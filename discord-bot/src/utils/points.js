// Gang roster + weekly points (Sahara Cartel).
//
//   /add <rang> @user                    add someone to the gang (Angajat / Asociat / Membru)      leaders
//   /puncte da @user <tip> [cantitate]   give points (mină, task, prezență, organizat, bonus)      leaders
//   /puncte anuleaza <id>                undo an entry from this week                              leaders
//   /profil [@user]                      rank, time in the gang, this week, last weeks             everyone (private)
//   /clasament [saptamana]               standings for this week or a past week                    everyone (private)
//   /banda lista | rang | scoate | concediu | config
//
// Rules in short:
//  - Ranks: Angajat (no limit) < Asociat (limited seats) < Membru (limited seats).
//  - A week runs Monday 00:00 -> Sunday 23:59 (Europe/Bucharest by default). Sunday night the bot archives it,
//    resets the points, counts "weeks under the threshold" and posts the standings.
//  - To HOLD Asociat/Membru you need the weekly threshold of that rank. Missing it `toleranta` weeks in a row
//    (default 2) drops you one rank. A promotion needs the target rank's threshold for `saptamani_promovare` weeks
//    (default 2) AND a free seat. Leave (/banda concediu) and the week you joined or changed rank never count.
//  - Voice time counts 1 minute per minute while you are with at least one other person, not deafened, not in AFK.
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const adminlog = require('./adminlog');
const { zonedToUtc, validTz } = require('./timeparse');

// ---- storage (own file, atomic writes) ------------------------------------

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'points.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadAll() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (err) {
    if (err.code !== 'ENOENT') { try { fs.renameSync(FILE, `${FILE}.bak`); console.warn('points: data file was corrupt, moved to points.json.bak'); } catch { /* ignore */ } }
    return { guilds: {} };
  }
}
const db = loadAll();
db.guilds ||= {};
let dirty = false;
const touch = () => { dirty = true; };
function flush() {
  if (!dirty) return;
  dirty = false;
  try { const tmp = `${FILE}.tmp`; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, FILE); }
  catch (err) { dirty = true; console.error('points: save failed:', err.message); }
}

// ---- constants ------------------------------------------------------------

const RANKS = ['angajat', 'asociat', 'membru'];
const RANK_NAME = { angajat: 'Angajat', asociat: 'Asociat', membru: 'Membru' };
const RANK_CHOICES = RANKS.map((r) => ({ name: RANK_NAME[r], value: r }));
const TYPES = {
  mina: 'Mină', task: 'Task', prezenta: 'Prezență eveniment', organizat: 'Eveniment organizat', voice: 'Voice', bonus: 'Bonus',
};
const TYPE_CHOICES = [
  { name: 'Mină', value: 'mina' }, { name: 'Task', value: 'task' }, { name: 'Prezență la eveniment', value: 'prezenta' },
  { name: 'Eveniment organizat', value: 'organizat' }, { name: 'Bonus / penalizare (puncte directe)', value: 'bonus' },
];
const DAY = 86400000;

const DEFAULTS = () => ({
  tz: 'Europe/Bucharest',
  values: { mina: 10, task: 10, prezenta: 5, organizat: 15, voice: 2 }, // voice = points per hour
  caps: { voice: 40 }, // max points per week from a type (0/none = unlimited)
  slots: { asociat: 4, membru: 10 },
  prag: { asociat: 60, membru: 100 },
  toleranta: 2, promoWeeks: 2, autoDemote: true,
  channelId: null, leaderRoleIds: [],
});

function G(guildId) {
  const d = (db.guilds[guildId] ||= { cfg: DEFAULTS(), members: {}, week: null, archive: [], nextId: 1 });
  const def = DEFAULTS();
  d.cfg = { ...def, ...d.cfg, values: { ...def.values, ...d.cfg.values }, caps: { ...def.caps, ...d.cfg.caps }, slots: { ...def.slots, ...d.cfg.slots }, prag: { ...def.prag, ...d.cfg.prag } };
  return d;
}

// ---- weeks ----------------------------------------------------------------

function localParts(ts, tz) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day };
}

// Monday 00:00 .. next Monday 00:00 (in tz) around ts
function weekBounds(ts, tz) {
  const { y, m, d } = localParts(ts, tz);
  const back = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // days since Monday
  const start = zonedToUtc(y, m, d - back, 0, 0, tz);
  const end = zonedToUtc(y, m, d - back + 7, 0, 0, tz);
  // ISO week number from the Thursday of this week
  const thu = new Date(Date.UTC(y, m - 1, d - back + 3));
  const jan1 = Date.UTC(thu.getUTCFullYear(), 0, 1);
  const no = Math.ceil(((thu.getTime() - jan1) / DAY + 1) / 7);
  return { start, end, no, year: thu.getUTCFullYear(), key: `${thu.getUTCFullYear()}-W${String(no).padStart(2, '0')}` };
}

function newWeek(ts, tz) {
  const b = weekBounds(ts, tz);
  return { key: b.key, no: b.no, year: b.year, start: b.start, end: b.end, entries: [], voice: {} };
}

// ---- totals ---------------------------------------------------------------

function totalsOf(d, week) {
  const out = {};
  const get = (u) => (out[u] ||= { byType: {}, total: 0 });
  for (const e of week.entries) { const t = get(e.user); t.byType[e.type] = (t.byType[e.type] || 0) + e.pts; }
  for (const [u, min] of Object.entries(week.voice)) { const t = get(u); t.byType.voice = Math.floor((min * d.cfg.values.voice) / 60); t.voiceMin = min; }
  for (const t of Object.values(out)) {
    let sum = 0;
    for (const [type, pts] of Object.entries(t.byType)) {
      const cap = d.cfg.caps[type];
      const v = cap > 0 ? Math.min(pts, cap) : pts;
      t.byType[type] = v; sum += v;
    }
    t.total = Math.max(0, sum);
  }
  return out;
}
const pointsOf = (d, week, uid) => totalsOf(d, week)[uid]?.total || 0;

const countRank = (d, rank) => Object.values(d.members).filter((m) => m.rank === rank).length;
const seatsLeft = (d, rank) => (rank === 'angajat' ? Infinity : Math.max(0, (d.cfg.slots[rank] || 0) - countRank(d, rank)));
const seatText = (d, rank) => (rank === 'angajat' ? `${countRank(d, rank)}` : `${countRank(d, rank)}/${d.cfg.slots[rank]}`);

// can `uid` be promoted to `target` based on the closed weeks?
function eligible(d, uid, target) {
  const need = d.cfg.promoWeeks, pr = d.cfg.prag[target];
  if (!pr) return { ok: true };
  const weeks = d.archive.slice(-need);
  if (weeks.length < need) return { ok: false, reason: `Sunt necesare ${need} săptămâni încheiate; sunt doar ${weeks.length} în arhivă.` };
  const bad = weeks.filter((w) => (w.totals[uid]?.t || 0) < pr);
  if (bad.length) {
    const list = weeks.map((w) => `S${w.no}: ${w.totals[uid]?.t || 0}`).join(', ');
    return { ok: false, reason: `Pentru ${RANK_NAME[target]} sunt necesare ${pr} puncte pe săptămână, ${need} săptămâni la rând (${list}).` };
  }
  return { ok: true };
}

// ---- Discord helpers ------------------------------------------------------

const cleanName = (n) => String(n || '').replace(/[^\p{L}\s-]/gu, '').trim();
const LEADER_RE = /^(co[\s-]?)?lider$/i;

function isAdmin(i) { return !!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild); }
function isLeader(i, d) {
  if (isAdmin(i)) return true;
  const roles = i.member?.roles;
  const ids = Array.isArray(roles) ? roles : [...(roles?.cache?.keys?.() ?? [])];
  return ids.some((id) => d.cfg.leaderRoleIds.includes(id) || LEADER_RE.test(cleanName(i.guild?.roles.cache.get(id)?.name)));
}

async function syncRoles(guild, uid, rank) {
  try {
    if (!guild.roles.cache.size) await guild.roles.fetch().catch(() => {});
    const member = await guild.members.fetch(uid).catch(() => null);
    if (!member) return;
    const byName = (r) => guild.roles.cache.find((x) => cleanName(x.name).toLowerCase() === RANK_NAME[r].toLowerCase());
    const roles = Object.fromEntries(RANKS.map((r) => [r, byName(r)]));
    const remove = RANKS.filter((r) => r !== rank).map((r) => roles[r]).filter((r) => r && member.roles.cache.has(r.id));
    if (remove.length) await member.roles.remove(remove, 'Rang bandă').catch(() => {});
    if (rank && roles[rank] && !member.roles.cache.has(roles[rank].id)) await member.roles.add(roles[rank], 'Rang bandă').catch(() => {});
  } catch (err) { console.warn('points: role sync failed:', err.message); }
}

const unix = (ms) => Math.floor(ms / 1000);
const bar = (v, m) => { const n = Math.max(0, Math.min(10, Math.round((10 * v) / (m || 1)))); return '█'.repeat(n) + '░'.repeat(10 - n); };
const days = (from, now = Date.now()) => Math.max(0, Math.floor((now - from) / DAY));
const NOPING = { parse: [] };
const COLOR = 0x8a5a2b;
const parseIds = (s) => [...String(s || '').matchAll(/<@!?(\d+)>/g)].map((m) => m[1]);

function ensureWeekNow(d) {
  if (!d.week) { d.week = newWeek(Date.now(), d.cfg.tz); touch(); }
  return d.week;
}

// ---- commands -------------------------------------------------------------

const addCmd = new SlashCommandBuilder().setName('add').setDescription('Adaugă pe cineva în bandă (lider)').setContexts(0)
  .addStringOption((o) => o.setName('rang').setDescription('Rangul').setRequired(true).addChoices(...RANK_CHOICES))
  .addUserOption((o) => o.setName('user').setDescription('Cine').setRequired(true));

const pointsCmd = new SlashCommandBuilder().setName('puncte').setDescription('Puncte pentru activități (lider)').setContexts(0)
  .addSubcommand((s) => s.setName('da').setDescription('Dă puncte')
    .addUserOption((o) => o.setName('user').setDescription('Cine').setRequired(true))
    .addStringOption((o) => o.setName('tip').setDescription('Activitatea').setRequired(true).addChoices(...TYPE_CHOICES))
    .addIntegerOption((o) => o.setName('cantitate').setDescription('De câte ori (la Bonus: numărul de puncte, poate fi negativ)').setMinValue(-500).setMaxValue(500))
    .addStringOption((o) => o.setName('nota').setDescription('Motiv (apare în log)').setMaxLength(100))
    .addStringOption((o) => o.setName('si').setDescription('Încă alte persoane: @a @b @c (primesc la fel)')))
  .addSubcommand((s) => s.setName('anuleaza').setDescription('Anulează o intrare din săptămâna asta')
    .addIntegerOption((o) => o.setName('id').setDescription('Numărul intrării (îl vezi la /puncte da)').setRequired(true).setMinValue(1)));

const profileCmd = new SlashCommandBuilder().setName('profil').setDescription('Rang, vechime și puncte').setContexts(0)
  .addUserOption((o) => o.setName('user').setDescription('Altcineva (altfel ești tu)'));

const boardCmd = new SlashCommandBuilder().setName('clasament').setDescription('Clasamentul săptămânii').setContexts(0)
  .addIntegerOption((o) => o.setName('saptamana').setDescription('Numărul săptămânii (altfel cea curentă)').setMinValue(1).setMaxValue(53));

const gangCmd = (() => {
  const b = new SlashCommandBuilder().setName('banda').setDescription('Membrii benzii, ranguri, concedii și setări').setContexts(0);
  b.addSubcommand((s) => s.setName('lista').setDescription('Cine e în bandă, pe ranguri'));
  b.addSubcommand((s) => s.setName('rang').setDescription('Schimbă rangul cuiva (lider)')
    .addUserOption((o) => o.setName('user').setDescription('Cine').setRequired(true))
    .addStringOption((o) => o.setName('rang').setDescription('Rangul nou').setRequired(true).addChoices(...RANK_CHOICES))
    .addBooleanOption((o) => o.setName('forta').setDescription('Ignoră condiția de puncte (doar admin)')));
  b.addSubcommand((s) => s.setName('scoate').setDescription('Scoate pe cineva din evidență (lider)')
    .addUserOption((o) => o.setName('user').setDescription('Cine').setRequired(true)));
  b.addSubcommand((s) => s.setName('concediu').setDescription('Concediu: săptămânile astea nu dau avertismente (lider)')
    .addUserOption((o) => o.setName('user').setDescription('Cine').setRequired(true))
    .addIntegerOption((o) => o.setName('zile').setDescription('Câte zile (0 = îl oprești)').setRequired(true).setMinValue(0).setMaxValue(60)));
  const int = (name, desc, max = 1000) => (o) => o.setName(name).setDescription(desc).setMinValue(0).setMaxValue(max);
  b.addSubcommand((s) => s.setName('config').setDescription('Valori, praguri, locuri (admin). Fără opțiuni: arată setările')
    .addIntegerOption(int('mina', 'Puncte pe o mină'))
    .addIntegerOption(int('task', 'Puncte pe un task'))
    .addIntegerOption(int('prezenta', 'Puncte pe prezența la un eveniment'))
    .addIntegerOption(int('organizat', 'Puncte pentru un eveniment organizat'))
    .addIntegerOption(int('voice', 'Puncte pe oră de voice'))
    .addIntegerOption(int('plafon_voice', 'Maximum puncte din voice pe săptămână (0 = fără limită)'))
    .addIntegerOption(int('prag_membru', 'Puncte pe săptămână ca să rămâi/devii Membru'))
    .addIntegerOption(int('prag_asociat', 'Puncte pe săptămână ca să rămâi/devii Asociat'))
    .addIntegerOption(int('locuri_membru', 'Locuri de Membru', 100))
    .addIntegerOption(int('locuri_asociat', 'Locuri de Asociat', 100))
    .addIntegerOption(int('toleranta', 'Câte săptămâni sub prag până la retrogradare', 10))
    .addIntegerOption(int('saptamani_promovare', 'Câte săptămâni peste prag pentru promovare', 10))
    .addBooleanOption((o) => o.setName('retrogradare').setDescription('Retrogradare automată după toleranță'))
    .addStringOption((o) => o.setName('fus').setDescription('Fusul orar al săptămânii, ex: Europe/Bucharest'))
    .addChannelOption((o) => o.setName('canal').setDescription('Canalul unde se postează clasamentul de duminică').addChannelTypes(ChannelType.GuildText))
    .addRoleOption((o) => o.setName('rol_lider').setDescription('Rolul Lider (dacă nu se numește „Lider”)'))
    .addRoleOption((o) => o.setName('rol_colider').setDescription('Rolul Co-Lider (dacă nu se numește „Co-Lider”)')));
  return b;
})();

const commands = [addCmd, pointsCmd, profileCmd, boardCmd, gangCmd];

// ---- command logic --------------------------------------------------------

const log = (client, guildId, title, text, userId) => adminlog.action(client, guildId, title, text, userId);

function addMember(d, uid, rank, now = Date.now()) {
  d.members[uid] = { rank, since: now, rankSince: now, strikes: 0, leaveUntil: 0, history: [{ rank, at: now }] };
  touch();
}

async function doAdd(i, client, d) {
  const rank = i.options.getString('rang', true), user = i.options.getUser('user', true);
  if (user.bot) return i.editReply('Nu pot adăuga un bot.');
  if (d.members[user.id]) return i.editReply(`${user} e deja în bandă ca **${RANK_NAME[d.members[user.id].rank]}**. Pentru schimbare folosește \`/banda rang\`.`);
  if (seatsLeft(d, rank) <= 0) return i.editReply(`Nu mai sunt locuri de **${RANK_NAME[rank]}** (${seatText(d, rank)}). Alege alt rang sau mărește locurile cu \`/banda config\`.`);
  addMember(d, user.id, rank);
  ensureWeekNow(d);
  await syncRoles(i.guild, user.id, rank);
  log(client, i.guildId, 'Membru adăugat', `${user} -> ${RANK_NAME[rank]}`, i.user.id);
  return i.editReply({ content: `${user} a intrat în bandă ca **${RANK_NAME[rank]}**. Locuri ${RANK_NAME[rank]}: ${seatText(d, rank)}.`, allowedMentions: NOPING });
}

async function doGive(i, client, d) {
  const week = ensureWeekNow(d);
  const type = i.options.getString('tip', true);
  const qty = i.options.getInteger('cantitate') ?? 1;
  const note = i.options.getString('nota') || '';
  const ids = [...new Set([i.options.getUser('user', true).id, ...parseIds(i.options.getString('si'))])].slice(0, 25);
  if (type !== 'bonus' && qty < 1) return i.editReply('La activități cantitatea trebuie să fie cel puțin 1. Pentru scăderi folosește **Bonus** cu un număr negativ.');
  if (type === 'bonus' && qty === 0) return i.editReply('La Bonus spune câte puncte (poate fi negativ).');
  const each = type === 'bonus' ? qty : d.cfg.values[type] * qty;
  const lines = [];
  for (const uid of ids) {
    if (!d.members[uid]) { lines.push(`<@${uid}>: nu e în bandă (folosește \`/add\`)`); continue; }
    const before = pointsOf(d, week, uid);
    const id = d.nextId++;
    week.entries.push({ id, at: Date.now(), by: i.user.id, user: uid, type, qty, pts: each, note });
    const after = pointsOf(d, week, uid);
    touch();
    const capped = type !== 'bonus' && d.cfg.caps[type] > 0 && after - before < each ? ` (limita de ${d.cfg.caps[type]} pe săptămână)` : '';
    lines.push(`<@${uid}>: **${after - before >= 0 ? '+' : ''}${after - before}**${capped}, acum ${after} (#${id})`);
    log(client, i.guildId, 'Puncte', `<@${uid}>: ${each >= 0 ? '+' : ''}${each} ${TYPES[type]}${qty > 1 && type !== 'bonus' ? ` x${qty}` : ''}${note ? ` (${note})` : ''} · #${id}`, i.user.id);
  }
  return i.editReply({ content: `${TYPES[type]}${type === 'bonus' ? '' : ` x${qty} = ${each} puncte`}\n${lines.join('\n')}`.slice(0, 1990), allowedMentions: NOPING });
}

async function doUndo(i, client, d) {
  const week = ensureWeekNow(d);
  const id = i.options.getInteger('id', true);
  const at = week.entries.findIndex((e) => e.id === id);
  if (at < 0) return i.editReply(`Nu găsesc intrarea #${id} în săptămâna asta (anularea merge doar pe săptămâna curentă).`);
  const [e] = week.entries.splice(at, 1);
  touch();
  log(client, i.guildId, 'Puncte anulate', `#${id}: <@${e.user}> ${e.pts >= 0 ? '+' : ''}${e.pts} ${TYPES[e.type]} (dat de <@${e.by}>)`, i.user.id);
  return i.editReply({ content: `Anulat #${id}: <@${e.user}> ${e.pts >= 0 ? '+' : ''}${e.pts} ${TYPES[e.type]}.`, allowedMentions: NOPING });
}

function weekHistory(d, uid, n = 6) {
  return d.archive.slice(-n).reverse().map((w) => ({ no: w.no, t: w.totals[uid]?.t ?? null, rank: w.ranks[uid] || null, prag: w.prag }));
}

function profileEmbed(d, guild, uid, user) {
  const m = d.members[uid], week = ensureWeekNow(d);
  const e = new EmbedBuilder().setColor(COLOR).setTitle(user?.displayName || user?.username || 'Profil');
  if (user?.displayAvatarURL) e.setThumbnail(user.displayAvatarURL());
  if (!m) return e.setDescription('Nu e în evidența benzii.');
  const t = totalsOf(d, week)[uid] || { total: 0, byType: {} };
  const prag = d.cfg.prag[m.rank] || 0;
  const parts = Object.entries(t.byType).filter(([, v]) => v).map(([k, v]) => `${TYPES[k]} ${v}`).join(' · ');
  e.addFields(
    { name: 'Rang', value: `**${RANK_NAME[m.rank]}** de ${days(m.rankSince)} zile (din <t:${unix(m.rankSince)}:D>)`, inline: true },
    { name: 'În bandă', value: `de ${days(m.since)} zile (din <t:${unix(m.since)}:D>)`, inline: true },
  );
  e.addFields({
    name: `Săptămâna S${week.no} (până duminică)`,
    value: prag
      ? `${bar(t.total, prag)} **${t.total}/${prag}**${t.total >= prag ? ' ✓' : ''}\n${parts || 'Încă nimic'}`
      : `**${t.total}** puncte\n${parts || 'Încă nimic'}`,
  });
  const hist = weekHistory(d, uid);
  if (hist.length) e.addFields({ name: 'Ultimele săptămâni', value: hist.map((h) => `S${h.no}: ${h.t ?? '-'}${h.rank && h.prag?.[h.rank] ? (h.t >= h.prag[h.rank] ? ' ✓' : ' ✗') : ''}`).join('\n') });
  const notes = [];
  if (m.strikes) notes.push(`${m.strikes}/${d.cfg.toleranta} săptămâni sub prag`);
  if (m.leaveUntil > Date.now()) notes.push(`concediu până <t:${unix(m.leaveUntil)}:D>`);
  if (notes.length) e.addFields({ name: 'Atenție', value: notes.join('\n') });
  const next = m.rank === 'angajat' ? 'asociat' : m.rank === 'asociat' ? 'membru' : null;
  if (next) {
    const el = eligible(d, uid, next);
    e.setFooter({ text: el.ok ? `Poate avansa la ${RANK_NAME[next]}${seatsLeft(d, next) ? '' : ' (nu sunt locuri libere)'}` : `Avansare: ${el.reason}` });
  }
  return e;
}

async function doProfile(i, d) {
  const user = i.options.getUser('user') || i.user;
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  const e = profileEmbed(d, i.guild, user.id, member || user);
  return i.editReply({ embeds: [e], allowedMentions: NOPING });
}

function boardEmbed(d, label, totals, ranks, prag) {
  const rows = Object.entries(ranks).map(([uid, rank]) => ({ uid, rank, t: totals[uid]?.t ?? totals[uid]?.total ?? 0 })).sort((a, b) => b.t - a.t);
  const lines = rows.slice(0, 40).map((r, k) => {
    const p = prag[r.rank] || 0;
    return `${String(k + 1).padStart(2)}. <@${r.uid}> **${r.t}** · ${RANK_NAME[r.rank]}${p ? (r.t >= p ? ' ✓' : ` (prag ${p})`) : ''}`;
  });
  return new EmbedBuilder().setColor(COLOR).setTitle(`Clasament ${label}`).setDescription(lines.join('\n').slice(0, 4000) || 'Nimeni în evidență încă.')
    .setFooter({ text: `Prag Membru ${prag.membru} · Asociat ${prag.asociat}` });
}

async function doBoard(i, d) {
  const week = ensureWeekNow(d);
  const n = i.options.getInteger('saptamana');
  if (n && n !== week.no) {
    const w = [...d.archive].reverse().find((x) => x.no === n);
    if (!w) return i.editReply(`Nu am săptămâna ${n} în arhivă. Disponibile: ${d.archive.map((x) => x.no).join(', ') || 'niciuna încă'}.`);
    return i.editReply({ embeds: [boardEmbed(d, `S${w.no} (încheiată)`, w.totals, w.ranks, w.prag)], allowedMentions: NOPING });
  }
  const totals = totalsOf(d, week);
  const ranks = Object.fromEntries(Object.entries(d.members).map(([u, m]) => [u, m.rank]));
  return i.editReply({ embeds: [boardEmbed(d, `S${week.no} (în curs)`, totals, ranks, d.cfg.prag)], allowedMentions: NOPING });
}

async function doList(i, d) {
  const e = new EmbedBuilder().setColor(COLOR).setTitle('Sahara Cartel');
  for (const r of [...RANKS].reverse()) {
    const rows = Object.entries(d.members).filter(([, m]) => m.rank === r).sort((a, b) => a[1].rankSince - b[1].rankSince);
    e.addFields({
      name: `${RANK_NAME[r]} (${seatText(d, r)})`,
      value: rows.map(([u, m]) => `<@${u}> · ${days(m.since)}z${m.leaveUntil > Date.now() ? ' · concediu' : ''}`).join('\n').slice(0, 1000) || '-',
    });
  }
  return i.editReply({ embeds: [e], allowedMentions: NOPING });
}

async function doRank(i, client, d) {
  const user = i.options.getUser('user', true), rank = i.options.getString('rang', true);
  const force = !!i.options.getBoolean('forta');
  const m = d.members[user.id];
  if (!m) return i.editReply(`${user} nu e în bandă. Folosește \`/add\`.`);
  if (m.rank === rank) return i.editReply(`${user} e deja ${RANK_NAME[rank]}.`);
  if (force && !isAdmin(i)) return i.editReply('Opțiunea „forță” e doar pentru admini.');
  if (seatsLeft(d, rank) <= 0) return i.editReply(`Nu mai sunt locuri de **${RANK_NAME[rank]}** (${seatText(d, rank)}).`);
  const up = RANKS.indexOf(rank) > RANKS.indexOf(m.rank);
  if (up && !force) {
    const el = eligible(d, user.id, rank);
    if (!el.ok) return i.editReply(`${user} nu poate avansa la ${RANK_NAME[rank]}. ${el.reason}`);
  }
  const from = m.rank;
  m.rank = rank; m.rankSince = Date.now(); m.strikes = 0; m.history.push({ rank, at: m.rankSince });
  touch();
  await syncRoles(i.guild, user.id, rank);
  log(client, i.guildId, up ? 'Promovare' : 'Retrogradare', `${user}: ${RANK_NAME[from]} -> ${RANK_NAME[rank]}${force ? ' (forțat)' : ''}`, i.user.id);
  return i.editReply({ content: `${user}: ${RANK_NAME[from]} -> **${RANK_NAME[rank]}**.`, allowedMentions: NOPING });
}

async function doRemove(i, client, d) {
  const user = i.options.getUser('user', true);
  const m = d.members[user.id];
  if (!m) return i.editReply(`${user} nu e în evidență.`);
  delete d.members[user.id];
  touch();
  await syncRoles(i.guild, user.id, null);
  log(client, i.guildId, 'Scos din bandă', `${user} (era ${RANK_NAME[m.rank]}, ${days(m.since)} zile)`, i.user.id);
  return i.editReply({ content: `${user} a fost scos din evidență. Săptămânile vechi rămân în arhivă.`, allowedMentions: NOPING });
}

async function doLeave(i, client, d) {
  const user = i.options.getUser('user', true), n = i.options.getInteger('zile', true);
  const m = d.members[user.id];
  if (!m) return i.editReply(`${user} nu e în bandă.`);
  m.leaveUntil = n ? Date.now() + n * DAY : 0;
  touch();
  log(client, i.guildId, 'Concediu', `${user}: ${n ? `${n} zile` : 'oprit'}`, i.user.id);
  return i.editReply({ content: n ? `${user} e în concediu ${n} zile; săptămânile acoperite nu dau avertismente.` : `Concediul lui ${user} s-a oprit.`, allowedMentions: NOPING });
}

function configText(d) {
  const c = d.cfg, v = c.values;
  return [
    `**Puncte**: mină ${v.mina} · task ${v.task} · prezență ${v.prezenta} · eveniment organizat ${v.organizat} · voice ${v.voice}/oră (maxim ${c.caps.voice || 'fără limită'}/săptămână)`,
    `**Praguri/săptămână**: Membru ${c.prag.membru} · Asociat ${c.prag.asociat}`,
    `**Locuri**: Membru ${seatText(d, 'membru')} · Asociat ${seatText(d, 'asociat')}`,
    `**Toleranță**: ${c.toleranta} săptămâni sub prag, apoi ${c.autoDemote ? 'retrogradare automată' : 'doar avertisment (retrogradarea e manuală)'}`,
    `**Promovare**: ${c.promoWeeks} săptămâni peste pragul rangului țintă + loc liber`,
    `**Fus orar**: ${c.tz} · săptămâna se închide duminică la miezul nopții`,
    `**Clasament duminică**: ${c.channelId ? `<#${c.channelId}>` : 'nesetat (doar în adminlog)'}`,
    `**Lideri**: admini + roluri „Lider”/„Co-Lider”${c.leaderRoleIds.length ? ` + ${c.leaderRoleIds.map((r) => `<@&${r}>`).join(' ')}` : ''}`,
  ].join('\n');
}

async function doConfig(i, client, d) {
  const o = i.options, c = d.cfg, changed = [];
  const set = (name, fn) => { const v = o.get(name)?.value; if (v !== undefined && v !== null) { fn(v); changed.push(name); } };
  set('mina', (v) => { c.values.mina = v; }); set('task', (v) => { c.values.task = v; });
  set('prezenta', (v) => { c.values.prezenta = v; }); set('organizat', (v) => { c.values.organizat = v; });
  set('voice', (v) => { c.values.voice = v; }); set('plafon_voice', (v) => { c.caps.voice = v; });
  set('prag_membru', (v) => { c.prag.membru = v; }); set('prag_asociat', (v) => { c.prag.asociat = v; });
  set('locuri_membru', (v) => { c.slots.membru = v; }); set('locuri_asociat', (v) => { c.slots.asociat = v; });
  set('toleranta', (v) => { c.toleranta = Math.max(1, v); }); set('saptamani_promovare', (v) => { c.promoWeeks = Math.max(1, v); });
  set('retrogradare', (v) => { c.autoDemote = !!v; });
  let err = '';
  set('fus', (v) => { if (validTz(v.trim())) c.tz = v.trim(); else err = `Fus orar invalid: ${v}. `; });
  set('canal', (v) => { c.channelId = v; });
  const rl = o.getRole('rol_lider'), rc = o.getRole('rol_colider');
  if (rl || rc) { c.leaderRoleIds = [rl?.id, rc?.id].filter(Boolean); changed.push('roluri'); }
  if (changed.length) { touch(); log(client, i.guildId, 'Setări puncte', changed.join(', '), i.user.id); }
  return i.editReply({ content: `${err}${changed.length ? 'Salvat. Valorile noi se aplică de acum; punctele deja date rămân cum au fost.\n\n' : ''}${configText(d)}`.slice(0, 1990), allowedMentions: NOPING });
}

async function handleInteraction(i, client) {
  if (!i.isChatInputCommand?.() || !['add', 'puncte', 'profil', 'clasament', 'banda'].includes(i.commandName)) return false;
  if (!i.guildId) { await i.reply({ content: 'Doar pe server.', ephemeral: true }); return true; }
  const d = G(i.guildId);
  const sub = i.options.getSubcommand(false);
  const needsLeader = i.commandName === 'add' || i.commandName === 'puncte' || (i.commandName === 'banda' && ['rang', 'scoate', 'concediu'].includes(sub));
  const needsAdmin = i.commandName === 'banda' && sub === 'config';
  if ((needsAdmin && !isAdmin(i)) || (needsLeader && !isLeader(i, d))) {
    await i.reply({ content: needsAdmin ? 'Doar adminii pot schimba setările.' : 'Doar Liderul, Co-Liderul sau adminii pot folosi comanda asta.', ephemeral: true });
    return true;
  }
  await i.deferReply({ ephemeral: true });
  try {
    if (i.commandName === 'add') await doAdd(i, client, d);
    else if (i.commandName === 'puncte') await (sub === 'da' ? doGive(i, client, d) : doUndo(i, client, d));
    else if (i.commandName === 'profil') await doProfile(i, d);
    else if (i.commandName === 'clasament') await doBoard(i, d);
    else if (sub === 'lista') await doList(i, d);
    else if (sub === 'rang') await doRank(i, client, d);
    else if (sub === 'scoate') await doRemove(i, client, d);
    else if (sub === 'concediu') await doLeave(i, client, d);
    else await doConfig(i, client, d);
  } catch (err) {
    console.error('points error:', err);
    await i.editReply(`Nu a mers: ${err.message}`).catch(() => {});
  }
  flush();
  return true;
}

// ---- weekly close ---------------------------------------------------------

function findReportChannel(guild, d) {
  const saved = d.cfg.channelId && guild.channels.cache.get(d.cfg.channelId);
  if (saved) return saved;
  return guild.channels.cache.find((c) => c.type === ChannelType.GuildText && /(clasament|puncte)/i.test(c.name)) || null;
}

async function closeWeek(client, guild, d, now) {
  const week = d.week;
  const totals = totalsOf(d, week);
  const snap = { key: week.key, no: week.no, year: week.year, start: week.start, end: week.end, prag: { ...d.cfg.prag }, totals: {}, ranks: {} };
  for (const [uid, m] of Object.entries(d.members)) {
    snap.ranks[uid] = m.rank;
    snap.totals[uid] = { t: totals[uid]?.total || 0, b: totals[uid]?.byType || {} };
  }
  const warn = [], demoted = [], ok = [];
  for (const [uid, m] of Object.entries(d.members)) {
    const prag = d.cfg.prag[m.rank];
    if (!prag) continue; // Angajat has no threshold
    const t = snap.totals[uid].t;
    const excused = m.rankSince > week.start || m.leaveUntil > week.start;
    if (excused) continue;
    if (t >= prag) { m.strikes = 0; ok.push(uid); continue; }
    m.strikes += 1;
    if (m.strikes >= d.cfg.toleranta && d.cfg.autoDemote) {
      const from = m.rank;
      let to = RANKS[RANKS.indexOf(from) - 1];
      if (to !== 'angajat' && seatsLeft(d, to) <= 0) to = 'angajat';
      m.rank = to; m.rankSince = now; m.strikes = 0; m.history.push({ rank: to, at: now });
      demoted.push({ uid, from, to, t, prag });
      syncRoles(guild, uid, to);
    } else warn.push({ uid, t, prag, strikes: m.strikes });
  }
  d.archive.push(snap);
  if (d.archive.length > 120) d.archive.shift();
  d.week = newWeek(now, d.cfg.tz);
  touch();

  // suggestions: who could advance (checked on the freshly archived weeks)
  const promo = [];
  for (const [uid, m] of Object.entries(d.members)) {
    const next = m.rank === 'angajat' ? 'asociat' : m.rank === 'asociat' ? 'membru' : null;
    if (next && seatsLeft(d, next) > 0 && eligible(d, uid, next).ok) promo.push({ uid, next, t: snap.totals[uid].t });
  }
  promo.sort((a, b) => b.t - a.t);

  const top = Object.entries(snap.totals).sort((a, b) => b[1].t - a[1].t).slice(0, 10)
    .map(([uid, v], k) => `${k + 1}. <@${uid}> **${v.t}** · ${RANK_NAME[snap.ranks[uid]]}`);
  const e = new EmbedBuilder().setColor(COLOR).setTitle(`Clasament S${snap.no} (încheiată)`)
    .setDescription(top.join('\n') || 'Nimeni în evidență.');
  if (warn.length) e.addFields({ name: 'Sub prag', value: warn.map((w) => `<@${w.uid}> ${w.t}/${w.prag} (${w.strikes}/${d.cfg.toleranta})`).join('\n').slice(0, 1000) });
  if (demoted.length) e.addFields({ name: 'Retrogradați', value: demoted.map((x) => `<@${x.uid}> ${RANK_NAME[x.from]} -> ${RANK_NAME[x.to]} (${x.t}/${x.prag})`).join('\n').slice(0, 1000) });
  if (promo.length) e.addFields({ name: 'Pot avansa (au loc liber)', value: promo.slice(0, 10).map((p) => `<@${p.uid}> -> ${RANK_NAME[p.next]}`).join('\n') });
  e.addFields({ name: 'Locuri', value: `Membru ${seatText(d, 'membru')} · Asociat ${seatText(d, 'asociat')}` });
  e.setFooter({ text: `Săptămâna nouă: S${d.week.no}` });

  const ch = findReportChannel(guild, d);
  if (ch) await ch.send({ embeds: [e], allowedMentions: NOPING }).catch((err) => console.warn('points: could not post standings:', err.message));
  log(client, guild.id, `Săptămâna S${snap.no} închisă`, `${Object.keys(snap.totals).length} membri · ${demoted.length} retrogradați · ${warn.length} sub prag`);
}

function tickVoice(guild, d) {
  const week = d.week;
  if (!week) return;
  const byChannel = new Map();
  for (const vs of guild.voiceStates.cache.values()) {
    if (!vs.channelId || vs.member?.user?.bot || vs.channelId === guild.afkChannelId) continue;
    (byChannel.get(vs.channelId) || byChannel.set(vs.channelId, []).get(vs.channelId)).push(vs);
  }
  for (const list of byChannel.values()) {
    if (list.length < 2) continue; // alone in the channel: no points
    for (const vs of list) {
      if (vs.deaf || vs.selfDeaf || !d.members[vs.id]) continue;
      week.voice[vs.id] = (week.voice[vs.id] || 0) + 1;
      touch();
    }
  }
}

async function tick(client) {
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    const d = db.guilds[guild.id];
    if (!d || !Object.keys(d.members).length) continue;
    try {
      ensureWeekNow(d);
      if (now >= d.week.end) await closeWeek(client, guild, d, now);
      tickVoice(guild, d);
    } catch (err) { console.error('points tick:', err); }
  }
  flush();
}

function start(client) {
  setInterval(() => tick(client).catch((err) => console.error('points tick:', err)), 60_000).unref?.();
  tick(client).catch(() => {});
}

module.exports = { commands, handleInteraction, start, G, weekBounds, totalsOf, eligible, closeWeek, tickVoice, addMember, configText, touch, flush, _db: db };

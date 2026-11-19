// The Discord side: slash commands, delivery feed, rank-ups, convoy announcements and reminders, recruitment.
const { Client, GatewayIntentBits, Events, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { db, save, cfg } = require('./store');
const stats = require('./stats');
const trucky = require('./trucky');
const convoys = require('./convoys');

const BROWN = 0x8a5a2b, AMBER = 0xf2a03d, GREEN = 0x6fae5a, RED = 0xc4553b;
const km = (n) => `${Math.round(n).toLocaleString('ro-RO')} km`;
const money = (n, game) => `${Math.round(n).toLocaleString('ro-RO')} ${game === 'ATS' ? '$' : '€'}`;
const siteUrl = () => (process.env.WEB_URL || db.config.siteUrl || '').replace(/\/$/, '');
const web = (u) => (/^https?:\/\//.test(String(u || '')) ? String(u) : null);
const ts = (ms, f = 'F') => `<t:${Math.floor(ms / 1000)}:${f}>`;
const PERIOD = { week: 'săptămâna asta', month: 'luna asta', all: 'din toate timpurile' };

const commands = [
  new SlashCommandBuilder().setName('profil').setDescription('Profilul de șofer Diesel Union')
    .addUserOption((o) => o.setName('membru').setDescription('Al cui profil (implicit al tău)')),
  new SlashCommandBuilder().setName('top').setDescription('Clasamentul șoferilor')
    .addStringOption((o) => o.setName('perioada').setDescription('Perioada').addChoices({ name: 'Săptămâna asta', value: 'week' }, { name: 'Luna asta', value: 'month' }, { name: 'Total', value: 'all' }))
    .addStringOption((o) => o.setName('dupa').setDescription('După ce').addChoices({ name: 'Kilometri', value: 'km' }, { name: 'Venit', value: 'income' }, { name: 'Curse', value: 'jobs' })),
  new SlashCommandBuilder().setName('convoi').setDescription('Următorul convoi'),
  new SlashCommandBuilder().setName('aplica').setDescription('Cum intri în Diesel Union'),
  new SlashCommandBuilder().setName('portal').setDescription('Linkul către portal'),
];

function jobEmbed(j) {
  const e = new EmbedBuilder().setColor(BROWN).setAuthor({ name: j.driverName, iconURL: web(j.avatar) || undefined })
    .setTitle(`${j.from || '?'} → ${j.to || '?'}`.slice(0, 250))
    .setDescription([`**${j.cargo || 'Marfă'}**${j.mass ? ` · ${(j.mass / 1000).toFixed(1)} t` : ''}`, `${km(j.km)} · ${money(j.income, j.game)} · avarii ${j.dmg}%`, j.truck ? `Camion: ${j.truck}` : null].filter(Boolean).join('\n'))
    .setFooter({ text: `${j.game}${j.mp ? ` · ${j.server || 'TruckersMP'}` : ''}` }).setTimestamp(j.end || Date.now());
  if (siteUrl()) e.setURL(`${siteUrl()}/#/curse`);
  return e;
}
function convoyEmbed(c, title) {
  const e = new EmbedBuilder().setColor(AMBER).setTitle(`${title ? `${title}: ` : ''}${c.title}`.slice(0, 250))
    .setDescription([`${ts(c.start)} (${ts(c.start, 'R')})`, c.from || c.to ? `**Traseu:** ${c.from || '?'} → ${c.to || '?'}` : null, c.server ? `**Server:** ${c.server}` : null, c.meet ? `**Întâlnire:** ${c.meet}` : null, c.dlc ? `**DLC:** ${c.dlc}` : null, c.desc ? `\n${c.desc.slice(0, 1200)}` : null].filter(Boolean).join('\n'))
    .setFooter({ text: c.game });
  if (web(c.image)) e.setImage(c.image);
  if (siteUrl()) e.setURL(`${siteUrl()}/#/convoaie`);
  return e;
}

async function onCommand(i) {
  const n = i.commandName;
  if (n === 'portal') return i.reply({ content: siteUrl() ? `Portalul Diesel Union: ${siteUrl()}` : 'Adresa portalului nu e setată încă.', flags: MessageFlags.Ephemeral });
  if (n === 'aplica') return i.reply({ content: siteUrl() ? (cfg().recruitOpen ? `Aplică aici: ${siteUrl()}/#/aplica` : 'Recrutările sunt închise acum.') : 'Portalul nu are încă o adresă.', flags: MessageFlags.Ephemeral });
  if (n === 'profil') {
    const u = i.options.getUser('membru') || i.user;
    const tid = db.links[u.id];
    if (!tid) return i.reply({ content: u.id === i.user.id ? `Contul tău de Discord nu e legat de Trucky. Leagă-l din portal${siteUrl() ? `: ${siteUrl()}/#/cont` : ''}.` : `${u.username} nu și-a legat contul de Trucky.`, flags: MessageFlags.Ephemeral });
    const p = stats.profile(tid);
    if (!p) return i.reply({ content: 'Nu am găsit șoferul.', flags: MessageFlags.Ephemeral });
    const e = new EmbedBuilder().setColor(BROWN).setTitle(p.name).setThumbnail(web(p.avatar) || u.displayAvatarURL())
      .setDescription(`**${p.rank.name}**${p.role ? ` · ${p.role}` : ''}${p.rank.next ? `\nMai are ${km(p.rank.next.km - p.km)} până la ${p.rank.next.name}` : ''}`)
      .addFields({ name: 'Total', value: `${km(p.km)}\n${p.jobs} curse`, inline: true }, { name: 'Luna asta', value: `${km(p.month?.km || 0)}\n${p.month?.jobs || 0} curse`, inline: true }, { name: 'Avarii medii', value: `${p.avgDmg}%`, inline: true });
    if (siteUrl()) e.setURL(`${siteUrl()}/#/soferi/${p.id}`);
    return i.reply({ embeds: [e] });
  }
  if (n === 'top') {
    const per = i.options.getString('perioada') || 'month', by = i.options.getString('dupa') || 'km';
    const rows = stats.board(per, by).slice(0, 10);
    const fmt = (r) => (by === 'km' ? km(r.v) : by === 'jobs' ? `${r.v} curse` : `${Math.round(r.v).toLocaleString('ro-RO')} venit`);
    const e = new EmbedBuilder().setColor(BROWN).setTitle(`Clasament ${PERIOD[per]}`)
      .setDescription(rows.length ? rows.map((r, k) => `\`${String(k + 1).padStart(2)}\` **${r.name}**  ${fmt(r)}`).join('\n') : 'Nicio cursă încă în perioada asta.');
    if (siteUrl()) e.setURL(`${siteUrl()}/#/clasament`);
    return i.reply({ embeds: [e] });
  }
  if (n === 'convoi') {
    const next = convoys.list().find((c) => c.start > Date.now() - 1800_000);
    return i.reply(next ? { embeds: [convoyEmbed(convoys.pub(db.convoys.find((c) => c.id === next.id)), 'Următorul convoi')] } : { content: 'Nu e niciun convoi programat.', flags: MessageFlags.Ephemeral });
  }
}

function start() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const guild = () => (process.env.WEB_GUILD_ID && client.guilds.cache.get(process.env.WEB_GUILD_ID)) || client.guilds.cache.first();
  const channel = (id) => { const ch = id && client.channels.cache.get(id); return ch?.isTextBased?.() ? ch : null; };
  const post = (id, payload) => { const ch = channel(id); return ch ? ch.send(payload).catch((err) => console.warn('post:', err.message)) : null; };
  const dm = async (uid, payload) => { try { const u = await client.users.fetch(uid); await u.send(payload); return true; } catch { return false; } };

  // a finished delivery: feed message, and a shout when someone reaches a new rank
  trucky.on('job', (j, live) => {
    if (!client.isReady() || !live) return; // only fresh webhook deliveries, not the backfill
    post(cfg().jobsChannel, { embeds: [jobEmbed(j)] });
    const total = db.jobs.filter((x) => x.driver === j.driver && x.status === 'completed' && x.km >= (cfg().minJobKm || 0)).reduce((a, x) => a + x.km, 0); // read the raw list: the new job is not saved yet
    const before = stats.rankFor(total - j.km), after = stats.rankFor(total);
    if (after.index > before.index) post(cfg().jobsChannel, { embeds: [new EmbedBuilder().setColor(AMBER).setTitle(`${j.driverName} a urcat în rang`).setDescription(`De acum e **${after.name}**, cu ${km(total)} parcurși cu Diesel Union.`)] });
  });

  async function tick(n) {
    try {
      await trucky.pollJobs(n === 0 ? 6 : 2).catch((err) => { db.sync.jobs = { at: Date.now(), ok: false, error: err.message }; });
      if (n % 6 === 0) await trucky.pollMembers().catch((err) => { db.sync.members = { at: Date.now(), ok: false, error: err.message }; });
      // convoy reminder an hour before: in the channel, and privately to everyone who said they come
      for (const c of db.convoys) {
        if (!c.reminded && c.start - Date.now() < 3600_000 && c.start > Date.now()) {
          c.reminded = true; save();
          post(cfg().convoyChannel, { content: 'Convoiul începe într-o oră.', embeds: [convoyEmbed(c)] });
          for (const uid of Object.keys(c.rsvp || {}).filter((u) => c.rsvp[u].status === 'yes')) await dm(uid, { content: `Convoiul **${c.title}** începe ${ts(c.start, 'R')}.`, embeds: [convoyEmbed(c)] });
        }
      }
    } catch (err) { console.error('tick:', err.message); }
  }

  client.once(Events.ClientReady, async (c) => {
    console.log(`Logged in as ${c.user.tag}`);
    try { const g = await c.application.commands.fetch(); if (g.size) await c.application.commands.set([]); } catch { /* ignore */ }
    for (const g of c.guilds.cache.values()) await g.commands.set(commands.map((x) => x.toJSON())).catch((err) => console.error(`commands in ${g.name}:`, err.message));
  });
  client.on(Events.GuildCreate, (g) => g.commands.set(commands.map((x) => x.toJSON())).catch(() => {}));
  client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    try { await onCommand(i); }
    catch (err) { console.error('command:', err); const msg = 'Ceva nu a mers. Mai încearcă o dată.'; if (i.deferred || i.replied) await i.editReply(msg).catch(() => {}); else await i.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {}); }
  });

  let n = 0;
  setTimeout(() => { tick(n++); setInterval(() => tick(n++), 5 * 60_000); }, 8000); // Trucky polling runs even if Discord is down

  return {
    client,
    async role(uid) { // 'admin' | 'staff' | null
      if (String(process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).includes(uid)) return 'admin';
      const g = guild(); if (!g) return null;
      if (g.ownerId === uid) return 'admin';
      try {
        const m = await g.members.fetch(uid);
        if (m.permissions.has(PermissionFlagsBits.ManageGuild)) return 'admin';
        if (process.env.STAFF_ROLE_ID && m.roles.cache.has(process.env.STAFF_ROLE_ID)) return 'staff';
      } catch { /* not on the server */ }
      return null;
    },
    channels() {
      const g = guild(), me = g?.members.me; if (!g || !me) return [];
      return [...g.channels.cache.values()].filter((c) => (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) && c.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]))
        .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name, group: c.parent?.name || '' }));
    },
    convoyAdded: (c) => post(cfg().convoyChannel, { embeds: [convoyEmbed(c, 'Convoi nou')] }),
    applied: (a) => post(cfg().staffChannel, { embeds: [new EmbedBuilder().setColor(BROWN).setTitle(`Aplicare nouă: ${a.name}`).setDescription(`<@${a.discord}> · ${a.age} ani · ${a.games.join(' și ')}\n\n${a.why.slice(0, 900)}`).setURL(siteUrl() ? `${siteUrl()}/#/staff` : null).setTimestamp(a.at)] }),
    decided: (a) => dm(a.discord, { embeds: [new EmbedBuilder().setColor(a.status === 'accepted' ? GREEN : RED)
      .setTitle(a.status === 'accepted' ? 'Bun venit în Diesel Union' : 'Aplicarea ta la Diesel Union')
      .setDescription(a.status === 'accepted' ? `Ai fost acceptat. Instalează Trucky și intră în compania Diesel Union ca să-ți fie numărate cursele.${a.note ? `\n\n${a.note}` : ''}` : `De data asta nu ai fost acceptat.${a.note ? `\n\n${a.note}` : ''}\nPoți aplica din nou peste o săptămână.`)] }),
    test: (id) => post(id, { embeds: [new EmbedBuilder().setColor(BROWN).setTitle('Test Diesel Union').setDescription('Botul poate scrie în canalul ăsta.')] }),
    login: () => client.login(process.env.DISCORD_TOKEN),
  };
}

module.exports = { start, commands, _onCommand: onCommand, jobEmbed, convoyEmbed };

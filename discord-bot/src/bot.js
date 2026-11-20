// The Discord side: slash commands, delivery feed, rank-ups, convoy announcements and reminders, recruitment.
const { Client, GatewayIntentBits, Events, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const media = require('./media');
const path = require('path');
const { db, save, cfg } = require('./store');
const stats = require('./stats');
const trucky = require('./trucky');
const convoys = require('./convoys');
const apply = require('./apply');
const G = require('./guild');
const X = require('./extras');

const BROWN = 0x8a5a2b, AMBER = 0xf2a03d, GREEN = 0x6fae5a, RED = 0xc4553b;
const km = (n) => `${Math.round(n).toLocaleString('en-GB')} km`;
const money = (n, game) => `${game === 'ATS' ? '$' : '€'}${Math.round(n).toLocaleString('en-GB')}`;
const siteUrl = () => (process.env.WEB_URL || db.config.siteUrl || '').replace(/\/$/, '');
const web = (u) => (/^https?:\/\//.test(String(u || '')) ? String(u) : null);
const ts = (ms, f = 'F') => `<t:${Math.floor(ms / 1000)}:${f}>`;
const PERIOD = { week: 'this week', month: 'this month', all: 'all time' };

const commands = [
  new SlashCommandBuilder().setName('profile').setDescription('A Diesel Union driver profile')
    .addUserOption((o) => o.setName('member').setDescription('Whose profile (yours by default)')),
  new SlashCommandBuilder().setName('top').setDescription('Driver leaderboard')
    .addStringOption((o) => o.setName('period').setDescription('Period').addChoices({ name: 'This week', value: 'week' }, { name: 'This month', value: 'month' }, { name: 'All time', value: 'all' }))
    .addStringOption((o) => o.setName('by').setDescription('Ranked by').addChoices({ name: 'Kilometres', value: 'km' }, { name: 'Income', value: 'income' }, { name: 'Jobs', value: 'jobs' })),
  new SlashCommandBuilder().setName('convoy').setDescription('The next convoy'),
  new SlashCommandBuilder().setName('apply').setDescription('Apply to join Diesel Union'),
  new SlashCommandBuilder().setName('loa').setDescription('Going away for a while? Tell the company (leave of absence)')
    .addIntegerOption((o) => o.setName('days').setDescription('How many days (0 = I am back)').setRequired(true).setMinValue(0).setMaxValue(90))
    .addStringOption((o) => o.setName('reason').setDescription('Optional').setMaxLength(300)),
  new SlashCommandBuilder().setName('link').setDescription('Link your Discord to your Diesel Union driver on Trucky')
    .addStringOption((o) => o.setName('steam').setDescription('Your Steam profile link or SteamID64 (the one you drive with)').setRequired(true).setMaxLength(120)),
  new SlashCommandBuilder().setName('unlink').setDescription('Unlink your Discord from your Trucky driver'),
  new SlashCommandBuilder().setName('linkdriver').setDescription('Staff: link a member to a Trucky driver').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((o) => o.setName('member').setDescription('The Discord member').setRequired(true))
    .addStringOption((o) => o.setName('driver').setDescription('Start typing the Trucky name (or paste a Steam link)').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('unlinkdriver').setDescription('Staff: remove the Trucky link of a member').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((o) => o.setName('member').setDescription('The Discord member').setRequired(true)),
  new SlashCommandBuilder().setName('setup').setDescription('Build or repair the Diesel Union channels, roles and panels').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((o) => o.setName('hide_others').setDescription('Also hide old channels that are not part of the layout from newcomers')),
  new SlashCommandBuilder().setName('verify').setDescription('Check a member\'s onboarding and give access when it is done').setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((o) => o.setName('member').setDescription('Who').setRequired(true))
    .addBooleanOption((o) => o.setName('force').setDescription('Give access now, even if the steps are not done')),
  new SlashCommandBuilder().setName('portal').setDescription('Link to the company portal'),
];

function jobEmbed(j) {
  const e = new EmbedBuilder().setColor(BROWN).setAuthor({ name: j.driverName, iconURL: web(j.avatar) || undefined })
    .setTitle(`${j.from || '?'} → ${j.to || '?'}`.slice(0, 250))
    .setDescription([`**${j.cargo || 'Cargo'}**${j.mass ? ` · ${(j.mass / 1000).toFixed(1)} t` : ''}`, `${km(j.km)} · ${money(j.income, j.game)} · damage ${j.dmg}%`, j.truck ? `Truck: ${j.truck}` : null].filter(Boolean).join('\n'))
    .setFooter({ text: `${j.game}${j.mp ? ` · ${j.server || 'TruckersMP'}` : ''}` }).setTimestamp(j.end || Date.now());
  if (siteUrl()) e.setURL(`${siteUrl()}/#/curse`);
  return e;
}
const slotLine = (c) => {
  const s = convoys.slotsOf(c), n = (k) => (s[k].length ? s[k].join(', ') : 'open');
  const going = Object.values(s).reduce((a, x) => a + x.length, 0);
  return `**Lead:** ${n('lead')} · **Tail:** ${n('tail')}\n**Road Guard:** ${n('guard')}\n**Going:** ${going}`;
};
function convoyEmbed(c, title) {
  const e = new EmbedBuilder().setColor(AMBER).setTitle(`${title ? `${title}: ` : ''}${c.title}`.slice(0, 250))
    .setDescription([`${ts(c.start)} (${ts(c.start, 'R')})`, c.from || c.to ? `**Route:** ${c.from || '?'} → ${c.to || '?'}` : null, c.server ? `**Server:** ${c.server}` : null, c.meet ? `**Meeting point:** ${c.meet}` : null, c.dlc ? `**DLC:** ${c.dlc}` : null, `\n${slotLine(c)}`, c.desc ? `\n${c.desc.slice(0, 1200)}` : null].filter(Boolean).join('\n'))
    .setFooter({ text: c.game });
  if (siteUrl()) e.setURL(`${siteUrl()}/#/convoaie`);
  return e;
}
// an embed with its picture: our own uploads go along as an attachment, links are used as they are
function withImage(e, image) {
  const f = media.file(image);
  if (f) { const name = `image${path.extname(f)}`; e.setImage(`attachment://${name}`); return { embeds: [e], files: [new AttachmentBuilder(f, { name })] }; }
  if (web(image)) e.setImage(image);
  return { embeds: [e], files: [] };
}
const linkButton = (url, label) => (/^https?:\/\//.test(url || '') ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(String(label || 'Open link').slice(0, 80)))] : []);
function convoyMsg(c, title) {
  const btns = [];
  if (/^https?:\/\//.test(c.link || '')) btns.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(c.link).setLabel('Event page'));
  if (siteUrl()) btns.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`${siteUrl()}/#/convoaie`).setLabel('RSVP on the website'));
  return { ...withImage(convoyEmbed(c, title), c.image), components: btns.length ? [new ActionRowBuilder().addComponents(btns)] : [] };
}

async function onCommand(i) {
  const n = i.commandName;
  if (n === 'portal') return i.reply({ content: siteUrl() ? `Diesel Union portal: ${siteUrl()}` : 'The portal address is not set yet.', flags: MessageFlags.Ephemeral });
  if (n === 'profile') {
    const u = i.options.getUser('member') || i.user;
    const tid = db.links[u.id];
    if (!tid) return i.reply({ content: u.id === i.user.id ? `Your Discord account is not linked to Trucky. Link it on the portal${siteUrl() ? `: ${siteUrl()}/#/cont` : ''}.` : `${u.username} has not linked their Trucky account.`, flags: MessageFlags.Ephemeral });
    const p = stats.profile(tid);
    if (!p) return i.reply({ content: 'Driver not found.', flags: MessageFlags.Ephemeral });
    const e = new EmbedBuilder().setColor(BROWN).setTitle(p.name).setThumbnail(web(p.avatar) || u.displayAvatarURL())
      .setDescription(`**${p.rank.name}**${p.role ? ` · ${p.role}` : ''}${p.rank.next ? `\n${km(p.rank.next.km - p.km)} to ${p.rank.next.name}` : ''}`)
      .addFields({ name: 'All time', value: `${km(p.km)}\n${p.jobs} jobs`, inline: true }, { name: 'This month', value: `${km(p.month?.km || 0)}\n${p.month?.jobs || 0} jobs`, inline: true }, { name: 'Average damage', value: `${p.avgDmg}%`, inline: true });
    const conv = X.attended(u.id), crowns = X.dotmCount(tid);
    e.addFields({ name: 'Convoys attended', value: String(conv), inline: true }, { name: 'Driver of the Month', value: crowns ? `🏆 × ${crowns}` : 'Not yet', inline: true });
    if (siteUrl()) e.setURL(`${siteUrl()}/#/soferi/${p.id}`);
    return i.reply({ embeds: [e] });
  }
  if (n === 'top') {
    const per = i.options.getString('period') || 'month', by = i.options.getString('by') || 'km';
    const rows = stats.board(per, by).slice(0, 10);
    const fmt = (r) => (by === 'km' ? km(r.v) : by === 'jobs' ? `${r.v} jobs` : `${Math.round(r.v).toLocaleString('en-GB')} income`);
    const e = new EmbedBuilder().setColor(BROWN).setTitle(`Leaderboard, ${PERIOD[per]}`)
      .setDescription(rows.length ? rows.map((r, k) => `\`${String(k + 1).padStart(2)}\` **${r.name}**  ${fmt(r)}`).join('\n') : 'No jobs in this period yet.');
    if (siteUrl()) e.setURL(`${siteUrl()}/#/clasament`);
    return i.reply({ embeds: [e] });
  }
  if (n === 'convoy') {
    const next = convoys.list().find((c) => c.start > Date.now() - 1800_000);
    return i.reply(next ? convoyMsg(db.convoys.find((c) => c.id === next.id), 'Next convoy') : { content: 'No convoy is planned.', flags: MessageFlags.Ephemeral });
  }
}

// ---- application form (Discord) ----
const drafts = new Map(); // uid -> answers, kept 30 minutes so a mistake does not wipe the form
function applyModal(uid) {
  const d = drafts.get(uid)?.b || {};
  const input = (id, label, style, ph, req, max, val) => { const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(req).setMaxLength(max).setPlaceholder(ph); if (val) t.setValue(String(val).slice(0, max)); return new ActionRowBuilder().addComponents(t); };
  return new ModalBuilder().setCustomId('du:applym').setTitle('Diesel Union application').addComponents(
    input('steam', 'Steam profile link or SteamID64', TextInputStyle.Short, 'https://steamcommunity.com/profiles/7656119…', true, 120, d.steam),
    input('tmp', 'TruckersMP profile link or ID', TextInputStyle.Short, 'https://truckersmp.com/user/…', true, 80, d.tmp),
    input('age', 'How old are you?', TextInputStyle.Short, '18', true, 3, d.age),
    input('hours', 'How many hours do you have in ETS2?', TextInputStyle.Short, 'About 400 hours', true, 60, d.hours),
    input('why', 'Tell us about yourself. Why Diesel Union?', TextInputStyle.Paragraph, 'At least 30 characters', true, 1000, d.why));
}
function appEmbed(a) {
  const st = { pending: ['Pending', BROWN], accepted: ['Accepted', GREEN], rejected: ['Declined', RED] }[a.status] || ['?', BROWN];
  const tmp = /^\d+$/.test(a.tmp || '') ? `https://truckersmp.com/user/${a.tmp}` : a.tmp;
  return new EmbedBuilder().setColor(st[1]).setTitle(`Application: ${a.name}`).setThumbnail(web(a.avatar) || null)
    .addFields(
      { name: 'Discord', value: `<@${a.discord}>`, inline: true }, { name: 'Age', value: String(a.age), inline: true }, { name: 'ETS2 hours', value: (a.hours || '?').slice(0, 200), inline: true },
      { name: 'Steam', value: `https://steamcommunity.com/profiles/${a.steam}`, inline: false }, { name: 'TruckersMP', value: (tmp || 'not given').slice(0, 200), inline: false },
      { name: 'About them', value: a.why.slice(0, 1000) },
      { name: 'Status', value: `${st[0]}${a.by ? ` by ${a.by}` : ''}${a.note ? `\n${a.note}` : ''}${a.onboarded ? `\nAccess granted ${ts(a.onboarded, 'R')}` : ''}${a.trucky ? `\n${a.trucky}` : ''}`.slice(0, 1000) })
    .setFooter({ text: `ID ${a.id} · from ${a.src === 'discord' ? 'Discord' : 'the website'}` }).setTimestamp(a.at);
}
const appButtons = (a) => (a.status === 'pending' ? [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`du:acc:${a.id}`).setStyle(ButtonStyle.Success).setLabel('Accept'),
  new ButtonBuilder().setCustomId(`du:dec:${a.id}`).setStyle(ButtonStyle.Danger).setLabel('Decline'))] : []);

function start() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const guild = () => (process.env.WEB_GUILD_ID && client.guilds.cache.get(process.env.WEB_GUILD_ID)) || client.guilds.cache.first();
  const channel = (id) => { const ch = id && client.channels.cache.get(id); return ch?.isTextBased?.() ? ch : null; };
  const post = (id, payload) => { const ch = channel(id); return ch ? ch.send(payload).catch((err) => { console.warn('post:', err.message); return null; }) : null; };
  const dm = async (uid, payload) => { try { const u = await client.users.fetch(uid); await u.send(payload); return true; } catch { return false; } };
  const member = async (uid) => { const g = guild(); if (!g) return null; try { return await g.members.fetch(uid); } catch { return null; } };
  const botlog = (text) => post(G.ch('botLogs'), { content: text.slice(0, 1900), allowedMentions: { parse: [] } });
  const welcomeChannel = () => G.ch('newDrivers') || cfg().jobsChannel;
  const promoChannel = () => G.ch('promotions') || G.ch('newDrivers') || cfg().jobsChannel;

  async function role(uid) { // 'admin' | 'staff' | null
    if (String(process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).includes(uid)) return 'admin';
    const g = guild(); if (!g) return null;
    if (g.ownerId === uid) return 'admin';
    const m = await member(uid); if (!m) return null;
    if (m.permissions.has(PermissionFlagsBits.ManageGuild)) return 'admin';
    if (G.staffRoleIds().some((r) => m.roles.cache.has(r))) return 'staff';
    return null;
  }

  // ---- applications ----
  async function logApp(a) {
    const m = await post(cfg().staffChannel, { content: G.roleId('staff') ? `<@&${G.roleId('staff')}> new application` : 'New application', embeds: [appEmbed(a)], components: appButtons(a), allowedMentions: { roles: [G.roleId('staff')].filter(Boolean) } });
    if (m) { a.log = { c: m.channelId, m: m.id }; save(); }
  }
  async function refreshLog(a) {
    const c = a.log && channel(a.log.c); if (!c) return;
    const m = await c.messages.fetch(a.log.m).catch(() => null);
    if (m) await m.edit({ content: m.content, embeds: [appEmbed(a)], components: appButtons(a) }).catch(() => {});
  }
  async function decided(a) {
    if (a.status === 'accepted') {
      const gm = await member(a.discord), ap = G.roleId('approved');
      if (gm && ap) await gm.roles.add(ap, 'Application accepted').catch((err) => botlog(`⚠️ Could not give Approved to <@${a.discord}>: ${err.message}`));
      if (process.env.TRUCKY_TOKEN && !a.trucky) { const t = await trucky.addDriver(a.steam, a.name).catch(() => ({ msg: 'Trucky add failed.' })); a.trucky = t.msg; save(); }
      const sent = await dm(a.discord, { embeds: [new EmbedBuilder().setColor(GREEN).setTitle('You are accepted into Diesel Union').setDescription(`${a.note ? `${a.note}\n\n` : ''}${G.setupSteps()}`)], components: [G.linkRow(G.links())] });
      if (G.ch('setup')) { const m = await post(G.ch('setup'), { content: `<@${a.discord}> you are accepted. Follow the steps above.${sent ? '' : ' (Your DMs are closed, so everything is here.)'}`, allowedMentions: { users: [a.discord] } }); if (m) setTimeout(() => m.delete().catch(() => {}), 15 * 60_000); }
      botlog(`✅ ${a.name} (<@${a.discord}>) accepted by ${a.by}.${sent ? '' : ' DM closed.'}`);
      setTimeout(() => onboard(a.discord).catch(() => {}), 4000); // they may already be in the company on Trucky
    } else {
      await dm(a.discord, { embeds: [new EmbedBuilder().setColor(RED).setTitle('Your Diesel Union application').setDescription(`You were not accepted this time.${a.note ? `\n\n**Reason:** ${a.note}` : ''}\n\nYou can apply again in a week.`)] });
      botlog(`❌ ${a.name} (<@${a.discord}>) declined by ${a.by}${a.note ? `: ${a.note}` : ''}.`);
    }
    await refreshLog(a);
  }

  // ---- onboarding: give access once the steps are done ----
  const busy = new Set();
  async function onboard(uid, { force = false } = {}) {
    if (busy.has(uid)) return { done: false, text: 'Already checking, try again in a moment.' };
    busy.add(uid);
    try {
      const gm = await member(uid), mem = G.roleId('member'), ap = G.roleId('approved');
      if (!gm) return { done: false, text: 'That person is not on the server.' };
      if (!mem) return { done: false, text: 'The server is not set up yet: an admin has to run /setup.' };
      const p = await G.progress(uid), hasAp = !!ap && gm.roles.cache.has(ap);
      if (gm.roles.cache.has(mem)) { if (p.driver && !db.links[uid]) { db.links[uid] = p.driver.id; save(); } await G.syncRank(gm); return { done: true, already: true, p, text: 'Already has access.' }; }
      const list = G.checklist(p, hasAp);
      if (!force) {
        if (!(p.accepted || hasAp)) return { done: false, p, text: `${list}\n\nThe application is not accepted yet.` };
        if (!p.driver || !p.web || p.tmp === false) return { done: false, p, text: list };
      }
      if (p.driver) {
        const other = Object.entries(db.links).find(([d, t]) => t === p.driver.id && d !== uid);
        if (other && !force) return { done: false, p, text: `${list}\n\nThat Trucky driver is already linked to another Discord account. Ask staff.` };
        if (!other) db.links[uid] = p.driver.id;
      }
      if (p.app) p.app.onboarded = Date.now();
      save();
      await gm.roles.add(mem, 'Diesel Union onboarding done');
      if (hasAp) await gm.roles.remove(ap).catch(() => {});
      const rank = await G.syncRank(gm);
      const w = await post(welcomeChannel(), { content: `Please welcome <@${uid}> to the 🤎 **Diesel Union Family** 🤎 as a driver! 🚛 We wish you a nice time here!`, allowedMentions: { users: [uid] } });
      if (w) for (const e of ['🤎', '🚛', '👋', '🎉']) await w.react(e).catch(() => {});
      await dm(uid, { embeds: [new EmbedBuilder().setColor(GREEN).setTitle('Welcome to Diesel Union').setDescription(`Everything is done and the whole server is open for you.${rank ? ` You start as **${rank}**.` : ''}\n\nDrive with Trucky running and your jobs show up in the logbook. See you on the road.`)] });
      botlog(`🟢 Access granted to <@${uid}>${p.driver ? ` (Trucky: ${p.driver.name})` : ''}${force ? ' by staff, forced' : ''}.`);
      if (p.app) refreshLog(p.app);
      return { done: true, p, text: `${list}\n\n**All done. Welcome to Diesel Union!**` };
    } catch (err) {
      console.warn('onboard:', err.message);
      return { done: false, text: `Could not give the role: ${err.message}. The bot's role has to be above the Diesel Union roles.` };
    } finally { busy.delete(uid); }
  }
  // everyone accepted but not in yet (after a member sync)
  async function onboardPending() {
    const recent = db.applications.filter((a) => a.status === 'accepted' && !a.onboarded && Date.now() - a.decided < 60 * 86400_000);
    for (const a of recent) await onboard(a.discord).catch(() => {});
  }
  let lastMemberPoll = 0;
  async function freshMembers() { if (Date.now() - lastMemberPoll < 60_000) return; lastMemberPoll = Date.now(); await trucky.pollMembers().catch(() => {}); }

  // a finished delivery: logbook post, and a promotion (with the role) when someone reaches a new rank
  trucky.on('job', (j, live) => {
    if (!client.isReady() || !live || j.game !== 'ETS2') return; // only fresh ETS2 webhook deliveries, not the backfill
    post(cfg().jobsChannel, { embeds: [jobEmbed(j)] });
    const total = db.jobs.filter((x) => x.driver === j.driver && x.status === 'completed' && x.game === 'ETS2' && x.km >= (cfg().minJobKm || 0)).reduce((a, x) => a + x.km, 0); // read the raw list: the new job is not saved yet
    const before = stats.rankFor(total - j.km), after = stats.rankFor(total);
    if (after.index > before.index) {
      const uid = Object.keys(db.links).find((d) => db.links[d] === j.driver);
      const roleId = G.roleId(`rank:${G.tierOf(after.name)}`);
      post(promoChannel(), { content: uid ? `<@${uid}>` : undefined, allowedMentions: { users: uid ? [uid] : [] }, embeds: [new EmbedBuilder().setColor(AMBER).setTitle(`🎉 ${j.driverName} is now ${after.name}`).setDescription(`Promoted to ${roleId && G.tierOf(after.name) === after.name ? `<@&${roleId}>` : `**${after.name}**`}${roleId && G.tierOf(after.name) !== after.name && G.tierOf(after.name) !== G.tierOf(before.name) ? `, new tier <@&${roleId}>` : ''} with ${km(total)} driven for Diesel Union. Congratulations!${after.next ? `\nNext: **${after.next.name}** at ${km(after.next.km)}.` : ''}`)] });
      if (uid) setTimeout(() => member(uid).then((gm) => gm && G.syncRank(gm)).catch(() => {}), 1500); // after the job is saved
    }
  });
  trucky.on('cancel', (j, live) => {
    if (!client.isReady() || !live || j.game !== 'ETS2' || !G.ch('canceled')) return;
    post(G.ch('canceled'), { embeds: [new EmbedBuilder().setColor(RED).setAuthor({ name: j.driverName, iconURL: web(j.avatar) || undefined }).setTitle(`Cancelled: ${j.from || '?'} → ${j.to || '?'}`.slice(0, 250)).setDescription(`${j.cargo || 'Cargo'}${j.km ? ` · ${km(j.km)} driven` : ''}`).setFooter({ text: j.game }).setTimestamp(j.end || Date.now())] });
  });
  // the company on Trucky: joining finishes onboarding, leaving removes access
  trucky.on('member', (ev, m) => {
    if (!client.isReady()) return;
    if (ev === 'user_joined_company' || ev === 'application_accepted') {
      const uid = Object.keys(db.links).find((d) => db.links[d] === m.id) || db.applications.find((a) => a.status === 'accepted' && a.steam && a.steam === m.steam)?.discord;
      if (uid) setTimeout(() => onboard(uid).catch(() => {}), 1000);
    }
    if ((ev === 'member_left' || ev === 'member_kicked') && cfg().autoRemove !== false) {
      const uid = Object.keys(db.links).find((d) => db.links[d] === m.id); if (!uid) return;
      member(uid).then(async (gm) => {
        if (!gm) return;
        const drop = [G.roleId('member'), ...G.rankRoleIds()].filter((r) => r && gm.roles.cache.has(r));
        if (drop.length) await gm.roles.remove(drop, 'Left Diesel Union on Trucky').catch(() => {});
        botlog(`🔴 <@${uid}> (${m.name}) ${ev === 'member_kicked' ? 'was removed from' : 'left'} the company on Trucky. Access removed.`);
      }).catch(() => {});
    }
  });

  // Monday: last week's top drivers
  async function weekly() {
    const ws = stats.startOf('week'), c = G.ch('weekly');
    if (!c || db.sync.weekly === ws || Date.now() < ws + 9 * 3600_000) return;
    db.sync.weekly = ws; save();
    const by = new Map();
    for (const j of stats.done()) if (j.end >= ws - 7 * 86400_000 && j.end < ws) { const r = by.get(j.driver) || { name: j.driverName, km: 0, jobs: 0 }; r.km += j.km; r.jobs++; by.set(j.driver, r); }
    const rows = [...by.entries()].sort((a, b) => b[1].km - a[1].km).slice(0, 10);
    if (!rows.length) return;
    const medal = ['🥇', '🥈', '🥉'], total = [...by.values()].reduce((a, r) => a + r.km, 0);
    const line = ([id, r], k) => { const uid = Object.keys(db.links).find((d) => db.links[d] === id); return `${medal[k] || `\`${k + 1}.\``} **${r.name}**${uid ? ` (<@${uid}>)` : ''}  ${km(r.km)} · ${r.jobs} jobs`; };
    post(c, { allowedMentions: { parse: [] }, embeds: [new EmbedBuilder().setColor(AMBER).setTitle('🏆 Top drivers of last week').setDescription(`${rows.map(line).join('\n')}\n\nThe company drove **${km(total)}** together. Well done, everyone.`).setTimestamp()] });
  }

  async function tick(n) {
    try {
      await trucky.pollJobs(n === 0 ? 6 : 2).catch((err) => { db.sync.jobs = { at: Date.now(), ok: false, error: err.message }; });
      if (n % 6 === 0) {
        await trucky.pollMembers().catch((err) => { db.sync.members = { at: Date.now(), ok: false, error: err.message }; });
        if (client.isReady()) {
          await onboardPending();
          // rank roles for everyone with access
          for (const uid of Object.keys(db.links)) { const gm = await member(uid); if (gm && G.roleId('member') && gm.roles.cache.has(G.roleId('member'))) await G.syncRank(gm).catch(() => {}); }
        }
      }
      if (client.isReady()) { await weekly(); await driverOfMonth(); await photoOfWeek(); await inactivity(); }
      // convoy reminder an hour before: in the channel, and privately to everyone who said they come
      for (const c of db.convoys) {
        if (!c.reminded && !c.draft && c.start - Date.now() < 3600_000 && c.start > Date.now()) {
          c.reminded = true; save();
          post(cfg().convoyChannel, { content: 'The convoy starts in one hour.', ...convoyMsg(c) });
          for (const uid of Object.keys(c.rsvp || {}).filter((u) => c.rsvp[u].status === 'yes')) await dm(uid, { content: `The convoy **${c.title}** starts ${ts(c.start, 'R')}.`, ...convoyMsg(c) });
        }
      }
    } catch (err) { console.error('tick:', err.message); }
  }

  // ---- interactions ----
  const eph = (content, extra = {}) => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] }, ...extra });
  async function openApply(i) {
    const mem = G.roleId('member');
    if (mem && i.member?.roles?.cache?.has?.(mem)) return i.reply(eph('You are already a Diesel Union driver.'));
    const no = apply.canApply(i.user.id); if (no) return i.reply(eph(no));
    return i.showModal(applyModal(i.user.id));
  }
  async function onButton(i) {
    const [, what, id] = i.customId.split(':');
    if (what === 'apply') return openApply(i);
    if (what === 'applyok') {
      const d = drafts.get(i.user.id); if (!d) return i.update({ content: 'The form expired. Press Apply again.', components: [] });
      const r = apply.submit({ id: i.user.id, name: i.user.globalName || i.user.username, avatar: i.user.displayAvatarURL({ size: 128 }) }, { ...d.b, rules: true });
      if (!r.ok) return i.update({ content: r.msg, components: [] });
      r.item.src = 'discord'; save(); drafts.delete(i.user.id);
      await i.update({ content: '✅ **Application sent.** Staff will read it soon and you will get the answer in a DM, so keep your DMs from this server open.', components: [] });
      return logApp(r.item);
    }
    if (what === 'check') {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      let p = await G.progress(i.user.id);
      if (!p.driver) { await freshMembers(); }
      const r = await onboard(i.user.id);
      return i.editReply(r.done ? (r.already ? 'You already have access. 🤎' : r.text) : `${r.text}\n\nWhen a step is missing, do it and press the button again. It can take a few minutes after you join on Trucky.`);
    }
    if (what === 'acc' || what === 'dec') {
      if (!(await role(i.user.id))) return i.reply(eph('Only staff can decide applications.'));
      const a = db.applications.find((x) => x.id === id);
      if (!a || a.status !== 'pending') return i.reply(eph('That application has already been answered.'));
      if (what === 'dec') {
        return i.showModal(new ModalBuilder().setCustomId(`du:decm:${id}`).setTitle(`Decline ${a.name}`.slice(0, 45)).addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('note').setLabel('Reason (sent to them)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500))));
      }
      await i.deferUpdate();
      const r = apply.decide(id, { name: i.user.globalName || i.user.username }, true, '');
      if (r.ok) await decided(r.item);
      return i.followUp(eph(r.msg));
    }
  }
  async function onModal(i) {
    const [, what, id] = i.customId.split(':');
    if (what === 'applym') {
      const f = (k) => i.fields.getTextInputValue(k);
      const b = { steam: f('steam'), tmp: f('tmp'), age: f('age'), why: f('why'), hours: f('hours') };
      await i.deferReply({ flags: MessageFlags.Ephemeral }); // looking up a custom Steam link can take a moment
      const steamId = await apply.resolveSteam(b.steam); if (steamId) b.steam = steamId;
      drafts.set(i.user.id, { b, at: Date.now() }); setTimeout(() => { if (Date.now() - (drafts.get(i.user.id)?.at || 0) >= 30 * 60_000) drafts.delete(i.user.id); }, 30 * 60_000 + 1000);
      const v = apply.validate({ id: i.user.id, name: i.user.username }, { ...b, rules: true });
      const again = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('du:apply').setStyle(ButtonStyle.Primary).setLabel('Fix my answers'));
      if (!v.ok) return i.editReply({ content: `⚠️ ${v.msg}`, components: [again] });
      const rules = (cfg().discordRules || []).map((x, k) => `**${k + 1}.** ${x}`).join('\n').slice(0, 3000);
      return i.editReply({ content: `**Last step: the rules.**\n\n${rules}\n\nDo you accept them and the TruckersMP rules?`, components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('du:applyok').setStyle(ButtonStyle.Success).setLabel('I accept, send my application'), new ButtonBuilder().setCustomId('du:apply').setStyle(ButtonStyle.Secondary).setLabel('Edit answers'))] });
    }
    if (what === 'decm') {
      if (!(await role(i.user.id))) return i.reply(eph('Only staff can decide applications.'));
      const r = apply.decide(id, { name: i.user.globalName || i.user.username }, false, i.fields.getTextInputValue('note'));
      if (r.ok) await decided(r.item);
      return i.reply(eph(r.msg));
    }
  }
  // ---- linking a Discord account to a Trucky driver ----
  // driver: a Trucky driver ID, an exact Trucky name, or a Steam link / ID
  async function findDriver(v) {
    const s = String(v || '').trim(); if (!s) return null;
    if (db.members[s]) return db.members[s];
    const byName = Object.values(db.members).filter((m) => m.name?.toLowerCase() === s.toLowerCase());
    if (byName.length === 1) return byName[0];
    const steam = await apply.resolveSteam(s);
    if (steam) { let m = Object.values(db.members).find((x) => x.steam === steam); if (!m) { await freshMembers(); m = Object.values(db.members).find((x) => x.steam === steam); } return m || null; }
    return null;
  }
  async function linkDriver(uid, driver, by, { force = false } = {}) {
    if (!driver) return { ok: false, msg: 'That driver is not in Diesel Union on Trucky. Join the company on Trucky first; it can take a few minutes to show up.' };
    if (driver.left) return { ok: false, msg: `${driver.name} has left the company on Trucky.` };
    const other = Object.keys(db.links).find((d) => db.links[d] === driver.id && d !== uid);
    if (other && !force) return { ok: false, msg: `${driver.name} is already linked to another Discord account. Ask staff if that is a mistake.` };
    if (other) delete db.links[other];
    const had = db.links[uid]; db.links[uid] = driver.id; save();
    botlog(`🔗 <@${uid}> linked to Trucky driver **${driver.name}**${by ? ` by ${by}` : ''}${other ? ` (moved from <@${other}>)` : ''}${had && had !== driver.id ? ` (was ${db.members[had]?.name || had})` : ''}.`);
    const gm = await member(uid);
    let extra = '';
    if (gm) {
      const mem = G.roleId('member');
      if (mem && gm.roles.cache.has(mem)) { const rk = await G.syncRank(gm); if (rk) extra = ` Rank: **${rk}**.`; }
      else { const r = await onboard(uid).catch(() => null); if (r?.done) extra = ' All steps are done, so access was given too.'; }
    }
    return { ok: true, msg: `Linked to **${driver.name}** on Trucky.${extra}` };
  }
  function unlinkDriver(uid, by) {
    const t = db.links[uid]; if (!t) return { ok: false, msg: 'There is no Trucky link to remove.' };
    delete db.links[uid]; save();
    botlog(`⛓️ <@${uid}> unlinked from Trucky driver **${db.members[t]?.name || t}**${by ? ` by ${by}` : ''}.`);
    return { ok: true, msg: `Unlinked from ${db.members[t]?.name || 'the driver'}.` };
  }
  async function onAutocomplete(i) {
    const q = String(i.options.getFocused() || '').toLowerCase();
    const linked = new Set(Object.values(db.links));
    const list = Object.values(db.members).filter((m) => !m.left && (!q || m.name?.toLowerCase().includes(q) || m.id === q))
      .sort((a, b) => (linked.has(a.id) - linked.has(b.id)) || a.name.localeCompare(b.name)).slice(0, 25);
    return i.respond(list.map((m) => ({ name: `${m.name}${linked.has(m.id) ? ' (already linked)' : ''}`.slice(0, 100), value: m.id }))).catch(() => {});
  }

  async function onAdminCommand(i) {
    if (i.commandName === 'link') {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const d = await findDriver(i.options.getString('steam'));
      if (!d && !(await apply.resolveSteam(i.options.getString('steam')))) return i.editReply('We could not find that Steam profile. Paste your profile link, like steamcommunity.com/id/yourname or steamcommunity.com/profiles/7656119…');
      return i.editReply((await linkDriver(i.user.id, d, null)).msg);
    }
    if (i.commandName === 'unlink') return i.reply(eph(unlinkDriver(i.user.id, null).msg));
    if (i.commandName === 'linkdriver' || i.commandName === 'unlinkdriver') {
      if (!(await role(i.user.id))) return i.reply(eph('Only staff can do that.'));
      const u = i.options.getUser('member'), by = i.member?.displayName || i.user.username;
      if (i.commandName === 'unlinkdriver') return i.reply(eph(unlinkDriver(u.id, by).msg));
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await linkDriver(u.id, await findDriver(i.options.getString('driver')), by, { force: true });
      return i.editReply(`<@${u.id}>: ${r.msg}`);
    }
    if (i.commandName === 'apply') return openApply(i);
    if (i.commandName === 'setup') {
      if ((await role(i.user.id)) !== 'admin') return i.reply(eph('Only admins can run /setup.'));
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const log = await G.setup(i.guild, { hideOthers: !!i.options.getBoolean('hide_others') });
        const made = log.filter((l) => l.startsWith('+')).length, warn = log.filter((l) => l.startsWith('!') || l.startsWith('~'));
        return i.editReply(`**Diesel Union is set up.** ${made ? `Created ${made} roles/channels, ` : ''}fixed permissions and posted the panels.\n${warn.length ? `\n${warn.join('\n')}\n` : ''}\nNext:\n• Give yourself **CEO**, and your team CEO, Co-CEO, Management, HR Team, Staff, Event Team or Media Team.\n• Give current drivers **Union Member** (or let them press Check my progress).\n• Put the Trucky join link in Website → Staff → Settings if the button goes to the wrong page.`.slice(0, 1990));
      } catch (err) { return i.editReply(`Setup stopped: ${err.message}`); }
    }
    if (i.commandName === 'loa') {
      const r = X.setLoa(i.user.id, i.member?.displayName || i.user.globalName || i.user.username, i.options.getInteger('days'), i.options.getString('reason'));
      if (r.item) post(G.ch('leave'), { allowedMentions: { parse: [] }, embeds: [new EmbedBuilder().setColor(AMBER).setTitle('📅 Leave of absence').setDescription(`<@${i.user.id}> is away until ${ts(r.item.until, 'D')} (${ts(r.item.until, 'R')}).${r.item.reason ? `\n**Reason:** ${r.item.reason}` : ''}`)] });
      else if (r.ended) post(G.ch('leave'), { allowedMentions: { parse: [] }, content: `✅ <@${i.user.id}> is back on the road.` });
      return i.reply(eph(r.msg));
    }
    if (i.commandName === 'verify') {
      if (!(await role(i.user.id))) return i.reply(eph('Only staff can use /verify.'));
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const u = i.options.getUser('member');
      await freshMembers();
      const r = await onboard(u.id, { force: !!i.options.getBoolean('force') });
      return i.editReply(`<@${u.id}>: ${r.done ? (r.already ? 'already has access (rank role synced).' : 'access granted.') : 'not finished yet.'}\n\n${r.text}`.slice(0, 1990));
    }
    return onCommand(i);
  }

  client.once(Events.ClientReady, async (c) => {
    console.log(`Logged in as ${c.user.tag}`);
    try { const g = await c.application.commands.fetch(); if (g.size) await c.application.commands.set([]); } catch { /* ignore */ }
    for (const g of c.guilds.cache.values()) await g.commands.set(commands.map((x) => x.toJSON())).catch((err) => console.error(`commands in ${g.name}:`, err.message));
    const g = guild(); if (g && db.config.panels) G.refreshPanels(g).catch(() => {}); // keep panels up to date after an update
  });
  client.on(Events.GuildCreate, (g) => g.commands.set(commands.map((x) => x.toJSON())).catch(() => {}));
  client.on(Events.InteractionCreate, async (i) => {
    try {
      if (i.isAutocomplete()) return await onAutocomplete(i);
      if (i.isChatInputCommand()) return await onAdminCommand(i);
      if (i.isButton() && i.customId.startsWith('du:')) return await onButton(i);
      if (i.isModalSubmit() && i.customId.startsWith('du:')) return await onModal(i);
    } catch (err) {
      console.error('interaction:', err);
      const msg = 'Something went wrong. Try again.';
      if (i.isAutocomplete?.()) return;
      if (i.deferred || i.replied) await i.followUp(eph(msg)).catch(() => {}); else await i.reply?.(eph(msg)).catch(() => {});
    }
  });

  // ---- automations ----
  async function runScheduled() {
    if (!client.isReady()) return;
    for (const x of X.due()) {
      X.unschedule(x.id);
      const out = await api.publish(x.p);
      if (out.ok) { db.posts.push({ id: x.id, ref: out.ref, channel: out.channelName, title: x.p.title || String(x.p.text || '').slice(0, 60), image: x.p.image, ping: x.p.ping, by: x.by, at: Date.now() }); save(); }
      else botlog(`⚠️ A scheduled post by ${x.by.name} could not be posted: ${out.msg}`);
    }
  }
  // 1st of the month, after 10:00: Driver of the Month
  async function driverOfMonth(force) {
    const m = X.lastMonth(); const key = m.to;
    if (!force && (db.sync.dotm === key || Date.now() < key + 10 * 3600_000)) return { ok: false, msg: 'Not due yet.' };
    db.sync.dotm = key; save();
    if (!m.winner) return { ok: false, msg: `Nobody drove in ${m.label}.` };
    if (!force && X.dotm()?.from === m.from) return { ok: false, msg: 'Already crowned.' };
    const prevUid = X.crown(m), uid = X.dotm().uid, rid = G.roleId('dotm');
    if (rid && prevUid && prevUid !== uid) { const gm = await member(prevUid); if (gm) await gm.roles.remove(rid).catch(() => {}); }
    if (rid && uid) { const gm = await member(uid); if (gm) await gm.roles.add(rid, 'Driver of the Month').catch(() => {}); }
    const runner = m.rows.slice(1, 3).map((r, k) => `${['🥈', '🥉'][k]} ${r.name}, ${km(r.km)}`).join('\n');
    await post(promoChannel(), { content: uid ? `<@${uid}>` : undefined, allowedMentions: { users: uid ? [uid] : [] }, embeds: [new EmbedBuilder().setColor(0xffd36b).setTitle(`🏆 Driver of the Month: ${m.winner.name}`)
      .setDescription(`**${km(m.winner.km)}** in ${m.winner.jobs} jobs during ${m.label}. Congratulations!${runner ? `\n\n${runner}` : ''}`)] });
    return { ok: true, msg: `${m.winner.name} is Driver of the Month for ${m.label}.` };
  }
  // Monday after 12:00: the photo with the most reactions in #convoy-photos last week
  async function photoOfWeek(force) {
    const ws = stats.startOf('week'), id = G.ch('convoyPhotos');
    if (!id || (!force && (db.sync.potw === ws || Date.now() < ws + 12 * 3600_000))) return { ok: false, msg: 'Not due yet.' };
    db.sync.potw = ws; save();
    const ch = channel(id); if (!ch) return { ok: false, msg: 'No #convoy-photos channel.' };
    const msgs = await ch.messages.fetch({ limit: 100 }).catch(() => null); if (!msgs) return { ok: false, msg: 'Could not read #convoy-photos.' };
    const from = ws - 7 * 86400_000, to = ws;
    const best = [...msgs.values()].filter((m) => !m.author.bot && m.createdTimestamp >= from && m.createdTimestamp < (force ? Date.now() : to))
      .map((m) => ({ m, n: m.reactions.cache.reduce((a, r) => a + r.count, 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
    if (!best) return { ok: false, msg: 'No photo got reactions last week.' };
    const img = best.m.attachments.find((a) => /^image\//.test(a.contentType || ''));
    const e = new EmbedBuilder().setColor(AMBER).setTitle('📸 Photo of the Week').setDescription(`By <@${best.m.author.id}>, with ${best.n} reactions. Well shot!`);
    if (img) e.setImage(img.url);
    await post(id, { embeds: [e], allowedMentions: { parse: [] }, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(best.m.url).setLabel('See the photo'))] });
    return { ok: true, msg: 'Photo of the Week posted.' };
  }
  // once a day: drivers with no delivery for 30 days get a friendly DM (once a month)
  async function inactivity(force) {
    const day = new Date().toISOString().slice(0, 10);
    if (!force && (db.sync.inactive === day || new Date().getUTCHours() < 17)) return { ok: false, msg: 'Not due yet.' };
    db.sync.inactive = day; save();
    const list = X.toWarn(); let sent = 0;
    for (const x of list) {
      const gm = await member(x.uid); if (!gm || !G.roleId('member') || !gm.roles.cache.has(G.roleId('member'))) continue;
      const ok = await dm(x.uid, { embeds: [new EmbedBuilder().setColor(AMBER).setTitle('We miss you on the road').setDescription(`Hey ${x.name}, you have not delivered anything for Diesel Union in ${x.days} days.\n\nAll good? If you are away for a while, use **/loa** on our server so we know. Otherwise, come drive with us at the next convoy!`)] });
      X.markWarned(x.uid); if (ok) sent++;
    }
    if (list.length) botlog(`🟡 Inactivity check: ${list.length} driver(s) with no job for ${X.INACTIVE_DAYS}+ days, ${sent} DM(s) sent. See the admin panel.`);
    return { ok: true, msg: `${list.length} inactive, ${sent} messaged.` };
  }
  // keep the convoy post in step with the RSVPs (slots), at most every 15 seconds per convoy
  const pending = new Map();
  function convoyRefresh(c) {
    if (!c?.post || pending.has(c.id)) return;
    pending.set(c.id, setTimeout(() => { pending.delete(c.id); api.convoyPost(c).catch(() => {}); }, 15_000));
  }

  let n = 0;
  setTimeout(() => { tick(n++); setInterval(() => tick(n++), 5 * 60_000); }, 8000); // Trucky polling runs even if Discord is down
  setInterval(() => runScheduled().catch((err) => console.warn('scheduled:', err.message)), 60_000);

  const api = {
    client, role, onboard, decided, convoyRefresh, driverOfMonth, photoOfWeek, inactivity, weekly: () => { db.sync.weekly = null; return weekly(); },
    async isMember(uid) {
      const ids = [G.roleId('member'), ...G.staffRoleIds()].filter(Boolean); if (!ids.length) return false;
      const m = await member(uid); return !!m && ids.some((r) => m.roles.cache.has(r));
    },
    channels() {
      const g = guild(), me = g?.members.me; if (!g || !me) return [];
      return [...g.channels.cache.values()].filter((c) => (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) && c.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]))
        .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name, group: c.parent?.name || '' }));
    },
    refreshPanels: () => { const g = guild(); return g && db.config.panels ? G.refreshPanels(g).catch(() => {}) : null; },
    // ---- panel: posts and convoys from the website ----
    async access(uid) { // what this person may do in the panel
      const r = await role(uid), gm = await member(uid), teams = gm ? G.teamsOf(gm) : [];
      const post = r === 'admin' || teams.includes('ceo') || teams.includes('coceo');
      return { role: r, teams, caps: { post, media: post || teams.includes('media'), events: post || !!r || teams.includes('events'), manage: post || !!r, ban: post || teams.includes('management') } };
    },
    mediaChannels: () => G.MEDIA_KEYS.map(G.ch).filter(Boolean),
    async publish(p) { // { channel, title, text, color, image, link, linkLabel, ping, plain }
      const ch = channel(p.channel); if (!ch) return { ok: false, msg: 'The bot cannot post in that channel.' };
      const pg = G.ping(p.ping);
      let payload;
      if (p.plain) {
        const f = media.file(p.image);
        payload = { content: [pg.content, p.title ? `**${p.title}**` : null, p.text, !f && web(p.image) ? p.image : null].filter(Boolean).join('\n').slice(0, 2000), files: f ? [new AttachmentBuilder(f, { name: `image${path.extname(f)}` })] : [] };
      } else {
        const e = new EmbedBuilder().setColor(p.color ?? BROWN);
        if (p.title) e.setTitle(p.title); if (p.text) e.setDescription(p.text);
        e.setFooter({ text: cfg().name }).setTimestamp();
        payload = { content: pg.content, ...withImage(e, p.image) };
      }
      payload.components = linkButton(p.link, p.linkLabel);
      payload.allowedMentions = pg.allowedMentions;
      if (!payload.content && !payload.embeds?.length && !payload.files?.length) return { ok: false, msg: 'Write something first.' };
      try { const m = await ch.send(payload); return { ok: true, ref: { c: ch.id, m: m.id }, channelName: ch.name }; }
      catch (err) { return { ok: false, msg: `Discord refused it: ${err.message}` }; }
    },
    async unpost(ref) {
      const ch = ref && channel(ref.c); if (!ch) return false;
      const m = await ch.messages.fetch(ref.m).catch(() => null); if (!m) return false;
      return m.delete().then(() => true).catch(() => false);
    },
    async convoyPost(c, ping) { // announce, or edit the announcement if it is already out
      if (c.post) {
        const ch = channel(c.post.c), m = ch && await ch.messages.fetch(c.post.m).catch(() => null);
        if (m) { await m.edit({ ...convoyMsg(c, 'Convoy'), attachments: [] }).catch((err) => console.warn('convoy edit:', err.message)); return c.post; }
      }
      const pg = G.ping(ping || c.ping);
      const m = await post(cfg().convoyChannel, { content: pg.content, allowedMentions: pg.allowedMentions, ...convoyMsg(c, 'New convoy') });
      if (m) { c.post = { c: m.channelId, m: m.id }; save(); }
      return c.post || null;
    },
    convoyAdded(c) { return api.convoyPost(c); },
    applied: (a) => logApp(a),
    test: (id) => post(id, { embeds: [new EmbedBuilder().setColor(BROWN).setTitle('Diesel Union test').setDescription('The bot can post in this channel.')] }),
    login: () => client.login(process.env.DISCORD_TOKEN),
    // admin panel actions on one member
    async grant(uid) { const r = await onboard(uid, { force: true }); return { ok: r.done, msg: r.done ? (r.already ? 'They already had access. Rank role synced.' : 'Access given.') : r.text.replace(/[*⬜✅]/g, '') }; },
    async link(uid, driver, by) { return linkDriver(uid, await findDriver(driver), by, { force: true }); },
    unlink: (uid, by) => unlinkDriver(uid, by),
    async revoke(uid) {
      const gm = await member(uid); if (!gm) return { ok: false, msg: 'That person is not on the Discord server.' };
      const drop = [G.roleId('member'), G.roleId('approved'), ...G.rankRoleIds()].filter((r) => r && gm.roles.cache.has(r));
      await gm.roles.remove(drop, 'Access removed from the admin panel').catch(() => {});
      botlog(`🔴 Access removed from <@${uid}> on the admin panel.`);
      return { ok: true, msg: 'Access removed.' };
    },
    async warn(uid) {
      const x = X.inactive().find((q) => q.uid === uid);
      const ok = await dm(uid, { embeds: [new EmbedBuilder().setColor(AMBER).setTitle('A word from Diesel Union staff').setDescription(`We have not seen you on the road${x ? ` for ${x.days} days` : ' for a while'}. All good? If you are away, use **/loa** on our server. Hope to see you at the next convoy!`)] });
      X.markWarned(uid);
      return ok ? { ok: true, msg: 'Message sent.' } : { ok: false, msg: 'Their DMs are closed.' };
    },
    async inGuild(uids) { const out = {}; const mem = G.roleId('member'); for (const u of uids) { const gm = await member(u); out[u] = gm ? (mem && gm.roles.cache.has(mem) ? 'member' : 'guest') : 'gone'; } return out; },
    // ---- moderation from the admin panel ----
    async findMembers(q) {
      const g = guild(); if (!g) return [];
      q = String(q || '').trim().slice(0, 40); if (!q) return [];
      let list = [];
      const id = q.match(/\d{15,25}/)?.[0];
      if (id) { const gm = await member(id); if (gm) list = [gm]; }
      else list = [...(await g.members.search({ query: q, limit: 12 }).catch(() => new Map())).values()];
      const ranks = new Set(G.rankRoleIds()), teams = new Set(G.staffRoleIds());
      return list.map((gm) => ({ uid: gm.id, name: gm.displayName, tag: gm.user.username, avatar: gm.user.displayAvatarURL({ size: 64 }), bot: gm.user.bot, joined: gm.joinedTimestamp,
        roles: gm.roles.cache.filter((r) => r.id !== g.id).sort((a, b) => b.position - a.position).map((r) => r.name).slice(0, 6),
        staff: [...gm.roles.cache.keys()].some((r) => teams.has(r)) || gm.permissions.has(PermissionFlagsBits.ManageGuild), rank: gm.roles.cache.find((r) => ranks.has(r.id))?.name || null,
        timeout: gm.communicationDisabledUntilTimestamp > Date.now() ? gm.communicationDisabledUntilTimestamp : null,
        history: (db.modlog || []).filter((x) => x.uid === gm.id).slice(-8).reverse() }));
    },
    async bans() {
      const g = guild(); if (!g) return [];
      const b = await g.bans.fetch().catch(() => null); if (!b) return [];
      return [...b.values()].slice(0, 200).map((x) => ({ uid: x.user.id, name: x.user.username, avatar: x.user.displayAvatarURL({ size: 64 }), reason: x.reason || '' }));
    },
    async moderate(action, uid, o, actor) { // actor: { id, name, role }
      const g = guild(); if (!g) return { ok: false, msg: 'The bot is not on a server.' };
      if (uid === g.ownerId || uid === client.user?.id) return { ok: false, msg: 'You cannot do that to this account.' };
      if (uid === actor.id) return { ok: false, msg: 'You cannot moderate yourself.' };
      const reason = String(o.reason || '').trim().slice(0, 400) || 'No reason given';
      const gm = await member(uid);
      if (gm && actor.role !== 'admin' && (G.staffRoleIds().some((r) => gm.roles.cache.has(r)) || gm.permissions.has(PermissionFlagsBits.ManageGuild))) return { ok: false, msg: 'Only server admins can moderate staff.' };
      const name = gm?.displayName || o.name || uid, audit = `${reason} (by ${actor.name}, admin panel)`;
      const tell = (title, extra = '') => dm(uid, { embeds: [new EmbedBuilder().setColor(RED).setTitle(title).setDescription(`**Reason:** ${reason}${extra}`).setFooter({ text: cfg().name })] });
      let msg;
      try {
        if (action === 'warn') { if (!gm) return { ok: false, msg: 'They are not on the server.' }; const sent = await tell('You received a warning from Diesel Union staff'); msg = sent ? `${name} was warned.` : `${name} was warned (their DMs are closed, it is only in the log).`; }
        else if (action === 'timeout') {
          if (!gm) return { ok: false, msg: 'They are not on the server.' };
          const min = Math.max(0, Math.min(40320, Math.round(Number(o.minutes)) || 0));
          if (!gm.moderatable) return { ok: false, msg: 'The bot cannot time them out. Its role must be above theirs.' };
          await gm.timeout(min ? min * 60_000 : null, audit);
          if (min) await tell('You were timed out on the Diesel Union server', `\n**Until:** ${ts(Date.now() + min * 60_000, 'f')}`);
          msg = min ? `${name} is timed out for ${min >= 1440 ? `${Math.round(min / 1440)} day(s)` : min >= 60 ? `${Math.round(min / 60)} hour(s)` : `${min} minutes`}.` : `${name}'s timeout was removed.`;
          o.minutes = min;
        }
        else if (action === 'kick') {
          if (!gm) return { ok: false, msg: 'They are not on the server.' };
          if (!gm.kickable) return { ok: false, msg: 'The bot cannot kick them. Its role must be above theirs.' };
          await tell('You were removed from the Diesel Union server'); await gm.kick(audit); msg = `${name} was kicked.`;
        }
        else if (action === 'ban') {
          if (gm && !gm.bannable) return { ok: false, msg: 'The bot cannot ban them. Its role must be above theirs.' };
          if (gm) await tell('You were banned from the Diesel Union server');
          const days = Math.max(0, Math.min(7, Math.round(Number(o.days)) || 0));
          await g.members.ban(uid, { reason: audit, deleteMessageSeconds: days * 86400 }); msg = `${name} was banned.`; o.days = days;
        }
        else if (action === 'unban') { await g.members.unban(uid, audit); msg = `${name} was unbanned.`; }
        else return { ok: false, msg: 'Unknown action.' };
      } catch (err) { return { ok: false, msg: `Discord refused: ${err.message}` }; }
      db.modlog = db.modlog || [];
      db.modlog.push({ id: Date.now().toString(36), action, uid, name, reason, minutes: o.minutes, days: o.days, by: actor.name, at: Date.now() });
      if (db.modlog.length > 1000) db.modlog.shift();
      save();
      const icon = { warn: '⚠️', timeout: '⏳', kick: '👢', ban: '🔨', unban: '♻️' }[action];
      botlog(`${icon} **${action}** <@${uid}> (${name}) by ${actor.name}: ${reason}${o.minutes ? ` · ${o.minutes} min` : ''}`);
      return { ok: true, msg };
    },
    async repair() { const g = guild(); if (!g) return { ok: false, msg: 'The bot is not on a server.' }; try { const log = await G.setup(g); return { ok: true, msg: `Discord server repaired. ${log.filter((l) => l.startsWith('+')).length} things created.`, log }; } catch (err) { return { ok: false, msg: err.message }; } },
  };
  return api;
}

module.exports = { start, commands, _onCommand: onCommand, jobEmbed, convoyEmbed, convoyMsg, appEmbed, applyModal };

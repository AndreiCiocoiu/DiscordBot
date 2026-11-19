// The Discord side: slash commands, delivery feed, rank-ups, convoy announcements and reminders, recruitment.
const { Client, GatewayIntentBits, Events, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { db, save, cfg } = require('./store');
const stats = require('./stats');
const trucky = require('./trucky');
const convoys = require('./convoys');
const apply = require('./apply');
const G = require('./guild');

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
function convoyEmbed(c, title) {
  const e = new EmbedBuilder().setColor(AMBER).setTitle(`${title ? `${title}: ` : ''}${c.title}`.slice(0, 250))
    .setDescription([`${ts(c.start)} (${ts(c.start, 'R')})`, c.from || c.to ? `**Route:** ${c.from || '?'} → ${c.to || '?'}` : null, c.server ? `**Server:** ${c.server}` : null, c.meet ? `**Meeting point:** ${c.meet}` : null, c.dlc ? `**DLC:** ${c.dlc}` : null, c.desc ? `\n${c.desc.slice(0, 1200)}` : null].filter(Boolean).join('\n'))
    .setFooter({ text: c.game });
  if (web(c.image)) e.setImage(c.image);
  if (siteUrl()) e.setURL(`${siteUrl()}/#/convoaie`);
  return e;
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
    return i.reply(next ? { embeds: [convoyEmbed(convoys.pub(db.convoys.find((c) => c.id === next.id)), 'Next convoy')] } : { content: 'No convoy is planned.', flags: MessageFlags.Ephemeral });
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
  const promoChannel = () => G.ch('newDrivers') || cfg().jobsChannel;

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
      const sent = await dm(a.discord, { embeds: [new EmbedBuilder().setColor(GREEN).setTitle('You are accepted into Diesel Union').setDescription(`${a.note ? `${a.note}\n\n` : ''}${G.setupSteps()}`)], components: [G.linkRow(G.links().filter(([n]) => n !== 'TruckersMP VTC'))] });
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
        if (!p.driver || !p.web) return { done: false, p, text: list };
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
      const w = await post(promoChannel(), { content: `Please welcome <@${uid}> to the 🤎 **Diesel Union Family** 🤎 as a driver! 🚛 We wish you a nice time here!`, allowedMentions: { users: [uid] } });
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
      const roleId = G.roleId(`rank:${after.name}`);
      post(promoChannel(), { content: uid ? `<@${uid}>` : undefined, allowedMentions: { users: uid ? [uid] : [] }, embeds: [new EmbedBuilder().setColor(AMBER).setTitle(`🎉 ${j.driverName} is now ${after.name}`).setDescription(`Promoted to ${roleId ? `<@&${roleId}>` : `**${after.name}**`} with ${km(total)} driven for Diesel Union. Congratulations!${after.next ? `\nNext: **${after.next.name}** at ${km(after.next.km)}.` : ''}`)] });
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
      if (client.isReady()) await weekly();
      // convoy reminder an hour before: in the channel, and privately to everyone who said they come
      for (const c of db.convoys) {
        if (!c.reminded && c.start - Date.now() < 3600_000 && c.start > Date.now()) {
          c.reminded = true; save();
          post(cfg().convoyChannel, { content: 'The convoy starts in one hour.', embeds: [convoyEmbed(c)] });
          for (const uid of Object.keys(c.rsvp || {}).filter((u) => c.rsvp[u].status === 'yes')) await dm(uid, { content: `The convoy **${c.title}** starts ${ts(c.start, 'R')}.`, embeds: [convoyEmbed(c)] });
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
      drafts.set(i.user.id, { b, at: Date.now() }); setTimeout(() => { if (Date.now() - (drafts.get(i.user.id)?.at || 0) >= 30 * 60_000) drafts.delete(i.user.id); }, 30 * 60_000 + 1000);
      const v = apply.validate({ id: i.user.id, name: i.user.username }, { ...b, rules: true });
      const again = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('du:apply').setStyle(ButtonStyle.Primary).setLabel('Fix my answers'));
      if (!v.ok) return i.reply(eph(`⚠️ ${v.msg}`, { components: [again] }));
      const rules = (cfg().discordRules || []).map((x, k) => `**${k + 1}.** ${x}`).join('\n').slice(0, 3000);
      return i.reply(eph(`**Last step: the rules.**\n\n${rules}\n\nDo you accept them and the TruckersMP rules?`, { components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('du:applyok').setStyle(ButtonStyle.Success).setLabel('I accept, send my application'), new ButtonBuilder().setCustomId('du:apply').setStyle(ButtonStyle.Secondary).setLabel('Edit answers'))] }));
    }
    if (what === 'decm') {
      if (!(await role(i.user.id))) return i.reply(eph('Only staff can decide applications.'));
      const r = apply.decide(id, { name: i.user.globalName || i.user.username }, false, i.fields.getTextInputValue('note'));
      if (r.ok) await decided(r.item);
      return i.reply(eph(r.msg));
    }
  }
  async function onAdminCommand(i) {
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
      if (i.isChatInputCommand()) return await onAdminCommand(i);
      if (i.isButton() && i.customId.startsWith('du:')) return await onButton(i);
      if (i.isModalSubmit() && i.customId.startsWith('du:')) return await onModal(i);
    } catch (err) {
      console.error('interaction:', err);
      const msg = 'Something went wrong. Try again.';
      if (i.deferred || i.replied) await i.followUp(eph(msg)).catch(() => {}); else await i.reply?.(eph(msg)).catch(() => {});
    }
  });

  let n = 0;
  setTimeout(() => { tick(n++); setInterval(() => tick(n++), 5 * 60_000); }, 8000); // Trucky polling runs even if Discord is down

  return {
    client, role, onboard, decided,
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
    convoyAdded: (c) => post(cfg().convoyChannel, { embeds: [convoyEmbed(c, 'New convoy')] }),
    applied: (a) => logApp(a),
    test: (id) => post(id, { embeds: [new EmbedBuilder().setColor(BROWN).setTitle('Diesel Union test').setDescription('The bot can post in this channel.')] }),
    login: () => client.login(process.env.DISCORD_TOKEN),
  };
}

module.exports = { start, commands, _onCommand: onCommand, jobEmbed, convoyEmbed, appEmbed, applyModal };

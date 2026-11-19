// The Discord server itself: the channel and role layout (/setup builds it), the panels the bot keeps
// in #apply, #finish-setup, #links, #ranks and #rules, the onboarding check that grants access, and rank roles.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits: P } = require('discord.js');
const { db, save, cfg } = require('./store');
const stats = require('./stats');
const { getJson } = require('./fetcher');

const BROWN = 0x8a5a2b, AMBER = 0xf2a03d, GREEN = 0x6fae5a;
const km = (n) => `${Math.round(n).toLocaleString('en-GB')} km`;
const siteUrl = () => (process.env.WEB_URL || db.config.siteUrl || '').replace(/\/$/, '');
const https = (u) => (/^https:\/\/[^\s]+$/.test(String(u || '')) ? String(u) : null);

// ---- layout ----
// access: gate = only people without access (newcomers) see it; approved = accepted, still finishing setup;
// member = drivers with access; staff = staff only. ro = read-only for everyone except staff and the bot.
const LAYOUT = [
  { cat: '🤎 Start Here 🤎', access: 'gate', channels: [
    { key: 'apply', name: '📝┃apply', ro: true, topic: 'Want to drive with Diesel Union? Press Apply below.' }] },
  { cat: '🤎 Finish Setup 🤎', access: 'approved', channels: [
    { key: 'setup', name: '✅┃finish-setup', ro: true, topic: 'You were accepted. Do the steps, then press Check my progress.' }] },
  { cat: '🤎 Truck Details 🤎', access: 'member', channels: [
    { key: 'tagInfo', name: '🏷┃tag-name-and-colour', ro: true, topic: 'How to write the Diesel Union tag and name in TruckersMP, and its colour.' },
    { key: 'truckInfo', name: '🚚┃truck-colour', ro: true, topic: 'The company truck colour.' },
    { key: 'trailerInfo', name: '🚛┃trailer-colour-and-livery', ro: true, topic: 'Trailer colour and the company livery.' }] },
  { cat: '🤎 Welcome to Diesel Union 🤎', access: 'member', channels: [
    { key: 'welcome', name: '👋┃welcome', ro: true },
    { key: 'rules', name: '📜┃discord-rules', ro: true },
    { key: 'ranks', name: '🏅┃ranks', ro: true, topic: 'Ranks are given automatically by total kilometres on Trucky.' },
    { key: 'links', name: '🔗┃diesel-links', ro: true, topic: 'Trucky, TruckersMP and the website.' }] },
  { cat: '🤎 Diesel Updates 🤎', access: 'member', channels: [
    { key: 'news', name: '📰┃vtc-news', ro: true, writers: ['media', 'events'] },
    { key: 'newDrivers', name: '🤎┃new-drivers-and-promotions', ro: true, topic: 'New drivers and rank promotions, posted by the bot.' }] },
  { cat: '🤎 Convoys & Events 🤎', access: 'member', channels: [
    { key: 'convoys', name: '🚛┃convoys', ro: true, writers: ['events'], topic: 'Upcoming convoys. RSVP on the website.' },
    { key: 'convoyPhotos', name: '📸┃convoy-photos' },
    { key: 'radio1', name: '📻 Convoy Radio 1', voice: true },
    { key: 'radio2', name: '📻 Convoy Radio 2', voice: true }] },
  { cat: '🤎 Logbook 🤎', access: 'member', channels: [
    { key: 'deliveries', name: '📦┃deliveries', ro: true, topic: 'Every delivery finished on Trucky, live.' },
    { key: 'canceled', name: '❌┃cancelled-jobs', ro: true, topic: 'Jobs cancelled on Trucky.' },
    { key: 'weekly', name: '🏆┃weekly-top', ro: true, topic: 'Top drivers of the week, every Monday.' }] },
  { cat: '🤎 Community 🤎', access: 'member', channels: [
    { key: 'generalRo', name: '🇷🇴┃general-romana', topic: 'Chat general, în română.' },
    { key: 'generalEn', name: '🇬🇧┃general-english', topic: 'General chat, in English.' },
    { key: 'screenshots', name: '📷┃screenshots' },
    { key: 'commands', name: '🤖┃bot-commands', topic: '/profile, /top, /convoy' },
    { key: 'lounge', name: '🔊 Lounge', voice: true }] },
  { cat: '🤎 Support 🤎', access: 'member', channels: [
    { key: 'help', name: '❓┃help' },
    { key: 'leave', name: '📅┃leave-of-absence', topic: 'Going away for a while? Tell us here.' }] },
  { cat: '🔒 Staff 🔒', access: 'staff', channels: [
    { key: 'applications', name: '🗂┃applications', topic: 'New applications. Accept or decline with the buttons.' },
    { key: 'staffChat', name: '💼┃staff-chat' },
    { key: 'botLogs', name: '🧾┃bot-logs', topic: 'Access granted, roles changed, drivers who left Trucky.' },
    { key: 'staffVoice', name: '🔊 Staff Meeting', voice: true }] },
];
// which channel keys the rest of the bot posts to
const FEEDS = { jobsChannel: 'deliveries', convoyChannel: 'convoys', staffChannel: 'applications' };

const RANK_COLORS = [0xa1887f, 0xc08a5a, 0xd4a373, 0xb5651d, 0xe9a25b, 0xffc061, 0xffd98a, 0xfff0c4];
const STAFF_PERMS = [P.ManageMessages, P.ModerateMembers, P.MuteMembers, P.MoveMembers, P.ManageThreads, P.ManageNicknames];
// the leadership and team roles, top to bottom. staff: true = can review applications, sees the Staff category and the staff pages on the website
const ROLE_DEFS = () => [
  { key: 'ceo', name: 'CEO', color: 0xffc94d, hoist: true, staff: true, perms: [P.Administrator] },
  { key: 'coceo', name: 'Co-CEO', color: 0xf5b041, hoist: true, staff: true, perms: [P.Administrator] },
  { key: 'management', name: 'Management', color: 0xe9a25b, hoist: true, staff: true, perms: [...STAFF_PERMS, P.KickMembers, P.BanMembers] },
  { key: 'hr', name: 'HR Team', color: 0xd98c4a, hoist: true, staff: true, perms: STAFF_PERMS },
  { key: 'events', name: 'Event Team', color: 0xc77d3a, hoist: true, perms: [P.MuteMembers, P.MoveMembers] },
  { key: 'media', name: 'Media Team', color: 0xb86b3a, hoist: true, perms: [] },
  { key: 'staff', name: 'Staff', color: 0xa65f33, hoist: true, staff: true, perms: STAFF_PERMS },
  // rank roles, highest first so they stack in the member list
  ...[...cfg().ranks].sort((a, b) => b.km - a.km).map((r, i, all) => ({ key: `rank:${r.name}`, name: r.name, color: RANK_COLORS[Math.min(all.length - 1 - i, RANK_COLORS.length - 1)], hoist: true, perms: [] })),
  { key: 'member', name: 'Union Member', color: 0, hoist: false, perms: [] },
  { key: 'approved', name: 'Approved', color: 0x8f8f8f, hoist: false, perms: [] },
];

const roles = () => db.config.roles || {};
const roleId = (k) => roles()[k] || (k === 'member' ? process.env.MEMBER_ROLE_ID : k === 'staff' ? process.env.STAFF_ROLE_ID : null) || null;
const STAFF_KEYS = ['ceo', 'coceo', 'management', 'hr', 'staff'];
const staffRoleIds = () => STAFF_KEYS.map(roleId).filter(Boolean);
const rankRoleIds = () => Object.entries(roles()).filter(([k]) => k.startsWith('rank:')).map(([, v]) => v);
const ch = (k) => (db.config.channels || {})[k] || null;

function overwrites(g, access, ro, botId, kind = 'cat', writers = []) {
  const everyone = g.roles.everyone.id, member = roleId('member'), approved = roleId('approved');
  const voice = kind !== 'text', text = kind !== 'voice';
  const VIEW = [P.ViewChannel, P.ReadMessageHistory, ...(voice ? [P.Connect] : [])];
  const TALK = [P.SendMessages, ...(text ? [P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads] : []), ...(voice ? [P.Speak] : [])];
  const o = [{ id: botId, allow: [...VIEW, ...TALK, P.EmbedLinks, P.AttachFiles, P.ManageMessages, P.AddReactions] }];
  for (const s of staffRoleIds()) o.push({ id: s, allow: [...VIEW, ...TALK] });
  const see = (id) => o.push({ id, allow: VIEW, deny: ro ? TALK : [] });
  for (const w of writers) if (roleId(w)) o.push({ id: roleId(w), allow: [...VIEW, ...TALK] }); // e.g. the Event Team posts in #convoys
  if (access === 'gate') { o.push({ id: everyone, allow: VIEW, deny: ro ? TALK : [] }); if (member) o.push({ id: member, deny: [P.ViewChannel] }); if (approved) o.push({ id: approved, deny: [P.ViewChannel] }); }
  else {
    o.push({ id: everyone, deny: [P.ViewChannel] });
    if (access === 'approved' && approved) see(approved);
    if (access === 'member' && member) see(member);
  }
  return o;
}

// Build or repair the whole server. Safe to run again: it finds what exists by saved ID or by name and fixes it.
async function setup(g, { hideOthers = false } = {}) {
  const me = g.members.me, log = [];
  if (!me.permissions.has(P.ManageRoles) || !me.permissions.has(P.ManageChannels)) throw new Error('The bot needs the Manage Roles and Manage Channels permissions (Administrator is simplest while you run /setup).');
  await g.roles.fetch(); await g.channels.fetch();
  db.config.roles = { ...(db.config.roles || {}) }; db.config.channels = { ...(db.config.channels || {}) };

  // roles
  const made = [];
  for (const d of ROLE_DEFS()) {
    let r = g.roles.cache.get(db.config.roles[d.key]) || g.roles.cache.find((x) => x.name === d.name && !x.managed);
    if (!r) { r = await g.roles.create({ name: d.name, color: d.color, hoist: d.hoist, permissions: d.perms, mentionable: false, reason: 'Diesel Union /setup' }); log.push(`+ role ${d.name}`); }
    db.config.roles[d.key] = r.id; made.push(r);
  }
  // keep the rank list in step with the ranks set on the website
  for (const k of Object.keys(db.config.roles)) if (k.startsWith('rank:') && !cfg().ranks.some((r) => `rank:${r.name}` === k)) delete db.config.roles[k];
  // order them under the bot's own role, in the order above
  const top = me.roles.highest.position;
  const order = made.filter((r) => r.position < top);
  try { await g.roles.setPositions(order.map((r, i) => ({ role: r.id, position: Math.max(1, top - 1 - i) }))); }
  catch (err) { log.push(`! could not order the roles (${err.message}). Drag the bot's role to the top of the list and run /setup again.`); }
  save();

  // categories and channels (forget keys from older layouts, so those channels count as "old")
  const keys = new Set(LAYOUT.flatMap((sec) => [`cat:${sec.cat}`, ...sec.channels.map((c) => c.key)]));
  for (const k of Object.keys(db.config.channels)) if (!keys.has(k)) delete db.config.channels[k];
  let pos = 0;
  for (const sec of LAYOUT) {
    const catKey = `cat:${sec.cat}`;
    let cat = g.channels.cache.get(db.config.channels[catKey]) || g.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === sec.cat);
    const catPerms = overwrites(g, sec.access, false, me.id);
    if (!cat) { cat = await g.channels.create({ name: sec.cat, type: ChannelType.GuildCategory, permissionOverwrites: catPerms, reason: 'Diesel Union /setup' }); log.push(`+ ${sec.cat}`); }
    else await cat.permissionOverwrites.set(catPerms);
    await cat.setPosition(pos++).catch(() => {});
    db.config.channels[catKey] = cat.id;
    let cpos = 0;
    for (const c of sec.channels) {
      const type = c.voice ? ChannelType.GuildVoice : ChannelType.GuildText;
      let x = g.channels.cache.get(db.config.channels[c.key]) || g.channels.cache.find((y) => y.type === type && y.name === c.name);
      const perms = overwrites(g, sec.access, !!c.ro, me.id, c.voice ? 'voice' : 'text', c.writers || []);
      if (!x) { x = await g.channels.create({ name: c.name, type, parent: cat.id, topic: c.topic, permissionOverwrites: perms, reason: 'Diesel Union /setup' }); log.push(`+ ${c.name}`); }
      else { if (x.parentId !== cat.id) await x.setParent(cat.id, { lockPermissions: false }); await x.permissionOverwrites.set(perms); }
      await x.setPosition(cpos++).catch(() => {});
      db.config.channels[c.key] = x.id;
    }
  }
  for (const [k, key] of Object.entries(FEEDS)) db.config[k] = db.config.channels[key];
  save();

  // everything else on the server: newcomers should only see #apply
  const ours = new Set(Object.values(db.config.channels));
  const others = [...g.channels.cache.values()].filter((c) => !ours.has(c.id) && !ours.has(c.parentId) && !c.isThread?.() && c.permissionsFor(g.roles.everyone)?.has(P.ViewChannel));
  if (others.length && hideOthers) {
    for (const c of others) {
      await c.permissionOverwrites.edit(g.roles.everyone, { ViewChannel: false }).catch(() => {});
      await c.permissionOverwrites.edit(roleId('member'), { ViewChannel: true }).catch(() => {});
      for (const s of staffRoleIds()) await c.permissionOverwrites.edit(s, { ViewChannel: true }).catch(() => {});
    }
    log.push(`~ hid ${others.length} old channel(s)/categories from newcomers (members still see them)`);
  } else if (others.length) log.push(`! ${others.length} old channel(s) are still visible to newcomers: ${others.slice(0, 6).map((c) => c.name).join(', ')}. Run /setup hide_others:true to hide them, or delete them.`);

  await refreshPanels(g);
  return log;
}

// ---- panels (one message each, edited in place on every /setup) ----
function links() {
  const c = cfg(), out = [];
  const tr = https(c.truckyUrl) || (c.truckyId ? `https://hub.truckyapp.com/vtc/${c.truckyId}` : null);
  if (tr) out.push(['Diesel Union on Trucky', tr, '🚚']);
  if (c.tmpId) out.push(['TruckersMP VTC', `https://truckersmp.com/vtc/${c.tmpId}`, '🛣️']);
  if (siteUrl()) out.push(['Our website', siteUrl(), '🌐']);
  out.push(['Download Trucky', 'https://truckyapp.com/', '⬇️']);
  return out;
}
const linkRow = (items) => new ActionRowBuilder().addComponents(items.slice(0, 5).map(([label, url, emoji]) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url).setEmoji(emoji)));

function applyPanel() {
  const c = cfg();
  const e = new EmbedBuilder().setColor(BROWN).setTitle(`Join ${c.name}`).setDescription([
    c.about,
    '',
    '**What we ask**',
    ...(c.requirements || []).map((r) => `• ${r}`),
    '',
    '**How it works**',
    '1. Press **Apply** and answer a few questions.',
    '2. Staff read your application. You get the answer in a DM.',
    '3. If you are accepted, you join us on Trucky and log in on our website.',
    '4. The bot checks it and opens the whole server for you.',
    '',
    c.recruitOpen ? 'By applying you agree to follow our rules and the TruckersMP rules.' : '**Recruitment is closed right now.** Check back soon.',
  ].join('\n').slice(0, 4000)).setFooter({ text: c.tagline || '' });
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('du:apply').setStyle(ButtonStyle.Success).setLabel('Apply').setEmoji('📝').setDisabled(!c.recruitOpen));
  if (siteUrl()) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Website').setURL(siteUrl()));
  return { embeds: [e], components: [row] };
}
function setupSteps() {
  const L = Object.fromEntries(links().map(([n, u]) => [n, u]));
  return [
    `**1. Join Diesel Union on Trucky.** ${L['Diesel Union on Trucky'] ? `Open our company page and press Join: ${L['Diesel Union on Trucky']}` : 'Search for Diesel Union in the Trucky VTC Hub and press Join.'} Use the same Steam account you applied with.`,
    `**2. Apply to Diesel Union on TruckersMP.** ${L['TruckersMP VTC'] ? `Open ${L['TruckersMP VTC']} , log in and press Apply / Join.` : 'Find Diesel Union in the TruckersMP VTC list and apply.'} Staff accept you there too.`,
    `**3. Install Trucky** and keep it running when you drive, so your jobs count: https://truckyapp.com/`,
    `**4. Log in on our website** with Discord${siteUrl() ? `: ${siteUrl()}` : ''}.`,
    '**5. Press Check my progress** in #finish-setup. When everything is ticked, the server opens for you. It also happens by itself within a few minutes.',
  ].join('\n\n');
}
function setupPanel() {
  const e = new EmbedBuilder().setColor(GREEN).setTitle('You are accepted. A few steps left.').setDescription(setupSteps());
  const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('du:check').setStyle(ButtonStyle.Success).setLabel('Check my progress').setEmoji('✅'));
  return { embeds: [e], components: [btn, linkRow(links())] };
}
function linksPanel() {
  const L = links();
  const e = new EmbedBuilder().setColor(BROWN).setTitle('Diesel Union links').setDescription(L.map(([n, u, em]) => `${em} **${n}**\n${u}`).join('\n\n'));
  return { embeds: [e], components: [linkRow(L)] };
}
function ranksPanel() {
  const list = [...cfg().ranks].sort((a, b) => a.km - b.km);
  const e = new EmbedBuilder().setColor(AMBER).setTitle('Ranks')
    .setDescription(['Your rank comes from the total kilometres you drive for Diesel Union on Trucky. The bot gives you the role by itself when you reach it.', '',
      ...list.map((r) => `${roles()[`rank:${r.name}`] ? `<@&${roles()[`rank:${r.name}`]}>` : `**${r.name}**`}  ${r.km ? `from ${km(r.km)}` : 'when you join'}`)].join('\n'));
  return { embeds: [e], allowedMentions: { parse: [] } };
}
function rulesPanel() {
  const r = cfg().discordRules || [];
  return { embeds: [new EmbedBuilder().setColor(BROWN).setTitle('Discord rules').setDescription(r.map((x, i) => `**${i + 1}.** ${x}`).join('\n\n').slice(0, 4000) || 'No rules set.')] };
}
function welcomePanel() {
  const c = cfg(), C = (k) => (ch(k) ? `<#${ch(k)}>` : `#${k}`);
  return { embeds: [new EmbedBuilder().setColor(BROWN).setTitle(`Welcome to ${c.name}`).setDescription([`${c.tagline}.`, '', `${C('rules')} the rules`, `${C('tagInfo')} ${C('truckInfo')} ${C('trailerInfo')} tag, truck and trailer`, `${C('ranks')} how ranks work`, `${C('links')} Trucky, TruckersMP and the website`, `${C('convoys')} upcoming convoys`, `${C('deliveries')} every delivery, live`, `${C('commands')} try /profile and /top`].join('\n'))] };
}
const STANDARDS = { tagInfo: ['tag', '🏷 Tag name and colour'], truckInfo: ['truck', '🚚 Truck colour'], trailerInfo: ['trailer', '🚛 Trailer colour and livery'] };
function standardPanel(key) {
  const [k, title] = STANDARDS[key], s = (cfg().standards || {})[k] || {}, hex = /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : null;
  const e = new EmbedBuilder().setColor(hex ? parseInt(hex.slice(1), 16) : BROWN).setTitle(title).setDescription((s.text || 'Coming soon. Staff will post the details here.').slice(0, 4000));
  if (hex) e.addFields({ name: 'Colour', value: `\`${hex.toUpperCase()}\``, inline: true });
  if (https(s.image)) e.setImage(s.image);
  return { embeds: [e] };
}
const PANELS = { tagInfo: () => standardPanel('tagInfo'), truckInfo: () => standardPanel('truckInfo'), trailerInfo: () => standardPanel('trailerInfo'), apply: applyPanel, setup: setupPanel, links: linksPanel, ranks: ranksPanel, rules: rulesPanel, welcome: welcomePanel };

async function refreshPanels(g, only) {
  db.config.panels = { ...(db.config.panels || {}) };
  for (const [k, build] of Object.entries(PANELS)) {
    if (only && !only.includes(k)) continue;
    const c = ch(k) && g.channels.cache.get(ch(k)); if (!c?.isTextBased?.()) continue;
    const payload = build();
    const old = db.config.panels[k] && await c.messages.fetch(db.config.panels[k]).catch(() => null);
    if (old) await old.edit(payload).catch((err) => console.warn('panel edit:', err.message));
    else { const m = await c.send(payload).catch((err) => { console.warn('panel:', err.message); return null; }); if (m) db.config.panels[k] = m.id; }
  }
  save();
}

// ---- onboarding: accepted -> joined on Trucky + logged in on the site -> access ----
// returns the checklist; grants access when everything is done
async function progress(uid) {
  const app = db.applications.filter((a) => a.discord === uid).sort((a, b) => b.at - a.at)[0] || null;
  const linked = db.links[uid] && db.members[db.links[uid]];
  const steam = linked?.steam || app?.steam || null;
  const driver = linked && !linked.left ? linked : steam ? Object.values(db.members).find((m) => m.steam === steam && !m.left) : null;
  return { app, accepted: app?.status === 'accepted', driver: driver || null, web: !!(db.web || {})[uid], steam, tmp: await inTmp(steam, app?.tmp) };
}
// is this person a member of our VTC on TruckersMP? true / false, or null when we cannot tell (no VTC ID, API down)
async function inTmp(steam, tmpProfile) {
  const id = cfg().tmpId; if (!id || (!steam && !tmpProfile)) return null;
  try {
    const d = await getJson(`https://api.truckersmp.com/v2/vtc/${encodeURIComponent(id)}/members`, { ttl: 60_000 });
    const list = d?.response?.members || (Array.isArray(d?.response) ? d.response : null);
    if (!Array.isArray(list)) return null;
    const tmpUser = String(tmpProfile || '').match(/(?:user\/)?(\d{1,9})(?!\d)/)?.[1];
    return list.some((m) => (steam && String(m.steam_id ?? m.steamID ?? '') === steam) || (tmpUser && String(m.user_id ?? m.userId ?? '') === tmpUser));
  } catch { return null; }
}

function checklist(p, hasApproved) {
  const t = (ok, s) => `${ok ? '✅' : '⬜'} ${s}`;
  return [t(p.accepted || hasApproved, 'Application accepted'), t(!!p.driver, p.driver ? `In the company on Trucky as **${p.driver.name}**` : 'Join Diesel Union on Trucky (with the Steam account you applied with)'),
    ...(p.tmp === null ? [] : [t(p.tmp, p.tmp ? 'In the Diesel Union VTC on TruckersMP' : 'Apply to Diesel Union on TruckersMP and wait to be accepted')]), t(p.web, 'Logged in on the website with Discord')].join('\n');
}

// rank role for a linked driver: add the right one, drop the others
async function syncRank(gm) {
  const tid = db.links[gm.id]; if (!tid) return null;
  const p = stats.profile(tid); if (!p) return null;
  const want = roles()[`rank:${p.rank.name}`]; if (!want) return p.rank.name;
  const drop = rankRoleIds().filter((r) => r !== want && gm.roles.cache.has(r));
  if (drop.length) await gm.roles.remove(drop, 'Diesel Union rank').catch((err) => console.warn('rank remove:', err.message));
  if (!gm.roles.cache.has(want)) await gm.roles.add(want, 'Diesel Union rank').catch((err) => console.warn('rank add:', err.message));
  return p.rank.name;
}

module.exports = { LAYOUT, FEEDS, setup, refreshPanels, applyPanel, setupPanel, linksPanel, ranksPanel, setupSteps, links, linkRow, progress, checklist, syncRank, roleId, staffRoleIds, rankRoleIds, ch };

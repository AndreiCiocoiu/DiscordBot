// The Discord side: slash commands, delivery feed, rank-ups, convoy announcements and reminders, recruitment.
const { Client, GatewayIntentBits, Events, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { db, save, cfg } = require('./store');
const stats = require('./stats');
const trucky = require('./trucky');
const convoys = require('./convoys');

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
  new SlashCommandBuilder().setName('apply').setDescription('How to join Diesel Union'),
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
  if (n === 'apply') return i.reply({ content: siteUrl() ? (cfg().recruitOpen ? `Apply here: ${siteUrl()}/#/aplica` : 'Recruitment is closed right now.') : 'The portal has no address yet.', flags: MessageFlags.Ephemeral });
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
    if (after.index > before.index) post(cfg().jobsChannel, { embeds: [new EmbedBuilder().setColor(AMBER).setTitle(`${j.driverName} ranked up`).setDescription(`Now **${after.name}**, with ${km(total)} driven for Diesel Union.`)] });
  });

  async function tick(n) {
    try {
      await trucky.pollJobs(n === 0 ? 6 : 2).catch((err) => { db.sync.jobs = { at: Date.now(), ok: false, error: err.message }; });
      if (n % 6 === 0) await trucky.pollMembers().catch((err) => { db.sync.members = { at: Date.now(), ok: false, error: err.message }; });
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

  client.once(Events.ClientReady, async (c) => {
    console.log(`Logged in as ${c.user.tag}`);
    try { const g = await c.application.commands.fetch(); if (g.size) await c.application.commands.set([]); } catch { /* ignore */ }
    for (const g of c.guilds.cache.values()) await g.commands.set(commands.map((x) => x.toJSON())).catch((err) => console.error(`commands in ${g.name}:`, err.message));
  });
  client.on(Events.GuildCreate, (g) => g.commands.set(commands.map((x) => x.toJSON())).catch(() => {}));
  client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    try { await onCommand(i); }
    catch (err) { console.error('command:', err); const msg = 'Something went wrong. Try again.'; if (i.deferred || i.replied) await i.editReply(msg).catch(() => {}); else await i.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {}); }
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
    // a VTC member on Discord: has MEMBER_ROLE_ID (or the staff role)
    async isMember(uid) {
      const ids = [process.env.MEMBER_ROLE_ID, process.env.STAFF_ROLE_ID].filter(Boolean); if (!ids.length) return false;
      const g = guild(); if (!g) return false;
      try { const m = await g.members.fetch(uid); return ids.some((r) => m.roles.cache.has(r)); } catch { return false; }
    },
    channels() {
      const g = guild(), me = g?.members.me; if (!g || !me) return [];
      return [...g.channels.cache.values()].filter((c) => (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) && c.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]))
        .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition).map((c) => ({ id: c.id, name: c.name, group: c.parent?.name || '' }));
    },
    convoyAdded: (c) => post(cfg().convoyChannel, { embeds: [convoyEmbed(c, 'New convoy')] }),
    applied: (a) => post(cfg().staffChannel, { embeds: [new EmbedBuilder().setColor(BROWN).setTitle(`New application: ${a.name}`).setDescription(`<@${a.discord}> · ${a.age} years old · ${a.games.join(' and ')}\n\n${a.why.slice(0, 900)}`).setURL(siteUrl() ? `${siteUrl()}/#/staff` : null).setTimestamp(a.at)] }),
    decided: (a) => dm(a.discord, { embeds: [new EmbedBuilder().setColor(a.status === 'accepted' ? GREEN : RED)
      .setTitle(a.status === 'accepted' ? 'Welcome to Diesel Union' : 'Your Diesel Union application')
      .setDescription(a.status === 'accepted' ? `You are in. Install Trucky and join the Diesel Union company so your jobs are counted.${a.note ? `

${a.note}` : ''}` : `You were not accepted this time.${a.note ? `

${a.note}` : ''}
You can apply again in a week.`)] }),
    test: (id) => post(id, { embeds: [new EmbedBuilder().setColor(BROWN).setTitle('Diesel Union test').setDescription('The bot can post in this channel.')] }),
    login: () => client.login(process.env.DISCORD_TOKEN),
  };
}

module.exports = { start, commands, _onCommand: onCommand, jobEmbed, convoyEmbed };

// /setup <feature>: one admin command per feature (hidden from non-admins, re-checked here).
//   /setup tot         everything below, in one go
//   /setup welcome | evenimente | anunturi | log | razii | crafting | puncte   [canal]
//   /setup fus <zona>  time zone for events      /setup info   what is set up and what is missing
// Without `canal` the bot reuses the channel it already knows (or one with the right name) and only
// creates a new one if there is none. With `canal` it uses exactly that channel.
const { SlashCommandBuilder, PermissionFlagsBits: P, ChannelType } = require('discord.js');
const store = require('./store');
const adminlog = require('./adminlog');
const { validTz } = require('./timeparse');
const banner = require('./panelBanner');

const FEATURES = [
  { id: 'welcome', label: 'Welcome', desc: 'Canalul cu bannerul animat pentru membri noi' },
  { id: 'evenimente', label: 'Evenimente', desc: 'Planificare evenimente cu foaie western' },
  { id: 'anunturi', label: 'Anunțuri', desc: 'Canalul unde postează /anunt' },
  { id: 'log', label: 'Adminlog', desc: 'Log privat, doar pentru admini' },
  { id: 'razii', label: 'Razii', desc: 'Panoul de timere pentru razii' },
  { id: 'crafting', label: 'Crafting', desc: 'Panoul cu catalog și calculator' },
  { id: 'puncte', label: 'Puncte', desc: 'Canalul cu clasamentul săptămânal al benzii' },
];

const command = (() => {
  const b = new SlashCommandBuilder().setName('setup').setDescription('Configurează funcțiile botului (admin)')
    .setDefaultMemberPermissions(P.ManageGuild).setContexts(0);
  b.addSubcommand((s) => s.setName('tot').setDescription('Configurează totul dintr-o dată'));
  for (const f of FEATURES) {
    b.addSubcommand((s) => s.setName(f.id).setDescription(f.desc)
      .addChannelOption((o) => o.setName('canal').setDescription('Canalul de folosit (altfel îl găsesc sau îl creez)').addChannelTypes(ChannelType.GuildText)));
  }
  b.addSubcommand((s) => s.setName('fus').setDescription('Fusul orar pentru evenimente')
    .addStringOption((o) => o.setName('zona').setDescription('ex: Europe/Bucharest, Europe/London').setRequired(true)));
  b.addSubcommand((s) => s.setName('info').setDescription('Ce e configurat și ce lipsește'));
  return b;
})();

// ---- helpers ------------------------------------------------------------

const lazy = () => require('./serverText'); // nameKey / smallCaps (loaded late: serverText also uses this file)
const botAllow = [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory, P.ManageMessages];

async function getChannel(ctx, { key, names, label, emoji, readonly, priv, picked }) {
  const { guild, client } = ctx;
  const { nameKey, smallCaps } = lazy();
  if (picked) return { ch: picked, made: false };
  const savedId = store.cfg(guild.id)[key];
  const saved = savedId ? await guild.channels.fetch(savedId).catch(() => null) : null;
  if (saved) return { ch: saved, made: false };
  await guild.channels.fetch().catch(() => {});
  const found = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && names.includes(nameKey(c.name)));
  if (found) return { ch: found, made: false };
  const me = client.user.id;
  const overwrites = priv
    ? [{ id: guild.id, deny: [P.ViewChannel] }, { id: me, allow: botAllow }]
    : [...(readonly ? [{ id: guild.id, deny: [P.SendMessages] }] : []), { id: me, allow: [...botAllow, P.MentionEveryone] }];
  const parentId = ctx.parentId ?? undefined;
  const ch = await guild.channels.create({ name: `${emoji}・${smallCaps(names[0])}`, type: ChannelType.GuildText, parent: parentId, permissionOverwrites: overwrites });
  return { ch, made: true };
}

const bot = (ctx) => ctx.guild.members.me;
const need = (ctx, perms) => perms.filter((p) => !bot(ctx)?.permissions.has(p));
const permNames = { [P.ManageChannels]: 'Manage Channels', [P.ManageRoles]: 'Manage Roles', [P.MentionEveryone]: 'Mention Everyone', [P.ViewAuditLog]: 'View Audit Log', [P.ManageGuild]: 'Manage Server' };

// ---- one function per feature: returns a line of text -------------------

const run = {
  async welcome(ctx) {
    const { ch, made } = await getChannel(ctx, { key: 'welcomeId', names: ['welcome'], emoji: '👋', readonly: true, picked: ctx.picked });
    store.setConfig(ctx.guild.id, { welcomeId: ch.id });
    return `**Welcome**: ${ch}${made ? ' (creat)' : ''}. Bannerul apare la fiecare membru nou. Previzualizare: \`server test\`.`;
  },
  async evenimente(ctx) {
    const sessions = require('./sessions');
    const { ch, made } = await getChannel(ctx, { key: 'sessionsId', names: ['evenimente', 'sesiuni'], emoji: '📅', readonly: true, picked: ctx.picked });
    store.setConfig(ctx.guild.id, { sessionsId: ch.id });
    const old = store.cfg(ctx.guild.id).sessionsPanelId;
    if (old) await (await ch.messages.fetch(old).catch(() => null))?.delete().catch(() => {});
    await sessions.postPanel(ctx.client, ch);
    await sessions.ensureRole(ctx.guild);
    return `**Evenimente**: ${ch}${made ? ' (creat)' : ''}, panoul e postat. Fusul orar: \`${store.cfg(ctx.guild.id).tz || 'Europe/Bucharest'}\` (schimbi cu \`/setup fus\`).`;
  },
  async anunturi(ctx) {
    const { ch, made } = await getChannel(ctx, { key: 'announceId', names: ['anunturi', 'anunt'], emoji: '📢', readonly: true, picked: ctx.picked });
    store.setConfig(ctx.guild.id, { announceId: ch.id });
    const miss = ch.permissionsFor(bot(ctx))?.has(P.MentionEveryone) ? '' : ' Botul nu are **Mention Everyone** aici, deci `/anunt` nu va da ping.';
    return `**Anunțuri**: ${ch}${made ? ' (creat)' : ''}. Postezi cu \`/anunt\`.${miss}`;
  },
  async log(ctx) {
    const { ch, made } = await getChannel(ctx, { key: 'logId', names: ['adminlog'], emoji: '🔒', priv: true, picked: ctx.picked });
    // edit only @everyone and the bot: never replace the whole list, other roles' overrides stay as they are
    await ch.permissionOverwrites.edit(ctx.client.user.id, { ViewChannel: true, SendMessages: true, EmbedLinks: true, AttachFiles: true, ReadMessageHistory: true }).catch(() => {});
    await ch.permissionOverwrites.edit(ctx.guild.id, { ViewChannel: false }).catch(() => {});
    store.setConfig(ctx.guild.id, { logId: ch.id });
    return `**Adminlog**: ${ch}${made ? ' (creat)' : ''}, privat: îl văd doar adminii.`;
  },
  async razii(ctx) {
    const raziiUi = require('./raziiUi'), razii = require('./razii');
    const { ch, made } = await getChannel(ctx, { key: 'raziiChannelId', names: ['razii', 'razie'], emoji: '🚨', picked: ctx.picked });
    store.setConfig(ctx.guild.id, { raziiChannelId: ch.id });
    await raziiUi.createPanel(ctx.client, ch);
    const hasVoice = razii.findVoiceRecording?.();
    return `**Razii**: ${ch}${made ? ' (creat)' : ''}, panoul e postat; aici scrii și \`razie <zona>\`.${hasVoice ? '' : ' Încă nu ai vocea ta: scrie `razie sunet` cu un fișier audio atașat.'}`;
  },
  async crafting(ctx) {
    const craft = require('./craft');
    const { ch, made } = await getChannel(ctx, { key: 'craftChannelId', names: ['crafting', 'craft'], emoji: '🔨', picked: ctx.picked });
    const old = store.cfg(ctx.guild.id).craftPanel;
    if (old) {
      const oc = await ctx.guild.channels.fetch(old.channelId).catch(() => null);
      await (await oc?.messages.fetch(old.messageId).catch(() => null))?.delete().catch(() => {});
    }
    const msg = await ch.send(banner.withBanner(craft.panelPayload()));
    await msg.pin().catch(() => {});
    store.setConfig(ctx.guild.id, { craftChannelId: ch.id, craftPanel: { channelId: ch.id, messageId: msg.id } });
    return `**Crafting**: ${ch}${made ? ' (creat)' : ''}, panoul e postat. Oricine poate scrie \`/craft\` și \`/catalog\`.`;
  },
  async puncte(ctx) {
    const points = require('./points');
    const { ch, made } = await getChannel(ctx, { key: 'pointsChannelId', names: ['clasament', 'puncte'], emoji: '🏆', readonly: true, picked: ctx.picked });
    store.setConfig(ctx.guild.id, { pointsChannelId: ch.id });
    const d = points.G(ctx.guild.id);
    d.cfg.channelId = ch.id;
    points.touch(); points.flush();
    return `**Puncte**: ${ch}${made ? ' (creat)' : ''}, aici se postează clasamentul duminică seara. Adaugi oameni cu \`/add\`, dai puncte cu \`/puncte da\`. Setări: \`/banda config\`. Liderii sunt rolurile „Lider” și „Co-Lider”.`;
  },
  async fus(ctx) {
    const tz = ctx.zona.trim();
    if (!validTz(tz)) return 'Fus orar invalid. Exemple: `Europe/London`, `Europe/Bucharest`.';
    store.setConfig(ctx.guild.id, { tz });
    return `**Fus orar** pentru evenimente: \`${tz}\`. (Evenimentele deja postate rămân cum sunt.)`;
  },
  async info(ctx) {
    const c = store.cfg(ctx.guild.id), ch = (id) => (id ? `<#${id}>` : '*nesetat*');
    const rz = require('./razii').cfg(ctx.guild.id);
    const miss = need(ctx, [P.ManageChannels, P.ManageRoles, P.MentionEveryone, P.ViewAuditLog, P.ManageGuild]).map((p) => permNames[p]);
    return [
      `Welcome: ${ch(c.welcomeId)}`, `Evenimente: ${ch(c.sessionsId)}`, `Anunțuri: ${ch(c.announceId)}`, `Adminlog: ${ch(c.logId)}`,
      `Razii: ${ch(rz.panel?.channelId)}`, `Crafting: ${ch(c.craftChannelId)}`, `Puncte: ${ch(c.pointsChannelId)}`, `Fus orar: ${c.tz || 'Europe/Bucharest (implicit)'}`,
      miss.length ? `\nLipsesc permisiuni la bot: **${miss.join(', ')}**` : '\nPermisiunile botului sunt ok.',
    ].join('\n');
  },
};

const ORDER = ['welcome', 'evenimente', 'anunturi', 'log', 'razii', 'crafting', 'puncte'];

async function runFeature(feature, ctx) {
  if (feature !== 'info' && feature !== 'fus') {
    const miss = need(ctx, [P.ManageChannels]);
    if (miss.length && !ctx.picked) return `Botul are nevoie de **Manage Channels** ca să creeze canale (sau alege tu un canal existent).`;
  }
  try { return await run[feature](ctx); }
  catch (err) {
    console.error(`setup ${feature}:`, err);
    return `**${feature}**: nu a mers (${err.message}). Verifică permisiunile botului în canal.`;
  }
}

// text command `server setup` and /setup tot
async function setupAll(ctx) {
  const welcome = await run.welcome({ ...ctx }).catch((e) => `**Welcome**: nu a mers (${e.message})`);
  const wch = ctx.guild.channels.cache.get(store.cfg(ctx.guild.id).welcomeId);
  const sub = { ...ctx, parentId: wch?.parentId };
  const lines = [welcome];
  for (const f of ORDER.slice(1)) lines.push(await runFeature(f, sub));
  return lines.join('\n');
}

async function handleInteraction(interaction, client) {
  if (!interaction.isChatInputCommand?.() || interaction.commandName !== 'setup') return false;
  if (!interaction.memberPermissions?.has(P.ManageGuild)) {
    await interaction.reply({ content: 'Doar adminii pot folosi comanda asta.', ephemeral: true });
    return true;
  }
  await interaction.deferReply({ ephemeral: true });
  const feature = interaction.options.getSubcommand();
  const ctx = {
    guild: interaction.guild, client, userId: interaction.user.id,
    picked: interaction.options.getChannel?.('canal') ?? null,
    zona: interaction.options.getString?.('zona') ?? '',
  };
  const text = feature === 'tot' ? await setupAll(ctx) : await runFeature(feature, ctx);
  if (feature !== 'info') adminlog.action(client, ctx.guild.id, `Setup: ${feature}`, text.slice(0, 1500), ctx.userId);
  await interaction.editReply({ content: text.slice(0, 1990), allowedMentions: { parse: [] } });
  return true;
}

module.exports = { command, handleInteraction, setupAll };

// Admin text commands for the server features (the bot has no slash commands):
//   server setup            create/reuse the welcome, sessions and adminlog channels
//   server aici <welcome|sesiuni|log>   use THIS channel for that feature
//   server test             preview the welcome banner (for yourself)
//   server tz <fus orar>    time zone for sessions, e.g. Europe/Bucharest
//   server info             show the current settings
const { PermissionFlagsBits, ChannelType } = require('discord.js');
const store = require('./store');
const sessions = require('./sessions');
const welcome = require('./welcome');
const adminlog = require('./adminlog');
const { validTz } = require('./timeparse');

const SMALL = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', y: 'ʏ', z: 'ᴢ' };
const REVERSE = Object.fromEntries(Object.entries(SMALL).map(([k, v]) => [v, k]));
const smallCaps = (s) => [...s.toLowerCase()].map((c) => SMALL[c] ?? c).join('');
// "👋・ᴡᴇʟᴄᴏᴍᴇ" and "welcome" are the same channel
const nameKey = (name) => {
  const n = name.includes('・') ? name.split('・').slice(1).join('・') : name;
  return [...n].map((c) => REVERSE[c] ?? c).join('').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

const isAdmin = (m) => Boolean(m.member?.permissions.has(PermissionFlagsBits.Administrator));
const P = PermissionFlagsBits;

async function ack(message, ok, text) {
  const reacted = await message.react(ok ? '✅' : '❌').then(() => true).catch(() => false);
  if (text && (!reacted || !ok)) await message.reply({ content: text, allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
}

const findText = (guild, key) => guild.channels.cache.find((c) => c.type === ChannelType.GuildText && nameKey(c.name) === key);

async function setup(message, client) {
  const guild = message.guild;
  await guild.channels.fetch();
  const me = client.user.id;
  const botAllow = [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory, P.ManageMessages];
  const made = [];

  let welcomeCh = findText(guild, 'welcome');
  if (!welcomeCh) {
    welcomeCh = await guild.channels.create({
      name: `👋・${smallCaps('welcome')}`, type: ChannelType.GuildText,
      permissionOverwrites: [{ id: guild.id, deny: [P.SendMessages] }, { id: me, allow: botAllow }],
    });
    made.push('welcome');
  }

  let sessionsCh = findText(guild, 'sesiuni');
  if (!sessionsCh) {
    sessionsCh = await guild.channels.create({
      name: `📅・${smallCaps('sesiuni')}`, type: ChannelType.GuildText, parent: welcomeCh.parentId ?? undefined,
      permissionOverwrites: [{ id: guild.id, deny: [P.SendMessages] }, { id: me, allow: botAllow }],
    });
    made.push('sesiuni');
  }

  // adminlog is always private: nobody but admins (and the bot) can see it
  let logCh = findText(guild, 'adminlog');
  const logOverwrites = [{ id: guild.id, deny: [P.ViewChannel] }, { id: me, allow: botAllow }];
  if (!logCh) {
    logCh = await guild.channels.create({ name: `🔒・${smallCaps('adminlog')}`, type: ChannelType.GuildText, permissionOverwrites: logOverwrites });
    made.push('adminlog');
  } else {
    await logCh.permissionOverwrites.set(logOverwrites).catch(() => {});
  }

  store.setConfig(guild.id, { welcomeId: welcomeCh.id, sessionsId: sessionsCh.id, logId: logCh.id });

  // fresh planner panel in the sessions channel
  const old = store.cfg(guild.id).sessionsPanelId;
  if (old) await (await sessionsCh.messages.fetch(old).catch(() => null))?.delete().catch(() => {});
  await sessions.postPanel(client, sessionsCh);

  adminlog.action(client, guild.id, 'Server setup', `Welcome: ${welcomeCh}\nSesiuni: ${sessionsCh}\nAdminlog: ${logCh}`, message.author.id);
  await message.reply({
    content: `Gata.\nWelcome: ${welcomeCh}\nSesiuni: ${sessionsCh}\nAdminlog: ${logCh} (privat)${made.length ? `\nCreate acum: ${made.join(', ')}` : '\nAm folosit canalele existente.'}`,
    allowedMentions: { parse: [], repliedUser: false },
  }).catch(() => {});
}

async function handleServerMessage(message, client) {
  if (message.author.bot || !message.guild) return;
  const m = message.content.trim().match(/^server\s+(\S+)(?:\s+(.+))?$/i);
  if (!m || !isAdmin(message)) return;
  const sub = m[1].toLowerCase(), arg = (m[2] || '').trim().toLowerCase();
  const guildId = message.guild.id;

  if (sub === 'setup') return setup(message, client);

  if (sub === 'aici') {
    const key = { welcome: 'welcomeId', sesiuni: 'sessionsId', log: 'logId', adminlog: 'logId' }[arg];
    if (!key) return ack(message, false, 'Folosește: `server aici welcome`, `server aici sesiuni` sau `server aici log`.');
    store.setConfig(guildId, { [key]: message.channel.id });
    if (key === 'sessionsId') await sessions.postPanel(client, message.channel);
    await ack(message, true);
    const visible = message.channel.permissionsFor(message.guild.roles.everyone)?.has(P.ViewChannel);
    if (key === 'logId' && visible) {
      await message.reply({ content: 'Atenție: canalul ăsta e vizibil pentru toți. Fă-l privat sau rulează `server setup`.', allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
    }
    return;
  }

  if (sub === 'test') {
    const payload = await welcome.buildWelcome(message.member);
    await message.channel.send(payload).catch((err) => message.reply(`Nu a mers: ${err.message}`).catch(() => {}));
    return;
  }

  if (sub === 'tz') {
    const tz = (m[2] || '').trim();
    if (!tz || !validTz(tz)) return ack(message, false, 'Fus orar invalid. Exemple: `server tz Europe/London`, `server tz Europe/Bucharest`.');
    store.setConfig(guildId, { tz });
    return ack(message, true, `Fus orar: ${tz}`);
  }

  if (sub === 'info') {
    const c = store.cfg(guildId);
    const ch = (id) => (id ? `<#${id}>` : 'nesetat');
    return message.reply({
      content: `Welcome: ${ch(c.welcomeId)}\nSesiuni: ${ch(c.sessionsId)}\nAdminlog: ${ch(c.logId)}\nFus orar sesiuni: ${c.tz || 'Europe/London (implicit)'}`,
      allowedMentions: { parse: [], repliedUser: false },
    }).catch(() => {});
  }
}

module.exports = { handleServerMessage, nameKey, smallCaps };

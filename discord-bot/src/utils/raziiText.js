// Text triggers (the bot has no slash commands):
//   razie <zona>          start / restart a timer (panel or alert channel only)
//   razie panou           post the panel here            (admin)
//   razie sunet           + an audio attachment: upload your "Atentie, razie!" (admin)
//   razie test            bot joins your voice channel and plays everything (admin)
const { PermissionFlagsBits } = require('discord.js');
const razii = require('./razii');
const ui = require('./raziiUi');
const adminlog = require('./adminlog');

const NO_PING = { parse: [], repliedUser: false };
const ADMIN_WORDS = ['panou', 'sunet', 'test'];
const lastUse = new Map();

const isAdmin = (message) => Boolean(message.member?.permissions.has(PermissionFlagsBits.ManageGuild));

// A reaction instead of a reply keeps the chat clean; reply only if reacting fails.
async function ack(message, ok, text) {
  const reacted = await message.react(ok ? '✅' : '❌').then(() => true).catch(() => false);
  if (!reacted && text) await message.reply({ content: text, allowedMentions: NO_PING }).catch(() => {});
}

async function adminCommand(message, client, word) {
  if (!isAdmin(message)) return;

  if (word === 'panou') {
    await ui.createPanel(client, message.channel);
    adminlog.action(client, message.guild.id, 'Razie: panou postat', `În ${message.channel}`, message.author.id);
    if (!(await message.delete().then(() => true).catch(() => false))) await ack(message, true);
    return;
  }

  if (word === 'sunet') {
    const att = message.attachments.first();
    const ext = att ? (att.name.split('.').pop() || '').toLowerCase() : '';
    if (!att || !razii.AUDIO_EXT.includes(ext)) {
      return ack(message, false, `Atașează un fișier audio (${razii.AUDIO_EXT.join(', ')}) la mesajul \`razie sunet\`.`);
    }
    if (att.size > 3 * 1024 * 1024) return ack(message, false, 'Fișierul e prea mare (max 3 MB).');
    const res = await fetch(att.url).catch(() => null);
    if (!res?.ok) return ack(message, false, 'Nu am putut descărca fișierul.');
    razii.saveRecording(Buffer.from(await res.arrayBuffer()), ext);
    adminlog.action(client, message.guild.id, 'Razie: voce încărcată', att.name, message.author.id);
    return ack(message, true, 'Salvat.');
  }

  if (word === 'test') {
    const channel = message.member.voice?.channel;
    if (!channel) return ack(message, false, 'Intră întâi pe un canal vocal.');
    try {
      await razii.playInChannel(message.guild, channel);
      return ack(message, true);
    } catch (err) {
      console.error('razie test error:', err);
      return ack(message, false, `Nu a mers: ${err.message}`);
    }
  }
}

async function handleMessage(message, client) {
  if (message.author.bot || !message.guild) return;
  const m = message.content.trim().match(/^razie\s+(.+)$/i);
  if (!m) return;

  const word = m[1].trim().toLowerCase();
  if (ADMIN_WORDS.includes(word)) return adminCommand(message, client, word);

  // timers: only in the panel / alert channel (anywhere if there is no panel yet)
  const c = razii.cfg(message.guild.id);
  const allowed = [c.panel?.channelId, c.channelId].filter(Boolean);
  if (allowed.length && !allowed.includes(message.channel.id)) return;

  const now = Date.now();
  if (now - (lastUse.get(message.author.id) || 0) < 2000) return;
  lastUse.set(message.author.id, now);

  const res = razii.start(client, { guildId: message.guild.id, zone: m[1], userId: message.author.id });
  if (!res.ok) return;
  adminlog.action(client, message.guild.id, res.replaced ? 'Razie: timer repornit (text)' : 'Razie: timer pornit (text)', `**${res.entry.zone}** · <t:${Math.floor(res.entry.endsAt / 1000)}:R>`, message.author.id);
  if (c.panel) return ack(message, true, `Pornit: **${res.entry.zone}**`);
  await message.reply({
    content: `Pornit: **${res.entry.zone}** · <t:${Math.floor(res.entry.endsAt / 1000)}:R>`,
    allowedMentions: NO_PING,
  }).catch(() => {});
}

module.exports = { handleMessage };

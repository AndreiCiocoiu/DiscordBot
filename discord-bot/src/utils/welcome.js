// Welcome message with the animated banner.
const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('./store');
const adminlog = require('./adminlog');
const { renderWelcomeGif } = require('./banner');

async function fetchAvatar(user) {
  try {
    const res = await fetch(user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }), { signal: AbortSignal.timeout(5000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch { return null; }
}

// One render at a time, and during a join flood (raid) fall back to plain text.
let chain = Promise.resolve();
const recent = [];
const busy = () => { const now = Date.now(); while (recent.length && now - recent[0] > 30_000) recent.shift(); return recent.length >= 6; };

async function buildWelcome(member, { banner = true } = {}) {
  const guild = member.guild;
  const embed = new EmbedBuilder()
    .setColor(0xf2a33d)
    .setDescription(
      `Bine ai venit pe **${guild.name}**, ${member}!\nEști membrul **#${guild.memberCount}**.\n\n` +
      'Intră pe voice, vezi planurile din sesiuni și apasă un buton de mai jos dacă vrei alerte.'
    );
  const files = [];

  if (banner) {
    try {
      const avatarBuffer = await fetchAvatar(member.user);
      const gif = await (chain = chain.catch(() => {}).then(() => renderWelcomeGif({
        username: member.displayName || member.user.username,
        memberNumber: guild.memberCount,
        serverName: guild.name,
        avatarBuffer,
      })));
      files.push(new AttachmentBuilder(gif, { name: 'welcome.gif' }));
      embed.setImage('attachment://welcome.gif');
    } catch (err) {
      console.error('welcome banner failed, sending text only:', err);
    }
  }

  return {
    content: `${member}`,
    embeds: [embed],
    files,
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rz:role').setLabel('Alerte razie').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('se:role').setLabel('Notificări sesiuni').setStyle(ButtonStyle.Secondary),
    )],
    allowedMentions: { users: [member.id] },
  };
}

async function onMemberAdd(client, member) {
  if (member.user.bot) return;
  const id = store.cfg(member.guild.id).welcomeId;
  if (!id) return;
  const channel = await client.channels.fetch(id).catch(() => null);
  if (!channel?.isTextBased()) return;
  const flood = busy();
  recent.push(Date.now());
  const payload = await buildWelcome(member, { banner: !flood });
  await channel.send(payload).catch((err) => console.error('welcome send failed:', err.message));
  adminlog.action(client, member.guild.id, 'Welcome trimis', `${member}${flood ? ' (fără banner: prea mulți membri noi deodată)' : ''}`);
}

module.exports = { buildWelcome, onMemberAdd };

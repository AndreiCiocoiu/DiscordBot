const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { nameKey } = require('../utils/nameKey');

const VOICE_TYPES = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];

// Which channels survive:
//  - every voice/stage channel
//  - everything inside the RDR2 Online category
//  - the welcome and general channels
//  - text channels inside the Voice category (e.g. music)
// Categories survive only if something inside them survives.
function channelsToKeep(channels) {
  const all = [...channels.values()].filter(Boolean);
  const catKey = (c) => {
    const parent = c.parentId ? channels.get(c.parentId) : null;
    return parent ? nameKey(parent.name) : null;
  };

  const keep = new Set();
  for (const c of all) {
    if (c.type === ChannelType.GuildCategory) continue;
    if (
      VOICE_TYPES.includes(c.type) ||
      catKey(c) === 'rdr2-online' ||
      catKey(c) === 'voice' ||
      ['welcome', 'general'].includes(nameKey(c.name))
    ) {
      keep.add(c.id);
    }
  }
  for (const c of all) {
    if (c.type === ChannelType.GuildCategory) continue;
    if (keep.has(c.id) && c.parentId) keep.add(c.parentId);
  }
  // keep the RDR2 / Voice categories even if empty
  for (const c of all) {
    if (c.type === ChannelType.GuildCategory && ['rdr2-online', 'voice'].includes(nameKey(c.name))) keep.add(c.id);
  }
  return keep;
}

module.exports = {
  channelsToKeep,
  data: new SlashCommandBuilder()
    .setName('cleanup')
    .setDescription('Deletes ALL roles and every channel except voice, RDR2, welcome and general.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Run this inside a server.', ephemeral: true });

    const guild = interaction.guild;
    const channels = await guild.channels.fetch();
    const roles = await guild.roles.fetch();

    const keep = channelsToKeep(channels);
    // The channel the command runs in can't be deleted mid-reply.
    const delChannels = [...channels.values()].filter((c) => c && !keep.has(c.id) && c.id !== interaction.channelId);
    const skippedHere = !keep.has(interaction.channelId) ? channels.get(interaction.channelId) : null;
    const isRazie = (r) => r.name.toLowerCase() === 'razie'; // keep the alert role
    const delRoles = [...roles.values()].filter((r) => r.id !== guild.id && !r.managed && r.editable && !isRazie(r));
    const blocked = [...roles.values()].filter((r) => r.id !== guild.id && !r.managed && !r.editable);

    const list = (arr) => arr.map((x) => x.name).join(', ') || '-';
    const preview = [
      `**Channels/categories to delete (${delChannels.length}):** ${list(delChannels)}`,
      `**Roles to delete (${delRoles.length}):** ${list(delRoles)}`,
      skippedHere ? `**Not deleted (you're running this here):** ${skippedHere.name}. Delete it by hand after.` : null,
      blocked.length ? `**Cannot delete (above my role, move my role higher):** ${list(blocked)}` : null,
      '',
      'Permanent. Kept: all voice channels, the RDR2 category, welcome, general, and text channels inside the Voice category.',
    ].filter((l) => l !== null).join('\n').slice(0, 1900);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cleanup_yes').setLabel('Delete').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cleanup_no').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.reply({ content: preview, components: [row], ephemeral: true, fetchReply: true });

    let press;
    try {
      press = await msg.awaitMessageComponent({ filter: (i) => i.user.id === interaction.user.id, time: 60_000 });
    } catch {
      return interaction.editReply({ content: 'Timed out, nothing deleted.', components: [] }).catch(() => {});
    }
    if (press.customId === 'cleanup_no') return press.update({ content: 'Cancelled.', components: [] });

    await press.update({ content: 'Deleting...', components: [] });

    let ch = 0, ro = 0, failed = 0;
    for (const c of delChannels.filter((c) => c.type !== ChannelType.GuildCategory)) {
      await c.delete('cleanup').then(() => ch++).catch(() => failed++);
    }
    for (const c of delChannels.filter((c) => c.type === ChannelType.GuildCategory)) {
      await c.delete('cleanup').then(() => ch++).catch(() => failed++);
    }
    for (const r of delRoles) {
      await r.delete('cleanup').then(() => ro++).catch(() => failed++);
    }

    await interaction
      .editReply({ content: `Done. Deleted ${ch} channels/categories and ${ro} roles. Failed: ${failed}.` })
      .catch(() => {});
  },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const music = require('../utils/musicPlayer');
const { toSmallCaps } = require('../utils/fancyFont');

module.exports = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Show the current music queue.'),

  async execute(interaction) {
    const q = music.getQueue(interaction.guild.id);
    if (!q || (!q.currentTrack && q.tracks.size === 0)) {
      return interaction.reply("Nothing's queued.");
    }

    const upcoming = q.tracks.toArray();
    const lines = [];
    if (q.currentTrack) lines.push(`▶️ **${q.currentTrack.title}** — requested by ${q.currentTrack.requestedBy ?? 'Unknown'}`);
    upcoming.forEach((t, i) => lines.push(`${i + 1}. **${t.title}** — requested by ${t.requestedBy ?? 'Unknown'}`));

    const embed = new EmbedBuilder()
      .setTitle(`🎶 ${toSmallCaps('Queue')}`)
      .setColor(0x5865F2)
      .setDescription(lines.join('\n'));
    await interaction.reply({ embeds: [embed] });
  },
};

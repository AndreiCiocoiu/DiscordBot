const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const music = require('../utils/musicPlayer');
const { toFraktur } = require('../utils/fancyFont');

module.exports = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Show the current music queue.'),

  async execute(interaction) {
    const q = music.getQueue(interaction.guild.id);
    if (!q || q.queue.length === 0) {
      return interaction.reply("Nothing's queued.");
    }

    const lines = q.queue.map((t, i) => `${i === 0 ? '▶️' : `${i}.`} **${t.title}** — requested by ${t.requestedBy}`);

    const embed = new EmbedBuilder()
      .setTitle(`🎶 ${toFraktur('Queue')}`)
      .setColor(0x5865F2)
      .setDescription(lines.join('\n'));
    await interaction.reply({ embeds: [embed] });
  },
};

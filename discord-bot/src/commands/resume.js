const { SlashCommandBuilder } = require('discord.js');
const music = require('../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume the paused song.'),

  async execute(interaction) {
    const resumed = music.resume(interaction.guild.id);
    await interaction.reply(resumed ? '▶️ Resumed.' : "Nothing's paused.");
  },
};

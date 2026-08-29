const { SlashCommandBuilder } = require('discord.js');
const music = require('../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the current song.'),

  async execute(interaction) {
    const paused = music.pause(interaction.guild.id);
    await interaction.reply(paused ? '⏸️ Paused.' : "Nothing's playing.");
  },
};

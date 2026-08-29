const { SlashCommandBuilder } = require('discord.js');
const music = require('../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current song.'),

  async execute(interaction) {
    const skipped = music.skip(interaction.guild.id);
    await interaction.reply(skipped ? '⏭️ Skipped.' : "Nothing's playing.");
  },
};

const { SlashCommandBuilder } = require('discord.js');
const music = require('../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop music and clear the queue.'),

  async execute(interaction) {
    const stopped = music.stop(interaction.guild.id);
    await interaction.reply(stopped ? '⏹️ Stopped and left the voice channel.' : "Nothing's playing.");
  },
};

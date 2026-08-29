const { SlashCommandBuilder } = require('discord.js');
const music = require('../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Search and play a song in your voice channel — just type the name, no link needed.')
    .addStringOption((opt) =>
      opt.setName('song').setDescription('Song name (or a YouTube link if you have one)').setRequired(true)
    ),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
    }

    await interaction.deferReply();
    const query = interaction.options.getString('song');

    try {
      const track = await music.playSong(voiceChannel, interaction.channel, query, interaction.user);
      await interaction.editReply(`➕ Queued: **${track.title}**`);
    } catch (err) {
      console.error('play command error:', err);
      await interaction.editReply("Couldn't find or play that — try a different search.");
    }
  },
};

const { SlashCommandBuilder } = require('discord.js');
const play = require('play-dl');
const music = require('../utils/musicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a YouTube song/URL or search term in your voice channel.')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('YouTube URL or search term').setRequired(true)
    ),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
    }

    await interaction.deferReply();
    let query = interaction.options.getString('query');

    try {
      if (!play.yt_validate(query)) {
        const results = await play.search(query, { limit: 1 });
        if (!results.length) return interaction.editReply("Couldn't find anything for that.");
        query = results[0].url;
      }

      const track = await music.addTrack(interaction.guild, voiceChannel, interaction.channel, query, interaction.user.tag);
      await interaction.editReply(`➕ Queued: **${track.title}**`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("Couldn't play that — check the link/search term and try again.");
    }
  },
};

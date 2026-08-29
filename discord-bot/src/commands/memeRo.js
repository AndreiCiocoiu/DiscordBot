const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchRomanianMeme, addVoteReactions } = require('../utils/memeFetcher');
const { toSmallCaps } = require('../utils/fancyFont');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme-ro')
    .setDescription('Get a random Romanian meme (r/RomaniaDank).'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const meme = await fetchRomanianMeme();

      const embed = new EmbedBuilder()
        .setTitle(meme.title)
        .setImage(meme.imageUrl)
        .setColor(0xffce00) // Romanian flag yellow
        .setFooter({ text: `👍 ${meme.ups} · r/${meme.subreddit} · ${toSmallCaps('romania')} 🇷🇴` });

      await interaction.editReply({ embeds: [embed] });
      const message = await interaction.fetchReply();
      await addVoteReactions(message);
    } catch {
      await interaction.editReply("Couldn't fetch a Romanian meme right now, try again in a bit.");
    }
  },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchMeme, addVoteReactions } = require('../utils/memeFetcher');

module.exports = {
  data: new SlashCommandBuilder().setName('meme').setDescription('Get a random meme.'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const meme = await fetchMeme();

      const embed = new EmbedBuilder()
        .setTitle(meme.title)
        .setImage(meme.imageUrl)
        .setColor(0x5865f2)
        .setFooter({ text: `👍 ${meme.ups} · r/${meme.subreddit}` });

      await interaction.editReply({ embeds: [embed] });
      const message = await interaction.fetchReply();
      await addVoteReactions(message);
    } catch {
      await interaction.editReply("Couldn't fetch a meme right now, try again in a bit.");
    }
  },
};

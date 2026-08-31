const { SlashCommandBuilder } = require('discord.js');
const { fetchAion2News } = require('../utils/aion2News');
const { buildAion2NewsEmbed } = require('../utils/aion2NewsEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aion2')
    .setDescription('Latest AION 2 news from Steam.'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const news = await fetchAion2News(3);
      if (news.length === 0) {
        return interaction.editReply('No AION 2 news right now — check back later.');
      }

      // Separate messages (not one message with 3 embeds) so each post's
      // banner image gets room to breathe instead of stacking on top of
      // each other.
      await interaction.editReply({ embeds: [buildAion2NewsEmbed(news[0])] });
      for (const item of news.slice(1)) {
        await interaction.followUp({ embeds: [buildAion2NewsEmbed(item)] });
      }
    } catch (err) {
      console.error('AION 2 news fetch failed:', err);
      await interaction.editReply("Couldn't fetch AION 2 news right now, try again in a bit.");
    }
  },
};

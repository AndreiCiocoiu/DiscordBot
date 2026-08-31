const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchAion2News } = require('../utils/aion2News');
const { toSmallCaps } = require('../utils/fancyFont');

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

      const embeds = news.map((item) =>
        new EmbedBuilder()
          .setTitle(item.title)
          .setURL(item.url)
          .setDescription(item.content.slice(0, 500) || '*(no preview available — click the title to read the full post)*')
          .setColor(0x8a2be2)
          .setFooter({ text: `${toSmallCaps('aion 2')} · ${item.feedName}` })
          .setTimestamp(item.date * 1000)
      );

      await interaction.editReply({ embeds });
    } catch (err) {
      console.error('AION 2 news fetch failed:', err);
      await interaction.editReply("Couldn't fetch AION 2 news right now, try again in a bit.");
    }
  },
};

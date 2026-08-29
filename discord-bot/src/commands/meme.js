const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('meme').setDescription('Get a random meme.'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const res = await fetch('https://meme-api.com/gimme');
      const data = await res.json();

      const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setImage(data.url)
        .setColor(0x5865F2)
        .setFooter({ text: `👍 ${data.ups} · r/${data.subreddit}` });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply("Couldn't fetch a meme right now, try again in a bit.");
    }
  },
};

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription("Check the bot's latency."),

  async execute(interaction) {
    await interaction.reply(`🏓 Pong! Latency: ${Math.round(interaction.client.ws.ping)}ms`);
  },
};

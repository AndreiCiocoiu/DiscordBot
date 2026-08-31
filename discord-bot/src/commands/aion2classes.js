const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { postClassShowcase } = require('../utils/aion2Classes');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aion2classes')
    .setDescription('Post the AION 2 class showcase (all 8 classes) in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await postClassShowcase(interaction.channel);
    await interaction.editReply('✅ Posted the class showcase.');
  },
};

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by their ID.')
    .addStringOption((opt) => opt.setName('user_id').setDescription("The user's ID").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    try {
      await interaction.guild.members.unban(userId);
      await interaction.reply(`✅ Unbanned user \`${userId}\`.`);
    } catch {
      await interaction.reply({ content: "Couldn't unban that ID — check it's correct and actually banned.", ephemeral: true });
    }
  },
};

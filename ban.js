const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server.')
    .addUserOption((opt) => opt.setName('user').setDescription('Who to ban').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Why are they being banned?'))
    .addIntegerOption((opt) =>
      opt.setName('delete_days').setDescription('Delete their messages from the last N days (0-7)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && !member.bannable) {
      return interaction.reply({ content: "I can't ban that member (role hierarchy).", ephemeral: true });
    }

    await interaction.guild.members.ban(user.id, {
      reason,
      deleteMessageSeconds: deleteDays * 24 * 60 * 60,
    });
    await interaction.reply(`🔨 Banned **${user.tag}**. Reason: ${reason}`);
  },
};

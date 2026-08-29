const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server.')
    .addUserOption((opt) => opt.setName('user').setDescription('Who to kick').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Why are they being kicked?'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: "That user isn't in this server.", ephemeral: true });
    }
    if (!member.kickable) {
      return interaction.reply({ content: "I can't kick that member (role hierarchy).", ephemeral: true });
    }

    await member.kick(reason);
    await interaction.reply(`👢 Kicked **${user.tag}**. Reason: ${reason}`);
  },
};

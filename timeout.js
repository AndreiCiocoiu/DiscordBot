const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) a member for a set number of minutes.')
    .addUserOption((opt) => opt.setName('user').setDescription('Who to time out').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('minutes').setDescription('Duration in minutes (max 40320 / 28 days)').setRequired(true)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Why are they being timed out?'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: "That user isn't in this server.", ephemeral: true });
    if (!member.moderatable) {
      return interaction.reply({ content: "I can't time out that member (role hierarchy).", ephemeral: true });
    }

    await member.timeout(minutes * 60 * 1000, reason);
    await interaction.reply(`🔇 Timed out **${user.tag}** for ${minutes} minute(s). Reason: ${reason}`);
  },
};

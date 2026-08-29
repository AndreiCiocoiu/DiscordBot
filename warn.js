const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Log a warning against a member.')
    .addUserOption((opt) => opt.setName('user').setDescription('Who to warn').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const count = db.addWarning(interaction.guild.id, user.id, {
      reason,
      moderator: interaction.user.tag,
      date: new Date().toISOString(),
    });

    await interaction.reply(`⚠️ Warned **${user.tag}**. This is warning #${count}. Reason: ${reason}`);
    await user.send(`You were warned in **${interaction.guild.name}**: ${reason}`).catch(() => {});
  },
};

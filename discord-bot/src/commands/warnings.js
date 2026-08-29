const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription("Check a member's warning history.")
    .addUserOption((opt) => opt.setName('user').setDescription('Who to check').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const warnings = db.getWarnings(interaction.guild.id, user.id);

    if (warnings.length === 0) {
      return interaction.reply({ content: `${user.tag} has no warnings.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Warnings for ${user.tag}`)
      .setColor(0xF1C40F)
      .setDescription(
        warnings
          .map((w, i) => `**#${i + 1}** — ${w.reason}\nby ${w.moderator} on ${new Date(w.date).toLocaleDateString()}`)
          .join('\n\n')
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

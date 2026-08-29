const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { xpForLevel } = require('../utils/leveling');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription("Check your (or someone else's) level and XP.")
    .addUserOption((opt) => opt.setName('user').setDescription('Whose rank to check')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const entry = db.getLevelData(interaction.guild.id, target.id);

    const needed = xpForLevel(entry.level);
    let xpIntoLevel = entry.xp;
    for (let l = 0; l < entry.level; l++) xpIntoLevel -= xpForLevel(l);

    const embed = new EmbedBuilder()
      .setTitle(`${target.username}'s Rank`)
      .setThumbnail(target.displayAvatarURL())
      .setColor(0x5865F2)
      .addFields(
        { name: 'Level', value: `${entry.level}`, inline: true },
        { name: 'XP', value: `${xpIntoLevel} / ${needed}`, inline: true },
        { name: 'Total XP', value: `${entry.xp}`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },
};

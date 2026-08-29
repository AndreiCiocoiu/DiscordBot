const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { toFraktur } = require('../utils/fancyFont');

module.exports = {
  data: new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 members by XP.'),

  async execute(interaction) {
    const top = db.getLeaderboard(interaction.guild.id, 10);

    if (top.length === 0) {
      return interaction.reply('No one has earned XP yet — start chatting!');
    }

    const lines = await Promise.all(
      top.map(async (entry, i) => {
        const member = await interaction.guild.members.fetch(entry.userId).catch(() => null);
        const name = member ? member.user.tag : `Unknown (${entry.userId})`;
        const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
        return `${medal} **${name}** — Level ${entry.level} (${entry.xp} XP)`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${interaction.guild.name} ${toFraktur('Leaderboard')}`)
      .setColor(0xF1C40F)
      .setDescription(lines.join('\n'));

    await interaction.reply({ embeds: [embed] });
  },
};

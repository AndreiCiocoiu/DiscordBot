const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription("Show info about a member.")
    .addUserOption((opt) => opt.setName('user').setDescription('Whose info to show')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(target.tag)
      .setThumbnail(target.displayAvatarURL())
      .setColor(0x5865F2)
      .addFields(
        { name: 'Joined server', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'N/A', inline: true },
        { name: 'Account created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
        {
          name: 'Roles',
          value: member ? member.roles.cache.filter((r) => r.name !== '@everyone').map((r) => r.name).join(', ') || 'None' : 'N/A',
        }
      );

    await interaction.reply({ embeds: [embed] });
  },
};

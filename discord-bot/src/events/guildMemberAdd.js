const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { buildWelcomeImage } = require('../utils/welcomeCard');
const { toSmallCaps } = require('../utils/fancyFont');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const config = db.getGuildConfig(member.guild.id);
    if (!config) return; // /setup hasn't been run yet

    if (config.memberRoleId) {
      const role = member.guild.roles.cache.get(config.memberRoleId);
      if (role) member.roles.add(role).catch(() => {});
    }

    if (config.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(config.welcomeChannelId);
      if (!channel) return;

      try {
        const imageBuffer = await buildWelcomeImage(member);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription(`${member} just joined — say hi! 👋`)
          .setImage('attachment://welcome.png');

        await channel.send({ content: `${member}`, embeds: [embed], files: [attachment] });
      } catch (err) {
        console.error('Failed to build welcome image, falling back to plain text:', err);
        channel.send(`Welcome to the server, ${member}! 👋 ${toSmallCaps('check out the rules and say hi')}.`).catch(() => {});
      }
    }
  },
};

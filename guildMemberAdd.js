const { Events } = require('discord.js');
const db = require('../utils/database');

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
      channel?.send(`Welcome to the server, ${member}! 👋 Check out the rules and say hi.`).catch(() => {});
    }
  },
};

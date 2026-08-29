const { Events } = require('discord.js');
const db = require('../utils/database');
const { levelFromXp, randomXp, LEVEL_ROLE_THRESHOLDS } = require('../utils/leveling');

const XP_COOLDOWN_MS = 60_000;

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const entry = db.getLevelData(message.guild.id, message.author.id);
    const now = Date.now();
    if (now - entry.lastMessage < XP_COOLDOWN_MS) return;

    const before = levelFromXp(entry.xp);
    entry.xp += randomXp();
    entry.lastMessage = now;
    const after = levelFromXp(entry.xp);
    entry.level = after;
    db.saveLevelData(message.guild.id, message.author.id, entry);

    if (after > before) {
      message.channel
        .send(`🎉 ${message.author} just leveled up to **Level ${after}**!`)
        .catch(() => {});

      if (LEVEL_ROLE_THRESHOLDS.includes(after)) {
        const config = db.getGuildConfig(message.guild.id);
        const roleId = config?.levelRoles?.[after];
        if (roleId) {
          const role = message.guild.roles.cache.get(roleId);
          const member = message.member;
          if (role && member && !member.roles.cache.has(role.id)) {
            member.roles.add(role).catch(() => {});
          }
        }
      }
    }
  },
};

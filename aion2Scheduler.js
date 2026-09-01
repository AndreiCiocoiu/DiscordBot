// Periodically checks AION 2's Steam news feed and auto-posts anything new
// to each guild's configured AION 2 news channel. Interval is configurable
// via AION2_CHECK_INTERVAL_MINUTES, default 30.

const db = require('./database');
const { fetchAion2News } = require('./aion2News');
const { buildAion2NewsEmbed } = require('./aion2NewsEmbed');

async function checkGuild(client, guildId) {
  const config = db.getGuildConfig(guildId);
  if (!config?.aion2NewsChannelId) return;

  const channel = await client.channels.fetch(config.aion2NewsChannelId).catch(() => null);
  if (!channel) return;

  try {
    const news = await fetchAion2News(5);
    if (news.length === 0) return;

    const lastSeenDate = config.aion2LastPostedDate ?? 0;

    // First time this channel has been checked — mark the current latest
    // post as "seen" without posting a burst of old news into the channel.
    if (!config.aion2LastPostedDate) {
      db.saveGuildConfig(guildId, { aion2LastPostedDate: news[0].date });
      return;
    }

    const freshItems = news.filter((item) => item.date > lastSeenDate).sort((a, b) => a.date - b.date);
    if (freshItems.length === 0) return;

    for (const item of freshItems) {
      await channel.send({ embeds: [buildAion2NewsEmbed(item)] }).catch(() => {});
    }

    db.saveGuildConfig(guildId, { aion2LastPostedDate: freshItems[freshItems.length - 1].date });
  } catch (err) {
    console.error(`AION 2 news check failed for guild ${guildId}:`, err.message);
  }
}

function startAion2NewsScheduler(client) {
  const minutes = Number(process.env.AION2_CHECK_INTERVAL_MINUTES) || 30;
  const intervalMs = minutes * 60 * 1000;

  setInterval(() => {
    for (const guild of client.guilds.cache.values()) {
      checkGuild(client, guild.id);
    }
  }, intervalMs);

  console.log(`AION 2 news checker running every ${minutes} minute(s).`);
}

module.exports = { startAion2NewsScheduler };

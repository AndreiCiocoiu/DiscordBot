// Periodically posts a Romanian meme to every guild's memes channel (set up
// by /setup), with 👍/👎 reactions added so people can vote on it.
// Interval is configurable via MEME_INTERVAL_MINUTES, default 20.

const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const { fetchRomanianMeme, addVoteReactions } = require('./memeFetcher');
const { toSmallCaps } = require('./fancyFont');

async function postToGuild(client, guildId) {
  const config = db.getGuildConfig(guildId);
  if (!config?.memesChannelId) return;

  const channel = await client.channels.fetch(config.memesChannelId).catch(() => null);
  if (!channel) return;

  try {
    const meme = await fetchRomanianMeme();
    const embed = new EmbedBuilder()
      .setTitle(meme.title)
      .setImage(meme.imageUrl)
      .setColor(0xffce00)
      .setFooter({ text: `👍 ${meme.ups} · r/${meme.subreddit} · ${toSmallCaps('romania')} 🇷🇴` });

    const message = await channel.send({ embeds: [embed] });
    await addVoteReactions(message);
  } catch (err) {
    console.error(`Auto-meme post failed for guild ${guildId}:`, err.message);
  }
}

function startMemeScheduler(client) {
  const minutes = Number(process.env.MEME_INTERVAL_MINUTES) || 20;
  const intervalMs = minutes * 60 * 1000;

  setInterval(() => {
    for (const guild of client.guilds.cache.values()) {
      postToGuild(client, guild.id);
    }
  }, intervalMs);

  console.log(`Romanian meme auto-poster running every ${minutes} minute(s).`);
}

module.exports = { startMemeScheduler };

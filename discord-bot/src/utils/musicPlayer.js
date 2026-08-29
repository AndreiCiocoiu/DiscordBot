// Music, powered by discord-player + a custom yt-dlp-backed extractor.
//
// This doesn't scrape/decipher YouTube's web player in JS at all — yt-dlp
// (a large, near-daily-updated project) handles resolving and streaming.
// When YouTube changes something, yt-dlp typically has a fix within hours
// to days, which is far more reliable long-term than smaller JS libraries.

const { Player, QueueRepeatMode, GuildQueueEvent } = require('discord-player');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { toSmallCaps } = require('./fancyFont');
const { YtDlpExtractor } = require('./ytdlpExtractor');

// So prism-media (used internally by discord-player to transcode audio)
// can find ffmpeg without relying on it being on the system PATH.
process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || require('ffmpeg-static');

let player = null;

// Confirms yt-dlp (and the Python it needs) actually works on this machine,
// so a broken setup shows up clearly in the boot logs instead of only
// surfacing later as a vague "no results" on /play.
async function checkYtDlp() {
  const youtubedl = require('youtube-dl-exec');
  try {
    const version = await youtubedl('--version', {});
    console.log(`yt-dlp OK — version ${String(version).trim()}`);
  } catch (err) {
    console.error(
      '⚠️  yt-dlp self-test FAILED — /play will not work until this is fixed. Error:',
      err.stderr || err.message || err
    );
  }
}

// Called once from index.js after the Discord client is created.
async function initPlayer(client) {
  player = new Player(client);

  await player.extractors.register(YtDlpExtractor, {});
  await checkYtDlp();

  player.events.on(GuildQueueEvent.PlayerStart, async (queue, track) => {
    const embed = buildNowPlayingEmbed(track, queue.repeatMode);
    const row = buildControlsRow(queue.guild.id);
    await queue.metadata?.channel?.send({ embeds: [embed], components: [row] }).catch(() => {});
  });

  player.events.on(GuildQueueEvent.PlayerError, (queue, error) => {
    console.error('discord-player playback error:', error);
    queue.metadata?.channel
      ?.send(`Couldn't play that track (${error.message}), skipping.`)
      .catch(() => {});
  });

  player.events.on(GuildQueueEvent.Error, (queue, error) => {
    console.error('discord-player queue error:', error);
  });

  return player;
}

function getPlayer() {
  if (!player) throw new Error('Music player not initialized yet');
  return player;
}

function buildNowPlayingEmbed(track, repeatMode) {
  return new EmbedBuilder()
    .setTitle(`🎶 ${toSmallCaps('Now Playing')}`)
    .setDescription(`**${track.title}**`)
    .addFields(
      { name: toSmallCaps('Requested by'), value: `${track.requestedBy ?? 'Unknown'}`, inline: true },
      { name: toSmallCaps('Loop'), value: repeatMode === QueueRepeatMode.TRACK ? '🔁 On' : 'Off', inline: true }
    )
    .setColor(0x5865f2);
}

function buildControlsRow(guildId) {
  const queue = player?.nodes.get(guildId);
  const isPaused = !!queue?.node.isPaused();
  const looping = queue?.repeatMode === QueueRepeatMode.TRACK;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`music_pause_${guildId}`)
      .setEmoji(isPaused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`music_skip_${guildId}`).setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music_loop_${guildId}`)
      .setEmoji('🔁')
      .setStyle(looping ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music_stop_${guildId}`).setEmoji('⏹️').setStyle(ButtonStyle.Danger)
  );
}

// Plays (or queues) a song by search term or URL. Returns the resolved track.
async function playSong(voiceChannel, textChannel, query, requestedByUser) {
  const { track } = await player.play(voiceChannel, query, {
    nodeOptions: {
      metadata: { channel: textChannel },
      leaveOnEmpty: true,
      leaveOnEmptyCooldown: 60_000,
      leaveOnEnd: true,
      leaveOnEndCooldown: 60_000,
    },
    requestedBy: requestedByUser,
  });
  return track;
}

function getQueue(guildId) {
  return player?.nodes.get(guildId) ?? null;
}

function skip(guildId) {
  const queue = getQueue(guildId);
  if (!queue || !queue.currentTrack) return false;
  return queue.node.skip();
}

function stop(guildId) {
  const queue = getQueue(guildId);
  if (!queue) return false;
  queue.delete();
  return true;
}

function pause(guildId) {
  const queue = getQueue(guildId);
  if (!queue) return false;
  return queue.node.setPaused(true);
}

function resume(guildId) {
  const queue = getQueue(guildId);
  if (!queue) return false;
  return queue.node.setPaused(false);
}

function toggleLoop(guildId) {
  const queue = getQueue(guildId);
  if (!queue) return null;
  const looping = queue.repeatMode === QueueRepeatMode.TRACK;
  queue.setRepeatMode(looping ? QueueRepeatMode.OFF : QueueRepeatMode.TRACK);
  return !looping;
}

module.exports = {
  initPlayer,
  getPlayer,
  getQueue,
  playSong,
  skip,
  stop,
  pause,
  resume,
  toggleLoop,
  buildNowPlayingEmbed,
  buildControlsRow,
};

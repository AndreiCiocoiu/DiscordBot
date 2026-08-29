const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const play = require('play-dl');
const yts = require('yt-search');
const { toSmallCaps } = require('./fancyFont');

// guildId -> { connection, player, queue: [{title, url, requestedBy}], playing, loop, skipRequested, textChannel, nowPlayingMessage }
const queues = new Map();

function getQueue(guildId) {
  return queues.get(guildId);
}

function ensureQueue(guild, voiceChannel, textChannel) {
  let q = queues.get(guild.id);
  if (q) {
    q.textChannel = textChannel;
    return q;
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  q = {
    connection,
    player,
    queue: [],
    playing: false,
    loop: false,
    skipRequested: false,
    textChannel,
    nowPlayingMessage: null,
  };
  queues.set(guild.id, q);

  player.on(AudioPlayerStatus.Idle, () => {
    if (q.skipRequested) {
      q.skipRequested = false;
      q.queue.shift();
    } else if (!q.loop) {
      q.queue.shift();
    }
    // if q.loop and not skipping, keep queue[0] and replay it
    playCurrent(guild.id);
  });

  player.on('error', (err) => {
    console.error('Audio player error:', err);
    q.queue.shift();
    playCurrent(guild.id);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      connection.destroy();
      queues.delete(guild.id);
    }
  });

  return q;
}

function buildNowPlayingEmbed(track, loop) {
  return new EmbedBuilder()
    .setTitle(`🎶 ${toSmallCaps('Now Playing')}`)
    .setDescription(`**${track.title}**`)
    .addFields(
      { name: toSmallCaps('Requested by'), value: track.requestedBy, inline: true },
      { name: toSmallCaps('Loop'), value: loop ? '🔁 On' : 'Off', inline: true }
    )
    .setColor(0x5865f2);
}

function buildControlsRow(guildId) {
  const q = queues.get(guildId);
  const isPaused = q?.player?.state?.status === AudioPlayerStatus.Paused;
  const looping = !!q?.loop;

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

async function playCurrent(guildId) {
  const q = queues.get(guildId);
  if (!q) return;

  if (q.queue.length === 0) {
    q.playing = false;
    return;
  }

  const track = q.queue[0];
  try {
    const stream = await play.stream(track.url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    q.player.play(resource);
    q.playing = true;

    const embed = buildNowPlayingEmbed(track, q.loop);
    const row = buildControlsRow(guildId);
    q.nowPlayingMessage = await q.textChannel?.send({ embeds: [embed], components: [row] }).catch(() => null);
  } catch (err) {
    console.error('Failed to play track:', err);
    q.textChannel?.send(`Couldn't play **${track.title}**, skipping.`).catch(() => {});
    q.queue.shift();
    playCurrent(guildId);
  }
}

async function addTrack(guild, voiceChannel, textChannel, searchTermOrUrl, requestedBy) {
  let url = searchTermOrUrl;

  // yt_validate returns 'video' for a real watch URL, but 'search' (a truthy
  // string!) for plain text — so we must check for 'video' specifically,
  // not just truthiness, or search terms get passed straight to video_info.
  if (play.yt_validate(searchTermOrUrl) !== 'video') {
    const results = await yts(searchTermOrUrl);
    const video = results.videos?.[0];
    if (!video?.videoId) throw new Error('No results found for that search');
    // Build a canonical watch URL ourselves — yt-search's own .url field isn't
    // always in a shape play-dl's validator accepts.
    url = `https://www.youtube.com/watch?v=${video.videoId}`;
  }

  const info = await play.video_info(url);
  const track = {
    title: info.video_details.title,
    // Use the URL we already validated above, not info.video_details.url —
    // that field can come back empty and broke playback.
    url,
    requestedBy,
  };

  const q = ensureQueue(guild, voiceChannel, textChannel);
  q.queue.push(track);

  if (!q.playing) {
    playCurrent(guild.id);
  }

  return track;
}

function skip(guildId) {
  const q = queues.get(guildId);
  if (!q || q.queue.length === 0) return false;
  q.skipRequested = true;
  q.player.stop(); // triggers Idle -> playCurrent picks up the next track
  return true;
}

function stop(guildId) {
  const q = queues.get(guildId);
  if (!q) return false;
  q.queue = [];
  q.player.stop();
  q.connection.destroy();
  queues.delete(guildId);
  return true;
}

function pause(guildId) {
  const q = queues.get(guildId);
  if (!q) return false;
  return q.player.pause();
}

function resume(guildId) {
  const q = queues.get(guildId);
  if (!q) return false;
  return q.player.unpause();
}

function toggleLoop(guildId) {
  const q = queues.get(guildId);
  if (!q) return null;
  q.loop = !q.loop;
  return q.loop;
}

module.exports = {
  getQueue,
  addTrack,
  skip,
  stop,
  pause,
  resume,
  toggleLoop,
  buildNowPlayingEmbed,
  buildControlsRow,
};

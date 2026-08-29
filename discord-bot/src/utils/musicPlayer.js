const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const play = require('play-dl');

// guildId -> { connection, player, queue: [{title, url, requestedBy}], playing }
const queues = new Map();

function getQueue(guildId) {
  return queues.get(guildId);
}

function ensureQueue(guild, voiceChannel, textChannel) {
  let q = queues.get(guild.id);
  if (q) return q;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  q = { connection, player, queue: [], playing: false, textChannel };
  queues.set(guild.id, q);

  player.on(AudioPlayerStatus.Idle, () => {
    q.queue.shift();
    playNext(guild.id);
  });

  player.on('error', (err) => {
    console.error('Audio player error:', err);
    q.queue.shift();
    playNext(guild.id);
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

async function playNext(guildId) {
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
    q.textChannel?.send(`Now playing: **${track.title}** (requested by ${track.requestedBy})`);
  } catch (err) {
    console.error('Failed to play track:', err);
    q.textChannel?.send(`Couldn't play **${track.title}**, skipping.`);
    q.queue.shift();
    playNext(guildId);
  }
}

async function addTrack(guild, voiceChannel, textChannel, url, requestedBy) {
  const info = await play.video_info(url);
  const track = {
    title: info.video_details.title,
    url: info.video_details.url,
    requestedBy,
  };

  const q = ensureQueue(guild, voiceChannel, textChannel);
  q.queue.push(track);

  if (!q.playing) {
    playNext(guild.id);
  }

  return track;
}

function skip(guildId) {
  const q = queues.get(guildId);
  if (!q || q.queue.length === 0) return false;
  q.player.stop(); // triggers Idle -> playNext
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

module.exports = { getQueue, addTrack, skip, stop, pause, resume };

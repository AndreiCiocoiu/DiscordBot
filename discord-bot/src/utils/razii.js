// Razie (police raid) core: timers, history, config, role and voice.
// Everything is saved to disk so it survives restarts (on Railway, mount a
// Volume at the data folder, otherwise a redeploy wipes it).
// All Discord messages/buttons live in raziiUi.js.
const fs = require('fs');
const path = require('path');
const { PermissionFlagsBits } = require('discord.js');

const ui = () => require('./raziiUi'); // lazy: raziiUi requires this file

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'razii.json');
const ASSETS = path.join(__dirname, '..', '..', 'assets');
const DEFAULT_MINUTES = Number(process.env.RAZIE_MINUTES) || 180; // 3 hours
const WARN_MINUTES = Number(process.env.RAZIE_WARN_MINUTES) || 10;
const ROLE_NAME = 'Razie';
const HISTORY_CAP = 1000;
const MAX_ZONES = 25;
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a'];

fs.mkdirSync(DATA_DIR, { recursive: true });

let db = { timers: {}, config: {}, history: [] };
try {
  db = { timers: {}, config: {}, history: [], ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch { /* first run */ }

const handles = new Map(); // key -> { fire, warn }

const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const keyOf = (guildId, zone) => `${guildId}:${zone.trim().toLowerCase()}`;
const cleanZone = (zone) => zone.replace(/\s+/g, ' ').trim().slice(0, 60);
const log = (what) => (err) => console.error(`razii ${what}:`, err);
const cooldownLabel = () => (DEFAULT_MINUTES % 60 === 0 ? `${DEFAULT_MINUTES / 60}h` : `${DEFAULT_MINUTES} min`);

// ---- config -------------------------------------------------------------

const cfg = (guildId) => (db.config[guildId] ||= {});

function setConfig(guildId, patch) {
  Object.assign(cfg(guildId), patch);
  save();
}

function addZone(guildId, zone) {
  const c = cfg(guildId);
  c.zones ||= [];
  if (!c.zones.some((z) => z.toLowerCase() === zone.toLowerCase())) {
    c.zones.push(zone);
    if (c.zones.length > MAX_ZONES) c.zones.shift();
  }
}

function removeZone(guildId, zone) {
  const c = cfg(guildId);
  c.zones = (c.zones || []).filter((z) => z.toLowerCase() !== zone.toLowerCase());
  save();
}

const panelGuilds = () => Object.keys(db.config).filter((g) => db.config[g].panel);

// ---- role ---------------------------------------------------------------

async function ensureRole(guild) {
  const c = cfg(guild.id);
  let role = c.roleId ? await guild.roles.fetch(c.roleId).catch(() => null) : null;
  if (!role) {
    await guild.roles.fetch().catch(() => {});
    role = guild.roles.cache.find((r) => r.name.toLowerCase() === ROLE_NAME.toLowerCase()) || null;
  }
  if (!role) {
    role = await guild.roles
      .create({ name: ROLE_NAME, color: 0xe74c3c, mentionable: true, reason: 'Alerte de razie' })
      .catch((err) => { console.warn('razii: could not create role:', err.message); return null; });
  }
  if (role) { c.roleId = role.id; save(); }
  return role;
}

async function toggleRole(member) {
  const role = await ensureRole(member.guild);
  if (!role) return { ok: false };
  const has = member.roles.cache.has(role.id);
  await (has ? member.roles.remove(role) : member.roles.add(role));
  return { ok: true, has: !has, role };
}

// ---- timers -------------------------------------------------------------

function clearHandles(key) {
  const h = handles.get(key);
  if (h) { clearTimeout(h.fire); clearTimeout(h.warn); }
  handles.delete(key);
}

function schedule(client, entry) {
  clearHandles(entry.key);
  const now = Date.now();
  const h = {};
  h.fire = setTimeout(() => fire(client, entry).catch(log('fire')), Math.max(0, entry.endsAt - now));
  const warnAt = entry.endsAt - WARN_MINUTES * 60_000;
  if (!entry.warned && warnAt > now) {
    h.warn = setTimeout(() => warn(client, entry).catch(log('warn')), warnAt - now);
  }
  handles.set(entry.key, h);
}

// Starting a zone that already has a timer simply replaces it (fix a mistake
// by writing it again).
function start(client, { guildId, zone, minutes, channelId, userId }) {
  zone = cleanZone(zone);
  if (!zone) return { ok: false, reason: 'empty' };
  const key = keyOf(guildId, zone);
  const replaced = Boolean(db.timers[key]);
  if (replaced) clearHandles(key);

  const now = Date.now();
  const entry = {
    key, guildId, zone, channelId, userId, warned: false,
    startedAt: now,
    totalMs: DEFAULT_MINUTES * 60_000,
    endsAt: now + (minutes || DEFAULT_MINUTES) * 60_000,
  };
  db.timers[key] = entry;
  addZone(guildId, zone);
  save();
  schedule(client, entry);
  ui().updatePanel(client, guildId).catch(log('panel'));
  return { ok: true, entry, replaced };
}

function cancel(client, guildId, zone) {
  const key = keyOf(guildId, zone);
  const entry = db.timers[key];
  if (!entry) return null;
  clearHandles(key);
  delete db.timers[key];
  save();
  ui().updatePanel(client, guildId).catch(log('panel'));
  return entry;
}

function cancelAll(client, guildId) {
  const mine = list(guildId);
  for (const e of mine) { clearHandles(e.key); delete db.timers[e.key]; }
  save();
  ui().updatePanel(client, guildId).catch(log('panel'));
  return mine.length;
}

// The raid came before the timer ended: log it as confirmed right now and
// restart the full cooldown from this moment.
function earlyRaid(client, { guildId, zone, channelId, userId }) {
  const old = db.timers[keyOf(guildId, zone)];
  if (!old) return { ok: false, reason: 'none' };
  clearHandles(old.key);
  delete db.timers[old.key];
  db.history.push({ guildId, zone: old.zone, at: Date.now(), status: 'confirmed', early: true });
  if (db.history.length > HISTORY_CAP) db.history.splice(0, db.history.length - HISTORY_CAP);
  save();
  const res = start(client, { guildId, zone: old.zone, channelId, userId });
  return { ok: true, entry: res.entry, prevEndsAt: old.endsAt };
}

// Undo earlyRaid: drop the logged raid and put the old timer back.
function undoEarly(client, { guildId, zone, prevEndsAt, channelId, userId }) {
  const z = zone.toLowerCase();
  for (let i = db.history.length - 1; i >= 0; i--) {
    const h = db.history[i];
    if (h.guildId === guildId && h.zone.toLowerCase() === z && h.early) { db.history.splice(i, 1); break; }
  }
  cancel(client, guildId, zone);
  const minutes = (prevEndsAt - Date.now()) / 60_000;
  if (minutes > 0.1) return start(client, { guildId, zone, minutes, channelId, userId }).entry;
  save();
  return null;
}

const list = (guildId) =>
  Object.values(db.timers).filter((t) => t.guildId === guildId).sort((a, b) => a.endsAt - b.endsAt);

function restore(client) {
  for (const entry of Object.values(db.timers)) schedule(client, entry);
  console.log(`Razii: restored ${Object.keys(db.timers).length} timer(s).`);
  // keep the live panels fresh (progress bar + colour)
  setInterval(() => ui().refreshPanels(client).catch(log('refresh')), 60_000);
}

// ---- warn + fire --------------------------------------------------------

async function warn(client, entry) {
  entry.warned = true;
  save();
  if (cfg(entry.guildId).warn === false) return;
  await ui().announceWarn(client, entry);
}

async function fire(client, entry) {
  clearHandles(entry.key);
  delete db.timers[entry.key];
  db.history.push({ guildId: entry.guildId, zone: entry.zone, at: entry.endsAt, status: 'pending' });
  if (db.history.length > HISTORY_CAP) db.history.splice(0, db.history.length - HISTORY_CAP);
  save();

  const late = Date.now() - entry.endsAt > 60_000;
  await ui().announceFire(client, entry, late).catch(log('announce'));

  if (!late && cfg(entry.guildId).voice !== false) {
    const guild = await client.guilds.fetch(entry.guildId).catch(() => null);
    if (guild) await sirenInVoice(client, guild, entry.userId).catch(log('voice'));
  }
}

// ---- history + stats ----------------------------------------------------

function markHistory(guildId, zone, from, to) {
  const z = zone.toLowerCase();
  for (let i = db.history.length - 1; i >= 0; i--) {
    const h = db.history[i];
    if (h.guildId === guildId && h.zone.toLowerCase() === z && (from === null || h.status === from)) {
      h.status = to;
      save();
      return h;
    }
  }
  return null;
}

const STATUS_LABEL = { pending: 'neconfirmată', confirmed: 'confirmată', none: 'n-a fost' };

const recent = (guildId, n = 10) => db.history.filter((h) => h.guildId === guildId).slice(-n).reverse();

function stats(guildId) {
  const byZone = new Map();
  for (const h of db.history.filter((x) => x.guildId === guildId)) {
    const key = h.zone.toLowerCase();
    if (!byZone.has(key)) byZone.set(key, { zone: h.zone, total: 0, confirmed: 0, none: 0, times: [] });
    const z = byZone.get(key);
    z.total++;
    if (h.status === 'confirmed') { z.confirmed++; z.times.push(h.at); }
    if (h.status === 'none') z.none++;
  }
  const weekAgo = Date.now() - 7 * 24 * 3600_000;
  return [...byZone.values()].map((z) => {
    const gaps = z.times.slice(1).map((t, i) => t - z.times[i]);
    return {
      zone: z.zone, total: z.total, confirmed: z.confirmed, none: z.none,
      last: z.times.length ? z.times[z.times.length - 1] : null,
      avgGapMin: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 60_000) : null,
      last7: z.times.filter((t) => t > weekAgo).length,
    };
  }).sort((a, b) => b.confirmed - a.confirmed);
}

// ---- voice --------------------------------------------------------------

function pickVoiceChannel(client, guild, preferUserId) {
  const counts = new Map();
  for (const vs of guild.voiceStates.cache.values()) {
    if (!vs.channelId || vs.id === client.user.id || vs.member?.user?.bot) continue;
    counts.set(vs.channelId, (counts.get(vs.channelId) || 0) + 1);
  }
  const preferred = guild.voiceStates.cache.get(preferUserId)?.channelId;
  if (preferred && counts.has(preferred)) return guild.channels.cache.get(preferred);
  let best = null;
  for (const [id, n] of counts) if (!best || n > best.n) best = { id, n };
  return best ? guild.channels.cache.get(best.id) : null;
}

function findVoiceRecording() {
  for (const dir of [DATA_DIR, ASSETS]) {
    for (const ext of AUDIO_EXT) {
      const p = path.join(dir, `atentie.${ext}`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function audioFiles() {
  const files = [path.join(ASSETS, 'siren.wav')];
  const rec = findVoiceRecording();
  if (rec) files.push(rec);
  return files;
}

function saveRecording(buffer, ext) {
  for (const e of AUDIO_EXT) fs.rmSync(path.join(DATA_DIR, `atentie.${e}`), { force: true });
  fs.writeFileSync(path.join(DATA_DIR, `atentie.${ext}`), buffer);
}

async function playInChannel(guild, channel) {
  const voice = require('@discordjs/voice');
  const perms = channel.permissionsFor(guild.members.me);
  if (!perms?.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.Speak)) {
    throw new Error(`Botul nu are Connect/Speak în ${channel.name}.`);
  }
  const connection = voice.joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  try {
    await voice.entersState(connection, voice.VoiceConnectionStatus.Ready, 20_000);
    const player = voice.createAudioPlayer();
    connection.subscribe(player);
    for (const file of audioFiles()) {
      player.play(voice.createAudioResource(file));
      await voice.entersState(player, voice.AudioPlayerStatus.Playing, 10_000);
      await voice.entersState(player, voice.AudioPlayerStatus.Idle, 60_000);
    }
  } finally {
    connection.destroy();
  }
}

async function sirenInVoice(client, guild, preferUserId) {
  const channel = pickVoiceChannel(client, guild, preferUserId);
  if (channel) await playInChannel(guild, channel); // nobody in voice -> skip
}

module.exports = {
  // timers
  start, cancel, cancelAll, earlyRaid, undoEarly, list, restore,
  // config / zones / role
  cfg, setConfig, removeZone, panelGuilds, ensureRole, toggleRole,
  // history
  markHistory, recent, stats, STATUS_LABEL,
  // voice
  playInChannel, sirenInVoice, saveRecording, findVoiceRecording,
  // misc
  AUDIO_EXT, DEFAULT_MINUTES, WARN_MINUTES, cooldownLabel, save,
};

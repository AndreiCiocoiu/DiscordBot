// Razie core: timers, history, config, role, voice.
// Data is saved to disk (atomically), so it survives restarts. On Railway,
// mount a Volume at the data folder, otherwise a redeploy wipes it.
// Everything the user sees (messages, buttons, panel) is in raziiUi.js.
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
const HISTORY_CAP = 200;
const MAX_ZONES = 20;
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a'];

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---- storage ------------------------------------------------------------

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { timers: raw.timers || {}, config: raw.config || {}, history: raw.history || [] };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      try { fs.renameSync(FILE, `${FILE}.bak`); console.warn('razii: data file was corrupt, moved to razii.json.bak'); } catch { /* ignore */ }
    }
    return { timers: {}, config: {}, history: [] };
  }
}

let db = load();

function save() {
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db)); // write + rename = never half-written
  fs.renameSync(tmp, FILE);
}

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

function removeZone(guildId, zone) {
  const c = cfg(guildId);
  c.zones = (c.zones || []).filter((z) => z.toLowerCase() !== zone.toLowerCase());
  save();
}

function rememberZone(guildId, zone) {
  const c = cfg(guildId);
  c.zones ||= [];
  if (!c.zones.some((z) => z.toLowerCase() === zone.toLowerCase())) {
    c.zones.push(zone);
    if (c.zones.length > MAX_ZONES) c.zones.shift();
  }
}

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
  if (role && c.roleId !== role.id) { c.roleId = role.id; save(); }
  return role;
}

async function toggleRole(member) {
  const role = await ensureRole(member.guild);
  if (!role) return { ok: false };
  const has = member.roles.cache.has(role.id);
  await (has ? member.roles.remove(role) : member.roles.add(role));
  return { ok: true, has: !has };
}

// ---- timers -------------------------------------------------------------

const handles = new Map(); // key -> { fire, warn }

function clearHandles(key) {
  const h = handles.get(key);
  if (h) { clearTimeout(h.fire); clearTimeout(h.warn); }
  handles.delete(key);
}

function schedule(client, entry) {
  clearHandles(entry.key);
  const now = Date.now();
  const h = { fire: setTimeout(() => fire(client, entry).catch(log('fire')), Math.max(0, entry.endsAt - now)) };
  const warnAt = entry.endsAt - WARN_MINUTES * 60_000;
  if (!entry.warned && warnAt > now) h.warn = setTimeout(() => warn(client, entry).catch(log('warn')), warnAt - now);
  handles.set(entry.key, h);
}

function drop(client, entry) {
  clearHandles(entry.key);
  delete db.timers[entry.key];
  ui().clearWarn(client, entry).catch(log('clearWarn'));
}

// Starting a zone that already has a timer replaces it (fixes a mistake).
function start(client, { guildId, zone, minutes, userId }) {
  zone = cleanZone(zone || '');
  if (!zone) return { ok: false };
  const key = keyOf(guildId, zone);
  const old = db.timers[key];
  if (old) drop(client, old);

  const entry = { key, guildId, zone, userId, warned: false, endsAt: Date.now() + (minutes || DEFAULT_MINUTES) * 60_000 };
  db.timers[key] = entry;
  rememberZone(guildId, zone);
  save();
  schedule(client, entry);
  ui().updatePanel(client, guildId).catch(log('panel'));
  return { ok: true, entry, replaced: Boolean(old) };
}

function cancel(client, guildId, zone) {
  const entry = db.timers[keyOf(guildId, zone)];
  if (!entry) return null;
  drop(client, entry);
  save();
  ui().updatePanel(client, guildId).catch(log('panel'));
  return entry;
}

function cancelAll(client, guildId) {
  const mine = list(guildId);
  mine.forEach((e) => drop(client, e));
  save();
  ui().updatePanel(client, guildId).catch(log('panel'));
  return mine.length;
}

const list = (guildId) =>
  Object.values(db.timers).filter((t) => t.guildId === guildId).sort((a, b) => a.endsAt - b.endsAt);

function restore(client) {
  for (const entry of Object.values(db.timers)) schedule(client, entry);
  console.log(`Razii: restored ${Object.keys(db.timers).length} timer(s).`);
}

async function warn(client, entry) {
  entry.warned = true;
  save();
  if (cfg(entry.guildId).warn === false) return;
  await ui().announceWarn(client, entry);
}

async function fire(client, entry) {
  drop(client, entry);
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

// The raid came before the timer ended: log it now and restart the cooldown.
function earlyRaid(client, { guildId, zone, userId }) {
  const old = db.timers[keyOf(guildId, zone)];
  if (!old) return { ok: false };
  drop(client, old);
  db.history.push({ guildId, zone: old.zone, at: Date.now(), status: 'confirmed', early: true });
  if (db.history.length > HISTORY_CAP) db.history.splice(0, db.history.length - HISTORY_CAP);
  const res = start(client, { guildId, zone: old.zone, userId });
  return { ok: true, entry: res.entry, prevEndsAt: old.endsAt };
}

// Undo earlyRaid: remove the logged raid and put the old timer back.
function undoEarly(client, { guildId, zone, prevEndsAt, userId }) {
  const z = zone.toLowerCase();
  for (let i = db.history.length - 1; i >= 0; i--) {
    const h = db.history[i];
    if (h.guildId === guildId && h.zone.toLowerCase() === z && h.early) { db.history.splice(i, 1); break; }
  }
  cancel(client, guildId, zone);
  const minutes = (prevEndsAt - Date.now()) / 60_000;
  const entry = minutes > 0.1 ? start(client, { guildId, zone, minutes, userId }).entry : null;
  save();
  return entry;
}

// ---- history ------------------------------------------------------------

function markHistory(guildId, zone, from, to) {
  const z = zone.toLowerCase();
  for (let i = db.history.length - 1; i >= 0; i--) {
    const h = db.history[i];
    if (h.guildId === guildId && h.zone.toLowerCase() === z && h.status === from) { h.status = to; save(); return h; }
  }
  return null;
}

const STATUS_LABEL = { pending: 'neconfirmată', confirmed: 'confirmată', none: 'n-a fost' };
const recent = (guildId, n = 10) => db.history.filter((h) => h.guildId === guildId).slice(-n).reverse();

// ---- voice (one at a time per server) -----------------------------------

const voiceQueues = new Map();

function queueVoice(guildId, job) {
  const prev = voiceQueues.get(guildId) || Promise.resolve();
  const next = prev.catch(() => {}).then(job);
  voiceQueues.set(guildId, next);
  next.catch(() => {}).finally(() => { if (voiceQueues.get(guildId) === next) voiceQueues.delete(guildId); });
  return next;
}

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

function saveRecording(buffer, ext) {
  for (const e of AUDIO_EXT) fs.rmSync(path.join(DATA_DIR, `atentie.${e}`), { force: true });
  fs.writeFileSync(path.join(DATA_DIR, `atentie.${ext}`), buffer);
}

function playInChannel(guild, channel) {
  return queueVoice(guild.id, async () => {
    const voice = require('@discordjs/voice');
    const perms = channel.permissionsFor(guild.members.me);
    if (!perms?.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.Speak)) {
      throw new Error(`Botul nu are Connect/Speak în ${channel.name}.`);
    }
    voice.getVoiceConnection(guild.id)?.destroy(); // never keep a stale connection
    const connection = voice.joinVoiceChannel({
      channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true,
    });
    try {
      await voice.entersState(connection, voice.VoiceConnectionStatus.Ready, 20_000);
      const player = voice.createAudioPlayer();
      connection.subscribe(player);
      const files = [path.join(ASSETS, 'siren.wav'), findVoiceRecording()].filter(Boolean);
      for (const file of files) {
        player.play(voice.createAudioResource(file));
        await voice.entersState(player, voice.AudioPlayerStatus.Playing, 10_000);
        await voice.entersState(player, voice.AudioPlayerStatus.Idle, 60_000);
      }
    } finally {
      connection.destroy();
    }
  });
}

async function sirenInVoice(client, guild, preferUserId) {
  const channel = pickVoiceChannel(client, guild, preferUserId);
  if (channel) await playInChannel(guild, channel); // nobody in voice -> skip
}

module.exports = {
  start, cancel, cancelAll, earlyRaid, undoEarly, list, restore,
  cfg, setConfig, removeZone, ensureRole, toggleRole,
  markHistory, recent, STATUS_LABEL,
  playInChannel, saveRecording, findVoiceRecording,
  save, AUDIO_EXT, DEFAULT_MINUTES, WARN_MINUTES, cooldownLabel,
};

// Razie (police raid) tracking for RDR2 Online.
// Timers + history are saved to disk, so they survive restarts (on Railway,
// mount a Volume at the data folder, otherwise a redeploy wipes them).
const fs = require('fs');
const path = require('path');
const {
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'razii.json');
const ASSETS = path.join(__dirname, '..', '..', 'assets');
const DEFAULT_MINUTES = Number(process.env.RAZIE_MINUTES) || 180; // 3 hours
const WARN_MINUTES = Number(process.env.RAZIE_WARN_MINUTES) || 10;
const ROLE_NAME = 'Razie';
const HISTORY_CAP = 1000;
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a'];

fs.mkdirSync(DATA_DIR, { recursive: true });

let db = { timers: {}, config: {}, history: [] };
try {
  db = { timers: {}, config: {}, history: [], ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch { /* first run */ }

const handles = new Map(); // key -> { fire, warn }

const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const keyOf = (guildId, zone) => `${guildId}:${zone.trim().toLowerCase()}`;
const unix = (ms) => Math.floor(ms / 1000);
const cleanZone = (zone) => zone.replace(/\s+/g, ' ').trim().slice(0, 60);
const log = (what) => (err) => console.error(`razii ${what}:`, err);
const cooldownLabel = () => (DEFAULT_MINUTES % 60 === 0 ? `${DEFAULT_MINUTES / 60}h` : `${DEFAULT_MINUTES} min`);

// ---- role ---------------------------------------------------------------

async function ensureRole(guild) {
  const cfg = (db.config[guild.id] ||= {});
  let role = cfg.roleId ? await guild.roles.fetch(cfg.roleId).catch(() => null) : null;
  if (!role) {
    await guild.roles.fetch().catch(() => {});
    role = guild.roles.cache.find((r) => r.name.toLowerCase() === ROLE_NAME.toLowerCase()) || null;
  }
  if (!role) {
    role = await guild.roles
      .create({ name: ROLE_NAME, color: 0xe74c3c, mentionable: true, reason: 'Alerte de razie' })
      .catch((err) => { console.warn('razii: could not create role:', err.message); return null; });
  }
  if (role) { cfg.roleId = role.id; save(); }
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

function start(client, { guildId, zone, minutes, channelId, userId }) {
  zone = cleanZone(zone);
  if (!zone) return { ok: false, reason: 'empty' };
  const key = keyOf(guildId, zone);
  if (db.timers[key]) return { ok: false, reason: 'running', entry: db.timers[key] };

  const entry = {
    key, guildId, zone, channelId, userId, warned: false,
    endsAt: Date.now() + (minutes || DEFAULT_MINUTES) * 60_000,
  };
  db.timers[key] = entry;
  save();
  schedule(client, entry);
  updatePanel(client, guildId).catch(log('panel'));
  return { ok: true, entry };
}

function cancel(client, guildId, zone) {
  const key = keyOf(guildId, zone);
  const entry = db.timers[key];
  if (!entry) return null;
  clearHandles(key);
  delete db.timers[key];
  save();
  updatePanel(client, guildId).catch(log('panel'));
  return entry;
}

const list = (guildId) =>
  Object.values(db.timers).filter((t) => t.guildId === guildId).sort((a, b) => a.endsAt - b.endsAt);

function restore(client) {
  for (const entry of Object.values(db.timers)) schedule(client, entry);
  console.log(`Razii: restored ${Object.keys(db.timers).length} timer(s).`);
}

function setChannel(guildId, channelId) {
  (db.config[guildId] ||= {}).channelId = channelId;
  save();
}

async function notifyChannel(client, entry) {
  const id = db.config[entry.guildId]?.channelId || entry.channelId;
  const ch = await client.channels.fetch(id).catch(() => null);
  return ch?.isTextBased() ? ch : null;
}

// ---- warn + fire --------------------------------------------------------

async function warn(client, entry) {
  entry.warned = true;
  save();
  const guild = await client.guilds.fetch(entry.guildId).catch(() => null);
  const channel = await notifyChannel(client, entry);
  if (!guild || !channel) return;
  const role = await ensureRole(guild);
  await channel.send({
    content: `Razie posibilă în ~${WARN_MINUTES} minute în **${entry.zone}**. ${role ? `<@&${role.id}>` : ''}`.trim(),
    allowedMentions: { roles: role ? [role.id] : [] },
  });
}

async function fire(client, entry) {
  clearHandles(entry.key);
  delete db.timers[entry.key];
  db.history.push({ guildId: entry.guildId, zone: entry.zone, at: entry.endsAt, status: 'pending' });
  if (db.history.length > HISTORY_CAP) db.history.splice(0, db.history.length - HISTORY_CAP);
  save();

  const guild = await client.guilds.fetch(entry.guildId).catch(() => null);
  if (!guild) return;
  const late = Date.now() - entry.endsAt > 60_000;
  const channel = await notifyChannel(client, entry);
  const role = await ensureRole(guild);

  if (channel) {
    await channel.send({
      content:
        `🚨 **Posibilă razie** în **${entry.zone}**! ${role ? `<@&${role.id}> ` : ''}<@${entry.userId}>` +
        (late ? `\n(Botul a fost oprit, timerul s-a terminat <t:${unix(entry.endsAt)}:R>.)` : ''),
      components: [confirmRow(entry.zone)],
      allowedMentions: { users: [entry.userId], roles: role ? [role.id] : [] },
    }).catch(log('send'));
  }

  updatePanel(client, entry.guildId).catch(log('panel'));
  if (!late) await sirenInVoice(client, guild, entry.userId).catch(log('voice'));
}

// ---- history + stats ----------------------------------------------------

function markHistory(guildId, zone, status) {
  const z = zone.toLowerCase();
  for (let i = db.history.length - 1; i >= 0; i--) {
    const h = db.history[i];
    if (h.guildId === guildId && h.zone.toLowerCase() === z && h.status === 'pending') {
      h.status = status;
      save();
      return h;
    }
  }
  return null;
}

const STATUS_LABEL = { pending: 'neconfirmată', confirmed: 'confirmată', none: 'n-a fost' };

function recent(guildId, n = 10) {
  return db.history.filter((h) => h.guildId === guildId).slice(-n).reverse();
}

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

// ---- buttons + panel ----------------------------------------------------

function confirmRow(zone) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rz:y:${zone}`).setLabel(`A fost razie, repornește ${cooldownLabel()}`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rz:n:${zone}`).setLabel("N-a fost").setStyle(ButtonStyle.Secondary),
  );
}

const roleRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rz:role').setLabel('Primesc / nu mai primesc alerte').setStyle(ButtonStyle.Primary),
  );

async function handleButton(interaction, client) {
  const id = interaction.customId;
  if (!id.startsWith('rz:')) return false;

  if (id === 'rz:role') {
    const res = await toggleRole(interaction.member);
    await interaction.reply({
      content: !res.ok
        ? 'Nu pot da rolul (botul are nevoie de permisiunea Manage Roles).'
        : res.has ? 'Ai primit rolul **Razie**, vei primi alertele.' : 'Ți-am scos rolul **Razie**.',
      ephemeral: true,
    });
    return true;
  }

  const [, kind, ...rest] = id.split(':');
  const zone = rest.join(':');
  const base = interaction.message.content;

  if (kind === 'y') {
    markHistory(interaction.guildId, zone, 'confirmed');
    const res = start(client, {
      guildId: interaction.guildId, zone, channelId: interaction.channelId, userId: interaction.user.id,
    });
    const next = res.ok ? `Următoarea posibilă <t:${unix(res.entry.endsAt)}:R>.` : 'Timerul era deja pornit.';
    await interaction.update({
      content: `${base}\nRazie confirmată de <@${interaction.user.id}>. ${next}`,
      components: [],
      allowedMentions: { parse: [] },
    });
  } else if (kind === 'n') {
    markHistory(interaction.guildId, zone, 'none');
    updatePanel(client, interaction.guildId).catch(log('panel'));
    await interaction.update({
      content: `${base}\nN-a fost razie (<@${interaction.user.id}>).`,
      components: [],
      allowedMentions: { parse: [] },
    });
  }
  if (kind === 'y') updatePanel(client, interaction.guildId).catch(log('panel'));
  return true;
}

function panelPayload(guildId) {
  const timers = list(guildId);
  const lines = timers.length
    ? timers.map((t) => `**${t.zone}**: <t:${unix(t.endsAt)}:R> (<t:${unix(t.endsAt)}:t>)`).join('\n')
    : 'Niciun timer activ.';
  const last = recent(guildId, 3)
    .map((h) => `**${h.zone}**: <t:${unix(h.at)}:R> (${STATUS_LABEL[h.status]})`)
    .join('\n');
  const embed = new EmbedBuilder()
    .setTitle('Razii')
    .setColor(0xe74c3c)
    .setDescription(lines.slice(0, 3500))
    .setFooter({ text: 'Se actualizează automat. Scrie "razie <zona>" ca să pornești un timer.' });
  if (last) embed.addFields({ name: 'Ultimele', value: last.slice(0, 1000) });
  return { content: '', embeds: [embed], components: [roleRow()], allowedMentions: { parse: [] } };
}

async function updatePanel(client, guildId) {
  const p = db.config[guildId]?.panel;
  if (!p) return;
  const channel = await client.channels.fetch(p.channelId).catch(() => null);
  const msg = channel ? await channel.messages.fetch(p.messageId).catch(() => null) : null;
  if (!msg) { delete db.config[guildId].panel; save(); return; }
  await msg.edit(panelPayload(guildId));
}

async function createPanel(client, channel) {
  const guildId = channel.guild.id;
  const old = db.config[guildId]?.panel;
  if (old) {
    const oc = await client.channels.fetch(old.channelId).catch(() => null);
    const om = oc ? await oc.messages.fetch(old.messageId).catch(() => null) : null;
    await om?.delete().catch(() => {});
  }
  const msg = await channel.send(panelPayload(guildId));
  await msg.pin().catch(() => {}); // needs Manage Messages, optional
  (db.config[guildId] ||= {}).panel = { channelId: channel.id, messageId: msg.id };
  save();
  await ensureRole(channel.guild);
  return msg;
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

// ---- text helpers -------------------------------------------------------

function startMessage(result) {
  if (!result.ok && result.reason === 'empty') return 'Scrie zona, ex: `razie Valentine`.';
  if (!result.ok && result.reason === 'running') {
    return `**${result.entry.zone}** are deja timer, se termină <t:${unix(result.entry.endsAt)}:R> (<t:${unix(result.entry.endsAt)}:t>).`;
  }
  const t = unix(result.entry.endsAt);
  return `Timer pornit pentru **${result.entry.zone}**. Posibilă razie <t:${t}:R> (<t:${t}:t>).`;
}

module.exports = {
  start, cancel, list, restore, setChannel, startMessage,
  handleButton, createPanel, updatePanel, toggleRole, ensureRole,
  recent, stats, STATUS_LABEL,
  playInChannel, sirenInVoice, saveRecording, findVoiceRecording,
  AUDIO_EXT, DEFAULT_MINUTES, WARN_MINUTES,
};

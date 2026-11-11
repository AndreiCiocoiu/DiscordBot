// Game session planner: one pinned panel in the sessions channel, one message
// per planned session with Vin / Poate / Nu vin buttons.
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const store = require('./store');
const { parseWhen, REASONS } = require('./timeparse');
const adminlog = require('./adminlog');
const { AttachmentBuilder } = require('discord.js');
const { render } = require('./announce');
const banner = require('./panelBanner');

const GREEN = 0x8a5a2b, GREY = 0x95a5a6; // western brown
const NO_PING = { parse: [] };
const REMIND_MIN = 30;
const KEEP_AFTER_START_MS = 3 * 3600_000;
const MAX_ACTIVE = 15;
const log = (what) => (err) => console.error(`sessions ${what}:`, err);
const unix = (ms) => Math.floor(ms / 1000);
const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...c) => new ActionRowBuilder().addComponents(...c);
const tzOf = (guildId) => store.cfg(guildId).tz || 'Europe/Bucharest';

const timers = new Map(); // sessionId -> { remind, cleanup }

// ---- role (opt-in notifications) ----------------------------------------

async function ensureRole(guild) {
  const c = store.cfg(guild.id);
  let role = c.sessionsRoleId ? await guild.roles.fetch(c.sessionsRoleId).catch(() => null) : null;
  if (!role) {
    await guild.roles.fetch().catch(() => {});
    role = guild.roles.cache.find((r) => r.name.toLowerCase() === 'evenimente') || null;
    if (!role) { // old name: rename it, members keep it
      const old = guild.roles.cache.find((r) => r.name.toLowerCase() === 'sesiuni');
      if (old) role = await old.setName('Evenimente', 'Sesiuni -> Evenimente').catch(() => old);
    }
  }
  if (!role) {
    role = await guild.roles.create({ name: 'Evenimente', color: 0x2ecc71, mentionable: true, reason: 'Notificări evenimente' })
      .catch((err) => { console.warn('sessions: could not create role:', err.message); return null; });
  }
  if (role && c.sessionsRoleId !== role.id) store.setConfig(guild.id, { sessionsRoleId: role.id });
  return role;
}

// ---- rendering ----------------------------------------------------------

const names = (s, status) => Object.entries(s.rsvp).filter(([, v]) => v === status).map(([id]) => `<@${id}>`);
const field = (title, list) => ({ name: `${title} (${list.length})`, value: list.join(' ').slice(0, 1000) || '-', inline: true });

function whenText(s) {
  try {
    return new Intl.DateTimeFormat('ro-RO', { timeZone: tzOf(s.guildId), weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(s.startsAt));
  } catch { return new Date(s.startsAt).toISOString(); }
}

// The parchment sheet (title, when, details, organizer). Hours are shown in the server time zone;
// the "Când" field under it shows the time in each person's own time zone.
function sheet(s) {
  const text = `Când: ${whenText(s)} (${tzOf(s.guildId)})${s.details ? `\n\n${s.details}` : ''}`;
  return new AttachmentBuilder(render({ title: s.title.toUpperCase().slice(0, 40), text, author: s.hostName }), { name: 'eveniment.png', description: `${s.title}: ${text}`.slice(0, 1000) });
}

function sessionEmbed(s) {
  return new EmbedBuilder()
    .setColor(GREEN)
    .setImage('attachment://eveniment.png')
    .addFields(
      { name: 'Când', value: `<t:${unix(s.startsAt)}:F> · <t:${unix(s.startsAt)}:R>`, inline: false },
      field('Vin', names(s, 'y')),
      field('Poate', names(s, 'm')),
      field('Nu vin', names(s, 'n')),
    );
}

const sessionRows = (s) => [
  row(btn(`se:y:${s.id}`, 'Vin', ButtonStyle.Success), btn(`se:m:${s.id}`, 'Poate'), btn(`se:n:${s.id}`, 'Nu vin', ButtonStyle.Danger)),
  row(btn(`se:x:${s.id}`, 'Anulează evenimentul')),
];

function panelPayload() {
  const embed = new EmbedBuilder()
    .setColor(GREEN)
    .setTitle('Evenimente')
    .setImage(banner.URL)
    .setDescription('Apasă **Planifică eveniment**, scrie ce faceți și când (ex: `azi 21:00`, `mâine 20:30`, `sâmbătă 22:00`, `28.10 21:00`). Apare o foaie western cu @everyone ascuns, iar fiecare spune dacă vine.');
  return {
    embeds: [embed],
    components: [row(btn('se:new', 'Planifică eveniment', ButtonStyle.Success))],
    allowedMentions: NO_PING,
  };
}

async function postPanel(client, channel) {
  const msg = await channel.send(banner.withBanner(panelPayload()));
  await msg.pin().catch(() => {});
  store.setConfig(channel.guild.id, { sessionsPanelId: msg.id });
  return msg;
}

// ---- scheduling ---------------------------------------------------------

function clearTimers(id) {
  const t = timers.get(id);
  if (t) { clearTimeout(t.remind); clearTimeout(t.cleanup); }
  timers.delete(id);
}

async function removeSession(client, s, { deleteMessage }) {
  clearTimers(s.id);
  delete store.db.sessions[s.id];
  store.save();
  if (!deleteMessage) return;
  const ch = await client.channels.fetch(s.channelId).catch(() => null);
  const msg = ch ? await ch.messages.fetch(s.messageId).catch(() => null) : null;
  await msg?.delete().catch(() => {});
}

async function remind(client, s) {
  s.reminded = true;
  store.save();
  const ch = await client.channels.fetch(s.channelId).catch(() => null);
  if (!ch) return;
  const going = Object.entries(s.rsvp).filter(([, v]) => v === 'y' || v === 'm').map(([id]) => id);
  await ch.send({
    content: `Începe <t:${unix(s.startsAt)}:R>: **${s.title}** ${going.map((id) => `<@${id}>`).join(' ')}`.trim(),
    reply: { messageReference: s.messageId, failIfNotExists: false },
    allowedMentions: { users: going },
  }).catch(log('remind'));
}

function schedule(client, s) {
  clearTimers(s.id);
  const now = Date.now();
  const t = {};
  const remindAt = s.startsAt - REMIND_MIN * 60_000;
  if (!s.reminded && remindAt > now) t.remind = setTimeout(() => remind(client, s).catch(log('remind')), remindAt - now);
  t.cleanup = setTimeout(() => removeSession(client, s, { deleteMessage: true }).catch(log('cleanup')),
    Math.max(0, s.startsAt + KEEP_AFTER_START_MS - now));
  timers.set(s.id, t);
}

function restore(client) {
  for (const s of Object.values(store.db.sessions)) schedule(client, s);
  console.log(`Sessions: restored ${Object.keys(store.db.sessions).length}.`);
}

// ---- interactions -------------------------------------------------------

const sessionModal = () =>
  new ModalBuilder().setCustomId('se:m').setTitle('Planifică eveniment').addComponents(
    row(new TextInputBuilder().setCustomId('title').setLabel('Ce jucăm / ce facem').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80).setPlaceholder('ex: RDR2 Online, jaf la bancă')),
    row(new TextInputBuilder().setCustomId('when').setLabel('Când').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30).setPlaceholder('azi 21:00 · mâine 20:30 · sâmbătă 22:00 · 28.10 21:00')),
    row(new TextInputBuilder().setCustomId('details').setLabel('Detalii (opțional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
  );

async function createSession(interaction, client) {
  const guildId = interaction.guildId;
  const c = store.cfg(guildId);
  const channelId = c.sessionsId || interaction.channelId;
  const reply = (content) => interaction.reply({ content, ephemeral: true, allowedMentions: NO_PING });

  const when = parseWhen(interaction.fields.getTextInputValue('when'), { tz: tzOf(guildId) });
  if (!when.ok) {
    return reply(`${REASONS[when.reason]} Exemple: \`azi 21:00\`, \`mâine 20:30\`, \`sâmbătă 22:00\`, \`28.10 21:00\`. (Fus orar: ${tzOf(guildId)})`);
  }
  if (Object.keys(store.db.sessions).filter((id) => store.db.sessions[id].guildId === guildId).length >= MAX_ACTIVE) {
    return reply(`Sunt deja ${MAX_ACTIVE} evenimente active. Anulează unul vechi.`);
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return reply('Nu găsesc canalul de evenimente. Un admin scrie `server setup`.');

  const s = {
    id: Date.now().toString(36),
    guildId, channelId,
    hostId: interaction.user.id,
    hostName: interaction.member?.displayName || interaction.user.username,
    title: interaction.fields.getTextInputValue('title').trim(),
    details: interaction.fields.getTextInputValue('details').trim(),
    startsAt: when.ts,
    rsvp: { [interaction.user.id]: 'y' },
    reminded: false,
  };

  const msg = await channel.send({
    content: '||@everyone||', // hidden, but it still pings everyone
    embeds: [sessionEmbed(s)],
    files: [sheet(s)],
    components: sessionRows(s),
    allowedMentions: { parse: ['everyone'] },
  }).catch(log('send'));
  if (!msg) return reply('Nu pot scrie în canalul de evenimente (verifică permisiunile botului).');

  s.messageId = msg.id;
  store.db.sessions[s.id] = s;
  store.save();
  schedule(client, s);
  adminlog.action(client, guildId, 'Eveniment planificat', `**${s.title}** · <t:${unix(s.startsAt)}:F>`, interaction.user.id);
  return reply(`Postat în <#${channelId}>.`);
}

async function handleInteraction(interaction, client) {
  const id = interaction.customId;
  if (!id || !id.startsWith('se:')) return false;
  const [, kind, sid] = id.split(':');
  const say = (content) => interaction.reply({ content, ephemeral: true, allowedMentions: NO_PING });

  if (interaction.isModalSubmit() && kind === 'm') { await createSession(interaction, client); return true; }
  if (!interaction.isButton()) return true;

  if (kind === 'new') { await interaction.showModal(sessionModal()); return true; }

  if (kind === 'role') {
    const role = await ensureRole(interaction.guild);
    if (!role) { await say('Nu pot da rolul (botul are nevoie de Manage Roles, iar rolul lui trebuie să fie deasupra lui @Evenimente).'); return true; }
    const has = interaction.member.roles.cache.has(role.id);
    await (has ? interaction.member.roles.remove(role) : interaction.member.roles.add(role));
    await say(has ? 'Ți-am scos rolul **Evenimente**.' : 'Ai primit rolul **Evenimente**, vei fi anunțat la evenimente noi.');
    return true;
  }

  const s = store.db.sessions[sid];
  if (!s) { await say('Evenimentul ăsta nu mai există.'); return true; }

  if (kind === 'y' || kind === 'm' || kind === 'n') {
    if (s.rsvp[interaction.user.id] === kind) delete s.rsvp[interaction.user.id]; // press again = take it back
    else s.rsvp[interaction.user.id] = kind;
    store.save();
    await interaction.update({ embeds: [sessionEmbed(s)], files: [sheet(s)], attachments: [], components: sessionRows(s), allowedMentions: NO_PING });
    return true;
  }

  if (kind === 'x') {
    const allowed = interaction.user.id === s.hostId || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (!allowed) { await say('Doar organizatorul sau un admin poate anula evenimentul.'); return true; }
    adminlog.action(client, s.guildId, 'Eveniment anulat', `**${s.title}**`, interaction.user.id);
    await say('Evenimentul a fost anulat.');
    await removeSession(client, s, { deleteMessage: true });
    return true;
  }
  return true;
}

module.exports = { handleInteraction, restore, postPanel, panelPayload, sessionEmbed, ensureRole };

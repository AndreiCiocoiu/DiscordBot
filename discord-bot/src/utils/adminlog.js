// Admin log: records (almost) everything that happens on the server in one
// private channel. Needs the "Server Members" and "Message Content" intents and
// the View Audit Log + Manage Server permissions to show who did what.
const { EmbedBuilder, Events, AuditLogEvent, ChannelType } = require('discord.js');
const store = require('./store');

const COLOR = {
  join: 0x2ecc71, leave: 0xe67e22, ban: 0xe74c3c, member: 0x3498db, msgDel: 0xe74c3c, msgEdit: 0xf1c40f,
  channel: 0x9b59b6, role: 0x1abc9c, voice: 0x5dade2, server: 0xe91e63, invite: 0x95a5a6, action: 0x5865f2, automod: 0xc0392b,
};
const CHANNEL_TYPE = {
  [ChannelType.GuildText]: 'text', [ChannelType.GuildVoice]: 'voce', [ChannelType.GuildCategory]: 'categorie',
  [ChannelType.GuildAnnouncement]: 'anunțuri', [ChannelType.GuildStageVoice]: 'stage', [ChannelType.GuildForum]: 'forum',
};

const unix = (ms) => Math.floor(ms / 1000);
const clip = (s, n = 1000) => { s = String(s ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mention = (id) => (id ? `<@${id}>` : '-');
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const warned = new Set();

// ---- posting ------------------------------------------------------------

function embed(color, title, description, fields = [], user = null) {
  const e = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
  if (description) e.setDescription(clip(description, 3500));
  const f = fields.filter(Boolean).map((x) => ({ name: x.name, value: clip(x.value || '-', 1000), inline: x.inline ?? false }));
  if (f.length) e.addFields(f.slice(0, 20));
  if (user) {
    const icon = user.displayAvatarURL?.();
    e.setAuthor({ name: clip(user.tag ?? user.username ?? String(user.id), 250), ...(typeof icon === 'string' && icon.startsWith('http') ? { iconURL: icon } : {}) });
    e.setFooter({ text: `ID ${user.id}` });
  }
  return e;
}

async function post(client, guildId, e, files) {
  const id = store.cfg(guildId).logId;
  if (!id) return;
  const ch = await client.channels.fetch(id).catch(() => null);
  if (!ch?.isTextBased()) return;
  await ch.send({ embeds: [e], files, allowedMentions: { parse: [] } }).catch((err) => {
    if (!warned.has(guildId)) { warned.add(guildId); console.warn(`adminlog: cannot write in the log channel: ${err.message}`); }
  });
}

// The bot's own features (razie, sessions, welcome...) report here.
function action(client, guildId, title, description, userId) {
  return post(client, guildId, embed(COLOR.action, title, `${description}${userId ? `\nDe: <@${userId}>` : ''}`)).catch(() => {});
}

// Who did it, from the audit log (null if the bot can't read it).
async function audit(guild, type, targetId, windowMs = 15_000) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 8 });
    const now = Date.now();
    return logs.entries.find((e) => (!targetId || e.targetId === targetId) && now - e.createdTimestamp < windowMs) || null;
  } catch { return null; }
}
const by = (entry) => (entry?.executor ? { name: 'Făcut de', value: `${mention(entry.executor.id)}${entry.reason ? `\nMotiv: ${entry.reason}` : ''}`, inline: true } : null);

// ---- invites ------------------------------------------------------------

const invites = new Map(); // guildId -> Map(code -> { uses, inviterId })

async function cacheInvites(guild) {
  try {
    const list = await guild.invites.fetch();
    invites.set(guild.id, new Map(list.map((i) => [i.code, { uses: i.uses ?? 0, inviterId: i.inviter?.id }])));
  } catch { /* no Manage Server permission */ }
}

async function usedInvite(guild) {
  const before = invites.get(guild.id);
  await cacheInvites(guild);
  const after = invites.get(guild.id);
  if (!before || !after) return null;
  for (const [code, v] of after) if (v.uses > (before.get(code)?.uses ?? 0)) return { code, inviterId: v.inviterId, uses: v.uses };
  for (const code of before.keys()) if (!after.has(code)) return { code, inviterId: before.get(code).inviterId, uses: null, note: 'invitație cu o singură folosire sau expirată' };
  return null;
}

// ---- helpers for diffs --------------------------------------------------

const change = (name, a, b) => (a !== b ? { name, value: `${clip(a ?? '-', 450)}\n→ ${clip(b ?? '-', 450)}`, inline: true } : null);

function overwriteChanges(oldC, newC) {
  const out = [];
  const o = oldC.permissionOverwrites?.cache, n = newC.permissionOverwrites?.cache;
  if (!o || !n) return out;
  for (const [id, ow] of n) {
    const prev = o.get(id);
    const label = `<@${ow.type === 0 ? '&' : ''}${id}>`;
    if (!prev) out.push(`${label}: adăugat`);
    else if (prev.allow.bitfield !== ow.allow.bitfield || prev.deny.bitfield !== ow.deny.bitfield) out.push(`${label}: schimbat`);
  }
  for (const [id, ow] of o) if (!n.has(id)) out.push(`<@${ow.type === 0 ? '&' : ''}${id}>: scos`);
  return out;
}

// ---- events -------------------------------------------------------------

function attach(client) {
  const on = (event, fn) => client.on(event, (...args) => {
    Promise.resolve(fn(...args)).catch((err) => console.error(`adminlog ${event}:`, err));
  });
  const logId = (guildId) => store.cfg(guildId).logId;

  client.once(Events.ClientReady, async () => { for (const g of client.guilds.cache.values()) await cacheInvites(g); });

  // -- members
  on(Events.GuildMemberAdd, async (m) => {
    const inv = await usedInvite(m.guild);
    const fresh = Date.now() - m.user.createdTimestamp < 7 * 86400_000;
    await post(client, m.guild.id, embed(COLOR.join, m.user.bot ? 'Bot adăugat' : 'Membru nou', `${m} a intrat pe server.`, [
      { name: 'Cont creat', value: `<t:${unix(m.user.createdTimestamp)}:R>${fresh ? '\nCont nou (sub 7 zile)' : ''}`, inline: true },
      { name: 'Membri acum', value: String(m.guild.memberCount), inline: true },
      { name: 'Invitație', value: inv ? `\`${inv.code}\` de ${mention(inv.inviterId)}${inv.uses ? ` (${inv.uses} folosiri)` : ''}${inv.note ? `\n${inv.note}` : ''}` : 'necunoscută', inline: true },
    ], m.user));
  });

  on(Events.GuildMemberRemove, async (m) => {
    await sleep(1000);
    const kick = await audit(m.guild, AuditLogEvent.MemberKick, m.id, 10_000);
    const roles = m.roles?.cache?.filter((r) => r.id !== m.guild.id).map((r) => `<@&${r.id}>`).join(' ');
    await post(client, m.guild.id, embed(kick ? COLOR.ban : COLOR.leave, kick ? 'Membru dat afară (kick)' : 'Membru a plecat', `<@${m.id}>`, [
      m.joinedTimestamp ? { name: 'A intrat', value: `<t:${unix(m.joinedTimestamp)}:R>`, inline: true } : null,
      roles ? { name: 'Roluri', value: roles } : null, by(kick),
    ], m.user));
  });

  on(Events.GuildBanAdd, async (ban) => {
    await sleep(800);
    const e = await audit(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await post(client, ban.guild.id, embed(COLOR.ban, 'Ban', `${ban.user} a primit ban.`, [by(e), !e && ban.reason ? { name: 'Motiv', value: ban.reason } : null], ban.user));
  });
  on(Events.GuildBanRemove, async (ban) => {
    await sleep(800);
    const e = await audit(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await post(client, ban.guild.id, embed(COLOR.member, 'Unban', `${ban.user} nu mai are ban.`, [by(e)], ban.user));
  });

  on(Events.GuildMemberUpdate, async (o, n) => {
    if (o.partial) return;
    const g = n.guild.id;
    if (o.nickname !== n.nickname) {
      await post(client, g, embed(COLOR.member, 'Nickname schimbat', `${n}`, [change('Nickname', o.nickname, n.nickname)], n.user));
    }
    const added = n.roles.cache.filter((r) => !o.roles.cache.has(r.id));
    const removed = o.roles.cache.filter((r) => !n.roles.cache.has(r.id));
    if (added.size || removed.size) {
      await sleep(800);
      const e = await audit(n.guild, AuditLogEvent.MemberRoleUpdate, n.id);
      await post(client, g, embed(COLOR.role, 'Roluri schimbate', `${n}`, [
        added.size ? { name: 'Adăugate', value: added.map((r) => `<@&${r.id}>`).join(' '), inline: true } : null,
        removed.size ? { name: 'Scoase', value: removed.map((r) => `<@&${r.id}>`).join(' '), inline: true } : null, by(e),
      ], n.user));
    }
    if (o.communicationDisabledUntilTimestamp !== n.communicationDisabledUntilTimestamp) {
      await sleep(800);
      const e = await audit(n.guild, AuditLogEvent.MemberUpdate, n.id);
      const until = n.communicationDisabledUntilTimestamp;
      await post(client, g, embed(COLOR.ban, until && until > Date.now() ? 'Timeout aplicat' : 'Timeout scos', `${n}`, [
        until && until > Date.now() ? { name: 'Până', value: `<t:${unix(until)}:F> (<t:${unix(until)}:R>)`, inline: true } : null, by(e),
      ], n.user));
    }
    if (!o.premiumSince && n.premiumSince) await post(client, g, embed(COLOR.server, 'Boost nou', `${n} a dat boost serverului.`, [], n.user));
  });

  on(Events.UserUpdate, async (o, n) => {
    const fields = [change('Username', o.username, n.username), change('Nume afișat', o.globalName, n.globalName),
      o.avatar !== n.avatar ? { name: 'Avatar', value: `[nou](${n.displayAvatarURL({ size: 256 })})`, inline: true } : null].filter(Boolean);
    if (!fields.length) return;
    for (const g of client.guilds.cache.values()) {
      if (g.members.cache.has(n.id)) await post(client, g.id, embed(COLOR.member, 'Profil schimbat', `${n}`, fields, n));
    }
  });

  // -- messages
  const skipChannel = (msg) => !msg.guild || msg.channelId === logId(msg.guild.id);

  on(Events.MessageDelete, async (msg) => {
    if (skipChannel(msg) || msg.author?.bot) return;
    await sleep(800);
    const e = msg.author ? await audit(msg.guild, AuditLogEvent.MessageDelete, msg.author.id, 6000) : null;
    const files = [...(msg.attachments?.values() ?? [])].map((a) => a.name).join(', ');
    await post(client, msg.guild.id, embed(COLOR.msgDel, 'Mesaj șters', null, [
      { name: 'Autor', value: msg.author ? `${msg.author}` : 'necunoscut (mesaj vechi)', inline: true },
      { name: 'Canal', value: `<#${msg.channelId}>`, inline: true },
      e?.executor && e.executor.id !== msg.author?.id ? { name: 'Șters de', value: mention(e.executor.id), inline: true } : null,
      { name: 'Conținut', value: msg.content || (msg.partial ? '(necunoscut, mesajul nu era în memorie)' : '(fără text)') },
      files ? { name: 'Fișiere', value: files } : null,
    ], msg.author || null));
  });

  on(Events.MessageBulkDelete, async (messages, channel) => {
    if (!channel.guild || channel.id === logId(channel.guild.id)) return;
    const lines = [...messages.values()].sort((a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0))
      .map((m) => `[${m.createdAt ? m.createdAt.toISOString() : '?'}] ${m.author?.tag ?? 'necunoscut'}: ${m.content ?? '(necunoscut)'}`);
    const buf = Buffer.from(lines.join('\n').slice(0, 400_000) || '(gol)', 'utf8');
    await post(client, channel.guild.id, embed(COLOR.msgDel, 'Mesaje șterse în masă', `**${messages.size}** mesaje în <#${channel.id}>. Lista e atașată.`),
      [{ attachment: buf, name: 'mesaje-sterse.txt' }]);
  });

  on(Events.MessageUpdate, async (o, n) => {
    if (skipChannel(n) || n.author?.bot || o.content === n.content || n.content == null) return;
    await post(client, n.guild.id, embed(COLOR.msgEdit, 'Mesaj editat', `[Sari la mesaj](${n.url})`, [
      { name: 'Autor', value: `${n.author ?? 'necunoscut'}`, inline: true },
      { name: 'Canal', value: `<#${n.channelId}>`, inline: true },
      { name: 'Înainte', value: o.content ?? '(necunoscut, mesajul nu era în memorie)' },
      { name: 'Acum', value: n.content || '(gol)' },
    ], n.author || null));
  });

  on(Events.ChannelPinsUpdate, (channel) => channel.guild && post(client, channel.guild.id,
    embed(COLOR.channel, 'Pin-uri schimbate', `În <#${channel.id}>.`)));

  // -- channels
  on(Events.ChannelCreate, async (c) => {
    await sleep(800);
    const e = await audit(c.guild, AuditLogEvent.ChannelCreate, c.id);
    await post(client, c.guild.id, embed(COLOR.channel, 'Canal creat', `<#${c.id}> (${CHANNEL_TYPE[c.type] ?? c.type})`, [
      c.parent ? { name: 'Categorie', value: c.parent.name, inline: true } : null, by(e)]));
  });
  on(Events.ChannelDelete, async (c) => {
    if (!c.guild) return;
    await sleep(800);
    const e = await audit(c.guild, AuditLogEvent.ChannelDelete, c.id);
    await post(client, c.guild.id, embed(COLOR.channel, 'Canal șters', `**${c.name}** (${CHANNEL_TYPE[c.type] ?? c.type})`, [by(e)]));
  });
  on(Events.ChannelUpdate, async (o, n) => {
    if (!n.guild) return;
    const ow = overwriteChanges(o, n);
    const fields = [change('Nume', o.name, n.name), change('Topic', o.topic, n.topic), change('Categorie', o.parent?.name, n.parent?.name),
      change('NSFW', String(o.nsfw), String(n.nsfw)), change('Slowmode (s)', String(o.rateLimitPerUser ?? 0), String(n.rateLimitPerUser ?? 0)),
      change('Limită utilizatori', String(o.userLimit ?? 0), String(n.userLimit ?? 0)),
      ow.length ? { name: 'Permisiuni', value: ow.join('\n') } : null].filter(Boolean);
    if (!fields.length) return;
    await sleep(800);
    const e = await audit(n.guild, AuditLogEvent.ChannelUpdate, n.id);
    await post(client, n.guild.id, embed(COLOR.channel, 'Canal modificat', `<#${n.id}>`, [...fields, by(e)]));
  });

  // -- roles
  on(Events.GuildRoleCreate, async (r) => {
    await sleep(800);
    const e = await audit(r.guild, AuditLogEvent.RoleCreate, r.id);
    await post(client, r.guild.id, embed(COLOR.role, 'Rol creat', `<@&${r.id}>`, [by(e)]));
  });
  on(Events.GuildRoleDelete, async (r) => {
    await sleep(800);
    const e = await audit(r.guild, AuditLogEvent.RoleDelete, r.id);
    await post(client, r.guild.id, embed(COLOR.role, 'Rol șters', `**${r.name}**`, [by(e)]));
  });
  on(Events.GuildRoleUpdate, async (o, n) => {
    const gained = o.permissions.missing(n.permissions), lost = n.permissions.missing(o.permissions);
    const fields = [change('Nume', o.name, n.name), change('Culoare', hex(o.color), hex(n.color)), change('Afișat separat', String(o.hoist), String(n.hoist)),
      change('Pot fi menționat', String(o.mentionable), String(n.mentionable)),
      gained.length ? { name: 'Permisiuni adăugate', value: gained.join(', ') } : null,
      lost.length ? { name: 'Permisiuni scoase', value: lost.join(', ') } : null].filter(Boolean);
    if (!fields.length) return;
    await sleep(800);
    const e = await audit(n.guild, AuditLogEvent.RoleUpdate, n.id);
    await post(client, n.guild.id, embed(COLOR.role, 'Rol modificat', `<@&${n.id}>`, [...fields, by(e)]));
  });

  // -- voice
  on(Events.VoiceStateUpdate, async (o, n) => {
    const m = n.member || o.member;
    if (!m || m.user.bot) return;
    const g = n.guild.id;
    if (!o.channelId && n.channelId) return post(client, g, embed(COLOR.voice, 'Voice: a intrat', `${m} în <#${n.channelId}>`, [], m.user));
    if (o.channelId && !n.channelId) return post(client, g, embed(COLOR.voice, 'Voice: a ieșit', `${m} din <#${o.channelId}>`, [], m.user));
    if (o.channelId !== n.channelId) return post(client, g, embed(COLOR.voice, 'Voice: a schimbat camera', `${m}: <#${o.channelId}> → <#${n.channelId}>`, [], m.user));
    if (o.serverMute !== n.serverMute || o.serverDeaf !== n.serverDeaf) {
      await sleep(800);
      const e = await audit(n.guild, AuditLogEvent.MemberUpdate, m.id, 8000);
      return post(client, g, embed(COLOR.voice, 'Voice: mute/deafen de server', `${m}`, [
        change('Mute server', String(o.serverMute), String(n.serverMute)), change('Deafen server', String(o.serverDeaf), String(n.serverDeaf)), by(e)], m.user));
    }
    if (o.streaming !== n.streaming) return post(client, g, embed(COLOR.voice, n.streaming ? 'Voice: a pornit stream' : 'Voice: a oprit streamul', `${m} în <#${n.channelId}>`, [], m.user));
    if (o.selfVideo !== n.selfVideo) return post(client, g, embed(COLOR.voice, n.selfVideo ? 'Voice: a pornit camera' : 'Voice: a oprit camera', `${m} în <#${n.channelId}>`, [], m.user));
  });

  // -- server, emoji, stickers, invites, threads, webhooks, events, automod
  on(Events.GuildUpdate, async (o, n) => {
    const fields = [change('Nume', o.name, n.name), change('Icon', o.icon, n.icon), change('Banner', o.banner, n.banner),
      change('Nivel verificare', String(o.verificationLevel), String(n.verificationLevel)),
      change('Owner', o.ownerId, n.ownerId), change('Canal AFK', o.afkChannelId, n.afkChannelId),
      change('Descriere', o.description, n.description)].filter(Boolean);
    if (!fields.length) return;
    await sleep(800);
    const e = await audit(n.guild ?? n, AuditLogEvent.GuildUpdate, null);
    await post(client, n.id, embed(COLOR.server, 'Server modificat', null, [...fields, by(e)]));
  });

  for (const [ev, title, kind] of [[Events.GuildEmojiCreate, 'Emoji adăugat', 'emoji'], [Events.GuildEmojiDelete, 'Emoji șters', 'emoji'],
    [Events.GuildStickerCreate, 'Sticker adăugat', 'sticker'], [Events.GuildStickerDelete, 'Sticker șters', 'sticker']]) {
    on(ev, (x) => post(client, x.guild.id, embed(COLOR.server, title, `**${x.name}**`).setThumbnail(x.imageURL?.() ?? x.url ?? null)));
  }
  on(Events.GuildEmojiUpdate, (o, n) => o.name !== n.name && post(client, n.guild.id, embed(COLOR.server, 'Emoji redenumit', null, [change('Nume', o.name, n.name)])));

  on(Events.InviteCreate, async (i) => {
    if (i.guild) { await cacheInvites(i.guild); await post(client, i.guild.id, embed(COLOR.invite, 'Invitație creată', `\`${i.code}\` în <#${i.channelId}>`, [
      { name: 'De', value: mention(i.inviterId), inline: true }, { name: 'Folosiri max', value: String(i.maxUses || 'nelimitat'), inline: true },
      { name: 'Expiră', value: i.expiresTimestamp ? `<t:${unix(i.expiresTimestamp)}:R>` : 'niciodată', inline: true }])); }
  });
  on(Events.InviteDelete, async (i) => {
    if (i.guild) { await post(client, i.guild.id, embed(COLOR.invite, 'Invitație ștearsă', `\`${i.code}\` din <#${i.channelId}>`)); await cacheInvites(i.guild); }
  });

  on(Events.ThreadCreate, (t, isNew) => isNew && post(client, t.guild.id, embed(COLOR.channel, 'Thread creat', `<#${t.id}> în <#${t.parentId}>`, [{ name: 'De', value: mention(t.ownerId) }])));
  on(Events.ThreadDelete, (t) => post(client, t.guild.id, embed(COLOR.channel, 'Thread șters', `**${t.name}**`)));
  on(Events.ThreadUpdate, (o, n) => {
    const fields = [change('Nume', o.name, n.name), change('Arhivat', String(o.archived), String(n.archived)), change('Blocat', String(o.locked), String(n.locked))].filter(Boolean);
    return fields.length && post(client, n.guild.id, embed(COLOR.channel, 'Thread modificat', `<#${n.id}>`, fields));
  });

  on(Events.WebhooksUpdate, async (channel) => {
    await sleep(800);
    const e = (await audit(channel.guild, AuditLogEvent.WebhookCreate, null, 8000)) || (await audit(channel.guild, AuditLogEvent.WebhookDelete, null, 8000))
      || (await audit(channel.guild, AuditLogEvent.WebhookUpdate, null, 8000));
    await post(client, channel.guild.id, embed(COLOR.server, 'Webhook-uri schimbate', `În <#${channel.id}>`, [by(e)]));
  });

  on(Events.GuildScheduledEventCreate, (ev) => post(client, ev.guildId, embed(COLOR.server, 'Eveniment creat', `**${ev.name}**`, [
    ev.scheduledStartTimestamp ? { name: 'Începe', value: `<t:${unix(ev.scheduledStartTimestamp)}:F>` } : null, { name: 'De', value: mention(ev.creatorId) }])));
  on(Events.GuildScheduledEventDelete, (ev) => post(client, ev.guildId, embed(COLOR.server, 'Eveniment șters', `**${ev.name}**`)));

  on(Events.AutoModerationActionExecution, (a) => post(client, a.guild.id, embed(COLOR.automod, 'AutoMod a acționat', null, [
    { name: 'Utilizator', value: mention(a.userId), inline: true }, a.channelId ? { name: 'Canal', value: `<#${a.channelId}>`, inline: true } : null,
    a.matchedKeyword ? { name: 'Cuvânt', value: a.matchedKeyword, inline: true } : null, a.content ? { name: 'Mesaj', value: a.content } : null])));
}

module.exports = { attach, action, post, embed, COLOR };

// Everything the user sees for razie: embeds, buttons, menus, modals, panel.
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');
const core = require('./razii');

const RED = 0xe74c3c, ORANGE = 0xf39c12, GREEN = 0x2ecc71, GREY = 0x95a5a6, BLURPLE = 0x5865f2;
const NO_PING = { parse: [] };
const log = (what) => (err) => console.error(`raziiUi ${what}:`, err);
const unix = (ms) => Math.floor(ms / 1000);

// ---- small helpers ------------------------------------------------------

function bar(fraction, size = 10) {
  const f = Math.max(0, Math.min(1, fraction));
  const filled = Math.round(f * size);
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

const progress = (t) => 1 - (t.endsAt - Date.now()) / (t.totalMs || core.DEFAULT_MINUTES * 60_000);

function dot(leftMs) {
  if (leftMs < 10 * 60_000) return '🔴';
  if (leftMs < 30 * 60_000) return '🟡';
  return '🟢';
}

function timerLine(t) {
  const left = t.endsAt - Date.now();
  const pct = Math.round(Math.max(0, Math.min(1, progress(t))) * 100);
  return `${dot(left)} **${t.zone}** · <t:${unix(t.endsAt)}:R> (<t:${unix(t.endsAt)}:t>)\n\`${bar(progress(t))}\` ${pct}%`;
}

const btn = (id, label, style = ButtonStyle.Secondary) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...components) => new ActionRowBuilder().addComponents(...components);
const isAdmin = (i) => i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

// ---- embeds -------------------------------------------------------------

function startPayload(result) {
  const t = result.entry;
  const embed = new EmbedBuilder()
    .setColor(GREEN)
    .setTitle(result.replaced ? 'Timer repornit' : 'Timer pornit')
    .setDescription(`${timerLine(t)}\nPornit de <@${t.userId}>`)
    .setFooter({ text: result.replaced ? 'Timerul vechi a fost înlocuit.' : 'Greșeală? Apasă Anulează.' });
  return {
    embeds: [embed],
    components: [row(btn(`rz:x:${t.zone}`, 'Anulează timerul', ButtonStyle.Danger), btn(`rz:r:${t.zone}`, `Repornește ${core.cooldownLabel()}`))],
    allowedMentions: NO_PING,
  };
}

function fireEmbed(zone, late) {
  return new EmbedBuilder()
    .setColor(RED)
    .setTitle('Posibilă razie')
    .setDescription(`**${zone}**\nTimerul de ${core.cooldownLabel()} s-a terminat.${late ? '\nBotul a fost oprit între timp.' : ''}`);
}

function historyEmbed(guildId) {
  const rows = core.recent(guildId, 10);
  const embed = new EmbedBuilder().setColor(BLURPLE).setTitle('Istoric razii');
  embed.setDescription(
    rows.length
      ? rows.map((h) => `**${h.zone}** · <t:${unix(h.at)}:f> · ${core.STATUS_LABEL[h.status]}`).join('\n').slice(0, 3800)
      : 'Nicio razie în istoric încă.'
  );
  return embed;
}

function statsEmbed(guildId) {
  const rows = core.stats(guildId);
  const embed = new EmbedBuilder().setColor(BLURPLE).setTitle('Statistici razii');
  if (!rows.length) return embed.setDescription('Nu sunt date încă.');
  const fmtGap = (m) => (m == null ? '-' : m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m} min`);
  for (const r of rows.slice(0, 12)) {
    embed.addFields({
      name: r.zone,
      value:
        `Confirmate: **${r.confirmed}** din ${r.total}\n` +
        `N-au fost: ${r.none}\n` +
        `Ultima: ${r.last ? `<t:${unix(r.last)}:R>` : '-'}\n` +
        `Interval mediu: ${fmtGap(r.avgGapMin)}\n` +
        `Ultimele 7 zile: ${r.last7}`,
      inline: true,
    });
  }
  return embed;
}

// ---- panel --------------------------------------------------------------

function panelRows() {
  return [
    row(
      btn('rz:new', 'Pornește timer', ButtonStyle.Success),
      btn('rz:cancel', 'Anulează', ButtonStyle.Danger),
      btn('rz:hist', 'Istoric'),
      btn('rz:stats', 'Statistici'),
    ),
    row(
      btn('rz:role', 'Alerte on/off', ButtonStyle.Primary),
      btn('rz:set', 'Setări'),
    ),
  ];
}

function panelPayload(guildId) {
  const timers = core.list(guildId);
  const soonest = timers[0] ? timers[0].endsAt - Date.now() : null;
  const color = soonest == null ? BLURPLE : soonest < 10 * 60_000 ? RED : soonest < 30 * 60_000 ? ORANGE : GREEN;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'Razii · RDR2 Online' })
    .setDescription(
      timers.length
        ? timers.map(timerLine).join('\n\n').slice(0, 3800)
        : 'Niciun timer activ.\nApasă **Pornește timer** sau scrie `razie <zona>`.'
    )
    .setFooter({ text: `${timers.length} ${timers.length === 1 ? 'timer activ' : 'timere active'} · cooldown ${core.cooldownLabel()}` })
    .setTimestamp();

  const last = core.recent(guildId, 3);
  if (last.length) {
    embed.addFields({
      name: 'Ultimele razii',
      value: last.map((h) => `**${h.zone}** · <t:${unix(h.at)}:R> · ${core.STATUS_LABEL[h.status]}`).join('\n').slice(0, 1000),
    });
  }
  return { content: '', embeds: [embed], components: panelRows(), allowedMentions: NO_PING };
}

async function updatePanel(client, guildId) {
  const p = core.cfg(guildId).panel;
  if (!p) return;
  const channel = await client.channels.fetch(p.channelId).catch(() => null);
  const msg = channel ? await channel.messages.fetch(p.messageId).catch(() => null) : null;
  if (!msg) { core.setConfig(guildId, { panel: null }); return; }
  await msg.edit(panelPayload(guildId));
}

async function refreshPanels(client) {
  for (const guildId of core.panelGuilds()) {
    if (core.list(guildId).length) await updatePanel(client, guildId).catch(log('refresh'));
  }
}

async function createPanel(client, channel) {
  const guildId = channel.guild.id;
  const old = core.cfg(guildId).panel;
  if (old) {
    const oc = await client.channels.fetch(old.channelId).catch(() => null);
    const om = oc ? await oc.messages.fetch(old.messageId).catch(() => null) : null;
    await om?.delete().catch(() => {});
  }
  const msg = await channel.send(panelPayload(guildId));
  await msg.pin().catch(() => {}); // needs Manage Messages, optional
  core.setConfig(guildId, { panel: { channelId: channel.id, messageId: msg.id } });
  await core.ensureRole(channel.guild);
  return msg;
}

// ---- announcements ------------------------------------------------------

async function notifyChannel(client, entry) {
  const id = core.cfg(entry.guildId).channelId || entry.channelId;
  const ch = await client.channels.fetch(id).catch(() => null);
  return ch?.isTextBased() ? ch : null;
}

async function announceWarn(client, entry) {
  const guild = await client.guilds.fetch(entry.guildId).catch(() => null);
  const channel = await notifyChannel(client, entry);
  if (!guild || !channel) return;
  const role = await core.ensureRole(guild);
  const embed = new EmbedBuilder()
    .setColor(ORANGE)
    .setTitle(`Razie posibilă în ~${core.WARN_MINUTES} minute`)
    .setDescription(`**${entry.zone}** · <t:${unix(entry.endsAt)}:R>`);
  await channel.send({
    content: role ? `<@&${role.id}>` : undefined,
    embeds: [embed],
    allowedMentions: { roles: role ? [role.id] : [] },
  });
}

async function announceFire(client, entry, late) {
  const guild = await client.guilds.fetch(entry.guildId).catch(() => null);
  if (!guild) return;
  const channel = await notifyChannel(client, entry);
  const role = await core.ensureRole(guild);
  if (channel) {
    await channel.send({
      content: `${role ? `<@&${role.id}> ` : ''}<@${entry.userId}>`,
      embeds: [fireEmbed(entry.zone, late)],
      components: [row(
        btn(`rz:y:${entry.zone}`, `A fost razie, repornește ${core.cooldownLabel()}`, ButtonStyle.Success),
        btn(`rz:n:${entry.zone}`, "N-a fost"),
      )],
      allowedMentions: { users: [entry.userId], roles: role ? [role.id] : [] },
    }).catch(log('send'));
  }
  updatePanel(client, entry.guildId).catch(log('panel'));
}

// ---- menus / modals / settings -----------------------------------------

function zoneModal() {
  return new ModalBuilder()
    .setCustomId('rz:m:start')
    .setTitle('Pornește timer de razie')
    .addComponents(
      row(new TextInputBuilder().setCustomId('zone').setLabel('Zona').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60).setPlaceholder('ex: Annesburg')),
      row(new TextInputBuilder().setCustomId('mins').setLabel('Minute rămase (gol = timer întreg)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(4).setPlaceholder('ex: 45')),
    );
}

function activeTimersMenu(guildId) {
  const timers = core.list(guildId).slice(0, 24);
  const options = [
    ...timers.map((t) => ({ label: t.zone.slice(0, 100), value: t.zone.slice(0, 100), description: `se termină la ${new Date(t.endsAt).toISOString().slice(11, 16)} UTC` })),
    { label: 'Toate timerele', value: '__all__', description: 'Șterge tot' },
  ];
  return new StringSelectMenuBuilder().setCustomId('rz:s:cancel').setPlaceholder('Ce timer anulezi?').addOptions(options);
}

function settingsPayload(guildId) {
  const c = core.cfg(guildId);
  const on = (v) => (v === false ? 'oprit' : 'pornit');
  const embed = new EmbedBuilder()
    .setColor(BLURPLE)
    .setTitle('Setări razie')
    .addFields(
      { name: 'Canal notificări', value: c.channelId ? `<#${c.channelId}>` : 'canalul unde pornești timerul', inline: true },
      { name: 'Sirenă pe voice', value: on(c.voice), inline: true },
      { name: 'Avertizare', value: `${on(c.warn)} (${core.WARN_MINUTES} min înainte)`, inline: true },
      { name: 'Vocea ta (Atenție razie)', value: core.findVoiceRecording() ? 'încărcată' : 'neîncărcată, folosește `/razie sunet`', inline: true },
      { name: 'Zone salvate', value: (c.zones || []).join(', ').slice(0, 900) || '-' },
    );
  const rows = [
    row(
      btn('rz:t:voice', `Sirenă: ${c.voice === false ? 'OFF' : 'ON'}`, c.voice === false ? ButtonStyle.Secondary : ButtonStyle.Success),
      btn('rz:t:warn', `Avertizare: ${c.warn === false ? 'OFF' : 'ON'}`, c.warn === false ? ButtonStyle.Secondary : ButtonStyle.Success),
    ),
    row(new ChannelSelectMenuBuilder().setCustomId('rz:s:chan').setPlaceholder('Alege canalul de notificări').setChannelTypes(ChannelType.GuildText)),
  ];
  if ((c.zones || []).length) {
    rows.push(row(
      new StringSelectMenuBuilder().setCustomId('rz:s:delzone').setPlaceholder('Șterge o zonă salvată')
        .addOptions(c.zones.slice(0, 25).map((z) => ({ label: z.slice(0, 100), value: z.slice(0, 100) }))),
    ));
  }
  return { embeds: [embed], components: rows, ephemeral: true };
}

// ---- interaction router -------------------------------------------------

function parseMinutes(text) {
  if (!text) return undefined;
  const n = Number(String(text).replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 1440 ? n : undefined;
}

async function handleInteraction(interaction, client) {
  const id = interaction.customId;
  if (!id || !id.startsWith('rz:')) return false;
  const [, kind, ...rest] = id.split(':');
  const arg = rest.join(':');
  const guildId = interaction.guildId;

  // ---- buttons
  if (interaction.isButton()) {
    if (kind === 'role') {
      const res = await core.toggleRole(interaction.member);
      await interaction.reply({
        content: !res.ok
          ? 'Nu pot da rolul (botul are nevoie de Manage Roles și rolul lui trebuie să fie deasupra lui @Razie).'
          : res.has ? 'Ai primit rolul **Razie**, vei primi alertele.' : 'Ți-am scos rolul **Razie**.',
        ephemeral: true,
      });
      return true;
    }

    if (kind === 'new') {
      const zones = core.cfg(guildId).zones || [];
      if (!zones.length) { await interaction.showModal(zoneModal()); return true; }
      await interaction.reply({
        content: 'Alege zona:',
        components: [
          row(new StringSelectMenuBuilder().setCustomId('rz:s:start').setPlaceholder('Zonă salvată').addOptions(zones.slice(0, 25).map((z) => ({ label: z.slice(0, 100), value: z.slice(0, 100) })))),
          row(btn('rz:newmodal', 'Altă zonă / minute rămase')),
        ],
        ephemeral: true,
      });
      return true;
    }

    if (kind === 'newmodal') { await interaction.showModal(zoneModal()); return true; }

    if (kind === 'cancel') {
      if (!core.list(guildId).length) {
        await interaction.reply({ content: 'Niciun timer activ.', ephemeral: true });
        return true;
      }
      await interaction.reply({ components: [row(activeTimersMenu(guildId))], ephemeral: true });
      return true;
    }

    if (kind === 'hist') { await interaction.reply({ embeds: [historyEmbed(guildId)], ephemeral: true }); return true; }
    if (kind === 'stats') { await interaction.reply({ embeds: [statsEmbed(guildId)], ephemeral: true }); return true; }

    if (kind === 'set') {
      if (!isAdmin(interaction)) { await interaction.reply({ content: 'Doar adminii.', ephemeral: true }); return true; }
      await interaction.reply(settingsPayload(guildId));
      return true;
    }

    if (kind === 't') { // toggles
      if (!isAdmin(interaction)) { await interaction.reply({ content: 'Doar adminii.', ephemeral: true }); return true; }
      const current = core.cfg(guildId)[arg];
      core.setConfig(guildId, { [arg]: current === false });
      await interaction.update(settingsPayload(guildId));
      return true;
    }

    if (kind === 'x') { // cancel from the start message
      const removed = core.cancel(client, guildId, arg);
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(GREY).setTitle('Timer anulat').setDescription(
          removed ? `**${removed.zone}** a fost anulat de <@${interaction.user.id}>.` : `**${arg}** nu mai avea timer.`)],
        components: [],
        allowedMentions: NO_PING,
      });
      return true;
    }

    if (kind === 'r') { // restart from the start message
      const result = core.start(client, { guildId, zone: arg, channelId: interaction.channelId, userId: interaction.user.id });
      await interaction.update(startPayload({ ...result, replaced: true }));
      return true;
    }

    if (kind === 'y') { // raid happened -> restart
      core.markHistory(guildId, arg, 'pending', 'confirmed');
      const res = core.start(client, { guildId, zone: arg, channelId: interaction.channelId, userId: interaction.user.id });
      const next = res.ok ? `Următoarea posibilă <t:${unix(res.entry.endsAt)}:R> (<t:${unix(res.entry.endsAt)}:t>).` : '';
      await interaction.update({
        content: '',
        embeds: [new EmbedBuilder().setColor(GREEN).setTitle('Razie confirmată').setDescription(`**${arg}**\nConfirmată de <@${interaction.user.id}>.\n${next}`)],
        components: [row(btn(`rz:u:${arg}`, 'Anulează (am apăsat greșit)'))],
        allowedMentions: NO_PING,
      });
      return true;
    }

    if (kind === 'n') { // no raid
      core.markHistory(guildId, arg, 'pending', 'none');
      updatePanel(client, guildId).catch(log('panel'));
      await interaction.update({
        content: '',
        embeds: [new EmbedBuilder().setColor(GREY).setTitle("N-a fost razie").setDescription(`**${arg}**\nMarcat de <@${interaction.user.id}>.`)],
        components: [row(btn(`rz:u:${arg}`, 'Anulează (am apăsat greșit)'))],
        allowedMentions: NO_PING,
      });
      return true;
    }

    if (kind === 'u') { // undo y / n
      core.markHistory(guildId, arg, 'confirmed', 'pending') || core.markHistory(guildId, arg, 'none', 'pending');
      core.cancel(client, guildId, arg);
      await interaction.update({
        embeds: [fireEmbed(arg, false)],
        components: [row(
          btn(`rz:y:${arg}`, `A fost razie, repornește ${core.cooldownLabel()}`, ButtonStyle.Success),
          btn(`rz:n:${arg}`, "N-a fost"),
        )],
      });
      return true;
    }
    return true;
  }

  // ---- select menus
  if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
    const value = interaction.values[0];

    if (kind === 's' && arg === 'start') {
      const result = core.start(client, { guildId, zone: value, channelId: interaction.channelId, userId: interaction.user.id });
      await interaction.update({ content: `Pornit: **${value}**.`, components: [] });
      await interaction.channel.send(startPayload(result)).catch(log('send'));
      return true;
    }

    if (kind === 's' && arg === 'cancel') {
      let text;
      if (value === '__all__') text = `${core.cancelAll(client, guildId)} timere șterse.`;
      else {
        const removed = core.cancel(client, guildId, value);
        text = removed ? `Timerul pentru **${removed.zone}** a fost anulat.` : 'Nu mai exista timerul.';
      }
      await interaction.update({ content: text, components: [] });
      return true;
    }

    if (kind === 's' && (arg === 'chan' || arg === 'delzone')) {
      if (!isAdmin(interaction)) { await interaction.reply({ content: 'Doar adminii.', ephemeral: true }); return true; }
      if (arg === 'chan') core.setConfig(guildId, { channelId: value });
      else core.removeZone(guildId, value);
      await interaction.update(settingsPayload(guildId));
      return true;
    }
    return true;
  }

  // ---- modal
  if (interaction.isModalSubmit() && kind === 'm' && arg === 'start') {
    const result = core.start(client, {
      guildId,
      zone: interaction.fields.getTextInputValue('zone'),
      minutes: parseMinutes(interaction.fields.getTextInputValue('mins')),
      channelId: interaction.channelId,
      userId: interaction.user.id,
    });
    if (!result.ok) {
      await interaction.reply({ content: 'Scrie o zonă.', ephemeral: true });
      return true;
    }
    await interaction.reply(startPayload(result));
    return true;
  }

  return true;
}

module.exports = {
  startPayload, panelPayload, updatePanel, refreshPanels, createPanel,
  announceWarn, announceFire, handleInteraction,
  historyEmbed, statsEmbed, settingsPayload,
};

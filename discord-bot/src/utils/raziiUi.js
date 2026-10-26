// What the user sees for razie: the panel, the alerts, buttons, menus, modal.
// Public messages are kept to a minimum: the panel, one warning (deleted when
// the timer ends) and one alert per raid. Everything else is private (ephemeral).
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const core = require('./razii');

const RED = 0xe74c3c, GREEN = 0x2ecc71, GREY = 0x95a5a6, BLURPLE = 0x5865f2;
const NO_PING = { parse: [] };
const log = (what) => (err) => console.error(`raziiUi ${what}:`, err);
const unix = (ms) => Math.floor(ms / 1000);

const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...components) => new ActionRowBuilder().addComponents(...components);
const isAdmin = (i) => i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
const when = (ms) => `<t:${unix(ms)}:R> (<t:${unix(ms)}:t>)`;

// ---- panel (the one pinned message) -------------------------------------

function panelPayload(guildId) {
  const timers = core.list(guildId);
  const embed = new EmbedBuilder()
    .setColor(timers.length ? GREEN : BLURPLE)
    .setTitle('Razii')
    .setDescription(
      timers.length
        ? timers.map((t) => `**${t.zone}** · ${when(t.endsAt)} · <@${t.userId}>`).join('\n').slice(0, 3800)
        : 'Niciun timer activ.\nApasă **Pornește** sau scrie `razie <zona>`.'
    )
    .setFooter({ text: `Cooldown ${core.cooldownLabel()}` });

  const last = core.recent(guildId, 3);
  if (last.length) {
    embed.addFields({
      name: 'Ultimele',
      value: last.map((h) => `**${h.zone}** · <t:${unix(h.at)}:R> · ${core.STATUS_LABEL[h.status]}`).join('\n').slice(0, 1000),
    });
  }
  return {
    content: '',
    embeds: [embed],
    components: [
      row(
        btn('rz:new', 'Pornește', ButtonStyle.Success),
        btn('rz:cancel', 'Anulează', ButtonStyle.Danger),
        btn('rz:early', 'A venit mai repede', ButtonStyle.Primary),
      ),
      row(btn('rz:hist', 'Istoric'), btn('rz:role', 'Alerte on/off'), btn('rz:set', 'Setări')),
    ],
    allowedMentions: NO_PING,
  };
}

// Several changes in a row become a single edit.
const pending = new Set();
function updatePanel(client, guildId) {
  if (pending.has(guildId)) return Promise.resolve();
  pending.add(guildId);
  return new Promise((resolve) => {
    setTimeout(async () => {
      pending.delete(guildId);
      try {
        const p = core.cfg(guildId).panel;
        if (!p) return;
        const channel = await client.channels.fetch(p.channelId).catch(() => null);
        const msg = channel ? await channel.messages.fetch(p.messageId).catch(() => null) : null;
        if (!msg) core.setConfig(guildId, { panel: null });
        else await msg.edit(panelPayload(guildId));
      } catch (err) { log('panel')(err); }
      resolve();
    }, 400);
  });
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

// ---- alerts -------------------------------------------------------------

async function alertChannel(client, entry) {
  const c = core.cfg(entry.guildId);
  const id = c.channelId || c.panel?.channelId || entry.channelId;
  const ch = id ? await client.channels.fetch(id).catch(() => null) : null;
  return ch?.isTextBased() ? ch : null;
}

const fireButtons = (zone) =>
  row(btn(`rz:y:${zone}`, `A fost razie, repornește ${core.cooldownLabel()}`, ButtonStyle.Success), btn(`rz:n:${zone}`, "N-a fost"));

const fireEmbed = (zone, late) =>
  new EmbedBuilder().setColor(RED).setTitle('Posibilă razie')
    .setDescription(`**${zone}**\nTimerul de ${core.cooldownLabel()} s-a terminat.${late ? '\n(Botul a fost oprit între timp.)' : ''}`);

async function announceWarn(client, entry) {
  const guild = await client.guilds.fetch(entry.guildId).catch(() => null);
  const channel = await alertChannel(client, entry);
  if (!guild || !channel) return;
  const role = await core.ensureRole(guild);
  const msg = await channel.send({
    content: `Razie posibilă în ~${core.WARN_MINUTES} min: **${entry.zone}** ${role ? `<@&${role.id}>` : ''}`.trim(),
    allowedMentions: { roles: role ? [role.id] : [] },
  });
  entry.warnMsg = { channelId: channel.id, messageId: msg.id };
  core.save();
}

// The warning disappears when the timer ends, is cancelled or replaced.
async function clearWarn(client, entry) {
  const w = entry.warnMsg;
  if (!w) return;
  entry.warnMsg = null;
  const ch = await client.channels.fetch(w.channelId).catch(() => null);
  const msg = ch ? await ch.messages.fetch(w.messageId).catch(() => null) : null;
  await msg?.delete().catch(() => {});
}

async function announceFire(client, entry, late) {
  const guild = await client.guilds.fetch(entry.guildId).catch(() => null);
  if (!guild) return;
  const channel = await alertChannel(client, entry);
  const role = await core.ensureRole(guild);
  if (channel) {
    await channel.send({
      content: role ? `<@&${role.id}>` : `<@${entry.userId}>`,
      embeds: [fireEmbed(entry.zone, late)],
      components: [fireButtons(entry.zone)],
      allowedMentions: { roles: role ? [role.id] : [], users: role ? [] : [entry.userId] },
    }).catch(log('send'));
  }
  updatePanel(client, entry.guildId).catch(log('panel'));
}

// ---- menus, modal, settings --------------------------------------------

const zoneModal = () =>
  new ModalBuilder().setCustomId('rz:m:start').setTitle('Pornește timer')
    .addComponents(
      row(new TextInputBuilder().setCustomId('zone').setLabel('Zona').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60).setPlaceholder('ex: Annesburg')),
      row(new TextInputBuilder().setCustomId('mins').setLabel('Minute rămase (gol = timer întreg)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(4).setPlaceholder('ex: 45')),
    );

const zoneOptions = (zones) => zones.slice(0, 25).map((z) => ({ label: z.slice(0, 100), value: z.slice(0, 100) }));

function settingsPayload(guildId) {
  const c = core.cfg(guildId);
  const state = (v) => (v === false ? 'oprit' : 'pornit');
  const embed = new EmbedBuilder().setColor(BLURPLE).setTitle('Setări').addFields(
    { name: 'Canal alerte', value: c.channelId ? `<#${c.channelId}>` : c.panel ? `<#${c.panel.channelId}> (canalul panoului)` : '-', inline: true },
    { name: 'Sirenă pe voice', value: state(c.voice), inline: true },
    { name: `Avertizare (${core.WARN_MINUTES} min)`, value: state(c.warn), inline: true },
    { name: 'Vocea ta', value: core.findVoiceRecording() ? 'încărcată' : 'neîncărcată (`/razie sunet`)', inline: true },
    { name: 'Zone salvate', value: (c.zones || []).join(', ').slice(0, 900) || '-' },
  );
  const rows = [
    row(
      btn('rz:t:voice', `Sirenă: ${c.voice === false ? 'OFF' : 'ON'}`, c.voice === false ? ButtonStyle.Secondary : ButtonStyle.Success),
      btn('rz:t:warn', `Avertizare: ${c.warn === false ? 'OFF' : 'ON'}`, c.warn === false ? ButtonStyle.Secondary : ButtonStyle.Success),
    ),
    row(new ChannelSelectMenuBuilder().setCustomId('rz:s:chan').setPlaceholder('Canal pentru alerte').setChannelTypes(ChannelType.GuildText)),
  ];
  if ((c.zones || []).length) {
    rows.push(row(new StringSelectMenuBuilder().setCustomId('rz:s:delzone').setPlaceholder('Șterge o zonă salvată').addOptions(zoneOptions(c.zones))));
  }
  return { embeds: [embed], components: rows, ephemeral: true };
}

function activeMenu(guildId, customId, placeholder, withAll) {
  const options = zoneOptions(core.list(guildId).map((t) => t.zone));
  if (withAll) options.push({ label: 'Toate timerele', value: '__all__' });
  return new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options.slice(0, 25));
}

function parseMinutes(text) {
  const n = Number(String(text || '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 1440 ? n : undefined;
}

const startedText = (res) => `${res.replaced ? 'Repornit' : 'Pornit'}: **${res.entry.zone}** · ${when(res.entry.endsAt)}`;

const earlyText = (res) =>
  `**${res.entry.zone}**: marcat ca venit mai repede. Cooldown-ul a pornit de acum, ${when(res.entry.endsAt)}.`;

// ---- router -------------------------------------------------------------

async function handleInteraction(interaction, client) {
  const id = interaction.customId;
  if (!id || !id.startsWith('rz:')) return false;
  const [, kind, ...rest] = id.split(':');
  const arg = rest.join(':');
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const say = (content) => interaction.reply({ content, ephemeral: true, allowedMentions: NO_PING });
  const adminOnly = () => say('Doar adminii.');

  // ---- buttons
  if (interaction.isButton()) {
    switch (kind) {
      case 'role': {
        const res = await core.toggleRole(interaction.member);
        await say(!res.ok ? 'Nu pot da rolul (botul are nevoie de Manage Roles, iar rolul lui trebuie să fie deasupra lui @Razie).'
          : res.has ? 'Ai primit rolul **Razie**, vei primi alertele.' : 'Ți-am scos rolul **Razie**.');
        return true;
      }
      case 'new': {
        const zones = core.cfg(guildId).zones || [];
        if (!zones.length) { await interaction.showModal(zoneModal()); return true; }
        await interaction.reply({
          content: 'Alege zona:',
          components: [
            row(new StringSelectMenuBuilder().setCustomId('rz:s:start').setPlaceholder('Zonă salvată').addOptions(zoneOptions(zones))),
            row(btn('rz:newmodal', 'Altă zonă / minute rămase')),
          ],
          ephemeral: true,
        });
        return true;
      }
      case 'newmodal': await interaction.showModal(zoneModal()); return true;
      case 'cancel':
        if (!core.list(guildId).length) { await say('Niciun timer activ.'); return true; }
        await interaction.reply({ components: [row(activeMenu(guildId, 'rz:s:cancel', 'Ce timer anulezi?', true))], ephemeral: true });
        return true;
      case 'early':
        if (!core.list(guildId).length) { await say('Niciun timer activ.'); return true; }
        await interaction.reply({ content: 'La ce zonă a venit mai repede?', components: [row(activeMenu(guildId, 'rz:s:early', 'Alege zona', false))], ephemeral: true });
        return true;
      case 'hist': {
        const rows = core.recent(guildId, 10);
        const text = rows.length
          ? rows.map((h) => `**${h.zone}** · <t:${unix(h.at)}:f> · ${core.STATUS_LABEL[h.status]}${h.early ? ' (mai devreme)' : ''}`).join('\n').slice(0, 3800)
          : 'Nicio razie în istoric încă.';
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(BLURPLE).setTitle('Istoric').setDescription(text)], ephemeral: true });
        return true;
      }
      case 'set':
        if (!isAdmin(interaction)) { await adminOnly(); return true; }
        await interaction.reply(settingsPayload(guildId));
        return true;
      case 't': // toggles: voice | warn
        if (!isAdmin(interaction)) { await adminOnly(); return true; }
        if (arg === 'voice' || arg === 'warn') core.setConfig(guildId, { [arg]: core.cfg(guildId)[arg] === false });
        await interaction.update(settingsPayload(guildId));
        return true;
      case 'y': { // raid happened -> restart
        core.markHistory(guildId, arg, 'pending', 'confirmed');
        const res = core.start(client, { guildId, zone: arg, userId });
        await interaction.update({
          content: '',
          embeds: [new EmbedBuilder().setColor(GREEN).setTitle('Razie confirmată')
            .setDescription(`**${arg}** · confirmată de <@${userId}>\n${res.ok ? `Următoarea posibilă ${when(res.entry.endsAt)}` : ''}`)],
          components: [row(btn(`rz:u:${arg}`, 'Anulează (am apăsat greșit)'))],
          allowedMentions: NO_PING,
        });
        return true;
      }
      case 'n': // no raid
        core.markHistory(guildId, arg, 'pending', 'none');
        updatePanel(client, guildId).catch(log('panel'));
        await interaction.update({
          content: '',
          embeds: [new EmbedBuilder().setColor(GREY).setTitle("N-a fost razie").setDescription(`**${arg}** · marcat de <@${userId}>`)],
          components: [row(btn(`rz:u:${arg}`, 'Anulează (am apăsat greșit)'))],
          allowedMentions: NO_PING,
        });
        return true;
      case 'u': // undo y / n
        if (!core.markHistory(guildId, arg, 'confirmed', 'pending')) core.markHistory(guildId, arg, 'none', 'pending');
        core.cancel(client, guildId, arg);
        await interaction.update({ embeds: [fireEmbed(arg, false)], components: [fireButtons(arg)] });
        return true;
      case 'ue': { // undo "came earlier"
        const [prev, ...zoneParts] = arg.split(':');
        const zone = zoneParts.join(':');
        const entry = core.undoEarly(client, { guildId, zone, prevEndsAt: Number(prev), userId });
        await interaction.update({
          content: entry ? `Anulat. Timerul vechi e înapoi: **${zone}** · ${when(entry.endsAt)}` : `Anulat. **${zone}** a fost scos din istoric.`,
          components: [],
          allowedMentions: NO_PING,
        });
        return true;
      }
      default:
        await say('Butonul ăsta e vechi. Folosește panoul actual (`/razie panou`).');
        return true;
    }
  }

  // ---- select menus
  if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
    const value = interaction.values[0];
    if (kind !== 's') return true;

    if (arg === 'start') {
      const res = core.start(client, { guildId, zone: value, userId });
      await interaction.update({ content: res.ok ? startedText(res) : 'Zonă invalidă.', components: [], allowedMentions: NO_PING });
    } else if (arg === 'cancel') {
      const text = value === '__all__'
        ? `${core.cancelAll(client, guildId)} timere șterse.`
        : core.cancel(client, guildId, value) ? `Timerul pentru **${value}** a fost anulat.` : 'Timerul nu mai există.';
      await interaction.update({ content: text, components: [], allowedMentions: NO_PING });
    } else if (arg === 'early') {
      const res = core.earlyRaid(client, { guildId, zone: value, userId });
      await interaction.update(res.ok
        ? { content: earlyText(res), components: [row(btn(`rz:ue:${res.prevEndsAt}:${res.entry.zone}`, 'Anulează (am apăsat greșit)'))], allowedMentions: NO_PING }
        : { content: 'Timerul nu mai există.', components: [] });
    } else if (arg === 'chan' || arg === 'delzone') {
      if (!isAdmin(interaction)) { await adminOnly(); return true; }
      if (arg === 'chan') core.setConfig(guildId, { channelId: value });
      else core.removeZone(guildId, value);
      await interaction.update(settingsPayload(guildId));
    }
    return true;
  }

  // ---- modal
  if (interaction.isModalSubmit() && kind === 'm' && arg === 'start') {
    const res = core.start(client, {
      guildId,
      zone: interaction.fields.getTextInputValue('zone'),
      minutes: parseMinutes(interaction.fields.getTextInputValue('mins')),
      userId,
    });
    await say(res.ok ? startedText(res) : 'Scrie o zonă.');
    return true;
  }
  return true;
}

module.exports = { panelPayload, updatePanel, createPanel, announceWarn, announceFire, clearWarn, handleInteraction };

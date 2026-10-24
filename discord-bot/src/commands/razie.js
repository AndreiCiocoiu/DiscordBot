const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const razii = require('../utils/razii');

const NO_PING = { parse: [] };
const unix = (ms) => Math.floor(ms / 1000);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('razie')
    .setDescription('Timere și istoric pentru raziile din RDR2.')
    .addSubcommand((s) =>
      s.setName('start').setDescription('Pornește timerul (implicit 3 ore) pentru o zonă.')
        .addStringOption((o) => o.setName('zona').setDescription('Ex: Valentine').setRequired(true).setMaxLength(60))
        .addIntegerOption((o) => o.setName('minute').setDescription('Altă durată în minute (pentru test)').setMinValue(1).setMaxValue(1440)))
    .addSubcommand((s) => s.setName('lista').setDescription('Arată timerele active.'))
    .addSubcommand((s) =>
      s.setName('anuleaza').setDescription('Oprește timerul unei zone.')
        .addStringOption((o) => o.setName('zona').setDescription('Zona').setRequired(true).setMaxLength(60)))
    .addSubcommand((s) => s.setName('alerta').setDescription('Primești / nu mai primești alertele (rolul Razie).'))
    .addSubcommand((s) => s.setName('panou').setDescription('Postează panoul live în canalul ăsta (admin).'))
    .addSubcommand((s) =>
      s.setName('canal').setDescription('Canalul unde vin notificările (admin).')
        .addChannelOption((o) => o.setName('canal').setDescription('Canal text').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName('istoric').setDescription('Ultimele 10 razii.'))
    .addSubcommand((s) => s.setName('stats').setDescription('Statistici pe zone.'))
    .addSubcommand((s) =>
      s.setName('sunet').setDescription('Încarcă vocea ta („Atenție razie”) care se aude după sirenă (admin).')
        .addAttachmentOption((o) => o.setName('fisier').setDescription('mp3, wav, ogg sau m4a, max 3 MB').setRequired(true)))
    .addSubcommand((s) => s.setName('test').setDescription('Intră la tine pe voice și dă sirena + vocea (admin).')),

  async execute(interaction, client) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Doar pe server.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
    const adminOnly = () => interaction.reply({ content: 'Doar adminii pot folosi comanda asta.', ephemeral: true });

    if (sub === 'start') {
      const result = razii.start(client, {
        guildId: interaction.guildId,
        zone: interaction.options.getString('zona'),
        minutes: interaction.options.getInteger('minute'),
        channelId: interaction.channelId,
        userId: interaction.user.id,
      });
      return interaction.reply({ content: razii.startMessage(result), allowedMentions: NO_PING });
    }

    if (sub === 'lista') {
      const timers = razii.list(interaction.guildId);
      if (!timers.length) return interaction.reply({ content: 'Niciun timer activ.', ephemeral: true });
      const lines = timers.map((t) => `**${t.zone}**: <t:${unix(t.endsAt)}:R> (<t:${unix(t.endsAt)}:t>)`);
      return interaction.reply({ content: lines.join('\n').slice(0, 1900), allowedMentions: NO_PING });
    }

    if (sub === 'anuleaza') {
      const removed = razii.cancel(client, interaction.guildId, interaction.options.getString('zona'));
      return interaction.reply({
        content: removed ? `Timerul pentru **${removed.zone}** a fost oprit.` : 'Nu există timer pentru zona asta.',
        allowedMentions: NO_PING,
      });
    }

    if (sub === 'alerta') {
      const res = await razii.toggleRole(interaction.member);
      return interaction.reply({
        content: !res.ok
          ? 'Nu pot da rolul (botul are nevoie de permisiunea Manage Roles).'
          : res.has ? 'Ai primit rolul **Razie**, vei primi alertele.' : 'Ți-am scos rolul **Razie**.',
        ephemeral: true,
      });
    }

    if (sub === 'panou') {
      if (!isAdmin) return adminOnly();
      await razii.createPanel(client, interaction.channel);
      return interaction.reply({ content: 'Panoul e postat (și fixat, dacă am voie).', ephemeral: true });
    }

    if (sub === 'canal') {
      if (!isAdmin) return adminOnly();
      const channel = interaction.options.getChannel('canal');
      razii.setChannel(interaction.guildId, channel.id);
      return interaction.reply({ content: `Notificările de razie vin acum în ${channel}.` });
    }

    if (sub === 'istoric') {
      const rows = razii.recent(interaction.guildId, 10);
      if (!rows.length) return interaction.reply({ content: 'Nicio razie în istoric încă.', ephemeral: true });
      const text = rows.map((h) => `**${h.zone}**: <t:${unix(h.at)}:f> (${razii.STATUS_LABEL[h.status]})`).join('\n');
      return interaction.reply({ content: text.slice(0, 1900), allowedMentions: NO_PING });
    }

    if (sub === 'stats') {
      const rows = razii.stats(interaction.guildId);
      if (!rows.length) return interaction.reply({ content: 'Nu sunt date încă.', ephemeral: true });
      const fmtGap = (m) => (m == null ? '-' : m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m} min`);
      const embed = new EmbedBuilder().setTitle('Statistici razii').setColor(0xe74c3c);
      for (const r of rows.slice(0, 20)) {
        embed.addFields({
          name: r.zone,
          value:
            `Confirmate: **${r.confirmed}** din ${r.total} alerte (n-au fost: ${r.none})\n` +
            `Ultima: ${r.last ? `<t:${unix(r.last)}:R>` : '-'}\n` +
            `Interval mediu între razii: ${fmtGap(r.avgGapMin)}\n` +
            `Ultimele 7 zile: ${r.last7}`,
          inline: true,
        });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'sunet') {
      if (!isAdmin) return adminOnly();
      const att = interaction.options.getAttachment('fisier');
      const ext = (att.name.split('.').pop() || '').toLowerCase();
      if (!razii.AUDIO_EXT.includes(ext)) {
        return interaction.reply({ content: `Fișierul trebuie să fie ${razii.AUDIO_EXT.join(', ')}.`, ephemeral: true });
      }
      if (att.size > 3 * 1024 * 1024) {
        return interaction.reply({ content: 'Fișierul e prea mare (max 3 MB).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      const res = await fetch(att.url);
      if (!res.ok) return interaction.editReply('Nu am putut descărca fișierul.');
      razii.saveRecording(Buffer.from(await res.arrayBuffer()), ext);
      return interaction.editReply('Salvat. Se aude după sirenă. Probează cu `/razie test`.');
    }

    if (sub === 'test') {
      if (!isAdmin) return adminOnly();
      const channel = interaction.member.voice?.channel;
      if (!channel) return interaction.reply({ content: 'Intră întâi pe un canal vocal.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      try {
        await razii.playInChannel(interaction.guild, channel);
        return interaction.editReply(razii.findVoiceRecording() ? 'Gata.' : 'Gata. (Nu ai încărcat încă vocea, vezi `/razie sunet`.)');
      } catch (err) {
        console.error('razie test error:', err);
        return interaction.editReply(`Nu a mers: ${err.message}`);
      }
    }
  },
};

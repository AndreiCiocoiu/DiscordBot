const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const razii = require('../utils/razii');
const ui = require('../utils/raziiUi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('razie')
    .setDescription('Timere și istoric pentru raziile din RDR2.')
    .addSubcommand((s) =>
      s.setName('start').setDescription('Pornește (sau repornește) timerul pentru o zonă.')
        .addStringOption((o) => o.setName('zona').setDescription('Ex: Annesburg').setRequired(true).setMaxLength(60))
        .addIntegerOption((o) => o.setName('minute').setDescription('Minute rămase (gol = timer întreg)').setMinValue(1).setMaxValue(1440)))
    .addSubcommand((s) =>
      s.setName('anuleaza').setDescription('Oprește timerul unei zone.')
        .addStringOption((o) => o.setName('zona').setDescription('Zona').setRequired(true).setMaxLength(60)))
    .addSubcommand((s) => s.setName('panou').setDescription('Postează panoul cu butoane în canalul ăsta (admin).'))
    .addSubcommand((s) =>
      s.setName('canal').setDescription('Canalul unde vin notificările (admin).')
        .addChannelOption((o) => o.setName('canal').setDescription('Canal text').addChannelTypes(ChannelType.GuildText).setRequired(true)))
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
      if (!result.ok) return interaction.reply({ content: 'Scrie o zonă.', ephemeral: true });
      return interaction.reply(ui.startPayload(result));
    }

    if (sub === 'anuleaza') {
      const removed = razii.cancel(client, interaction.guildId, interaction.options.getString('zona'));
      return interaction.reply({
        content: removed ? `Timerul pentru **${removed.zone}** a fost oprit.` : 'Nu există timer pentru zona asta.',
        allowedMentions: { parse: [] },
      });
    }

    if (sub === 'panou') {
      if (!isAdmin) return adminOnly();
      await ui.createPanel(client, interaction.channel);
      return interaction.reply({ content: 'Panoul e postat (și fixat, dacă am voie).', ephemeral: true });
    }

    if (sub === 'canal') {
      if (!isAdmin) return adminOnly();
      const channel = interaction.options.getChannel('canal');
      razii.setConfig(interaction.guildId, { channelId: channel.id });
      return interaction.reply({ content: `Notificările de razie vin acum în ${channel}.` });
    }

    if (sub === 'sunet') {
      if (!isAdmin) return adminOnly();
      const att = interaction.options.getAttachment('fisier');
      const ext = (att.name.split('.').pop() || '').toLowerCase();
      if (!razii.AUDIO_EXT.includes(ext)) {
        return interaction.reply({ content: `Fișierul trebuie să fie ${razii.AUDIO_EXT.join(', ')}.`, ephemeral: true });
      }
      if (att.size > 3 * 1024 * 1024) return interaction.reply({ content: 'Fișierul e prea mare (max 3 MB).', ephemeral: true });
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

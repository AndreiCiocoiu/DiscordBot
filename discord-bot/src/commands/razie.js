const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const razii = require('../utils/razii');
const ui = require('../utils/raziiUi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('razie')
    .setDescription('Panou și sunet pentru raziile din RDR2 (admin).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('panou').setDescription('Postează panoul cu butoane în canalul ăsta.'))
    .addSubcommand((s) =>
      s.setName('sunet').setDescription('Încarcă vocea ta („Atenție razie”) care se aude după sirenă.')
        .addAttachmentOption((o) => o.setName('fisier').setDescription('mp3, wav, ogg sau m4a, max 3 MB').setRequired(true)))
    .addSubcommand((s) => s.setName('test').setDescription('Intră la tine pe voice și dă sirena + vocea.')),

  async execute(interaction, client) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Doar pe server.', ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'panou') {
      await interaction.deferReply({ ephemeral: true });
      await ui.createPanel(client, interaction.channel);
      return interaction.editReply('Panoul e postat. Alertele vin în canalul ăsta (schimbi din Setări).');
    }

    if (sub === 'sunet') {
      const att = interaction.options.getAttachment('fisier');
      const ext = (att.name.split('.').pop() || '').toLowerCase();
      if (!razii.AUDIO_EXT.includes(ext)) return interaction.reply({ content: `Fișierul trebuie să fie ${razii.AUDIO_EXT.join(', ')}.`, ephemeral: true });
      if (att.size > 3 * 1024 * 1024) return interaction.reply({ content: 'Fișierul e prea mare (max 3 MB).', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const res = await fetch(att.url);
      if (!res.ok) return interaction.editReply('Nu am putut descărca fișierul.');
      razii.saveRecording(Buffer.from(await res.arrayBuffer()), ext);
      return interaction.editReply('Salvat. Se aude după sirenă. Probează cu `/razie test`.');
    }

    if (sub === 'test') {
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

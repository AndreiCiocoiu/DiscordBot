// Slash commands (the only ones this bot has):
//   /craft <item>     recipe in the chat (autocomplete)          everyone  -> craft.js
//   /catalog          private catalog with arrows                everyone
//   /panou <tip>      post a panel here (craft / razie / sesiuni)   admins only (Manage Server)
// Admin commands are hidden from everyone else by Discord AND re-checked here.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const craft = require('./craft');
const raziiUi = require('./raziiUi');
const sessions = require('./sessions');
const store = require('./store');
const adminlog = require('./adminlog');

const catalogCommand = new SlashCommandBuilder().setName('catalog').setDescription('Catalogul de crafting pe categorii').setContexts(0);

const panelCommand = new SlashCommandBuilder().setName('panou').setDescription('Postează un panou în canalul ăsta (admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(0)
  .addStringOption((o) => o.setName('tip').setDescription('Ce panou').setRequired(true).addChoices(
    { name: 'Crafting', value: 'craft' },
    { name: 'Razii', value: 'razie' },
    { name: 'Sesiuni', value: 'sesiuni' },
  ));

const list = [craft.command, catalogCommand, panelCommand];

async function handleInteraction(interaction, client) {
  if (!interaction.isChatInputCommand?.()) return false;

  if (interaction.commandName === 'catalog') {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await craft.catalogView(0));
    return true;
  }

  if (interaction.commandName === 'panou') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'Doar adminii pot folosi comanda asta.', ephemeral: true });
      return true;
    }
    const tip = interaction.options.getString('tip', true);
    const channel = interaction.channel ?? (await client.channels.fetch(interaction.channelId).catch(() => null));
    if (!channel) { await interaction.reply({ content: 'Nu pot scrie aici.', ephemeral: true }); return true; }
    await interaction.deferReply({ ephemeral: true });
    try {
      if (tip === 'craft') await channel.send(craft.panelPayload());
      else if (tip === 'razie') await raziiUi.createPanel(client, channel);
      else if (tip === 'sesiuni') {
        store.setConfig(interaction.guildId, { sessionsId: channel.id });
        await sessions.postPanel(client, channel);
      }
      adminlog.action(client, interaction.guildId, `Panou postat: ${tip}`, `În ${channel}`, interaction.user.id);
      await interaction.editReply('Gata, panoul e postat.');
    } catch (err) {
      console.error('panou error:', err);
      await interaction.editReply(`Nu a mers: ${err.message}`);
    }
    return true;
  }
  return false;
}

module.exports = { list, handleInteraction };

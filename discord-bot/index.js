require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const razii = require('./src/utils/razii');
const raziiUi = require('./src/utils/raziiUi');

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // for the "razie <zona>" text trigger
  ],
});
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'src', 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.name) client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  razii.restore(client);

  // Register the slash commands on every start (anything not in src/commands is removed).
  const body = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
  try {
    if (process.env.GUILD_ID) {
      const guild = await c.guilds.fetch(process.env.GUILD_ID);
      await guild.commands.set(body);
      await c.application.commands.set([]); // clear old global commands so nothing shows twice
      console.log(`Registered ${body.length} command(s) in guild ${guild.name}.`);
    } else {
      await c.application.commands.set(body);
      console.log(`Registered ${body.length} global command(s). Set GUILD_ID for instant updates.`);
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

async function fail(interaction, err) {
  if (err?.code === 10062 || err?.code === 40060) return; // expired / already answered
  console.error('Interaction error:', err);
  const payload = { content: 'Ceva nu a mers, mai încearcă o dată.', ephemeral: true };
  if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
  else await interaction.reply(payload).catch(() => {});
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      await raziiUi.handleInteraction(interaction, client); // ignores components that aren't ours
    } else if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction, client);
    }
  } catch (err) {
    await fail(interaction, err);
  }
});

// Text trigger: "razie Valentine". Only works in the panel / alert channel
// (or anywhere if no panel exists yet), at most once every 2 seconds per user.
const lastUse = new Map();
client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !message.guild) return;
    const m = message.content.trim().match(/^razie\s+(.+)$/i);
    if (!m) return;

    const c = razii.cfg(message.guild.id);
    const allowed = [c.panel?.channelId, c.channelId].filter(Boolean);
    if (allowed.length && !allowed.includes(message.channel.id)) return;

    const now = Date.now();
    if (now - (lastUse.get(message.author.id) || 0) < 2000) return;
    lastUse.set(message.author.id, now);

    const res = razii.start(client, { guildId: message.guild.id, zone: m[1], userId: message.author.id });
    if (!res.ok) return;
    if (c.panel) {
      await message.react('✅').catch(() => message.reply({ content: `Pornit: **${res.entry.zone}**`, allowedMentions: { parse: [] } }).catch(() => {}));
    } else {
      await message.reply({ content: `Pornit: **${res.entry.zone}** · <t:${Math.floor(res.entry.endsAt / 1000)}:R>`, allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
    }
  } catch (err) {
    console.error('Text trigger error:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const razii = require('./src/utils/razii');
const raziiUi = require('./src/utils/raziiUi');
const { handleMessage } = require('./src/utils/raziiText');
const { handleServerMessage } = require('./src/utils/serverText');
const sessions = require('./src/utils/sessions');
const welcome = require('./src/utils/welcome');
const adminlog = require('./src/utils/adminlog');
const craft = require('./src/utils/craft');

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

const G = GatewayIntentBits;
const BASE_INTENTS = [
  G.Guilds, G.GuildModeration, G.GuildExpressions ?? G.GuildEmojisAndStickers, G.GuildInvites, G.GuildWebhooks,
  G.GuildVoiceStates, G.GuildMessages, G.GuildScheduledEvents, G.AutoModerationExecution,
];

// Privileged intents must be switched on in the Developer Portal. If one is
// off, the bot starts anyway with fewer features instead of not starting.
const LEVELS = [
  { members: true, content: true },
  { members: false, content: true },
  { members: false, content: false },
];

function build(level) {
  const intents = [...BASE_INTENTS];
  if (level.members) intents.push(G.GuildMembers);
  if (level.content) intents.push(G.MessageContent);
  const client = new Client({ intents, partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User] });
  wire(client, level);
  return client;
}

// The only slash command is /craft (read-only lookup, answer is private). Everything else
// left over from older versions (global or per server) is removed at every start.
async function syncSlashCommands(c) {
  try {
    const global = await c.application.commands.fetch();
    if (global.size) { await c.application.commands.set([]); console.log(`Removed ${global.size} global slash command(s).`); }
  } catch (err) { console.error('Could not clear global slash commands:', err.message); }
  for (const guild of c.guilds.cache.values()) await syncGuild(guild);
}
async function syncGuild(guild) {
  try { await guild.commands.set([craft.command.toJSON()]); }
  catch (err) { console.error(`Could not set /craft in ${guild.name}:`, err.message); }
}

function wire(client, level) {
  client.once(Events.ClientReady, async (c) => {
    console.log(`Logged in as ${c.user.tag}`);
    if (!level.members) console.warn('Server Members Intent is OFF: welcome banner and member logs are disabled. Enable it in the Developer Portal -> Bot.');
    if (!level.content) console.warn('Message Content Intent is OFF: "razie ..." / "server ..." text commands and message logs are disabled.');
    razii.restore(client);
    sessions.restore(client);
    await syncSlashCommands(c);
  });

  client.on(Events.GuildCreate, (guild) => syncGuild(guild));
  adminlog.attach(client);
  client.on(Events.GuildMemberAdd, (member) => welcome.onMemberAdd(client, member).catch((err) => console.error('welcome error:', err)));

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!(interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit() || interaction.isChatInputCommand() || interaction.isAutocomplete())) return;
    try {
      (await raziiUi.handleInteraction(interaction, client)) || (await sessions.handleInteraction(interaction, client)) || (await craft.handleInteraction(interaction, client));
    } catch (err) {
      if (err?.code === 10062 || err?.code === 40060) return; // expired / already answered
      console.error('Interaction error:', err);
      const payload = { content: 'Ceva nu a mers, mai încearcă o dată.', ephemeral: true };
      if (interaction.isAutocomplete()) return;
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  });

  client.on(Events.MessageCreate, (message) => {
    handleMessage(message, client).catch((err) => console.error('Text trigger error:', err));
    craft.handleMessage(message, client).catch((err) => console.error('Craft error:', err));
    handleServerMessage(message, client).catch((err) => console.error('Server command error:', err));
  });
}

async function main() {
  for (const level of LEVELS) {
    const client = build(level);
    try {
      await client.login(process.env.DISCORD_TOKEN);
      return;
    } catch (err) {
      client.destroy();
      if (!/disallowed intents/i.test(String(err?.message)) || level === LEVELS[LEVELS.length - 1]) throw err;
      console.warn('A privileged intent is not enabled in the Developer Portal, retrying with fewer features...');
    }
  }
}

main().catch((err) => { console.error('Failed to start:', err); process.exit(1); });

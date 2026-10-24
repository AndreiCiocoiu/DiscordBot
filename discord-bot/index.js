require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'src', 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.name) client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  // Register the slash commands on every start, so a Railway redeploy is
  // enough and `npm run deploy` isn't needed. Anything not in src/commands
  // is removed from Discord.
  const body = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
  try {
    if (process.env.GUILD_ID) {
      const guild = await c.guilds.fetch(process.env.GUILD_ID);
      await guild.commands.set(body);
      await c.application.commands.set([]); // clear old global commands so nothing shows twice
      console.log(`Registered ${body.length} command(s) in guild ${guild.name}.`);
    } else {
      await c.application.commands.set(body);
      console.log(`Registered ${body.length} global command(s) (can take a while to show up; set GUILD_ID for instant).`);
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err);
    const payload = { content: 'Something went wrong.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);

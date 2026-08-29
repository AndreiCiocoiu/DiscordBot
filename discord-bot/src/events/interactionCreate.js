const { Events } = require('discord.js');
const music = require('../utils/musicPlayer');

async function handleMusicButton(interaction) {
  const [, action, guildId] = interaction.customId.split('_');
  const q = music.getQueue(guildId);

  if (!q) {
    return interaction.reply({ content: "Nothing's playing anymore.", ephemeral: true });
  }

  if (action === 'pause') {
    if (q.node.isPaused()) music.resume(guildId);
    else music.pause(guildId);
  } else if (action === 'skip') {
    music.skip(guildId);
  } else if (action === 'loop') {
    music.toggleLoop(guildId);
  } else if (action === 'stop') {
    music.stop(guildId);
    return interaction.update({ content: '⏹️ Stopped.', embeds: [], components: [] });
  }

  // Refresh the buttons/embed to reflect the new state (pause icon, loop highlight, etc.)
  const currentTrack = q.currentTrack;
  if (currentTrack) {
    const embed = music.buildNowPlayingEmbed(currentTrack, q.repeatMode);
    const row = music.buildControlsRow(guildId);
    await interaction.update({ embeds: [embed], components: [row] });
  } else {
    await interaction.update({ content: 'Queue is empty.', embeds: [], components: [] });
  }
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (interaction.isButton() && interaction.customId.startsWith('music_')) {
      try {
        await handleMusicButton(interaction);
      } catch (err) {
        console.error('Music button error:', err);
        await interaction.reply({ content: 'Something went wrong with that control.', ephemeral: true }).catch(() => {});
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`Error running /${interaction.commandName}:`, err);
      const payload = { content: 'Something went wrong running that command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};

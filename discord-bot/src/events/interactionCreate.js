const {
  Events,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const music = require('../utils/musicPlayer');
const db = require('../utils/database');
const { toSmallCaps } = require('../utils/fancyFont');

async function refreshNowPlaying(interaction, guildId, q) {
  const currentTrack = q.currentTrack;
  if (currentTrack) {
    const embed = music.buildNowPlayingEmbed(currentTrack, q.repeatMode);
    const rows = music.buildControlsRows(guildId);
    await interaction.update({ embeds: [embed], components: rows });
  } else {
    await interaction.update({ content: 'Queue is empty.', embeds: [], components: [] });
  }
}

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
  } else if (action === 'shuffle') {
    music.shuffle(guildId);
  } else if (action === 'volup') {
    music.volumeUp(guildId);
  } else if (action === 'voldown') {
    music.volumeDown(guildId);
  } else if (action === 'stop') {
    music.stop(guildId);
    return interaction.update({ content: '⏹️ Stopped.', embeds: [], components: [] });
  } else if (action === 'queue') {
    const upcoming = q.tracks.toArray();
    const lines = [];
    if (q.currentTrack) lines.push(`▶️ **${q.currentTrack.title}** — requested by ${q.currentTrack.requestedBy ?? 'Unknown'}`);
    upcoming.forEach((t, i) => lines.push(`${i + 1}. **${t.title}** — requested by ${t.requestedBy ?? 'Unknown'}`));

    const embed = new EmbedBuilder()
      .setTitle(`🎶 ${toSmallCaps('Queue')}`)
      .setColor(0x5865f2)
      .setDescription(lines.length ? lines.join('\n') : 'Nothing queued.');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (action === 'request') {
    const modal = new ModalBuilder()
      .setCustomId(`music_requestmodal_${guildId}`)
      .setTitle('Request a song');

    const input = new TextInputBuilder()
      .setCustomId('song_query')
      .setLabel('Song name or a YouTube link')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. Blinding Lights')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // Refresh the buttons/embed to reflect the new state (pause icon, loop highlight, etc.)
  await refreshNowPlaying(interaction, guildId, q);
}

async function handleSongRequestModal(interaction) {
  const [, , guildId] = interaction.customId.split('_');
  const query = interaction.fields.getTextInputValue('song_query');

  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const track = await music.playSong(voiceChannel, interaction.channel, query, interaction.user);
    await interaction.editReply(`➕ Queued: **${track.title}**`);
  } catch (err) {
    console.error('Song request modal error:', err);
    await interaction.editReply("Couldn't find or play that — try a different search.");
  }
}

async function toggleRole(interaction, roleId, roleLabel) {
  if (!roleId) {
    return interaction.reply({ content: "That role isn't set up yet — an admin needs to run /setup.", ephemeral: true });
  }
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    return interaction.reply({ content: "That role no longer exists — an admin needs to run /setup again.", ephemeral: true });
  }

  const member = interaction.member;
  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId).catch(() => {});
    return interaction.reply({ content: `Removed **${roleLabel}**.`, ephemeral: true });
  }

  await member.roles.add(roleId).catch(() => {});
  return interaction.reply({ content: `Added **${roleLabel}**! 🎉`, ephemeral: true });
}

async function handleAion2ClassRoleButton(interaction) {
  const className = interaction.customId.replace('aion2role_', '');
  const config = db.getGuildConfig(interaction.guild.id);
  const roleId = config?.aion2ClassRoleIds?.[className];
  await toggleRole(interaction, roleId, className);
}

async function handleAion2GeneralRoleButton(interaction) {
  const config = db.getGuildConfig(interaction.guild.id);
  await toggleRole(interaction, config?.aion2GeneralRoleId, 'AION 2');
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

    if (interaction.isModalSubmit() && interaction.customId.startsWith('music_requestmodal_')) {
      try {
        await handleSongRequestModal(interaction);
      } catch (err) {
        console.error('Song request modal error:', err);
        await interaction.reply({ content: 'Something went wrong with that request.', ephemeral: true }).catch(() => {});
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('aion2role_')) {
      try {
        await handleAion2ClassRoleButton(interaction);
      } catch (err) {
        console.error('AION 2 class role button error:', err);
        await interaction.reply({ content: 'Something went wrong with that role.', ephemeral: true }).catch(() => {});
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === 'aion2general') {
      try {
        await handleAion2GeneralRoleButton(interaction);
      } catch (err) {
        console.error('AION 2 general role button error:', err);
        await interaction.reply({ content: 'Something went wrong with that role.', ephemeral: true }).catch(() => {});
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

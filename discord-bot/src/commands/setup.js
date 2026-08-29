const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const db = require('../utils/database');
const { toSmallCaps } = require('../utils/fancyFont');

const ROLE_DEFS = [
  { name: `👑 ${toSmallCaps('Admin')}`, color: 0xE74C3C, permissions: [PermissionFlagsBits.Administrator], hoist: true },
  {
    name: `🛡️ ${toSmallCaps('Moderator')}`,
    color: 0x3498DB,
    permissions: [
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageNicknames,
    ],
    hoist: true,
  },
  { name: `🌱 ${toSmallCaps('Member')}`, color: 0x95A5A6, permissions: [], hoist: false },
  { name: `🥉 ${toSmallCaps('Level 5')}`, color: 0xCD7F32, permissions: [], hoist: true },
  { name: `🥈 ${toSmallCaps('Level 10')}`, color: 0xC0C0C0, permissions: [], hoist: true },
  { name: `🥇 ${toSmallCaps('Level 20')}`, color: 0xFFD700, permissions: [], hoist: true },
  { name: `💎 ${toSmallCaps('Level 30')}`, color: 0x9B59B6, permissions: [], hoist: true },
];

async function findOrCreateRole(guild, def) {
  let role = guild.roles.cache.find((r) => r.name === def.name);
  if (!role) {
    role = await guild.roles.create({
      name: def.name,
      colors: { primaryColor: def.color },
      permissions: def.permissions,
      hoist: def.hoist,
      reason: 'Server setup via /setup',
    });
  }
  return role;
}

async function findOrCreateCategory(guild, name) {
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === name
  );
  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      reason: 'Server setup via /setup',
    });
  }
  return category;
}

async function findOrCreateChannel(guild, name, type, parent, overwrites) {
  let channel = guild.channels.cache.find(
    (c) => c.name === name && c.parentId === parent.id && c.type === type
  );
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type,
      parent: parent.id,
      permissionOverwrites: overwrites,
      reason: 'Server setup via /setup',
    });
  }
  return channel;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up the whole server: channels, categories, and ranks/roles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Run this inside a server.', ephemeral: true });
    }

    await interaction.deferReply();
    const guild = interaction.guild;
    const everyone = guild.roles.everyone;

    // --- Roles ---
    const roles = {};
    for (const def of ROLE_DEFS) {
      roles[def.name] = await findOrCreateRole(guild, def);
    }

    const Admin = roles[`👑 ${toSmallCaps('Admin')}`];
    const Moderator = roles[`🛡️ ${toSmallCaps('Moderator')}`];
    const Member = roles[`🌱 ${toSmallCaps('Member')}`];

    // --- Chill Zone (text) ---
    const chillCategory = await findOrCreateCategory(guild, `💬 ${toSmallCaps('Chill Zone')}`);
    const welcomeChannel = await findOrCreateChannel(
      guild,
      `👋・${toSmallCaps('welcome')}`,
      ChannelType.GuildText,
      chillCategory,
      [{ id: everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] }]
    );
    const generalChat = await findOrCreateChannel(
      guild,
      `💬・${toSmallCaps('general')}`,
      ChannelType.GuildText,
      chillCategory,
      []
    );
    const memesChannel = await findOrCreateChannel(guild, `😂・${toSmallCaps('memes')}`, ChannelType.GuildText, chillCategory, []);
    await findOrCreateChannel(guild, `🎮・${toSmallCaps('gaming')}`, ChannelType.GuildText, chillCategory, []);
    const botCommandsChannel = await findOrCreateChannel(
      guild,
      `🤖・${toSmallCaps('bot-commands')}`,
      ChannelType.GuildText,
      chillCategory,
      []
    );

    // --- Voice ---
    const voiceCategory = await findOrCreateCategory(guild, `🔊 ${toSmallCaps('Voice')}`);
    await findOrCreateChannel(guild, `🎵・${toSmallCaps('music')}`, ChannelType.GuildText, voiceCategory, []);
    await findOrCreateChannel(guild, `🔊・${toSmallCaps('General Voice')}`, ChannelType.GuildVoice, voiceCategory, []);
    await findOrCreateChannel(guild, `🎮・${toSmallCaps('Gaming Voice')}`, ChannelType.GuildVoice, voiceCategory, []);
    await findOrCreateChannel(guild, `📷・${toSmallCaps('Camera')}`, ChannelType.GuildVoice, voiceCategory, []);
    await findOrCreateChannel(guild, `😴・${toSmallCaps('AFK')}`, ChannelType.GuildVoice, voiceCategory, []);

    // --- Save config for other commands/events to use ---
    db.saveGuildConfig(guild.id, {
      memberRoleId: Member.id,
      moderatorRoleId: Moderator.id,
      adminRoleId: Admin.id,
      welcomeChannelId: welcomeChannel.id,
      memesChannelId: memesChannel.id,
      botCommandsChannelId: botCommandsChannel.id,
      levelRoles: {
        5: roles[`🥉 ${toSmallCaps('Level 5')}`].id,
        10: roles[`🥈 ${toSmallCaps('Level 10')}`].id,
        20: roles[`🥇 ${toSmallCaps('Level 20')}`].id,
        30: roles[`💎 ${toSmallCaps('Level 30')}`].id,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle(`✅ ${toSmallCaps('Server setup complete!')}`)
      .setColor(0x57F287)
      .setDescription(
        [
          `**${toSmallCaps('Roles')}:** ${Admin} ${Moderator} ${Member}, plus 🥉 🥈 🥇 💎 rank roles that unlock as you level up`,
          `**${toSmallCaps('Channels')}:** ${welcomeChannel}, ${generalChat}, 😂 memes, 🎮 gaming, ${botCommandsChannel} — plus a 🎵 music-commands channel and 4 voice channels`,
          '',
          `New members auto-get **${Member.name}** and get welcomed in ${welcomeChannel}.`,
          `Chatting earns XP — level up to unlock rank roles automatically. Try /play to get music going! 🎶`,
          '',
          `⚠️ For roles to auto-assign, drag my bot's role **above** these roles in Server Settings → Roles.`,
        ].join('\n')
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

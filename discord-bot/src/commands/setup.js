const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const db = require('../utils/database');

const ROLE_DEFS = [
  { name: 'Admin', color: 0xE74C3C, permissions: [PermissionFlagsBits.Administrator], hoist: true },
  {
    name: 'Moderator',
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
  { name: 'Member', color: 0x95A5A6, permissions: [], hoist: false },
  { name: 'Level 5', color: 0x2ECC71, permissions: [], hoist: true },
  { name: 'Level 10', color: 0x27AE60, permissions: [], hoist: true },
  { name: 'Level 20', color: 0xF1C40F, permissions: [], hoist: true },
  { name: 'Level 30', color: 0x9B59B6, permissions: [], hoist: true },
];

async function findOrCreateRole(guild, def) {
  let role = guild.roles.cache.find((r) => r.name === def.name);
  if (!role) {
    role = await guild.roles.create({
      name: def.name,
      color: def.color,
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

    const { Admin, Moderator, Member } = roles;

    // --- Info category ---
    const infoCategory = await findOrCreateCategory(guild, 'ℹ️ Information');
    const welcomeChannel = await findOrCreateChannel(guild, 'welcome', ChannelType.GuildText, infoCategory, [
      { id: everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
    ]);
    const rulesChannel = await findOrCreateChannel(guild, 'rules', ChannelType.GuildText, infoCategory, [
      { id: everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
    ]);
    const announcementsChannel = await findOrCreateChannel(
      guild,
      'announcements',
      ChannelType.GuildText,
      infoCategory,
      [
        { id: everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
        { id: Moderator.id, allow: [PermissionFlagsBits.SendMessages] },
        { id: Admin.id, allow: [PermissionFlagsBits.SendMessages] },
      ]
    );

    // --- General category ---
    const generalCategory = await findOrCreateCategory(guild, '💬 General');
    const generalChat = await findOrCreateChannel(guild, 'general-chat', ChannelType.GuildText, generalCategory, []);
    const memesChannel = await findOrCreateChannel(guild, 'memes', ChannelType.GuildText, generalCategory, []);
    const botCommandsChannel = await findOrCreateChannel(
      guild,
      'bot-commands',
      ChannelType.GuildText,
      generalCategory,
      []
    );

    // --- Gaming category ---
    const gamingCategory = await findOrCreateCategory(guild, '🎮 Gaming');
    await findOrCreateChannel(guild, 'gaming-chat', ChannelType.GuildText, gamingCategory, []);
    await findOrCreateChannel(guild, 'looking-for-group', ChannelType.GuildText, gamingCategory, []);
    await findOrCreateChannel(guild, 'clips-and-clutches', ChannelType.GuildText, gamingCategory, []);

    // --- Voice category ---
    const voiceCategory = await findOrCreateCategory(guild, '🔊 Voice Channels');
    await findOrCreateChannel(guild, 'General Voice', ChannelType.GuildVoice, voiceCategory, []);
    await findOrCreateChannel(guild, 'Gaming Voice 1', ChannelType.GuildVoice, voiceCategory, []);
    await findOrCreateChannel(guild, 'Gaming Voice 2', ChannelType.GuildVoice, voiceCategory, []);
    await findOrCreateChannel(guild, 'AFK', ChannelType.GuildVoice, voiceCategory, []);

    // --- Staff-only category ---
    const staffCategory = await findOrCreateCategory(guild, '🔒 Staff');
    const staffOverwrites = [
      { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: Moderator.id, allow: [PermissionFlagsBits.ViewChannel] },
      { id: Admin.id, allow: [PermissionFlagsBits.ViewChannel] },
    ];
    await findOrCreateChannel(guild, 'mod-chat', ChannelType.GuildText, staffCategory, staffOverwrites);
    await findOrCreateChannel(guild, 'reports', ChannelType.GuildText, staffCategory, staffOverwrites);

    // --- Save config for other commands/events to use ---
    db.saveGuildConfig(guild.id, {
      memberRoleId: Member.id,
      moderatorRoleId: Moderator.id,
      adminRoleId: Admin.id,
      welcomeChannelId: welcomeChannel.id,
      announcementsChannelId: announcementsChannel.id,
      botCommandsChannelId: botCommandsChannel.id,
      levelRoles: {
        5: roles['Level 5'].id,
        10: roles['Level 10'].id,
        20: roles['Level 20'].id,
        30: roles['Level 30'].id,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Server setup complete')
      .setColor(0x57F287)
      .setDescription(
        [
          `**Roles:** ${Admin} ${Moderator} ${Member}, plus Level 5/10/20/30 rank roles`,
          `**Channels:** Information, General, Gaming, Voice, and a private Staff category`,
          '',
          `New members auto-get **${Member.name}**. Chatting earns XP and unlocks level roles automatically.`,
          `Heads up: for role auto-assignment to work, make sure my bot role is positioned **above** the roles I created in Server Settings → Roles.`,
        ].join('\n')
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

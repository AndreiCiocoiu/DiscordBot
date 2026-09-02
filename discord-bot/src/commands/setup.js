const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const db = require('../utils/database');
const { toSmallCaps } = require('../utils/fancyFont');
const { postClassShowcase } = require('../utils/aion2Classes');
const { postRolePicker, CLASS_EMOJIS } = require('../utils/aion2Roles');
const { AION2_CLASSES } = require('../data/aion2Classes');
const { NEW_GAME_ROLE_DEFS, GAME_LIST, postGameRolesPicker } = require('../utils/gameRoles');

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

// One self-assignable role per AION 2 class, plus a general "I play AION 2"
// role — colors match each class's embed color for visual consistency.
const CLASS_ROLE_COLORS = {
  Tank: 0x5865f2,
  'Melee DPS / Off-tank': 0xe74c3c,
  'Melee DPS': 0xe74c3c,
  'Ranged DPS': 0xf1c40f,
  'Magic DPS': 0x9b59b6,
  'Magic DPS / Summoner': 0x9b59b6,
  'Support / Hybrid': 0x2ecc71,
  Healer: 0x1abc9c,
};
const AION2_ROLE_DEFS = [
  { name: `🕊️ ${toSmallCaps('AION 2')}`, color: 0x8a2be2, permissions: [], hoist: false },
  ...AION2_CLASSES.map((cls) => ({
    name: `${CLASS_EMOJIS[cls.name] ?? '🎮'} ${toSmallCaps(cls.name)}`,
    color: CLASS_ROLE_COLORS[cls.role] ?? 0x8a2be2,
    permissions: [],
    hoist: false,
  })),
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

async function findOrCreateCategory(guild, name, overwrites) {
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === name
  );
  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      reason: 'Server setup via /setup',
    });
  } else if (overwrites) {
    await category.permissionOverwrites.set(overwrites, 'Server setup via /setup').catch(() => {});
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
  } else if (overwrites && overwrites.length) {
    await channel.permissionOverwrites.set(overwrites, 'Server setup via /setup').catch(() => {});
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

    // Force a fresh fetch instead of relying on the local cache — a stale
    // or incomplete cache is why re-running /setup was creating duplicate
    // roles/channels even when matching ones already existed.
    await guild.channels.fetch();
    await guild.roles.fetch();

    // --- Roles ---
    const roles = {};
    for (const def of ROLE_DEFS) {
      roles[def.name] = await findOrCreateRole(guild, def);
    }

    const aion2Roles = {};
    for (const def of AION2_ROLE_DEFS) {
      aion2Roles[def.name] = await findOrCreateRole(guild, def);
    }

    const gameRoles = {};
    for (const def of NEW_GAME_ROLE_DEFS) {
      gameRoles[def.name] = await findOrCreateRole(guild, def);
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
    await findOrCreateChannel(guild, `😂・${toSmallCaps('memes')}`, ChannelType.GuildText, chillCategory, []);
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

    // --- AION 2 ---
    const Aion2Role = aion2Roles[`🕊️ ${toSmallCaps('AION 2')}`];
    const aion2Category = await findOrCreateCategory(guild, `🕊️ ${toSmallCaps('AION 2')}`);

    // News/classes/chat are only visible to people who've grabbed the AION 2
    // role — but the roles channel itself stays open to everyone, otherwise
    // nobody could ever see it to opt in in the first place.
    const aion2MembersOnly = [
      { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: Aion2Role.id, allow: [PermissionFlagsBits.ViewChannel] },
      { id: Admin.id, allow: [PermissionFlagsBits.ViewChannel] },
      { id: Moderator.id, allow: [PermissionFlagsBits.ViewChannel] },
    ];

    const aion2RolesChannel = await findOrCreateChannel(
      guild,
      `🕊️・${toSmallCaps('roles')}`,
      ChannelType.GuildText,
      aion2Category,
      [{ id: everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] }]
    );
    const aion2NewsChannel = await findOrCreateChannel(
      guild,
      `📰・${toSmallCaps('news')}`,
      ChannelType.GuildText,
      aion2Category,
      aion2MembersOnly
    );
    const aion2ClassesChannel = await findOrCreateChannel(
      guild,
      `⚔️・${toSmallCaps('classes')}`,
      ChannelType.GuildText,
      aion2Category,
      [
        { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: Aion2Role.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
        { id: Admin.id, allow: [PermissionFlagsBits.ViewChannel] },
        { id: Moderator.id, allow: [PermissionFlagsBits.ViewChannel] },
      ]
    );
    await findOrCreateChannel(
      guild,
      `💬・${toSmallCaps('aion-2-chat')}`,
      ChannelType.GuildText,
      aion2Category,
      aion2MembersOnly
    );

    // Post the class showcase and role picker once — not on every /setup re-run.
    const aion2GeneralRoleId = Aion2Role.id;
    const aion2ClassRoleIds = {};
    for (const cls of AION2_CLASSES) {
      aion2ClassRoleIds[cls.name] = aion2Roles[`${CLASS_EMOJIS[cls.name] ?? '🎮'} ${toSmallCaps(cls.name)}`].id;
    }

    const existingConfig = db.getGuildConfig(guild.id);
    if (!existingConfig?.aion2ClassesPosted) {
      await postClassShowcase(aion2ClassesChannel);
    }
    if (!existingConfig?.aion2RolesPosted) {
      await postRolePicker(aion2RolesChannel);
    }

    // --- RDR2 Online ---
    const rdr2Category = await findOrCreateCategory(guild, `🤠 ${toSmallCaps('RDR2 Online')}`);
    await findOrCreateChannel(guild, `💬・${toSmallCaps('rdr2-chat')}`, ChannelType.GuildText, rdr2Category, []);

    // --- Game Roles (multi-game self-assign, separate from AION 2's own roles channel) ---
    const gameRolesCategory = await findOrCreateCategory(guild, `🎮 ${toSmallCaps('Game Roles')}`);
    const gameRolesChannel = await findOrCreateChannel(
      guild,
      `🎮・${toSmallCaps('game-roles')}`,
      ChannelType.GuildText,
      gameRolesCategory,
      [{ id: everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] }]
    );

    const gameRoleIds = {};
    for (const g of GAME_LIST) {
      if (g.reuseAion2) continue;
      const roleName = `${g.emoji} ${toSmallCaps(g.key)}`;
      gameRoleIds[g.key] = gameRoles[roleName].id;
    }

    if (!existingConfig?.gameRolesPosted) {
      await postGameRolesPicker(gameRolesChannel);
    }

    // --- Save config for other commands/events to use ---
    db.saveGuildConfig(guild.id, {
      memberRoleId: Member.id,
      moderatorRoleId: Moderator.id,
      adminRoleId: Admin.id,
      welcomeChannelId: welcomeChannel.id,
      botCommandsChannelId: botCommandsChannel.id,
      aion2RolesChannelId: aion2RolesChannel.id,
      aion2NewsChannelId: aion2NewsChannel.id,
      aion2ClassesChannelId: aion2ClassesChannel.id,
      aion2ClassesPosted: true,
      aion2RolesPosted: true,
      aion2GeneralRoleId,
      aion2ClassRoleIds,
      gameRolesChannelId: gameRolesChannel.id,
      gameRolesPosted: true,
      gameRoleIds,
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
          `**${toSmallCaps('Roles')}:** ${Admin} ${Moderator} ${Member}, plus 🥉 🥈 🥇 💎 rank roles that unlock as you level up, 9 self-assignable AION 2 roles (🕊️ general + one per class) in ${aion2RolesChannel}, and 9 more game roles (League, CS2, GTA 5, RDR2, ARK, REPO, Phasmophobia, Minecraft, Terraria) in ${gameRolesChannel}`,
          `**${toSmallCaps('Channels')}:** ${welcomeChannel}, ${generalChat}, 😂 memes, 🎮 gaming, ${botCommandsChannel} — plus a 🎵 music-commands channel, 4 voice channels, a 🕊️ AION 2 category (${aion2RolesChannel}, ${aion2NewsChannel}, ${aion2ClassesChannel}, and a chat channel), a 🤠 RDR2 Online category, and a 🎮 Game Roles category`,
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

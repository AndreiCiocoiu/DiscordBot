const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { toSmallCaps } = require('./fancyFont');

// The AION 2 entry reuses the existing general AION 2 role/button (same
// customId as the one in the AION 2 roles channel) rather than creating a
// duplicate role — clicking either toggles the same role.
const GAME_LIST = [
  { key: 'League', emoji: '🏆', color: 0x0ac8b9 },
  { key: 'CS2', emoji: '🔫', color: 0xf39c12 },
  { key: 'GTA 5', emoji: '🚔', color: 0x27ae60 },
  { key: 'RDR2', emoji: '🐴', color: 0xa0522d },
  { key: 'ARK', emoji: '🦖', color: 0xe67e22 },
  { key: 'AION 2', emoji: '🕊️', color: 0x8a2be2, reuseAion2: true },
  { key: 'REPO', emoji: '💀', color: 0x7f8c8d },
  { key: 'Phasmophobia', emoji: '👻', color: 0x9b59b6 },
  { key: 'Minecraft', emoji: '⛏️', color: 0x5d8a3a },
  { key: 'Terraria', emoji: '🌳', color: 0x1abc9c },
];

// The roles /setup needs to create — everything except the AION 2 reuse entry.
const NEW_GAME_ROLE_DEFS = GAME_LIST.filter((g) => !g.reuseAion2).map((g) => ({
  name: `${g.emoji} ${toSmallCaps(g.key)}`,
  color: g.color,
  permissions: [],
  hoist: false,
}));

function buildGameRolesEmbed() {
  return new EmbedBuilder()
    .setTitle(`🎮 ${toSmallCaps('Game Roles')}`)
    .setDescription(
      "Click a button below to add (or remove) a role for a game you play — toggles on/off, no need to ask a mod. Helps everyone find who's up for what."
    )
    .setColor(0x5865f2);
}

function buildGameRolesRows() {
  const rows = [];
  for (let i = 0; i < GAME_LIST.length; i += 5) {
    const chunk = GAME_LIST.slice(i, i + 5);
    rows.push(
      new ActionRowBuilder().addComponents(
        ...chunk.map((g) =>
          new ButtonBuilder()
            .setCustomId(g.reuseAion2 ? 'aion2general' : `gamerole_${g.key}`)
            .setLabel(g.key)
            .setEmoji(g.emoji)
            .setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }
  return rows;
}

async function postGameRolesPicker(channel) {
  await channel
    .send({ embeds: [buildGameRolesEmbed()], components: buildGameRolesRows() })
    .catch(() => {});
}

module.exports = { GAME_LIST, NEW_GAME_ROLE_DEFS, postGameRolesPicker };

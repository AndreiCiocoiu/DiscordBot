const { EmbedBuilder } = require('discord.js');
const { AION2_CLASSES } = require('../data/aion2Classes');

// Official Steam header image — used as a consistent visual banner since we
// don't have verified, reliably-hotlinkable art for each individual class.
const AION2_BANNER =
  'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3393110/8ba6511e1889fd45561956e603d04fac1a89645e/header.jpg';

const ROLE_COLORS = {
  Tank: 0x5865f2,
  'Melee DPS / Off-tank': 0xe74c3c,
  'Melee DPS': 0xe74c3c,
  'Ranged DPS': 0xf1c40f,
  'Magic DPS': 0x9b59b6,
  'Magic DPS / Summoner': 0x9b59b6,
  'Support / Hybrid': 0x2ecc71,
  Healer: 0x1abc9c,
};

function buildClassEmbed(cls) {
  return new EmbedBuilder()
    .setTitle(`${cls.name} — ${cls.role}`)
    .setDescription(cls.description)
    .addFields({ name: 'Weapon', value: cls.weapon, inline: true })
    .setThumbnail(AION2_BANNER)
    .setColor(ROLE_COLORS[cls.role] ?? 0x8a2be2)
    .setFooter({ text: 'AION 2 · store.steampowered.com/app/3393110' });
}

async function postClassShowcase(channel) {
  for (const cls of AION2_CLASSES) {
    await channel.send({ embeds: [buildClassEmbed(cls)] }).catch(() => {});
  }
}

module.exports = { buildClassEmbed, postClassShowcase, AION2_BANNER };

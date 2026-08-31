const { EmbedBuilder } = require('discord.js');
const { AION2_CLASSES } = require('../data/aion2Classes');

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
    .setThumbnail(cls.image)
    .setColor(ROLE_COLORS[cls.role] ?? 0x8a2be2)
    .setFooter({ text: 'AION 2 Wiki · aion2.wiki.fextralife.com' });
}

async function postClassShowcase(channel) {
  for (const cls of AION2_CLASSES) {
    await channel.send({ embeds: [buildClassEmbed(cls)] }).catch(() => {});
  }
}

module.exports = { buildClassEmbed, postClassShowcase };

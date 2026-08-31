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

// A Discord embed always renders its image below the title/description, so
// to get "big character art on top, description underneath" (like the
// game's own class-select screen) we send two stacked messages per class
// instead of forcing it all into one embed. Role-assign buttons live in
// their own channel (see aion2Roles.js), not on these showcase posts.

function buildClassImageEmbed(cls) {
  return new EmbedBuilder()
    .setTitle(`${cls.name} — ${cls.role}`)
    .setImage(cls.image)
    .setColor(ROLE_COLORS[cls.role] ?? 0x8a2be2);
}

function buildClassInfoEmbed(cls) {
  return new EmbedBuilder()
    .setDescription(cls.description)
    .addFields({ name: 'Weapon', value: cls.weapon, inline: true })
    .setColor(ROLE_COLORS[cls.role] ?? 0x8a2be2)
    .setFooter({ text: 'AION 2 Wiki · aion2guide.wiki' });
}

async function postClassShowcase(channel) {
  for (const cls of AION2_CLASSES) {
    await channel.send({ embeds: [buildClassImageEmbed(cls)] }).catch(() => {});
    await channel.send({ embeds: [buildClassInfoEmbed(cls)] }).catch(() => {});
  }
}

module.exports = { buildClassImageEmbed, buildClassInfoEmbed, postClassShowcase };

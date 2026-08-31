const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { AION2_CLASSES } = require('../data/aion2Classes');
const { toSmallCaps } = require('./fancyFont');

const CLASS_EMOJIS = {
  Templar: '🛡️',
  Gladiator: '⚔️',
  Assassin: '🗡️',
  Ranger: '🏹',
  Sorcerer: '🔮',
  Spiritmaster: '🌀',
  Chanter: '🎶',
  Cleric: '➕',
};

function buildRolePickerEmbed() {
  return new EmbedBuilder()
    .setTitle(`🕊️ ${toSmallCaps('AION 2 Roles')}`)
    .setDescription(
      [
        'Click a button below to add (or remove) a role — toggles on/off, no need to ask a mod.',
        '',
        '**🕊️ AION 2** — get pinged for game-wide announcements',
        '**Class roles** — tag whoever plays a given class, find a group fast',
      ].join('\n')
    )
    .setColor(0x8a2be2);
}

function buildRolePickerRows() {
  const generalRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('aion2general')
      .setLabel('I play AION 2')
      .setEmoji('🕊️')
      .setStyle(ButtonStyle.Primary)
  );

  // Discord allows up to 5 buttons per row — split the 8 classes into two
  // rows of 4 so everything fits cleanly under the general role button.
  const rows = [generalRow];
  for (let i = 0; i < AION2_CLASSES.length; i += 4) {
    const chunk = AION2_CLASSES.slice(i, i + 4);
    rows.push(
      new ActionRowBuilder().addComponents(
        ...chunk.map((cls) =>
          new ButtonBuilder()
            .setCustomId(`aion2role_${cls.name}`)
            .setLabel(cls.name)
            .setEmoji(CLASS_EMOJIS[cls.name] ?? '🎮')
            .setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }
  return rows;
}

async function postRolePicker(channel) {
  await channel
    .send({ embeds: [buildRolePickerEmbed()], components: buildRolePickerRows() })
    .catch(() => {});
}

module.exports = { postRolePicker, CLASS_EMOJIS };

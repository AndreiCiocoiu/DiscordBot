// Verified against multiple current AION 2 class guides (role/weapon/playstyle
// consistent across sources as of August 2026). Spiritmaster is sometimes
// translated as "Elementalist" in older community material — noted below.

const AION2_CLASSES = [
  {
    name: 'Templar',
    role: 'Tank',
    weapon: 'Longsword & Shield',
    description:
      'The shield-bearing guardian of the group. Templars plant themselves on the front line, hold enemy aggro, and mitigate incoming damage so the rest of the party can fight safely behind them. Widely recommended as a beginner-friendly pick thanks to its clear, forgiving role.',
  },
  {
    name: 'Gladiator',
    role: 'Melee DPS / Off-tank',
    weapon: 'Greatsword',
    description:
      'A hard-hitting frontline fighter that blends brute strength with wide AoE strikes and crowd control. Gladiators are known for surviving in the thick of a fight through life-steal abilities, making them a top pick for players who want to deal damage while staying tough.',
  },
  {
    name: 'Assassin',
    role: 'Melee DPS',
    weapon: 'Dual Daggers',
    description:
      'A stealth-focused striker built around burst damage and mobility — hit hard, then slip away. Assassin has a steeper learning curve since it leans heavily on positioning and timing, but rewards mastery with some of the deadliest single-target damage in the game.',
  },
  {
    name: 'Ranger',
    role: 'Ranged DPS',
    weapon: 'Bow',
    description:
      'A long-range physical damage dealer that controls space with precise bow strikes and traps. Rangers can chip enemies down from a safe distance, making them strong in both PvE clears and PvP poke damage.',
  },
  {
    name: 'Sorcerer',
    role: 'Magic DPS',
    weapon: 'Spellbook',
    description:
      'A glass-cannon spellcaster specializing in heavy AoE damage and crowd control. High ceiling, low forgiveness — Sorcerers hit devastatingly hard but are fragile and rely on good positioning to stay alive.',
  },
  {
    name: 'Spiritmaster',
    role: 'Magic DPS / Summoner',
    weapon: 'Orb',
    description:
      "An elemental caster who summons spirits to fight alongside them, layering pet damage with crowd control to disrupt entire enemy groups. Sometimes called \"Elementalist\" in older community material — same class.",
  },
  {
    name: 'Chanter',
    role: 'Support / Hybrid',
    weapon: 'Staff',
    description:
      "A flexible support that buffs and bolsters allies while still holding its own in a fight. Chanters blend healing-adjacent utility with real damage output, making them a strong pick for players who don't want to be locked into a single role.",
  },
  {
    name: 'Cleric',
    role: 'Healer',
    weapon: 'Mace',
    description:
      "The party's lifeline — a traditional healer who keeps allies standing and can turn the tide of a long fight. Along with Templar, Cleric is commonly recommended for new players thanks to its clear, essential role in any group.",
  },
];

module.exports = { AION2_CLASSES };

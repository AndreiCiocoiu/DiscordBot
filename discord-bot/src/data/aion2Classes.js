// Verified against multiple current AION 2 class guides (role/weapon/playstyle
// consistent across sources as of August 2026). Spiritmaster is sometimes
// translated as "Elementalist" in older community material — noted below.
// Images are each class's official icon from the AION 2 Wiki (Fextralife).

const AION2_CLASSES = [
  {
    name: 'Templar',
    role: 'Tank',
    weapon: 'Longsword & Shield',
    description:
      'The shield-bearing guardian of the group. Templars plant themselves on the front line, hold enemy aggro, and mitigate incoming damage so the rest of the party can fight safely behind them. Widely recommended as a beginner-friendly pick thanks to its clear, forgiving role.',
    image: 'https://static0.fextralifeimages.com/file/aion2/d/da/Templar-icon-aion2-wiki-guide.webp',
  },
  {
    name: 'Gladiator',
    role: 'Melee DPS / Off-tank',
    weapon: 'Greatsword',
    description:
      'A hard-hitting frontline fighter that blends brute strength with wide AoE strikes and crowd control. Gladiators are known for surviving in the thick of a fight through life-steal abilities, making them a top pick for players who want to deal damage while staying tough.',
    image: 'https://static0.fextralifeimages.com/file/aion2/b/b2/Gladiator-icon-aion2-wiki-guide.webp',
  },
  {
    name: 'Assassin',
    role: 'Melee DPS',
    weapon: 'Dual Daggers',
    description:
      'A stealth-focused striker built around burst damage and mobility — hit hard, then slip away. Assassin has a steeper learning curve since it leans heavily on positioning and timing, but rewards mastery with some of the deadliest single-target damage in the game.',
    image: 'https://static0.fextralifeimages.com/file/aion2/7/7e/Assassin-icon-aion2-wiki-guide.webp',
  },
  {
    name: 'Ranger',
    role: 'Ranged DPS',
    weapon: 'Bow',
    description:
      'A long-range physical damage dealer that controls space with precise bow strikes and traps. Rangers can chip enemies down from a safe distance, making them strong in both PvE clears and PvP poke damage.',
    image: 'https://static0.fextralifeimages.com/file/aion2/c/c5/Ranger-icon-aion2-wiki-guide.webp',
  },
  {
    name: 'Sorcerer',
    role: 'Magic DPS',
    weapon: 'Spellbook',
    description:
      'A glass-cannon spellcaster specializing in heavy AoE damage and crowd control. High ceiling, low forgiveness — Sorcerers hit devastatingly hard but are fragile and rely on good positioning to stay alive.',
    image: 'https://static0.fextralifeimages.com/file/aion2/e/ef/Sorcerer-icon-aion2-wiki-guide.webp',
  },
  {
    name: 'Spiritmaster',
    role: 'Magic DPS / Summoner',
    weapon: 'Orb',
    description:
      "An elemental caster who summons spirits to fight alongside them, layering pet damage with crowd control to disrupt entire enemy groups. Sometimes called \"Elementalist\" in official/community material — same class.",
    image: 'https://static0.fextralifeimages.com/file/aion2/b/b2/Elementalist-icon-aion2-wiki-guide.webp',
  },
  {
    name: 'Chanter',
    role: 'Support / Hybrid',
    weapon: 'Staff',
    description:
      "A flexible support that buffs and bolsters allies while still holding its own in a fight. Chanters blend healing-adjacent utility with real damage output, making them a strong pick for players who don't want to be locked into a single role.",
    image: 'https://static0.fextralifeimages.com/file/aion2/a/ac/Chanter-icon-aion2-wiki-guide.webp',
  },
  {
    name: 'Cleric',
    role: 'Healer',
    weapon: 'Mace',
    description:
      "The party's lifeline — a traditional healer who keeps allies standing and can turn the tide of a long fight. Along with Templar, Cleric is commonly recommended for new players thanks to its clear, essential role in any group.",
    image: 'https://static0.fextralifeimages.com/file/aion2/4/4e/Cleric-icon-aion2-wiki-guide.webp',
  },
];

module.exports = { AION2_CLASSES };

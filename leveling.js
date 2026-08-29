// XP required to go from `level` to `level + 1`
function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

// Given total accumulated xp, figure out the level
function levelFromXp(xp) {
  let level = 0;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return level;
}

// Random xp per message, mee6-style, with a cooldown enforced by the caller
function randomXp(min = 15, max = 25) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Roles unlocked at these levels — matched to the roles /setup creates
const LEVEL_ROLE_THRESHOLDS = [5, 10, 20, 30];

module.exports = { xpForLevel, levelFromXp, randomXp, LEVEL_ROLE_THRESHOLDS };

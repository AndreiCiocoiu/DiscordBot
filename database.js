const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const files = {
  levels: path.join(dataDir, 'levels.json'),
  warnings: path.join(dataDir, 'warnings.json'),
  guildConfig: path.join(dataDir, 'guildConfig.json'),
};

function load(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- Levels ----------
function getLevelData(guildId, userId) {
  const all = load(files.levels);
  if (!all[guildId]) all[guildId] = {};
  if (!all[guildId][userId]) all[guildId][userId] = { xp: 0, level: 0, lastMessage: 0 };
  return all[guildId][userId];
}

function saveLevelData(guildId, userId, entry) {
  const all = load(files.levels);
  if (!all[guildId]) all[guildId] = {};
  all[guildId][userId] = entry;
  save(files.levels, all);
}

function getLeaderboard(guildId, limit = 10) {
  const all = load(files.levels);
  const guildData = all[guildId] || {};
  return Object.entries(guildData)
    .map(([userId, d]) => ({ userId, ...d }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

// ---------- Warnings ----------
function addWarning(guildId, userId, warning) {
  const all = load(files.warnings);
  if (!all[guildId]) all[guildId] = {};
  if (!all[guildId][userId]) all[guildId][userId] = [];
  all[guildId][userId].push(warning);
  save(files.warnings, all);
  return all[guildId][userId].length;
}

function getWarnings(guildId, userId) {
  const all = load(files.warnings);
  return (all[guildId] && all[guildId][userId]) || [];
}

// ---------- Guild config (created by /setup) ----------
function getGuildConfig(guildId) {
  const all = load(files.guildConfig);
  return all[guildId] || null;
}

function saveGuildConfig(guildId, config) {
  const all = load(files.guildConfig);
  all[guildId] = { ...(all[guildId] || {}), ...config };
  save(files.guildConfig, all);
}

module.exports = {
  getLevelData,
  saveLevelData,
  getLeaderboard,
  addWarning,
  getWarnings,
  getGuildConfig,
  saveGuildConfig,
};

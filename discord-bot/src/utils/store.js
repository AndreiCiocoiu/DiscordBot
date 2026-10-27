// Small persistent store for server features (channels, sessions).
// Razie keeps its own file (razii.json); this one is server.json.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'server.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { config: raw.config || {}, sessions: raw.sessions || {} };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      try { fs.renameSync(FILE, `${FILE}.bak`); console.warn('store: data file was corrupt, moved to server.json.bak'); } catch { /* ignore */ }
    }
    return { config: {}, sessions: {} };
  }
}

const db = load();

function save() {
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}

const cfg = (guildId) => (db.config[guildId] ||= {});
function setConfig(guildId, patch) { Object.assign(cfg(guildId), patch); save(); }

module.exports = { db, save, cfg, setConfig };

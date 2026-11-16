// One JSON file on the persistent volume: portal settings, announcements, wishlists.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'portal.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULTS = { config: {}, news: [], watch: {}, seenFree: {}, lastDigest: '' };
function load() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch (err) {
    if (err.code !== 'ENOENT') { try { fs.renameSync(FILE, `${FILE}.bak`); console.warn('store: portal.json was corrupt, moved to portal.json.bak'); } catch { /* ignore */ } }
    return structuredClone(DEFAULTS);
  }
}
const db = load();

let timer = null;
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
function save() { if (!timer) timer = setTimeout(() => { timer = null; try { flush(); } catch (err) { console.error('store save:', err.message); } }, 300); }
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { flush(); } catch { /* ignore */ } process.exit(0); });

// settings with their defaults
const cfg = () => ({ dealsChannel: null, newsChannel: null, hour: 18, minCut: 50, digest: true, freeAlerts: true, ...db.config });

module.exports = { db, save, flush, cfg, DATA_DIR };

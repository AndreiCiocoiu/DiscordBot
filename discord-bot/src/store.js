// One JSON file on the persistent volume: members, deliveries, convoys, applications, settings.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'diesel.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULTS = { config: {}, members: {}, jobs: [], convoys: [], applications: [], links: {}, sync: {}, web: {}, version: 1 };
function load() {
  try { return { ...structuredClone(DEFAULTS), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch (err) {
    if (err.code !== 'ENOENT') { try { fs.renameSync(FILE, `${FILE}.bak`); console.warn('store: diesel.json was corrupt, moved to diesel.json.bak'); } catch { /* ignore */ } }
    return structuredClone(DEFAULTS);
  }
}
const db = load();

let timer = null, rev = 0;
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
function save() { rev++; if (!timer) timer = setTimeout(() => { timer = null; try { flush(); } catch (err) { console.error('store save:', err.message); } }, 400); }
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { flush(); } catch { /* ignore */ } process.exit(0); });

// Driver ranks by total kilometres. Staff can change them on the site.
const RANKS = [
  { name: 'Rookie', km: 0 }, { name: 'Driver', km: 2500 }, { name: 'Long Hauler', km: 10000 },
  { name: 'Veteran', km: 30000 }, { name: 'Road Master', km: 75000 }, { name: 'Diesel Legend', km: 150000 },
];
const cfg = () => ({
  name: 'Diesel Union', tag: 'DU', tagline: 'United by the Road',
  truckyId: process.env.TRUCKY_COMPANY_ID || '', tmpId: process.env.TMP_VTC_ID || '',
  jobsChannel: null, convoyChannel: null, staffChannel: null, recruitOpen: true, minJobKm: 0,
  discordInvite: '', truckyUrl: '',
  discordRules: ['Be respectful. No insults, harassment, racism or drama.', 'Keep it clean: no NSFW, no spam, no advertising other VTCs or servers.', 'Use the right channel for the right thing.', 'Follow the TruckersMP rules on the road and in convoys. A TruckersMP ban can mean a removal from the company.', 'Listen to the convoy lead and staff during events.', 'Your Trucky profile has to stay in Diesel Union. If you leave the company on Trucky, you lose access here.', 'Going away for a while? Post in #leave-of-absence.'],
  about: 'Diesel Union is a virtual trucking company on TruckersMP, driving Euro Truck Simulator 2 and American Truck Simulator. We run convoys every week, track every job with Trucky and look out for each other on the road. It does not matter how many kilometres you have: show up, drive clean, and have a good time.',
  requirements: ['A TruckersMP account with no active bans', 'Discord, so you can join voice during convoys', 'Trucky installed, so your jobs are counted', 'Respect on the road, for everyone', 'At least one convoy a month'],
  ranks: RANKS, ...db.config,
});

module.exports = { db, save, flush, cfg, DATA_DIR, rev: () => rev };

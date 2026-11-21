// One JSON file on the persistent volume: members, deliveries, convoys, applications, settings.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'diesel.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULTS = { config: {}, members: {}, jobs: [], convoys: [], applications: [], links: {}, sync: {}, web: {}, posts: [], scheduled: [], partners: [], dotm: [], loa: {}, warned: {}, modlog: [], version: 1 };
function load() {
  try { return { ...structuredClone(DEFAULTS), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch (err) {
    if (err.code !== 'ENOENT') { try { fs.renameSync(FILE, `${FILE}.bak`); console.warn('store: diesel.json was corrupt, moved to diesel.json.bak'); } catch { /* ignore */ } }
    return structuredClone(DEFAULTS);
  }
}
const db = load();
// one-off updates to settings saved by older versions
if ((db.version || 1) < 2) {
  if (!db.config.tmpId) delete db.config.tmpId; // empty means "not set": use the default
  if (!db.config.truckyUrl) delete db.config.truckyUrl;
  if (typeof db.config.about === 'string') db.config.about = db.config.about.replace(' and American Truck Simulator', '');
  db.version = 2;
}
if (db.version < 3) { // the old six ranks become the new 45-step ladder (custom ranks are kept)
  const old = ['Rookie', 'Driver', 'Long Hauler', 'Veteran', 'Road Master', 'Diesel Legend'];
  if (Array.isArray(db.config.ranks) && db.config.ranks.map((r) => r.name).join() === old.join()) delete db.config.ranks;
  db.version = 3;
}
if (db.version < 4) { // the first 45-rank names (Learner, Courier, ...) become tiers with levels
  if (Array.isArray(db.config.ranks) && db.config.ranks[1]?.name === 'Learner' && db.config.ranks.length === 45) delete db.config.ranks;
  db.version = 4;
}
if (db.version < 5) { // the tier names (Rookie I ... Legend V) become the named ladder
  if (Array.isArray(db.config.ranks) && db.config.ranks[0]?.name === 'Rookie I' && db.config.ranks.length === 45) delete db.config.ranks;
  db.version = 5;
}
if (db.version < 7) { // truck details saved empty from the settings page: use the Meteor defaults
  const st = db.config.standards;
  if (st && ['tag', 'truck', 'trailer'].every((k) => !st[k]?.text && !st[k]?.image)) delete db.config.standards;
}
if (db.version < 6) { // the 45 joke names become the 50 names Moft picked
  if (Array.isArray(db.config.ranks) && db.config.ranks[0]?.name === 'Learner Plate') delete db.config.ranks;
  db.version = 6;
}
if (db.version < 7) db.version = 7;

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
// 50 ranks: three before 2,500 km, then a little further apart each time, up to 1,000,000 km. Each one is a Discord role.
// (Names ending in I, II, III... are grouped into one role per name, if you ever want tiers instead.)
const RANKS = [
  { name: "New Recruit", km: 0 },
  { name: "Rookie Driver", km: 800 },
  { name: "Junior Hauler", km: 1600 },
  { name: "Road Apprentice", km: 2500 },
  { name: "Cargo Rookie", km: 2750 },
  { name: "Local Driver", km: 3250 },
  { name: "Freight Runner", km: 3750 },
  { name: "Road Explorer", km: 4250 },
  { name: "Highway Driver", km: 4750 },
  { name: "Certified Trucker", km: 5500 },
  { name: "Long Haul Driver", km: 6250 },
  { name: "Freight Specialist", km: 7000 },
  { name: "Cargo Operator", km: 8000 },
  { name: "Highway Specialist", km: 9250 },
  { name: "Diesel Operator", km: 10500 },
  { name: "Heavy Hauler", km: 12000 },
  { name: "Logistics Driver", km: 13500 },
  { name: "Route Specialist", km: 15500 },
  { name: "Professional Trucker", km: 17500 },
  { name: "Senior Hauler", km: 20000 },
  { name: "Veteran Driver", km: 23000 },
  { name: "Road Veteran", km: 26000 },
  { name: "Freight Veteran", km: 30000 },
  { name: "Highway Veteran", km: 34000 },
  { name: "Elite Trucker", km: 39000 },
  { name: "Master Hauler", km: 44000 },
  { name: "Diesel Veteran", km: 50000 },
  { name: "Convoy Specialist", km: 57000 },
  { name: "Road Commander", km: 65000 },
  { name: "Elite Roadmaster", km: 74000 },
  { name: "Highway Elite", km: 84000 },
  { name: "Diesel Elite", km: 96000 },
  { name: "Freight Commander", km: 110000 },
  { name: "Grand Hauler", km: 125000 },
  { name: "Road Titan", km: 140000 },
  { name: "Diesel Titan", km: 160000 },
  { name: "Union Commander", km: 185000 },
  { name: "Highway Warlord", km: 210000 },
  { name: "Road Sovereign", km: 240000 },
  { name: "Union Vanguard", km: 270000 },
  { name: "Road Legend", km: 310000 },
  { name: "Highway Legend", km: 350000 },
  { name: "Diesel Legend", km: 400000 },
  { name: "Freight Overlord", km: 460000 },
  { name: "Union Overlord", km: 520000 },
  { name: "Legendary Hauler", km: 590000 },
  { name: "Diesel Royalty", km: 680000 },
  { name: "Union Immortal", km: 770000 },
  { name: "King of the Highway", km: 880000 },
  { name: "Diesel Union Icon", km: 1000000 },
];
const cfg = () => ({
  name: 'Diesel Union', tag: 'DU', tagline: 'United by the Road',
  truckyId: process.env.TRUCKY_COMPANY_ID || '', tmpId: process.env.TMP_VTC_ID || '93701',
  jobsChannel: null, convoyChannel: null, staffChannel: null, recruitOpen: true, minJobKm: 0,
  // the three Truck Details channels: text, colour (hex) and a picture, set on the website
  standards: {
    tag: { text: "**Player tag:** `Diesel Union`\nType it exactly like this in the TruckersMP settings in game, then set the tag colour:\n\n**Tag colour**\nHEX `#433414`\nRGB `67, 52, 20`", color: '#433414', image: '/img/player-tag.webp' },
    truck: { text: "**Paint job:** Meteor\nSet these four colours in the paint shop. The **HSV** values are the ones you type in the game.\n\n**Colour 1** \u00b7 `H 21  S 63  V 22`\nHEX `#382115` \u00b7 RGB `56, 33, 21`\n\n**Colour 2** \u00b7 `H 20  S 59  V 7`\nHEX `#120B07` \u00b7 RGB `18, 11, 7`\n\n**Colour 3** \u00b7 `H 20  S 64  V 20`\nHEX `#331D12` \u00b7 RGB `51, 29, 18`\n\n**Colour 4** \u00b7 `H 15  S 57  V 10`\nHEX `#1A0F0B` \u00b7 RGB `26, 15, 11`\n\n-# HEX and RGB are worked out from the HSV values, for anywhere outside the game.", color: '#382115', image: '/img/paint-truck.webp' },
    trailer: { text: "**Paint job:** Meteor\nSame paint job and the same four colours as the truck, on the trailer. The **HSV** values are the ones you type in the game.\n\n**Colour 1** \u00b7 `H 21  S 63  V 22`\nHEX `#382115` \u00b7 RGB `56, 33, 21`\n\n**Colour 2** \u00b7 `H 20  S 59  V 7`\nHEX `#120B07` \u00b7 RGB `18, 11, 7`\n\n**Colour 3** \u00b7 `H 20  S 64  V 20`\nHEX `#331D12` \u00b7 RGB `51, 29, 18`\n\n**Colour 4** \u00b7 `H 15  S 57  V 10`\nHEX `#1A0F0B` \u00b7 RGB `26, 15, 11`\n\n-# HEX and RGB are worked out from the HSV values, for anywhere outside the game.", color: '#382115', image: '/img/paint-trailer.webp' },
  },
  discordInvite: '', truckyUrl: 'https://hub.truckyapp.com/vtc/diesel-union',
  discordRules: ['Be respectful. No insults, harassment, racism or drama.', 'Keep it clean: no NSFW, no spam, no advertising other VTCs or servers.', 'Use the right channel for the right thing.', 'Follow the TruckersMP rules on the road and in convoys. A TruckersMP ban can mean a removal from the company.', 'Listen to the convoy lead and staff during events.', 'Your Trucky profile has to stay in Diesel Union. If you leave the company on Trucky, you lose access here.', 'Going away for a while? Post in #leave-of-absence.'],
  about: 'Diesel Union is a virtual trucking company on TruckersMP, driving Euro Truck Simulator 2. We run convoys every week, track every job with Trucky and look out for each other on the road. It does not matter how many kilometres you have: show up, drive clean, and have a good time.',
  requirements: ['A TruckersMP account with no active bans', 'Discord, so you can join voice during convoys', 'Trucky installed, so your jobs are counted', 'Respect on the road, for everyone', 'At least one convoy a month'],
  ranks: RANKS, ...db.config,
});

module.exports = { db, save, flush, cfg, DATA_DIR, rev: () => rev };

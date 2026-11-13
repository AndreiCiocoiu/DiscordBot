'use strict';
// Website-only admission control. Discord membership and access approval are separate checks.
// All permissions are deny-by-default for writes; only the guild owner / configured owners
// can approve, block, or edit individual access rules. These settings do not edit bot roles.
const fs = require('fs');
const path = require('path');

const DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DIR, 'site-access.json');
fs.mkdirSync(DIR, { recursive: true });

const GROUPS = [
  ['Paginile principale', [
    ['board.view', 'Clasament'], ['roster.view', 'Banda și profile'], ['craft.use', 'Calculator crafting']]],
  ['Cartier — vizualizare', [
    ['hub.war.view', 'War Room'], ['hub.contracts.view', 'Contracte'], ['hub.dossiers.view', 'Dosare'],
    ['hub.treasury.view', 'Trezorerie'], ['hub.orders.view', 'Comenzi crafting'],
    ['hub.events.view', 'Calendar'], ['hub.polls.view', 'Voturi'], ['hub.feed.view', 'Jurnal'], ['hub.notices.view', 'Notificări']]],
  ['Cartier — administrare', [
    ['hub.war.manage', 'Planifică operațiuni'], ['hub.contracts.manage', 'Gestionează contracte'],
    ['hub.treasury.manage', 'Depuneri și retrageri'], ['hub.orders.manage', 'Gestionează comenzile'],
    ['hub.events.manage', 'Creează și modifică evenimente'], ['hub.polls.manage', 'Deschide și închide voturi']]],
  ['Administrare bot (acțiuni importante)', [
    ['points.manage', 'Acordă/anulează puncte'], ['members.manage', 'Adaugă, scoate sau schimbă rank'],
    ['idcard.manage', 'Cărți de identitate'], ['announcements.manage', 'Anunțuri Discord'],
    ['config.manage', 'Configurare bot']]],
];
const ALL = GROUPS.flatMap(([, rows]) => rows.map(([id]) => id));
const KNOWN = new Set(ALL);
const READ_DEFAULT = Object.fromEntries(ALL.map((id) => [id, id.endsWith('.view') || id === 'craft.use']));
const IDS = /^\d{15,22}$/;
const ownerIds = () => String(process.env.WEB_OWNER_IDS || process.env.WEB_OWNER_ID || '').split(/[\s,;]+/).filter(Boolean);
const owner = (guild, userId) => String(guild.ownerId) === String(userId) || ownerIds().includes(String(userId));

let db;
try {
  db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!db || typeof db.guilds !== 'object' || !db.guilds) throw new Error('Invalid format');
} catch (err) {
  if (err.code !== 'ENOENT' && fs.existsSync(FILE)) {
    try { fs.copyFileSync(FILE, FILE + '.corrupt-' + Date.now() + '.bak'); } catch {}
  }
  db = { version: 1, guilds: {} };
}
function section(guildId) {
  const g = db.guilds[guildId] ||= { users: {}, audit: [] };
  if (!g.users || typeof g.users !== 'object') g.users = {};
  if (!Array.isArray(g.audit)) g.audit = [];
  return g;
}
function save() {
  const tmp = FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
function audit(g, actor, action, target) {
  g.audit.unshift({ at: Date.now(), actor: String(actor), action, target: String(target) });
  g.audit.length = Math.min(g.audit.length, 600);
}
function cleanPermissions(input, fallback = READ_DEFAULT) {
  const obj = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = Object.fromEntries(ALL.map((id) => [id, Object.hasOwn(obj, id) ? obj[id] === true : !!fallback[id]]));
  // Management requires visibility of the same module.
  for (const key of ALL.filter((x) => x.endsWith('.manage') && x.startsWith('hub.'))) {
    if (result[key]) result[key.replace('.manage', '.view')] = true;
  }
  return result;
}
function register(guildId, user, actor = null) {
  const g = section(guildId), id = String(user.id);
  if (!IDS.test(id)) throw new Error('Invalid Discord ID');
  const existed = !!g.users[id];
  const rec = g.users[id] ||= { status: 'pending', permissions: cleanPermissions(), dm: true, createdAt: Date.now() };
  const name = String(user.name || id).slice(0, 85);
  let changed = !existed;
  if (rec.name !== name) { rec.name = name; changed = true; }
  if (user.avatar && rec.avatar !== user.avatar) { rec.avatar = String(user.avatar).slice(0, 300); changed = true; }
  if (changed) {
    if (!existed) audit(g, actor || id, 'Cerere de acces nouă', id);
    save();
  }
  return { record: rec, created: !existed };
}
function record(guildId, userId) { return section(guildId).users[String(userId)] || null; }
function approved(guild, userId, familyMember) {
  if (owner(guild, userId)) return true;
  const rec = record(guild.id, userId);
  return !!familyMember && rec?.status === 'approved';
}
function can(guild, userId, permission, familyMember) {
  if (!KNOWN.has(permission)) return false;
  if (owner(guild, userId)) return true;
  if (!approved(guild, userId, familyMember)) return false;
  return record(guild.id, userId).permissions?.[permission] === true;
}
function permissions(guild, userId, familyMember) {
  return Object.fromEntries(ALL.map((key) => [key, can(guild, userId, key, familyMember)]));
}
function state(guild, userId, familyMember) {
  const rec = record(guild.id, userId);
  const isOwner = owner(guild, userId);
  return {
    status: isOwner ? 'approved' : (rec?.status || 'pending'),
    owner: isOwner, inFamily: !!familyMember || isOwner,
    permissions: permissions(guild, userId, familyMember),
    dm: rec?.dm !== false,
  };
}
function list(guild) {
  const g = section(guild.id);
  return {
    users: Object.entries(g.users).map(([id, u]) => ({ id, name: u.name || id, avatar: u.avatar || null,
      status: owner(guild, id) ? 'owner' : u.status, permissions: cleanPermissions(u.permissions),
      dm: u.dm !== false, requestedAt: u.createdAt || 0, updatedAt: u.updatedAt || 0 })).sort((a,b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || b.requestedAt - a.requestedAt),
    audit: g.audit.slice(0, 100), groups: GROUPS,
  };
}
function update(guild, actorId, userId, status, permissionsInput) {
  if (!owner(guild, actorId)) throw new Error('Doar proprietarul website-ului poate aproba și edita accesul.');
  if (!IDS.test(String(userId))) throw new Error('ID Discord invalid.');
  if (owner(guild, userId)) throw new Error('Nu poți modifica accesul unui proprietar.');
  if (!['pending', 'approved', 'denied'].includes(status)) throw new Error('Status invalid.');
  const g = section(guild.id);
  const rec = g.users[userId];
  if (!rec) throw new Error('Utilizatorul trebuie să se autentifice întâi cu Discord.');
  rec.status = status;
  if (permissionsInput !== undefined) {
    if (!permissionsInput || typeof permissionsInput !== 'object' || Array.isArray(permissionsInput)) throw new Error('Permisiuni invalide.');
    if (Object.keys(permissionsInput).some((k) => !KNOWN.has(k) || typeof permissionsInput[k] !== 'boolean')) throw new Error('Permisiune necunoscută.');
    rec.permissions = cleanPermissions(permissionsInput);
  }
  rec.updatedAt = Date.now();
  rec.updatedBy = actorId;
  audit(g, actorId, `Acces: ${status} / permisiuni actualizate`, userId);
  save();
  return rec;
}
function setDm(guildId, userId, enabled) {
  const g = section(guildId);
  const rec = g.users[userId];
  if (!rec) throw new Error('Utilizator necunoscut.');
  rec.dm = enabled === true;
  audit(g, userId, rec.dm ? 'DM activate' : 'DM dezactivate', userId);
  save();
}
module.exports = { FILE, GROUPS, ALL, READ_DEFAULT, register, record, approved, can, permissions, owner, state, list, update, setDm };

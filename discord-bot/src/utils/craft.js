// Crafting lookup (no slash commands):
//   craft <item>      text trigger, answers with the recipe (anyone)
//   craft panou       post the panel with categories + search (admin)
// Recipes live in assets/recipes.json. Optional picture per item: assets/craft/<slug>.png|jpg|webp
// where <slug> is the item name in lowercase with dashes (e.g. cadru-pistol.png).
const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, PermissionFlagsBits,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, SlashCommandBuilder,
} = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const adminlog = require('./adminlog');

const FILE = path.join(__dirname, '..', '..', 'assets', 'recipes.json');
const IMG_DIR = path.join(__dirname, '..', '..', 'assets', 'craft');
const NO_PING = { parse: [], repliedUser: false };
const COLOR = 0xc8923a;
const PAGE = 25;
if (!GlobalFonts.families.some((f) => f.family === 'DejaVu')) GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf'), 'DejaVu');
if (!GlobalFonts.families.some((f) => f.family === 'Rye')) GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', 'assets', 'fonts', 'Rye-Regular.ttf'), 'Rye');

// ---- data ---------------------------------------------------------------

let cache = { mtime: 0, recipes: [], categories: [] };
function data() {
  try {
    const mtime = fs.statSync(FILE).mtimeMs;
    if (mtime !== cache.mtime) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      const recipes = (raw.recipes || []).filter((r) => r?.name && Array.isArray(r.ingredients));
      const cats = [...new Set([...(raw.categories || []), ...recipes.map((r) => r.category || 'Diverse')])]
        .filter((c) => recipes.some((r) => (r.category || 'Diverse') === c));
      cache = { mtime, recipes, categories: cats };
    }
  } catch (err) { console.error('craft: could not read recipes.json:', err.message); }
  return cache;
}

const norm = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/ /g, '-');

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

// score: lower is better, null = no match
function score(recipe, q) {
  const name = norm(recipe.name);
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  const qt = q.split(' ');
  const nt = name.split(' ');
  if (qt.every((t) => name.includes(t))) return 2;
  // typo tolerance, word by word
  let total = 0;
  for (const t of qt) {
    const best = Math.min(...nt.map((w) => (w.startsWith(t) ? 0 : lev(w, t))));
    if (best > (t.length > 4 ? 2 : 1)) return null;
    total += best;
  }
  return 3 + total;
}

function search(query) {
  const q = norm(query);
  if (!q) return [];
  return data().recipes
    .map((r) => ({ r, s: score(r, q) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => a.s - b.s || a.r.name.localeCompare(b.r.name))
    .map((x) => x.r);
}

// ---- rendering ----------------------------------------------------------

// All pictures live in one atlas (assets/craft-atlas.png + .json) so the repo stays small.
// A loose file assets/craft/<name>.png still wins over the atlas, for quick additions.
let atlas = null;
async function loadAtlas() {
  if (atlas) return atlas;
  try {
    const dir = path.join(__dirname, '..', '..', 'assets');
    atlas = { map: JSON.parse(fs.readFileSync(path.join(dir, 'craft-atlas.json'), 'utf8')), img: await loadImage(path.join(dir, 'craft-atlas.png')) };
  } catch (err) { console.error('craft: atlas not available:', err.message); atlas = { map: {}, img: null }; }
  return atlas;
}
const iconCache = new Map();
async function icon(name) {
  const k = slug(name);
  if (iconCache.has(k)) return iconCache.get(k);
  let res = null;
  const f = iconFile(name);
  if (f) res = { img: await loadImage(f), buf: () => fs.readFileSync(f), ext: path.extname(f) };
  else {
    const a = await loadAtlas();
    const r = a.map[k];
    if (r && a.img) {
      const c = createCanvas(r[2], r[3]);
      c.getContext('2d').drawImage(a.img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
      res = { img: c, buf: () => c.toBuffer('image/png'), ext: '.png' };
    }
  }
  iconCache.set(k, res);
  return res;
}

function iconFile(name) {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const f = path.join(IMG_DIR, `${slug(name)}.${ext}`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

// One picture with all the ingredients side by side: icon + amount ("x4") under it.
const stripCache = new Map();
async function ingredientStrip(recipe) {
  const key = recipe.name + JSON.stringify(recipe.ingredients);
  if (stripCache.has(key)) return stripCache.get(key);
  let buf = null;
  try {
    const items = [];
    for (const [n, q] of recipe.ingredients) {
      const ic = await icon(n);
      items.push({ q, img: ic ? ic.img : null });
    }
    if (items.some((i) => i.img)) {
      const CELL = 92, H = 104, BOX = 64;
      const canvas = createCanvas(Math.max(items.length, 2) * CELL, H);
      const ctx = canvas.getContext('2d');
      ctx.textAlign = 'center';
      items.forEach((it, i) => {
        const cx = i * CELL + CELL / 2;
        if (it.img) {
          const sc = Math.min(BOX / it.img.width, BOX / it.img.height, 2);
          const w = it.img.width * sc, h = it.img.height * sc;
          ctx.drawImage(it.img, cx - w / 2, 4 + (BOX - h) / 2, w, h);
        }
        ctx.font = '20px Rye';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(`x${it.q}`, cx, 94);
        ctx.fillStyle = '#e8b74a'; ctx.fillText(`x${it.q}`, cx, 94);
      });
      buf = canvas.toBuffer('image/png');
    }
  } catch (err) { console.error('craft: strip failed for', recipe.name, err.message); }
  stripCache.set(key, buf);
  return buf;
}

async function recipePayload(recipe, who) {
  const lines = recipe.ingredients.map(([n, q]) => `**${n}** x${q}`).join('\n');
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(recipe.name)
    .addFields({ name: 'Ingrediente', value: lines || '-' });
  const details = [];
  if (recipe.category) details.push(`Categorie: ${recipe.category}`);
  if (recipe.level !== undefined) details.push(`Nivel rețetă: ${recipe.level}`);
  if (recipe.points !== undefined) details.push(`Puncte rețetă: ${recipe.points}`);
  if (recipe.time) details.push(`Timp craft: ${recipe.time}`);
  if (recipe.yield > 1) details.push(`Se obțin: ${recipe.yield} buc`);
  embed.addFields({ name: 'Detalii', value: details.join('\n') });
  const foot = [recipe.note, who ? `Cerut de ${who}` : null].filter(Boolean).join(' · ');
  if (foot) embed.setFooter({ text: foot });
  const payload = { embeds: [embed], allowedMentions: NO_PING, files: [] };
  const thumb = await icon(recipe.name);
  if (thumb) {
    payload.files.push(new AttachmentBuilder(thumb.buf(), { name: `item${thumb.ext}` }));
    embed.setThumbnail(`attachment://item${thumb.ext}`);
  }
  const strip = await ingredientStrip(recipe);
  if (strip) {
    payload.files.push(new AttachmentBuilder(strip, { name: 'ingrediente.png' }));
    embed.setImage('attachment://ingrediente.png');
  }
  return payload;
}

const row = (...c) => new ActionRowBuilder().addComponents(...c);
const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

function itemSelect(customId, recipes, placeholder) {
  return new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder)
    .addOptions(recipes.slice(0, PAGE).map((r) => ({ label: r.name.slice(0, 100), value: r.name.slice(0, 100), description: r.ingredients.map(([n, q]) => `${n} x${q}`).join(', ').slice(0, 100) })));
}

function panelPayload() {
  const { recipes } = data();
  const embed = new EmbedBuilder().setColor(COLOR).setTitle('Crafting')
    .setDescription('**Catalog**: răsfoiești itemele pe categorii cu săgeți, iar ce alegi apare în chat.\n**Caută**: scrii numele itemului.\nPoți scrie și direct în chat: `craft cadru pistol` sau `/craft`.')
    .setFooter({ text: `${recipes.length} rețete` });
  return { embeds: [embed], components: [row(btn('cr:open', 'Catalog', ButtonStyle.Success), btn('cr:find', 'Caută'))], allowedMentions: NO_PING };
}

function categoryView(catIdx, page) {
  const { categories, recipes } = data();
  const cat = categories[catIdx];
  if (!cat) return { content: 'Categoria nu mai există.', embeds: [], components: [] };
  const items = recipes.filter((r) => (r.category || 'Diverse') === cat).sort((a, b) => a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = items.slice(p * PAGE, p * PAGE + PAGE);
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(cat)
    .setDescription(slice.map((r) => `**${r.name}**: ${r.ingredients.map(([n, q]) => `${n} x${q}`).join(', ')}`).join('\n').slice(0, 4000) || '-')
    .setFooter({ text: `Pagina ${p + 1}/${pages} · ${items.length} iteme` });
  const rows = [row(itemSelect(`cr:item:${catIdx}`, slice, 'Alege un item pentru detalii'))];
  if (pages > 1) rows.push(row(btn(`cr:pg:${catIdx}:${p - 1}`, 'Înapoi').setDisabled(p === 0), btn(`cr:pg:${catIdx}:${p + 1}`, 'Înainte').setDisabled(p >= pages - 1)));
  return { content: '', embeds: [embed], components: rows };
}

async function searchView(query, who) {
  const found = search(query);
  if (!found.length) return { content: `Nu am găsit **${query.slice(0, 60)}**. Încearcă alt nume sau alege din categorii.`, embeds: [], components: [], files: [] };
  if (found.length === 1) return { content: '', components: [], ...(await recipePayload(found[0], who)) };
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(`Rezultate pentru „${query.slice(0, 60)}”`)
    .setDescription(found.slice(0, PAGE).map((r) => `**${r.name}**: ${r.ingredients.map(([n, q]) => `${n} x${q}`).join(', ')}`).join('\n').slice(0, 4000));
  return { content: '', embeds: [embed], components: [row(itemSelect('cr:pick', found, 'Alege un item pentru detalii'))], files: [] };
}


// ---- catalog: category pages with arrows ---------------------------------

const PER_PAGE = 12;

function catalogPages() {
  const { categories, recipes } = data();
  const pages = [];
  for (const cat of categories) {
    const items = recipes.filter((r) => (r.category || 'Diverse') === cat).sort((a, b) => a.name.localeCompare(b.name));
    const parts = Math.max(1, Math.ceil(items.length / PER_PAGE));
    const size = Math.ceil(items.length / parts);
    for (let k = 0; k < parts; k++) pages.push({ cat, part: k + 1, parts, items: items.slice(k * size, (k + 1) * size) });
  }
  return pages;
}

// Grid with the item pictures and names for one catalog page.
const gridCache = new Map();
async function catalogImage(page) {
  const key = page.items.map((r) => r.name).join('|');
  if (gridCache.has(key)) return gridCache.get(key);
  let buf = null;
  try {
    const COLS = Math.min(4, Math.max(2, page.items.length)), CW = 150, CH = 112;
    const rows = Math.ceil(page.items.length / COLS);
    const canvas = createCanvas(COLS * CW, rows * CH);
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    let any = false;
    for (let i = 0; i < page.items.length; i++) {
      const r = page.items[i];
      const cx = (i % COLS) * CW + CW / 2, top = Math.floor(i / COLS) * CH;
      const ic = await icon(r.name);
      if (ic) {
        const img = ic.img;
        const sc = Math.min(70 / img.width, 70 / img.height, 2);
        const w = img.width * sc, h = img.height * sc;
        ctx.drawImage(img, cx - w / 2, top + 6 + (70 - h) / 2, w, h);
        any = true;
      }
      // name, shrunk to fit the cell
      let size = 14;
      do { ctx.font = `${size}px DejaVu`; size -= 1; } while (ctx.measureText(r.name).width > CW - 10 && size > 9);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(r.name, cx, top + 100);
      ctx.fillStyle = '#f0e6d2'; ctx.fillText(r.name, cx, top + 100);
    }
    if (any) buf = canvas.toBuffer('image/png');
  } catch (err) { console.error('craft: catalog image failed:', err.message); }
  gridCache.set(key, buf);
  return buf;
}

async function catalogView(index) {
  const pages = catalogPages();
  if (!pages.length) return { content: 'Catalogul e gol.', embeds: [], components: [], files: [], attachments: [] };
  const i = Math.min(Math.max(0, index), pages.length - 1);
  const pg = pages[i];
  const embed = new EmbedBuilder().setColor(COLOR)
    .setTitle(`${pg.cat}${pg.parts > 1 ? ` (${pg.part}/${pg.parts})` : ''}`)
    .setFooter({ text: `Pagina ${i + 1}/${pages.length} · ${pg.items.length} iteme` });
  const half = Math.ceil(pg.items.length / 2);
  embed.addFields(
    { name: '​', value: pg.items.slice(0, half).map((r) => `• ${r.name}`).join('\n') || '-', inline: true },
    { name: '​', value: pg.items.slice(half).map((r) => `• ${r.name}`).join('\n') || '​', inline: true },
  );
  const files = [];
  const grid = await catalogImage(pg);
  if (grid) { files.push(new AttachmentBuilder(grid, { name: 'catalog.png' })); embed.setImage('attachment://catalog.png'); }

  // category jump menu: value = first page of that category
  const firstOf = new Map();
  pages.forEach((p, k) => { if (!firstOf.has(p.cat)) firstOf.set(p.cat, k); });
  const catMenu = new StringSelectMenuBuilder().setCustomId('cr:cgc').setPlaceholder('Sari la o categorie')
    .addOptions([...firstOf].slice(0, 25).map(([cat, k]) => ({ label: cat, value: String(k), default: cat === pg.cat })));
  const itemMenu = itemSelect('cr:item:0', pg.items, 'Alege un item: îl postez în chat');
  const nav = row(
    btn(`cr:cg:${i - 1}`, '◀').setDisabled(i === 0),
    btn('cr:noop', `${i + 1}/${pages.length}`).setDisabled(true),
    btn(`cr:cg:${i + 1}`, '▶').setDisabled(i >= pages.length - 1),
    btn('cr:find', 'Caută', ButtonStyle.Success),
  );
  return { content: '', embeds: [embed], components: [row(catMenu), row(itemMenu), nav], files, attachments: [] };
}

// ---- interactions -------------------------------------------------------

const nameOf = (i) => i.member?.displayName || i.user?.username;

const command = new SlashCommandBuilder().setName('craft').setDescription('Arată rețeta unui item')
  .setContexts(0)
  .addStringOption((o) => o.setName('item').setDescription('Numele itemului (ex: cadru pistol)').setAutocomplete(true).setRequired(true));

async function handleInteraction(interaction) {
  if (interaction.isAutocomplete?.() && interaction.commandName === 'craft') {
    const q = interaction.options.getFocused();
    const list = q.trim() ? search(q) : [...data().recipes].sort((a, b) => a.name.localeCompare(b.name));
    await interaction.respond(list.slice(0, 25).map((r) => ({ name: `${r.name} (${r.category || 'Diverse'})`.slice(0, 100), value: r.name.slice(0, 100) }))).catch(() => {});
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === 'craft') {
    // the answer goes in the chat for everyone to see
    await interaction.deferReply();
    await interaction.editReply(await searchView(interaction.options.getString('item', true)));
    return true;
  }
  const id = interaction.customId;
  if (!id || !id.startsWith('cr:')) return false;
  const [, kind, a, b] = id.split(':');

  if (interaction.isButton() && kind === 'find') {
    await interaction.showModal(new ModalBuilder().setCustomId('cr:q').setTitle('Caută rețetă').addComponents(
      row(new TextInputBuilder().setCustomId('q').setLabel('Ce item cauți?').setPlaceholder('ex: cadru pistol').setStyle(TextInputStyle.Short).setMaxLength(60).setRequired(true))));
    return true;
  }
  if (interaction.isModalSubmit() && kind === 'q') {
    await interaction.deferReply();
    await interaction.editReply(await searchView(interaction.fields.getTextInputValue('q'), nameOf(interaction)));
    return true;
  }
  if (interaction.isButton() && kind === 'open') {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await catalogView(0));
    return true;
  }
  if (interaction.isButton() && kind === 'cg') {
    await interaction.update(await catalogView(Number(a)));
    return true;
  }
  if (interaction.isStringSelectMenu() && kind === 'cgc') {
    await interaction.update(await catalogView(Number(interaction.values[0])));
    return true;
  }
  if (interaction.isButton() && kind === 'noop') { await interaction.deferUpdate(); return true; }
  if (interaction.isStringSelectMenu() && kind === 'cat') {
    // old panels: category menu -> open the catalog at that category
    const cats = data().categories;
    const first = catalogPages().findIndex((p) => p.cat === cats[Number(interaction.values[0])]);
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await catalogView(Math.max(0, first)));
    return true;
  }
  if (interaction.isButton() && kind === 'pg') {
    await interaction.update(categoryView(Number(a), Number(b)));
    return true;
  }
  if (interaction.isStringSelectMenu() && (kind === 'item' || kind === 'pick')) {
    const r = data().recipes.find((x) => x.name === interaction.values[0]);
    if (!r) { await interaction.update({ content: 'Rețeta nu mai există.', embeds: [], components: [] }); return true; }
    const payload = await recipePayload(r, nameOf(interaction));
    if (kind === 'pick') {
      // the result list in the chat turns into the recipe
      await interaction.update({ content: '', components: [], attachments: [], ...payload });
    } else {
      // picked from the private category list: post it in the chat, keep the list for the next pick
      await interaction.deferUpdate();
      const ch = interaction.channel ?? (await interaction.client.channels.fetch(interaction.channelId).catch(() => null));
      if (ch) await ch.send(payload).catch(() => interaction.followUp({ ephemeral: true, ...payload }).catch(() => {}));
    }
    return true;
  }
  return true;
}

// ---- text trigger -------------------------------------------------------

const lastUse = new Map();

async function handleMessage(message, client) {
  if (message.author.bot || !message.guild) return;
  const m = message.content.trim().match(/^craft\s+(.+)$/i);
  if (!m) return;
  const arg = m[1].trim();

  if (arg.toLowerCase() === 'panou') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) return;
    await message.channel.send(panelPayload());
    adminlog.action(client, message.guild.id, 'Craft: panou postat', `În ${message.channel}`, message.author.id);
    if (!(await message.delete().then(() => true).catch(() => false))) await message.react('✅').catch(() => {});
    return;
  }

  const now = Date.now();
  if (now - (lastUse.get(message.author.id) || 0) < 2000) return;
  lastUse.set(message.author.id, now);

  const who = message.member?.displayName || message.author.username;
  const { content, ...rest } = await searchView(arg, who);
  const sent = await message.channel.send({ ...(content ? { content: `${message.author}: ${content}` } : {}), ...rest, allowedMentions: { parse: [], users: [] } }).catch(() => null);
  // remove the request so the channel only keeps the answer
  if (sent) await message.delete().catch(() => {});
}

module.exports = { command, handleInteraction, handleMessage, search, panelPayload, data };

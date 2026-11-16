// The Discord side: slash commands, the daily deals digest, free-game alerts, wishlist alerts, mirrored announcements.
const { Client, GatewayIntentBits, Events, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { db, save, cfg } = require('./store');
const deals = require('./deals');
const free = require('./free');
const watch = require('./watch');
const news = require('./news');

const YELLOW = 0xffd400, MINT = 0x3df2b0, CORAL = 0xff4d6d;
const usd = (n) => `${Number(n).toFixed(2)} $`;
const siteUrl = () => (process.env.WEB_URL || db.config.siteUrl || '').replace(/\/$/, '');
const web = (u) => (/^https?:\/\//.test(String(u || '')) ? String(u) : null); // embeds refuse anything that is not a web address
const cover = (d) => (d.appId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${d.appId}/header.jpg` : web(d.thumb));

const commands = [
  new SlashCommandBuilder().setName('reduceri').setDescription('Cele mai bune reduceri la jocuri, acum')
    .addIntegerOption((o) => o.setName('pret_max').setDescription('Preț maxim în dolari').setMinValue(1).setMaxValue(49))
    .addIntegerOption((o) => o.setName('reducere_min').setDescription('Reducere minimă în procente').setMinValue(10).setMaxValue(95)),
  new SlashCommandBuilder().setName('gratis').setDescription('Jocurile gratuite de acum și cele care urmează'),
  new SlashCommandBuilder().setName('joc').setDescription('Cel mai mic preț pentru un joc, în toate magazinele')
    .addStringOption((o) => o.setName('nume').setDescription('Numele jocului').setRequired(true).setMaxLength(60)),
  new SlashCommandBuilder().setName('portal').setDescription('Linkul către portal'),
];

async function topDeals({ max, cut } = {}) {
  const c = cfg();
  const r = await deals.list({ sort: 'rating', steam: 70, max, cut: cut ?? c.minCut, size: 60 });
  const seen = new Set();
  return r.items.filter((d) => !seen.has(d.gameId) && seen.add(d.gameId)).slice(0, 10);
}
async function dealsEmbed(list, title) {
  const st = await deals.stores().catch(() => ({}));
  const e = new EmbedBuilder().setColor(YELLOW).setTitle(title)
    .setDescription(list.map((d) => `**-${d.cut}%** [${d.title.replace(/[[\]]/g, '')}](${d.url})\n~~${usd(d.normal)}~~ **${usd(d.sale)}** la ${st[d.store]?.name || 'magazin'}`).join('\n\n').slice(0, 4000) || 'Nu am găsit reduceri cu filtrele astea.')
    .setFooter({ text: 'Prețuri în dolari, de la CheapShark. Pot diferi puțin în regiunea ta.' });
  if (list[0] && cover(list[0])) e.setThumbnail(cover(list[0]));
  if (siteUrl()) e.setURL(siteUrl());
  return e;
}
function freeEmbed(g, soon) {
  const e = new EmbedBuilder().setColor(MINT).setTitle(`${soon ? 'Urmează gratis' : 'Gratis acum'}: ${g.title}`.slice(0, 250)).setURL(web(g.url) || 'https://store.epicgames.com/free-games')
    .setDescription(`${g.desc || ''}\n\n${soon ? `Începe <t:${Math.floor(g.start / 1000)}:R>` : `Până <t:${Math.floor(g.end / 1000)}:F> (<t:${Math.floor(g.end / 1000)}:R>)`}${g.worth ? `\nPreț normal: ${usd(g.worth)}` : ''}`.trim())
    .setFooter({ text: g.store });
  if (web(g.image)) e.setImage(g.image);
  return e;
}

async function onCommand(i) {
  const name = i.commandName;
  if (name === 'portal') return i.reply({ content: siteUrl() ? `Portalul: ${siteUrl()}` : 'Adresa portalului nu e setată încă. Deschide site-ul o dată sau adaugă variabila WEB_URL.', flags: MessageFlags.Ephemeral });
  await i.deferReply();
  if (name === 'reduceri') {
    const list = await topDeals({ max: i.options.getInteger('pret_max') ?? undefined, cut: i.options.getInteger('reducere_min') ?? undefined });
    return i.editReply({ embeds: [await dealsEmbed(list, 'Cele mai bune reduceri acum')] });
  }
  if (name === 'gratis') {
    const f = await free.epic();
    const embeds = [...f.now.map((g) => freeEmbed(g, false)), ...f.soon.map((g) => freeEmbed(g, true))].slice(0, 6);
    return i.editReply(embeds.length ? { embeds } : { content: 'Nu am găsit jocuri gratuite acum. Mai încearcă mai târziu.' });
  }
  if (name === 'joc') {
    const found = await deals.search(i.options.getString('nume'));
    if (!found.length) return i.editReply('Nu am găsit niciun joc cu numele ăsta.');
    const g = await deals.game(found[0].gameId), st = await deals.stores().catch(() => ({}));
    if (!g || !g.deals.length) return i.editReply('Nu am găsit prețuri pentru jocul ăsta.');
    const e = new EmbedBuilder().setColor(YELLOW).setTitle(g.title.slice(0, 250)).setURL(g.deals[0].url)
      .setDescription(g.deals.slice(0, 8).map((d, k) => `${k === 0 ? '**' : ''}${usd(d.price)}${k === 0 ? '**' : ''}${d.cut ? ` (-${d.cut}%)` : ''} la [${st[d.store]?.name || 'magazin'}](${d.url})`).join('\n'))
      .setFooter({ text: g.low ? `Cel mai mic preț din istorie: ${usd(g.low.price)}. Prețuri în dolari, de la CheapShark.` : 'Prețuri în dolari, de la CheapShark.' });
    if (cover(g)) e.setThumbnail(cover(g));
    return i.editReply({ embeds: [e] });
  }
}

function start() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const guild = () => (process.env.WEB_GUILD_ID && client.guilds.cache.get(process.env.WEB_GUILD_ID)) || client.guilds.cache.first();
  const channel = (id) => { const ch = id && client.channels.cache.get(id); return ch?.isTextBased?.() ? ch : null; };

  async function digest(force) {
    const c = cfg(), ch = channel(c.dealsChannel);
    if (!ch) return { ok: false, msg: 'Alege mai întâi canalul pentru reduceri.' };
    const list = await topDeals();
    if (!list.length) return { ok: false, msg: 'Nu am găsit reduceri de trimis acum.' };
    await ch.send({ embeds: [await dealsEmbed(list, force ? 'Reduceri alese acum' : 'Reducerile zilei')] });
    return { ok: true, msg: `Am trimis reducerile în #${ch.name}.` };
  }
  async function freeAlerts() {
    const c = cfg(), ch = channel(c.dealsChannel);
    const f = await free.epic();
    for (const g of f.now) {
      const key = `${g.id}:${g.start}`;
      if (db.seenFree[key]) continue;
      db.seenFree[key] = Date.now();
      if (ch && c.freeAlerts) await ch.send({ embeds: [freeEmbed(g, false)] }).catch((err) => console.warn('free alert:', err.message));
    }
    for (const [k, at] of Object.entries(db.seenFree)) if (Date.now() - at > 90 * 86400_000) delete db.seenFree[k];
    save();
  }
  async function watchAlerts() {
    const st = await deals.stores().catch(() => ({}));
    await watch.check(async (uid, e) => {
      const emb = new EmbedBuilder().setColor(CORAL).setTitle(`${e.title} a ajuns la prețul tău`.slice(0, 250)).setURL(e.url)
        .setDescription(`Acum **${usd(e.price)}** la ${st[e.store]?.name || 'magazin'}. Ținta ta era ${usd(e.target)}.${e.low !== null && e.price <= e.low ? '\nE cel mai mic preț din istorie.' : ''}`);
      if (cover(e)) emb.setThumbnail(cover(e));
      const user = await client.users.fetch(uid);
      await user.send({ embeds: [emb] }); // fails when the person has DMs closed; nothing else to do then
    });
  }
  // every 5 minutes: is it time for the daily digest? every 30: free games and wishlists
  let n = 0;
  async function tick() {
    try {
      const c = cfg();
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date()).map((p) => [p.type, p.value]));
      const day = `${parts.year}-${parts.month}-${parts.day}`;
      if (c.digest && c.dealsChannel && Number(parts.hour) % 24 >= c.hour && db.lastDigest !== day) { db.lastDigest = day; save(); await digest(false); }
      if (n++ % 6 === 0) { await freeAlerts(); await watchAlerts(); }
    } catch (err) { console.error('bot tick:', err.message); }
  }

  client.once(Events.ClientReady, async (c) => {
    console.log(`Logged in as ${c.user.tag}`);
    try { const global = await c.application.commands.fetch(); if (global.size) await c.application.commands.set([]); } catch { /* ignore */ }
    for (const g of c.guilds.cache.values()) await g.commands.set(commands.map((x) => x.toJSON())).catch((err) => console.error(`commands in ${g.name}:`, err.message));
    // the first run only remembers which games are free now, so a restart does not re-announce them
    if (!Object.keys(db.seenFree).length) { try { const f = await free.epic(); for (const g of f.now) db.seenFree[`${g.id}:${g.start}`] = Date.now(); save(); } catch { /* next tick */ } }
    setTimeout(tick, 20_000); setInterval(tick, 5 * 60_000);
  });
  client.on(Events.GuildCreate, (g) => g.commands.set(commands.map((x) => x.toJSON())).catch(() => {}));
  client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    try { await onCommand(i); }
    catch (err) {
      console.error('command error:', err);
      const msg = 'Nu am putut lua prețurile acum. Mai încearcă peste un minut.';
      if (i.deferred || i.replied) await i.editReply(msg).catch(() => {}); else await i.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });

  return {
    client, guild, digest,
    // is this Discord user allowed to manage the portal? (Manage Server on the main server, or listed in ADMIN_IDS)
    async isAdmin(uid) {
      if (String(process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).includes(uid)) return true;
      const g = guild(); if (!g) return false;
      if (g.ownerId === uid) return true;
      try { const m = await g.members.fetch(uid); return m.permissions.has(PermissionFlagsBits.ManageGuild); } catch { return false; }
    },
    channels() {
      const g = guild(), me = g?.members.me; if (!g || !me) return [];
      return [...g.channels.cache.values()]
        .filter((c) => (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) && c.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]))
        .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition)
        .map((c) => ({ id: c.id, name: c.name, group: c.parent?.name || '' }));
    },
    async postNews(item) {
      const ch = channel(cfg().newsChannel);
      if (!ch) return { ok: false, msg: 'Alege mai întâi canalul pentru anunțuri, în Setări.' };
      const e = new EmbedBuilder().setColor(YELLOW).setTitle(item.title).setDescription(item.body.slice(0, 4000)).setFooter({ text: `${news.TAGS[item.tag]} de la ${item.by.name}` }).setTimestamp(item.at);
      if (item.link) e.setURL(item.link);
      if (item.image) e.setImage(item.image);
      try { await ch.send({ embeds: [e] }); return { ok: true, msg: `Trimis și în #${ch.name}.` }; }
      catch (err) { console.warn('postNews:', err.message); return { ok: false, msg: 'Nu am putut trimite pe Discord. Botul are nevoie de Send Messages și Embed Links în canal.' }; }
    },
    login: () => client.login(process.env.DISCORD_TOKEN),
  };
}

module.exports = { start, commands, _onCommand: onCommand };

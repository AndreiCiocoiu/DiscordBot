// AION 2's official Steam App ID. Steam's news API is public and needs no
// API key for this read-only call.
const AION2_APP_ID = 3393110;

// Steam news content often contains BBCode-ish tags and {STEAM_CLAN_IMAGE}
// placeholders (broken image refs once stripped of their base URL). Clean
// those up into plain, Discord-friendly text.
function cleanContent(raw = '') {
  return raw
    .replace(/\{STEAM_CLAN_IMAGE\}[^\s)"']*/g, '')
    .replace(/\[url=[^\]]+\]/g, '')
    .replace(/\[\/url\]/g, '')
    .replace(/\[\/?[a-z0-9]+\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchAion2News(count = 5) {
  const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${AION2_APP_ID}&count=${count}&maxlength=600&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam news API returned ${res.status}`);
  const data = await res.json();
  const items = data?.appnews?.newsitems ?? [];

  return items.map((item) => ({
    gid: item.gid,
    title: item.title,
    url: item.url,
    content: cleanContent(item.contents),
    date: item.date, // unix seconds
    feedName: item.feedlabel,
  }));
}

module.exports = { fetchAion2News, AION2_APP_ID };

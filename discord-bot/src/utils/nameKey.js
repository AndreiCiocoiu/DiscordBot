// Comparison key for a channel/category name: drops the emoji prefix (up to
// the "・" separator), un-small-caps it, lowercases it, dashes for spaces.
const SMALL_CAPS_REVERSE = {
  'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h',
  'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p',
  'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z',
};

function nameKey(name) {
  let n = name.includes('・') ? name.split('・').slice(1).join('・') : name;
  n = [...n].map((c) => SMALL_CAPS_REVERSE[c] ?? c).join('');
  return n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

module.exports = { nameKey };

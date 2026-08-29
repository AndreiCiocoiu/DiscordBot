// Converts plain ASCII letters into 𝕭𝖔𝖑𝖉 𝕱𝖗𝖆𝖐𝖙𝖚𝖗 unicode characters.
// Anything that isn't a-z/A-Z (spaces, digits, emoji, punctuation) is left untouched.

const LOWER_BASE = 0x1d586; // 𝖆
const UPPER_BASE = 0x1d56c; // 𝕬

function toFraktur(text) {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code >= 97 && code <= 122) {
      out += String.fromCodePoint(LOWER_BASE + (code - 97));
    } else if (code >= 65 && code <= 90) {
      out += String.fromCodePoint(UPPER_BASE + (code - 65));
    } else {
      out += char;
    }
  }
  return out;
}

module.exports = { toFraktur };

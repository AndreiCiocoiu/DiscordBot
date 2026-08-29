// Pulls a random hot meme from a given subreddit via the free meme-api.com.
// Used by /meme, /meme-ro, and the auto-poster so they share one code path.

async function fetchMeme(subreddit) {
  const url = subreddit ? `https://meme-api.com/gimme/${subreddit}` : 'https://meme-api.com/gimme';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`meme-api returned ${res.status}`);
  const data = await res.json();
  if (!data?.url) throw new Error('meme-api returned no image');
  return {
    title: data.title,
    imageUrl: data.url,
    ups: data.ups,
    subreddit: data.subreddit,
    postLink: data.postLink,
  };
}

// RomaniaDank is the dedicated meme-format subreddit; RoCirclejerk is a
// separate, ironic/self-aware humor sub about Romanian culture — different
// flavor of authentic Romanian humor, not political.
const ROMANIAN_MEME_SUBREDDITS = ['RomaniaDank', 'RoCirclejerk'];

// If every Romanian source fails (rare — e.g. Reddit hiccup), fall back to
// general meme subreddits so the channel doesn't just go silent.
const GENERAL_FALLBACK_SUBREDDITS = ['memes', 'dankmemes', 'wholesomememes'];

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchRomanianMeme() {
  let lastErr;
  // Random order each call so posts pull from different sources over time,
  // instead of always hitting the same subreddit first.
  for (const sub of shuffled(ROMANIAN_MEME_SUBREDDITS)) {
    try {
      return await fetchMeme(sub);
    } catch (err) {
      lastErr = err;
    }
  }
  for (const sub of GENERAL_FALLBACK_SUBREDDITS) {
    try {
      return await fetchMeme(sub);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('No meme subreddits worked');
}

// Reacts with 👍/👎 so people can vote on a posted meme.
async function addVoteReactions(message) {
  await message.react('👍').catch(() => {});
  await message.react('👎').catch(() => {});
}

module.exports = { fetchMeme, fetchRomanianMeme, addVoteReactions };

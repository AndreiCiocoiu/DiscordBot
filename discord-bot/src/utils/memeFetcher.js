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

// Well-known Romanian meme subreddits — RomaniaDank is the big one, the
// others are fallbacks in case a fetch comes back empty.
const ROMANIAN_MEME_SUBREDDITS = ['RomaniaDank', 'Romania'];

async function fetchRomanianMeme() {
  let lastErr;
  for (const sub of ROMANIAN_MEME_SUBREDDITS) {
    try {
      return await fetchMeme(sub);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('No Romanian meme subreddits worked');
}

// Reacts with 👍/👎 so people can vote on a posted meme.
async function addVoteReactions(message) {
  await message.react('👍').catch(() => {});
  await message.react('👎').catch(() => {});
}

module.exports = { fetchMeme, fetchRomanianMeme, addVoteReactions };

// Pulls a random hot meme from a given subreddit via the free meme-api.com.
// Used by /meme so it stays simple — no filtering needed there.

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
// separate, ironic/self-aware humor sub about Romanian culture.
const ROMANIAN_MEME_SUBREDDITS = ['RomaniaDank', 'RoCirclejerk'];

// If every Romanian source fails (rare — e.g. Reddit hiccup), fall back to
// general meme subreddits so the channel doesn't just go silent.
const GENERAL_FALLBACK_SUBREDDITS = ['memes', 'dankmemes', 'wholesomememes'];

// Romanian diacritics — the signal we use to tell "actually written in
// Romanian" apart from an English meme template that just got reposted
// into a Romanian-named subreddit.
const ROMANIAN_DIACRITICS = /[ăâîșțşţĂÂÎȘȚŞŢ]/;

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Fetches Reddit's own "hot" listing directly (not the meme-api wrapper),
// so we can see enough posts to actually filter for language/content.
async function fetchRedditListing(subreddit) {
  const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=50`, {
    headers: { 'User-Agent': 'chill-server-bot/1.0 (Discord meme bot)' },
  });
  if (!res.ok) throw new Error(`reddit returned ${res.status} for r/${subreddit}`);
  const data = await res.json();
  return (data?.data?.children ?? []).map((c) => c.data);
}

function isImagePost(post) {
  if (post.post_hint === 'image') return true;
  if (post.url && IMAGE_EXT_RE.test(post.url)) return true;
  return false;
}

function toMemeShape(post) {
  return {
    title: post.title,
    imageUrl: post.url,
    ups: post.ups ?? post.score ?? 0,
    subreddit: post.subreddit,
    postLink: `https://www.reddit.com${post.permalink}`,
  };
}

// Pulls a genuinely Romanian-language meme: fetches a real batch of hot
// posts from Romanian subreddits and filters for titles that actually
// contain Romanian diacritics, so an English template reposted without
// translation gets skipped rather than posted as "a Romanian meme".
async function fetchRomanianMeme() {
  for (const sub of shuffled(ROMANIAN_MEME_SUBREDDITS)) {
    try {
      const posts = await fetchRedditListing(sub);
      const imagePosts = posts.filter((p) => !p.stickied && isImagePost(p));

      const romanianTitled = imagePosts.filter((p) => ROMANIAN_DIACRITICS.test(p.title));
      if (romanianTitled.length > 0) {
        return toMemeShape(pickRandom(romanianTitled));
      }
    } catch {
      // try the next subreddit
    }
  }

  // Nothing with clearly Romanian-language titles right now — still prefer
  // a real post from a Romanian subreddit over a generic English fallback.
  for (const sub of shuffled(ROMANIAN_MEME_SUBREDDITS)) {
    try {
      const posts = await fetchRedditListing(sub);
      const imagePosts = posts.filter((p) => !p.stickied && isImagePost(p));
      if (imagePosts.length > 0) return toMemeShape(pickRandom(imagePosts));
    } catch {
      // try the next subreddit
    }
  }

  // Last resort — every Romanian source failed outright (e.g. Reddit is down).
  for (const sub of GENERAL_FALLBACK_SUBREDDITS) {
    try {
      return await fetchMeme(sub);
    } catch {
      // try the next one
    }
  }

  throw new Error('No meme subreddits worked');
}

// Reacts with 👍/👎 so people can vote on a posted meme.
async function addVoteReactions(message) {
  await message.react('👍').catch(() => {});
  await message.react('👎').catch(() => {});
}

module.exports = { fetchMeme, fetchRomanianMeme, addVoteReactions };

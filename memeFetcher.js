// Pulls a random hot meme from a given subreddit via the free meme-api.com.
// Used by /meme.

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

// Reacts with 👍/👎 so people can vote on a posted meme.
async function addVoteReactions(message) {
  await message.react('👍').catch(() => {});
  await message.react('👎').catch(() => {});
}

module.exports = { fetchMeme, addVoteReactions };

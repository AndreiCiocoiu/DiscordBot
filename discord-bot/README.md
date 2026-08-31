# Chill Server Bot

A Discord bot that sets up your whole server — channels, categories, and ranks/roles — with one command, plus moderation, fun, leveling, and music commands for you and your friends.

## What it does

**`/setup`** (admin only) builds:
- **Roles/ranks:** Admin, Moderator, Member, plus auto-unlocking Level 5 / 10 / 20 / 30 roles
- **Categories & channels:** Information (welcome, rules, announcements), General (chat, memes, bot-commands), Gaming (chat, LFG, clips), Voice Channels (general + 2 gaming rooms + AFK), a private Staff category, and a dedicated **AION 2** category (news, classes, chat)
- New members are automatically given the Member role and welcomed in `#welcome` with a generated image card (avatar in a decorative frame, username, member number)

**Leveling:** everyone earns XP for chatting (1 min cooldown) and levels up automatically, unlocking rank roles.

**Moderation:** `/kick` `/ban` `/unban` `/timeout` `/warn` `/warnings` `/clear`

**Fun:** `/meme` `/8ball` `/coinflip` `/guess`

**AION 2:** a whole `🕊️ AION 2` category, built by `/setup`, roles channel first:
- `🕊️・roles` — one message with every self-assignable AION 2 role: a general **"I play AION 2"** button plus one button per class (9 total). Click to add, click again to remove.
- `📰・news` — auto-posts new AION 2 announcements (checked every 30 min, adjustable via `AION2_CHECK_INTERVAL_MINUTES`), pulled from the game's official Steam news feed, no third-party source or API key needed. Each post gets a branded header, a banner image, up to ~1200 characters of content, and a link to the full post. `/aion2` shows the latest 3 posts on demand, anywhere, in the same format.
- `⚔️・classes` — a pure showcase of all 8 launch classes, each posted as a full character render (official art, one per class) followed by its role, weapon, and playstyle description underneath — no buttons here, those live in `🕊️・roles`. Auto-posted once when `/setup` first runs; re-post anytime with `/aion2classes` (mod-only).
- `💬・aion-2-chat` — open discussion channel, no bot involvement.

**Music:** `/play <song name>` — just type what you want, no link needed (a YouTube link still works if you have one). Powered by `yt-dlp` under the hood for reliability. Every "Now Playing" message comes with a full control panel:
- Row 1: ⏸️/▶️ pause-resume, ⏭️ skip, 🔁 loop, 🔀 shuffle, ⏹️ stop
- Row 2: ➕ **Request a song** (opens a popup to type a song name/link without using `/play`), 📃 Queue (shows what's up next, only visible to you), 🔊/🔉 volume up/down

`/skip` `/pause` `/resume` `/stop` `/queue` still work as commands too.

**Style:** server roles, channels, and the bot's main titles use a 𝕭𝖔𝖑𝖉 𝕱𝖗𝖆𝖐𝖙𝖚𝖗 unicode font (`src/utils/fancyFont.js` — reusable anywhere else you want it).

**Utility:** `/rank` `/leaderboard` `/ping` `/serverinfo` `/userinfo`

## Setup

### 1. Create the bot on Discord

1. Go to https://discord.com/developers/applications → **New Application**
2. Go to the **Bot** tab → **Reset Token** → copy it (this is your `DISCORD_TOKEN`)
3. On the same page, turn on **Message Content Intent** and **Server Members Intent** (under Privileged Gateway Intents)
4. Go to **OAuth2 → General** and copy the **Application ID** (this is your `CLIENT_ID`)
5. Go to **OAuth2 → URL Generator**, tick `bot` and `applications.commands`, then under Bot Permissions tick `Administrator` (simplest for a self-managed server bot). Open the generated URL and invite it to your server.

### 2. Install & configure

```bash
npm install
cp .env.example .env
```

Fill in `.env`:
```
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
GUILD_ID=your-server-id   # optional, makes commands appear instantly while testing
```
(To get your server's ID: enable Developer Mode in Discord settings → Advanced, then right-click your server icon → Copy Server ID.)

### 3. Register the slash commands

```bash
npm run deploy
```

### 4. Run the bot

```bash
npm start
```

### 5. In your server

Run `/setup` as an admin — it builds everything in a few seconds. After it finishes, open **Server Settings → Roles** and drag the bot's own role **above** Admin/Moderator/Level roles, or role auto-assignment (for new members and level-ups) won't work — Discord bots can only manage roles below their own.

## Notes

- Leveling and warnings are stored locally in `data/*.json`. Back that folder up if you care about keeping XP/history.
- Music runs on `discord-player` with a **custom extractor backed by `yt-dlp`** (`src/utils/ytdlpExtractor.js`), instead of a JS library that scrapes/reverse-engineers YouTube's player. yt-dlp is a huge, near-daily-updated project maintained specifically because YouTube keeps changing things — when something breaks, it's usually patched within hours to days, which is far more reliable long-term than smaller JS scraping libraries (which is what caused earlier versions of this bot's `/play` command to fail outright).
- **`yt-dlp` requires Python 3.9+ on the machine running the bot.** Railway's Node build image does NOT include Python by default — you'll see `env: 'python3': No such file or directory` in the logs if it's missing (the bot logs a clear `yt-dlp self-test FAILED` line on boot if this is the problem). Fix: in Railway → your service → **Variables**, add `RAILPACK_DEPLOY_APT_PACKAGES` with the value `python3`, then let it redeploy. Confirm it worked by checking for `yt-dlp OK — version ...` in the boot logs.
- If `/play` ever stops working again, the fix is almost always `npm update youtube-dl-exec` (which re-downloads the latest `yt-dlp` binary) rather than anything in this bot's own code.
- **Optional but helps with reliability:** authenticate with a real account's cookie, which YouTube trusts more than anonymous traffic:
  1. **Use a secondary/throwaway Google account for this**, not your main one — while low-risk, it's still an automated tool touching a logged-in session.
  2. Log into that account at youtube.com in a normal browser.
  3. Install a cookie-export extension like **Cookie-Editor** ([Chrome](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm) / [Firefox](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/)).
  4. While on youtube.com, open Cookie-Editor, export as a **Netscape cookies.txt file** (not the header-string format this time — yt-dlp wants the file format).
  5. Save that file into the project as `data/youtube-cookies.txt`, and it'll be picked up automatically (see `COMMON_FLAGS` in `ytdlpExtractor.js` if you want to wire this up — it's not auto-loaded yet, ask if you want this added).
  6. Treat that cookie file like a password — anyone with it can act as that YouTube account.
- Everything here uses Discord's native timeout for `/timeout` (no separate mute role needed).
- Re-running `/setup` is safe — it won't create duplicate roles/channels, it just reuses ones with matching names.

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

**RDR2 Online:** a `🤠 RDR2 Online` category, built by `/setup` — a `💬・rdr2-chat` channel, no bot automation, just a dedicated space for it.

**Game Roles:** a `🎮 Game Roles` category with one channel, `🎮・game-roles` — a single message with a button per game: League, CS2, GTA 5, RDR2, ARK, AION 2 (same role as the AION 2 roles channel — click either, same effect), REPO, Phasmophobia, Minecraft, Terraria. Click to add/remove, same self-toggle pattern as everywhere else.

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
- The bot **self-updates `yt-dlp` to the latest release every time it boots** (check the logs for `yt-dlp self-update: ...`), since YouTube changes frequently enough that a stale binary is a common cause of playback errors — this covers most "it randomly stopped working" cases without needing any manual fix. If `/play` still fails after a restart, check the logs for the actual error first.
- **Strongly recommended — authenticate with a real account's cookie.** Without this, YouTube frequently blocks requests with "Sign in to confirm you're not a bot" (anonymous datacenter traffic gets flagged hard):
  1. **Use a secondary/throwaway Google account for this**, not your main one — while low-risk, it's still an automated tool touching a logged-in session.
  2. Log into that account at youtube.com in a normal browser.
  3. Install a cookie-export extension like **Cookie-Editor** ([Chrome](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm) / [Firefox](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/)).
  4. While on youtube.com, open Cookie-Editor and export — either format works, the bot auto-detects and converts if needed:
     - **Header String** (`name=value; name2=value2; ...`) — simplest, just copy-paste
     - **Netscape** — also fine, used as-is
  5. In Railway → your service → **Variables**, add `YOUTUBE_COOKIE` and paste in what you copied.
  6. Redeploy (or just restart) and check the boot logs for `[ytdlp-extractor] Using YouTube cookies (...)` instead of the "No YouTube cookies configured" warning.
  7. Treat that value like a password — anyone with it can act as that YouTube account.
  8. (Advanced/alternative: you can instead upload a Netscape-format file directly to `data/youtube-cookies.txt` on the persistent volume — that takes priority over the env var if both are present. The env var is easier for most people since Railway's Variables tab is simple to use, no volume file browser needed.)
- **For the most reliable setup — route through a residential proxy.** Cookies and client-switching help, but the real reason YouTube flags requests in the first place is that Railway's IP is a datacenter IP. A residential proxy fixes the actual cause instead of working around it:
  1. Sign up with a residential proxy provider — e.g. [Webshare](https://www.webshare.io) (has a free tier, good for testing) or [DataImpulse](https://dataimpulse.com) (~$1/GB, pay-as-you-go, cheap for ongoing use).
  2. Get your proxy connection string from their dashboard — it looks like `http://username:password@host:port`.
  3. In Railway → your service → **Variables**, add `YT_PROXY` with that full string as the value.
  4. Redeploy. No log confirmation line for this one — just try `/play` and see if it holds up better.
  5. Treat that value like a password too — regenerate it in your provider's dashboard if it's ever exposed (e.g. pasted in a chat).
- Everything here uses Discord's native timeout for `/timeout` (no separate mute role needed).
- Re-running `/setup` is safe — it fetches a fresh list of channels/roles from Discord first (not just the local cache) before checking what already exists, so it reuses matching ones instead of creating duplicates, even right after a restart when the cache might not be fully warmed up yet.
- The `🕊️ AION 2` category (news, classes, chat) is only visible to people with the **🕊️ AION 2** role. The `🕊️・roles` channel itself stays visible to everyone, so people can actually see it to opt in — Admins and Moderators can also see the whole category regardless of the role.

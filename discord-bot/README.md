# Chill Server Bot

A Discord bot that sets up your whole server — channels, categories, and ranks/roles — with one command, plus moderation, fun, leveling, and music commands for you and your friends.

## What it does

**`/setup`** (admin only) builds:
- **Roles/ranks:** Admin, Moderator, Member, plus auto-unlocking Level 5 / 10 / 20 / 30 roles
- **Categories & channels:** Information (welcome, rules, announcements), General (chat, memes, bot-commands), Gaming (chat, LFG, clips), Voice Channels (general + 2 gaming rooms + AFK), and a private Staff category
- New members are automatically given the Member role and welcomed in `#welcome`

**Leveling:** everyone earns XP for chatting (1 min cooldown) and levels up automatically, unlocking rank roles.

**Moderation:** `/kick` `/ban` `/unban` `/timeout` `/warn` `/warnings` `/clear`

**Fun:** `/meme` `/8ball` `/coinflip` `/guess`

**Music:** `/play <song name>` — just type what you want, no link needed (a YouTube link still works if you have one). Every "Now Playing" message comes with buttons: ⏸️/▶️ pause-resume, ⏭️ skip, 🔁 loop, ⏹️ stop — no typing extra commands needed. `/skip` `/pause` `/resume` `/stop` `/queue` still work too.

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
- Music runs on `discord-player` with a `youtubei`-based extractor, which talks to YouTube's internal app API directly instead of scraping/deciphering the web player — much more resilient to YouTube changing things than older scraping-based libraries.
- **Getting rate-limited or music that won't play?** Optionally authenticate with a real account's cookie, which YouTube trusts more than anonymous traffic:
  1. **Use a secondary/throwaway Google account for this**, not your main one — while low-risk, it's still an automated tool touching a logged-in session.
  2. Log into that account at youtube.com in a normal browser.
  3. Install a cookie-export extension like **Cookie-Editor** ([Chrome](https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm) / [Firefox](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/)).
  4. While on youtube.com, open Cookie-Editor and click **Export** → **Export as Header String** (or "Copy" if that's the only option — you want one long `name=value; name2=value2; ...` line, not JSON).
  5. In Railway → your service → **Variables**, add `YOUTUBE_COOKIE` and paste that string in as the value.
  6. Redeploy. On boot you should see `Music player ready (discord-player + youtubei).` in the logs.
  7. Treat that cookie like a password — anyone with it can act as that YouTube account. If you ever want to revoke it, just log that Google account out of all sessions.
- `discord-player-youtubei` is pinned to exactly `1.5.0` in `package.json` on purpose — newer versions pull in an unrelated, flaky optional dependency (`youtube-dl-exec`) that can fail to install. Don't run `npm update` on just that package without checking this first.
- Everything here uses Discord's native timeout for `/timeout` (no separate mute role needed).
- Re-running `/setup` is safe — it won't create duplicate roles/channels, it just reuses ones with matching names.

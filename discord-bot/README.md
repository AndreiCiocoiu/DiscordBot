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

**Music:** `/play` `/skip` `/pause` `/resume` `/stop` `/queue` (plays YouTube links or search terms in your voice channel)

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
- Music uses `play-dl`, which pulls audio from YouTube. YouTube occasionally changes things in ways that break scraping-based players; if `/play` stops working, run `npm update play-dl` first.
- Everything here uses Discord's native timeout for `/timeout` (no separate mute role needed).
- Re-running `/setup` is safe — it won't create duplicate roles/channels, it just reuses ones with matching names.

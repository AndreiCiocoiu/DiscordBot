# MUIE bot

No slash commands: everything is buttons on pinned panels plus a few admin text commands. Leftover slash commands from older versions are removed at every start.

## Setup (once, admin)
1. Developer Portal -> Bot: enable **Server Members Intent** and **Message Content Intent** (the bot still starts without them, with fewer features, and says so in the logs).
2. Bot permissions: View Channels, Manage Channels, Manage Roles, Send Messages, Embed Links, Attach Files, Read Message History, Manage Messages, Add Reactions, **View Audit Log**, **Manage Server** (invite tracking), Connect, Speak. The bot's role must sit above the @Razie and @Sesiuni roles.
3. Write **`server setup`** in any channel. It reuses your existing welcome channel, creates **sesiuni** and a private **adminlog** (only admins see it), and posts the sessions panel.
4. Write `razie panou` in the channel for the raid panel (see below). Railway: add a **Volume** mounted at `/app/data` so timers, sessions and the recording survive redeploys.

Admin text commands (Administrator only): `server setup`, `server aici welcome|sesiuni|log` (use this channel), `server test` (preview the welcome banner), `server tz Europe/Bucharest` (time zone for sessions, default Europe/London), `server info`.

## Welcome
When someone joins, the bot posts in the welcome channel an embed with an **animated banner** (sunset, embers, glowing avatar ring, gold shimmer) with their name and member number, plus buttons for the razie and session notifications. During a join flood it falls back to text only.

## Sessions
In the sessions channel press **Planifica sesiune**: what you play + when (`azi 21:00`, `maine 20:30`, `sambata 22:00`, `28.10 21:00`) + optional details. The bot posts one message with **Vin / Poate / Nu vin** (press again to take it back) and pings the opt-in @Sesiuni role. 30 minutes before it pings everyone who said Vin or Poate. The host or an admin can cancel it. The message is deleted 3 hours after the start. Times show in everyone's own time zone.

## Admin log
Everything goes to the private adminlog: joins (account age, invite used), leaves, kicks, bans/unbans, nickname/role/timeout changes (with who did it), deleted/edited messages (with content), bulk deletes (attached as a text file), channel/role/server/emoji/sticker changes, invites, threads, webhooks, voice join/leave/move/mute/stream, AutoMod hits, and what the bot itself does (razie, sessions, welcome, setup). Messages sent before the bot started can't show their old content.

## Razie (RDR2 raid timers)
Panel with buttons: **Porneste** (zone + minutes left), **Anuleaza**, **A venit mai repede**, **Istoric**, **Alerte on/off**, **Setari**. Shortcut: write `razie Annesburg` in the panel channel. Starting a zone that already has a timer replaces it. 10 minutes before the end: one warning with an @Razie ping (deleted when the timer ends). At the end: one alert with buttons **A fost razie, reporneste 3h** / **N-a fost** (with undo); the bot joins voice and plays the siren plus your recording.
Admin: `razie panou`, `razie sunet` (+ audio attachment), `razie test`.

## Craft
Write `craft cadru pistol` in any channel: the bot answers with the recipe (typos and missing diacritics are fine; several matches give a pick list). `craft panou` (admin) posts a panel with a category menu and a **Cauta** button; those answers are private to whoever pressed. Recipes are in `assets/recipes.json` (name, category, ingredients `[name, qty]`, level, points, time); edit the file and push, no code changes. Optional picture per item: `assets/craft/cadru-pistol.png` (lowercase name with dashes).

## Env
Only `DISCORD_TOKEN`. Optional: `RAZIE_MINUTES` (180), `RAZIE_WARN_MINUTES` (10), `DATA_DIR`.

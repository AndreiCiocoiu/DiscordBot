# MUIE bot

Slash commands: `/craft` (recipe with autocomplete) and `/catalog` for everyone, `/panou` (crafting / razii / sesiuni panel in the current channel) for admins only: Discord hides it from everyone else and the bot re-checks Manage Server. Everything else is buttons on pinned panels plus a few admin text commands. Any other leftover slash commands are removed at every start.

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

## Craft (RedZone weapons)
Data is in `assets/recipes.json`: the weapons (category, badge, ingredients) and the `processes` (Fier, Cupru, Otel, Arc Metalic, Suruburi, Teava Metalica: what they are made from, how many per craft, where). The calculator follows the same rules as redzonerp.ro/crafting: intermediate items are crafted in whole batches (leftovers shown), each weapon already comes with one Teava Metalica.
- `/craft Revolver Cattleman 2` (autocomplete) or `craft cattleman 2` in chat: posts COMANDA, MATERIALE NECESARE, FACUTE PE PARCURS, MINEREU DE ADUNAT and ORDINEA DE CRAFT in the chat (the text version also deletes your message).
- `/panou` -> Crafting (or `craft panou`): panel with **Catalog** (one page per category, arrows, a menu to jump to a category and one to pick a weapon, which is calculated in the chat) and **Calculator** (type several weapons, one per line: `Revolver Cattleman 2` / `Carcano Rifle 1`).
- `/catalog`: the catalog, visible only to you.
To add a weapon, copy a block in `weapons`; to change a rule (yield, ore per craft) edit `processes`. No code changes.

## Env
Only `DISCORD_TOKEN`. Optional: `RAZIE_MINUTES` (180), `RAZIE_WARN_MINUTES` (10), `DATA_DIR`.

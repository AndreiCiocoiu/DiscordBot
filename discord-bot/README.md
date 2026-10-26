# MUIE bot

Razie (police raid) tracker for RDR2 Online. Everything is done with buttons on one pinned panel.

## Use
1. Admin posts the panel once: `/razie panou` (the alerts come to that channel; change it in Setari).
2. **Porneste**: pick a zone from the menu, or "Alta zona / minute ramase" to type a new one (and the minutes left, if you started late). Starting a zone that already has a timer **replaces** it.
3. **Anuleaza**: pick a timer (or all). **A venit mai repede**: the raid came before the timer ended, logs it now and restarts the full cooldown (has an undo).
4. **Istoric**: last 10 raids. **Alerte on/off**: get/drop the @Razie role. **Setari** (admin): siren on/off, 10 min warning on/off, alert channel, remove saved zones.
5. Text shortcut: write `razie Annesburg` in the panel/alert channel (the bot reacts with a check mark).

## What the bot posts
- the panel (edited, never reposted)
- 10 minutes before the end: one short warning with an @Razie ping (deleted when the timer ends)
- when the timer ends: one alert with an @Razie ping and the buttons **A fost razie, reporneste 3h** / **N-a fost** (with undo). If someone is in voice the bot joins, plays `assets/siren.wav`, then your recording.
Everything else (confirmations, menus, history) is private to whoever pressed the button.

## Commands (admin)
- `/razie panou`, `/razie sunet` (upload your "Atentie, razie!" recording, mp3/wav/ogg/m4a max 3 MB), `/razie test` (bot joins your voice channel and plays everything)
- `/cleanup`: deletes all roles (except @Razie) and every channel except voice channels, the RDR2 category, welcome, general and text channels in the Voice category. Asks for confirmation. Delete `src/commands/cleanup.js` when you don't need it anymore.

## Setup
- Commands register automatically at startup (set `GUILD_ID`). Start command: `npm start`.
- Developer Portal -> Bot: enable **Message Content Intent**.
- Bot permissions: View Channel, Send Messages, Connect, Speak, Manage Roles, Manage Messages (optional, pins the panel + deletes the warning), Add Reactions (optional).
- The bot's role must be above @Razie in Server Settings -> Roles.
- Railway: add a **Volume** mounted at `/app/data`, otherwise a redeploy loses timers, history and the uploaded recording.
- Optional env: `RAZIE_MINUTES` (default 180), `RAZIE_WARN_MINUTES` (default 10), `DATA_DIR`.

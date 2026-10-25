# MUIE bot

## Razie (RDR2 raid timers)
Everything works with buttons. Post the panel once with `/razie panou`:

- **Porneste timer**: pick a saved zone from a menu, or "Alta zona / minute ramase" (modal) to type a new zone and, if you started late, the minutes that are left.
- **Anuleaza**: menu with the active timers (or all of them).
- **A venit mai repede**: the raid came before the timer ended. Logs it as confirmed now and restarts the full cooldown from this moment (also a button on the start and warning messages; has an undo button).
- **Istoric / Statistici**: last raids and per-zone stats.
- **Alerte on/off**: get / drop the @Razie role.
- **Setari** (admin): voice siren on/off, 10 minute warning on/off, notification channel, remove saved zones.
- The panel updates itself every minute (progress bar, colour red/yellow/green by time left).

Writing `razie Annesburg` in any channel (or `/razie start`) does the same as the button. Starting a zone that already has a timer **replaces it** (fixes a mistake). The start message has **Anuleaza timerul** / **Reporneste** buttons.

Timeline of a timer: start -> 10 min before: warning + @Razie ping -> end: "Posibila razie" + @Razie ping, buttons **A fost razie, reporneste 3h** / **N-a fost** (and an undo button if you press wrong), the bot joins voice, plays `assets/siren.wav`, then your recording.

Slash commands: `/razie start|anuleaza|panou|canal|sunet|test`, `/ping`, `/cleanup`.
- `/razie sunet` (admin): upload your "Atentie, razie!" recording (mp3/wav/ogg/m4a, max 3 MB)
- `/razie test` (admin): the bot joins your voice channel and plays everything
- `/cleanup` (admin): deletes all roles (except @Razie) and every channel except voice channels, the RDR2 category, welcome, general and text channels in the Voice category. Asks for confirmation.

## Setup
- Commands register automatically at startup (set `GUILD_ID`). Start command: `npm start`.
- Developer Portal -> Bot: enable **Message Content Intent**.
- Bot permissions: View Channel, Send Messages, Connect, Speak, Manage Roles (for @Razie), Manage Messages (optional, pins the panel).
- The bot's role must be above @Razie in Server Settings -> Roles.
- Railway: add a **Volume** mounted at `/app/data`, otherwise a redeploy loses timers, history and the uploaded recording.
- Optional env: `RAZIE_MINUTES` (default 180), `RAZIE_WARN_MINUTES` (default 10), `DATA_DIR`.

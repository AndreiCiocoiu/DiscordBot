# MUIE bot

## Razie (RDR2 raid timers)
Write `razie Valentine` in any channel (or `/razie start`) to start a 3 hour timer for that zone.
- 10 minutes before the end: "Razie posibila in ~10 minute" + ping @Razie
- When it ends: "Posibila razie" + ping @Razie, with buttons **A fost razie, reporneste 3h** / **N-a fost**; the bot also joins the voice channel (yours, else the fullest one), plays `assets/siren.wav`, then your recording
- `/razie lista`, `/razie anuleaza <zona>`
- `/razie alerta`: get / drop the @Razie role (the role is created automatically; also a button on the panel)
- `/razie panou` (admin): live panel in this channel, pinned and updated automatically
- `/razie istoric`, `/razie stats`: history and per-zone statistics
- `/razie sunet` (admin): upload your "Atentie, razie!" recording (mp3/wav/ogg/m4a, max 3 MB)
- `/razie test` (admin): the bot joins your voice channel and plays everything
- `/razie canal <#canal>` (admin): where notifications go (default: where the timer was started)

## Other commands
- `/ping`
- `/cleanup` (admin): deletes all roles (except @Razie) and every channel except voice channels, the RDR2 category, welcome, general and text channels in the Voice category. Asks for confirmation.

## Setup
- Commands register automatically at startup (set `GUILD_ID`). Start command: `npm start`.
- Developer Portal -> Bot: enable **Message Content Intent**.
- Bot permissions: View Channel, Send Messages, Connect, Speak, Manage Roles (for @Razie), Manage Messages (optional, pins the panel).
- Drag the bot's role above @Razie in Server Settings -> Roles if the role can't be handed out.
- Railway: add a **Volume** mounted at `/app/data`, otherwise a redeploy loses timers, history and the uploaded recording.
- Optional env: `RAZIE_MINUTES` (default 180), `RAZIE_WARN_MINUTES` (default 10), `DATA_DIR`.

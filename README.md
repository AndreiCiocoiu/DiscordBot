# GamePortal 2.0 — Railway deployment

Upload this repository **including `discord-bot/`**. Both starting from the root and from `discord-bot/` work.

**Railway settings (simple):** Root Directory `/`, Build Command `npm ci`, Start Command `npm start`. If your current start command is `npm run deploy`, that works too (it now starts the actual server rather than exiting).

**Alternative:** Root Directory `/discord-bot`, Build Command `npm ci`, Start Command `npm start`.

**Railway Variables:** `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`, `WEB_GUILD_ID` (strongly recommended), optionally `WEB_URL`, `SESSION_SECRET`, `ENABLE_PRESENCE_TRACKING=1`, `GAME_BRIDGE_SECRET`. Add a persistent Railway Volume mounted at `/app/data` or specify `DATA_DIR` for persistence.

**OAuth2:** register `https://YOUR_RAILWAY_DOMAIN/auth/callback` in Discord Developer Portal → OAuth2 → Redirects.

**Discord Presence:** Enable the privileged **Presence Intent** in Discord Developer Portal → Bot BEFORE setting `ENABLE_PRESENCE_TRACKING=1`. Guild Voice States is enabled by default. Members must enable recording in their profile; public ranking is a separate opt-in.

**RedM Persona Non Grata:** Copy `discord-bot/integrations/gameportal_bridge` to your RedM server resources and add `ensure gameportal_bridge` to `server.cfg`. Configure:

```
set gameportal_bridge_url "https://YOUR_RAILWAY_DOMAIN"
set gameportal_bridge_secret "SAME_LONG_SECRET_AS_RAILWAY_GAME_BRIDGE_SECRET"
ensure gameportal_bridge
```

Only Discord identifiers exposed by RedM are reported. The portal counts RedM time only for members who agreed to tracking in Profile. The first heartbeat starts the session; the next minute starts crediting time. The bridge requires administrator access to the actual RedM server. Without it the Persona Non Grata-only leaderboard stays empty (Discord game presence is separate).

Read `discord-bot/README.md` for detailed features, limitations and commands.

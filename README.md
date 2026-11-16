# GamePortal 2.0 — Railway deployment

Upload this repository **including `discord-bot/`**. Both starting from the root and from `discord-bot/` work.

**Railway settings (simple):** Root Directory `/`, Build Command `npm ci`, Start Command `npm start`. If your current start command is `npm run deploy`, that works too (it now starts the actual server rather than exiting).

**Alternative:** Root Directory `/discord-bot`, Build Command `npm ci`, Start Command `npm start`.

**Railway Variables:** `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`, `WEB_GUILD_ID` (strongly recommended), optionally `WEB_URL`, `SESSION_SECRET`, `ENABLE_PRESENCE_TRACKING=1`, `GAME_BRIDGE_SECRET`. Add a persistent Railway Volume mounted at `/app/data` or specify `DATA_DIR` for persistence.

**OAuth2:** register `https://YOUR_RAILWAY_DOMAIN/auth/callback` in Discord Developer Portal → OAuth2 → Redirects.

**Discord Presence:** Enable the privileged **Presence Intent** in Discord Developer Portal → Bot BEFORE setting `ENABLE_PRESENCE_TRACKING=1`. Voice tracking uses Guild Voice States. Members observed in the configured community enter rankings automatically. Members can opt out in Profile or through `/statistici` on Discord. Activity prior to deployment cannot be reconstructed.

**RedM Persona Non Grata:** Copy `discord-bot/integrations/gameportal_bridge` to your RedM server resources and add `ensure gameportal_bridge` to `server.cfg`. Configure:

```
set gameportal_bridge_url "https://YOUR_RAILWAY_DOMAIN"
set gameportal_bridge_secret "SAME_LONG_SECRET_AS_RAILWAY_GAME_BRIDGE_SECRET"
ensure gameportal_bridge
```

Only Discord identifiers exposed by RedM are reported. The portal counts reported RedM playtime automatically unless a player has opted out. The first heartbeat starts the session; the next minute starts crediting time. The bridge requires administrator access to the actual RedM server. Without it the Persona Non Grata-only leaderboard stays empty (Discord game presence is separate).

Read `discord-bot/README.md` for detailed features, limitations and commands.

## Design: reductions first

The site's primary navigation is **Acasă · Reduceri · Gratis · Anunțuri · Wishlist**. The homepage shows deals first, including a contextual recommendation row; small rankings and events cards only appear after the deals. The full community feature set lives under a single low-emphasis `/#/comunitate` link near the footer and the homepage preview. It is grouped into three expandable categories rather than nine competing main pages. Old deep links remain available for bookmarks and Discord bot commands.

## Privacy notice and controls

Game activity and RedM player IDs are collected for the configured server without a mandatory website checkbox, **but Discord membership is not itself legal consent**. The operator needs an applicable legal basis and must give members transparent information about the data and its purpose before enabling collection. Announce the tracking in Discord server rules / an announcement. The site displays an explanation on the community page and in Profiles.

Members can use `/statistici` to opt out, reactivate, or erase data. They can also opt out or delete data in Profile. Deleting data persists the exclusion so a fresh heartbeat cannot silently re-enrol them. DM alerts remain optional and off by default. Previously disabled profiles remain disabled rather than silently overriding a past privacy choice.

Rankings are only as complete as the Discord Presence Intent, cached voice/presence events, and the RedM bridge allow. This build does not provide a legal compliance determination for your specific server.

**Fonts:** The distributable uses system font fallbacks; no font binaries are included.

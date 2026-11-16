# Portal de jocuri

Un site cu reduceri la jocuri, jocuri gratuite și anunțuri, plus un bot de Discord care le trimite pe server. Site-ul e servit chiar de bot, deci un singur deploy.

## Ce face

**Pe site**
- **Acasă**: ofertele momentului (se schimbă singure), jocurile gratuite de acum, ultimele anunțuri, cele mai mari reduceri.
- **Reduceri**: toate ofertele din Steam, GOG, Epic, Humble, Fanatical și alte magazine. Filtre după nume, magazin, preț, reducere minimă, recenzii.
- **Fișa jocului**: prețul în fiecare magazin și cel mai mic preț din istorie.
- **Gratis**: jocurile gratuite de la Epic (acum și cele care urmează) și reducerile de 100% din alte magazine.
- **Anunțuri**: adminii scriu anunțuri pe site; opțional ajung și într-un canal de Discord.
- **Wishlist**: alegi un joc și un preț țintă; când prețul ajunge acolo, botul îți scrie pe Discord (mesaj privat).
- **Căutare** (tasta `/`): orice joc după nume, chiar dacă nu e la reducere.
- Monedă: dolari (prețul real) sau, aproximativ, euro, lire, lei.

**Pe Discord**
- `/reduceri [pret_max] [reducere_min]`, `/gratis`, `/joc nume`, `/portal`
- zilnic, la ora aleasă, cele mai bune zece oferte în canalul ales
- anunț când apare un joc gratuit nou la Epic

Oricine poate vedea site-ul. Login cu Discord este necesar pentru wishlist și funcțiile personalizate din Community Hub. Admin pe site e cine are **Manage Server** pe serverul botului (sau e trecut în `ADMIN_IDS`).

## Instalare (Railway)

1. Pune fișierele în repo și dă push.
2. Variabile: `DISCORD_TOKEN` și `DISCORD_CLIENT_SECRET` (Developer Portal, OAuth2).
3. Settings, Networking: Generate Domain.
4. Developer Portal, OAuth2, Redirects: `https://<domeniul-tău>/auth/callback`.
5. Un Volume montat la `/app/data`, altfel anunțurile, wishlist-urile și setările se pierd la restart.
6. Pe site, intră cu Discord, deschide meniul contului, apoi **Setări**: alege canalul pentru reduceri și cel pentru anunțuri.

Pentru postările în canale, botul are nevoie de View Channel, Send Messages și Embed Links. Tracking-ul opțional al jocurilor folosește intent-ul privilegiat Presence Intent (vezi secțiunea GamePortal 2.0).

Variabile opționale: `SITE_NAME` (numele din colțul paginii, implicit DROPZONE), `WEB_URL`, `WEB_GUILD_ID` (dacă botul e pe mai multe servere), `ADMIN_IDS`, `SESSION_SECRET`, `WEB_DISABLED=1`.

## De unde vin datele

- **Reduceri și prețuri**: API-ul public CheapShark. Prețurile sunt în dolari; linkurile trec prin redirectul lor.
- **Jocuri gratuite**: feed-ul public de promoții al Epic Games Store.
- **Curs valutar**: Frankfurter (cursuri de referință zilnice), doar pentru afișarea aproximativă.

Răspunsurile sunt ținute în memorie câteva minute, ca botul să nu ceară aceleași date la fiecare vizită. Dacă o sursă nu răspunde, site-ul arată ultimele date bune.

## Fișiere

- `index.js` pornește site-ul, apoi botul
- `src/web.js` site, login, API
- `src/bot.js` comenzi, trimiteri zilnice, alerte
- `src/deals.js`, `src/free.js`, `src/rates.js` sursele de date
- `src/news.js`, `src/watch.js`, `src/store.js` anunțuri, wishlist, salvare (`data/portal.json`)
- `web/` interfața

## GamePortal 2.0 – Community Hub

The community section adds:

1. Leaderboards (7 days / 30 days / all-time; games, Persona Non Grata RedM, Discord voice), opt-in only.
2. Most played games and live Discord status display (requires enabled privileged Presence Intent).
3. Public member profiles and individually configured favorites, achievements (1/10/50/100/500 hours), streaks (10+ minutes/day).
4. Community analytics: 30-day activity histogram, current players, popular games.
5. Looking for Group: member-generated teams, capacity, join/leave, expiration, game-matched notifications.
6. Events: admin-created events, RSVPs, capacity and 1-hour reminders.
7. Game of the Week: admin-created polls, per-account voting, percentage results.
8. Release calendar: manual admin-created game/DLC/update entries and game-favorite reminders.
9. Price history graph in every game details sheet: recorded minimum price from CheapShark from the first site visit, at most one observation per six hours. Not a historical backfill.
10. Personalized in-site notification inbox and optional Discord DM alerts. Users must enable DMs in Profile.
11. Tournament hub: registration, admin starts bracket, automatic byes, admin scores winners, champion.
12. Game recommendations using favorites, community playtime and current deals; **heuristic**, not AI-generated.
13. Optional **real RedM server** playtime: `integrations/gameportal_bridge` reports active Discord IDs through an authenticated heartbeat. Requires access to the RedM host and an identical secret on both sides. Counts no time until a user opts in.

**New slash commands:** `/top [perioada]`, `/profil`, `/evenimente` plus the original commands.

### Data & privacy

- No playtime is recorded for players until they actively enable tracking in Profile.
- A separate toggle controls whether activity and profile appear publicly in leaderboards.
- Members can disable tracking, disable private DM alerts and erase their Community Hub data in Profile.
- The existing wishlist and announcements live in `portal.json`; GamePortal 2.0 community data also uses that file, requiring a **Railway Volume**. No PostgreSQL integration is included. Large communities should migrate it to PostgreSQL before reaching substantial scale.
- 'All-time' uses the accumulated history since consent/first tracking, not hours spent before installation. Overall gaming time uses the greater of Discord gaming hours or RedM gaming hours to avoid simply double-counting the same RDR2 session; it is therefore an estimate when the two sources cover different sessions.
- Discord statuses reveal a **game name**, but not whether someone is playing on the Persona Non Grata server. The RedM bridge is necessary for specific server time.
- Calendar entries are manually entered, not an automatically synchronized commercial release feed.
- DMs can fail when a user's privacy settings prevent bot messages.

**Railway fix:** The old issue `npm error Missing script: "deploy"` can be resolved with this ZIP. Both the root and the `discord-bot/` package have a valid `deploy` script that starts the application, not just a no-op message. Choose Root Directory `/` and Start Command `npm start` (recommended).

Set `ENABLE_PRESENCE_TRACKING=1` *only* after enabling Presence Intent in Discord Developer Portal. Otherwise Discord disconnects the bot with an intent error.

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

Oricine poate vedea site-ul. Login cu Discord e nevoie doar pentru wishlist. Admin pe site e cine are **Manage Server** pe serverul botului (sau e trecut în `ADMIN_IDS`).

## Instalare (Railway)

1. Pune fișierele în repo și dă push.
2. Variabile: `DISCORD_TOKEN` și `DISCORD_CLIENT_SECRET` (Developer Portal, OAuth2).
3. Settings, Networking: Generate Domain.
4. Developer Portal, OAuth2, Redirects: `https://<domeniul-tău>/auth/callback`.
5. Un Volume montat la `/app/data`, altfel anunțurile, wishlist-urile și setările se pierd la restart.
6. Pe site, intră cu Discord, deschide meniul contului, apoi **Setări**: alege canalul pentru reduceri și cel pentru anunțuri.

Botul are nevoie doar de permisiunile View Channel, Send Messages și Embed Links în canalele alese. Nu folosește intent-uri privilegiate.

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

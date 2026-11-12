# Sahara Cartel v7 — modificări de backend (separat de design)

## Ce am adăugat

Am integrat **un modul nou, izolat**, `src/utils/familyHub.js`, care gestionează nouă secțiuni website. Backend-ul existent al botului nu a fost rescris. Sunt păstrate funcțiile și comenzile Discord, calculul punctelor, ranks, voice, raid timers, crafting-ul existent și autentificarea OAuth2.

### Fișiere de backend

- **NOU:** `src/utils/familyHub.js` — stocare, validare și operațiuni pentru Cartier
- **MODIFICAT:** `src/utils/web.js` — 4 completări: importul modulului nou, servirea fișierelor `hub.js` și `hub.css`, un handler `GET /api/hub` și un handler `POST /api/hub`. Pentru aceste două rute, identitatea și rolurile sunt reverificate din Discord înainte de fiecare cerere.
- **NEMODIFICATE:** `index.js`, `src/utils/points.js`, `src/utils/craft.js`, `src/utils/razii.js`, `src/utils/sessions.js` și restul fișierelor botului.

### Endpoint-uri noi

`GET /api/hub` — citește starea autorizată a tuturor modulelor pentru utilizatorul curent.

`POST /api/hub` — primește JSON cu `action` și câmpurile necesare. Acțiuni permise:

| Modul | Acțiuni |
|---|---|
| War Room | `war.create`, `war.join`, `war.status` |
| Contract Board | `contract.create`, `contract.claim`, `contract.submit`, `contract.review`, `contract.close` |
| Member Dossier | doar citire; combină membrii existenți cu datele din Cartier |
| Family Treasury | `treasury.add` |
| Crafting Orders | `order.create`, `order.status` |
| Event Calendar | `event.create`, `event.rsvp`, `event.status` |
| Family Voting | `poll.create`, `poll.vote`, `poll.close` |
| Activity Feed | automat din acțiunile de mai sus; doar citire |
| Notifications Center | notificări automate din Cartier, `notice.read` |

### Permisiuni

1. Fiecare request necesită autentificare Discord existentă, verificarea apartenenței la server și roluri actuale.
2. Doar **membrii înregistrați ai bandei** și liderii pot citi și utiliza modulele. Nu este un API public.
3. Numai liderii pot publica operațiuni, contracte, evenimente, voturi și tranzacții financiare și pot aproba contractele sau modifica statusuri.
4. Membrii pot confirma participarea, accepta/trimite contracte, crea comenzi și vota.
5. Membrii văd doar **propriile comenzi**; liderii pot vedea toate. Notificările sunt returnate doar utilizatorului conectat. Rezultatele voturilor sunt agregate; identitatea votanților nu este returnată în interfață.
6. Sunt păstrate regulile de origin check, cookies semnate `HttpOnly`, `SameSite=Lax` și limita de 50 KB pentru cererile JSON.

### Stocare persistentă

Modulul creează **`family-hub.json`** în:

1. `DATA_DIR` dacă este definit;
2. altfel `RAILWAY_VOLUME_MOUNT_PATH` dacă există;
3. altfel `./data/` în proiect.

Datele sunt separate pe `guildId` și sunt scrise prin înlocuire atomică (fișier temporar + rename). Pentru producție, **volumul Railway trebuie să fie montat pe folderul persistent**; altfel datele adăugate pot dispărea la un redeploy/restart al containerului. Fă backup la `family-hub.json` înainte de migrare.

**Nu este nevoie de o bază de date nouă, pachet npm nou, cheie API sau token nou.** Se folosește mecanismul Discord OAuth existent.

### Ce NU face această versiune în mod automat

- Aprobarea unui contract **nu acordă automat puncte** în sistemul existent. Liderul le acordă manual din pagina Lideri; astfel nu riscăm dublări sau afectarea clasamentului.
- Tranzacțiile din trezorerie **nu scad materialele din crafting** și nu reprezintă date live din RDR2 — sunt evidențe completate de lideri.
- Notificările sunt **în website**, nu Discord DM, push sau ping automat. Sunt afișate când deschizi sau reîmprospătezi Cartierul.
- Comenzile de crafting sunt cereri urmărite în website, nu execută automat crafting în joc.
- Activitatea veche a botului (dinainte de v7) nu este rescrisă/importată în Jurnal. Jurnalul este pentru acțiunile noi din Cartier.

### Deployment în Railway

1. Fă backup la proiect și la volumul persistent existent.
2. Publică întregul folder `discord-bot` din arhiva v7, **fără să înlocuiești variabilele tale din Railway**.
3. Păstrează `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` (dacă există), `WEB_GUILD_ID` (dacă există), `WEB_URL` (dacă există) și configurația volumului.
4. Pornește normal proiectul cu `npm ci && npm start` (sau metoda de deploy folosită deja).
5. Intră în website cu Discord, deschide **Cartier** și verifică cu un cont membru și unul lider.
6. Verifică persistența printr-o operațiune de test, un restart și reîncărcarea paginii.

### Testare realizată

- Teste Node pentru toate acțiunile de bază, permisiuni, date separate, vot secret și persistență în fișier.
- Teste Chromium cu date demonstrative pe desktop și mobil pentru cele nouă pagini, formulare, înscrieri, aprobare, tranzacții, statusuri, voturi, dosar și notificări.
- Teste de regresie în browser pentru Clasament, Banda, profilul membrului și căutarea Ctrl+K.

**Notă:** testele Chromium folosesc date demonstrative locale; integrarea pe un server Discord/Railway real trebuie verificată după deployment, cu autentificare și roluri reale.

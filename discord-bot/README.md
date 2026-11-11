# MUIE bot

Slash commands: `/craft` (recipe with autocomplete) and `/catalog` for everyone, `/panou` (crafting / razii / sesiuni panel in the current channel) for admins only: Discord hides it from everyone else and the bot re-checks Manage Server. Everything else is buttons on pinned panels plus a few admin text commands. Any other leftover slash commands are removed at every start.

## Setup on a new server (admin, once)
1. Developer Portal -> your app -> **Installation / OAuth2 URL Generator**: scopes `bot` + `applications.commands`; permissions: View Channels, Manage Channels, Manage Roles, Send Messages, Embed Links, Attach Files, Read Message History, Manage Messages, Add Reactions, **Mention Everyone**, **View Audit Log**, **Manage Server**, Connect, Speak. Open the link and pick the server. (If the invite is refused, turn on **Public Bot** under Bot.)
2. Developer Portal -> Bot: enable **Server Members Intent** and **Message Content Intent** (the bot still starts without them, with fewer features).
3. In the server: drag the bot's role **above** @Razie and @Evenimente (Server Settings -> Roles).
4. Run **`/setup tot`** (admins only): it configures everything below in one go. Or one feature at a time: `/setup welcome`, `/setup evenimente`, `/setup anunturi`, `/setup log`, `/setup razii`, `/setup crafting`. Each one reuses the channel it already knows (or one with the right name), creates it only if missing, and posts the panel where needed. Add the `canal` option to use a channel you choose. `/setup fus Europe/Bucharest` sets the event time zone, `/setup info` shows what is set and which bot permissions are missing. (The old text command `server setup` does the same as `/setup tot`.)
5. Then, once: `razie sunet` with your audio file attached (the voice for raid alerts).
6. Test: `/anunt`, `/craft`, **Planifica eveniment**, the raid panel buttons.
7. Railway: one Volume mounted at `/app/data`. One bot instance serves any number of servers, each keeps its own settings.

Other admin text commands (Administrator only): `server aici welcome|evenimente|anunturi|log` (use the channel you are in), `server test` (preview the welcome banner), `server tz <fus>`, `server info`.

## Announcements
`/anunt` (admins): a box opens, write the title (optional) and the message. The bot posts it in the **anunturi** channel as a western parchment sheet signed with your name, with a hidden `||@everyone||` (grey bar that still pings). `/anunt ping:false` posts without the ping. Needs the Mention Everyone permission for the bot in that channel.

## Welcome
When someone joins, the bot posts in the welcome channel an embed with an **animated banner** (sunset, embers, glowing avatar ring, gold shimmer) with their name and member number, plus buttons for the razie and session notifications. During a join flood it falls back to text only.

## Events (formerly Sessions)
In the evenimente channel press **Planifica eveniment**: what you play + when (`azi 21:00`, `maine 20:30`, `sambata 22:00`, `28.10 21:00`) + optional details. The bot posts one message with **Vin / Poate / Nu vin** (press again to take it back) and posts a western parchment sheet with a hidden `||@everyone||` (grey bar that still pings); the @Evenimente role stays for reminders (an old @Sesiuni role is renamed automatically). 30 minutes before it pings everyone who said Vin or Poate. The host or an admin can cancel it. The message is deleted 3 hours after the start. Times show in everyone's own time zone.

## Banda: ranguri și puncte (Sahara Cartel)
Evidența membrilor (Angajat, Asociat, Membru) și puncte pe săptămână. Configurare: `/setup puncte` (canalul unde se postează clasamentul duminică), apoi setările cu `/banda config`.
- **Cine dă puncte**: adminii și rolurile numite **Lider** / **Co-Lider** (sau rolurile alese cu `/banda config rol_lider rol_colider`).
- `/add <rang> @nume` adaugă pe cineva; botul ține data intrării și a fiecărui rang. Dacă există roluri Discord numite Angajat / Asociat / Membru, le pune/scoate singur.
- `/puncte da @nume <mină|task|prezență|organizat|bonus> [cantitate] [nota] [si: @a @b]` dă puncte (mai multe persoane odată cu `si`); `/puncte anuleaza <id>` șterge o intrare din săptămâna curentă. Toate se scriu în adminlog.
- **Voice**: automat, 1 minut pe minut cât ești pe voice cu cel puțin încă o persoană, fără deafen, în afara canalului AFK. Valoare implicită 2 puncte/oră, maxim 40/săptămână.
- Valori implicite: mină 10, task 10, prezență eveniment 5, eveniment organizat 15. Praguri pe săptămână: Membru 100, Asociat 60. Locuri: Membru 10, Asociat 4. Toate se schimbă din `/banda config`.
- **Săptămâna**: luni 00:00 – duminică 23:59, ora Europe/Bucharest. Duminică la miezul nopții botul arhivează săptămâna, pornește de la zero și postează clasamentul. `/clasament saptamana:45` arată orice săptămână veche.
- **Insigna**: pentru a ține Asociat/Membru ai nevoie de pragul rangului. După 2 săptămâni la rând sub prag (`toleranta`) ești retrogradat automat cu un rang (poate fi oprit cu `retrogradare:false`). Săptămâna în care ai intrat sau ai schimbat rangul și concediile (`/banda concediu @nume zile`) nu dau avertismente.
- **Avansare**: `/banda rang @nume <rang>` cere pragul rangului țintă 2 săptămâni la rând și un loc liber (adminii pot ocoli cu `forta:true`). Clasamentul de duminică arată cine poate avansa.
- `/profil [@nume]` arată rangul, vechimea, punctele din săptămâna asta și ultimele săptămâni; `/banda lista` arată cine e în bandă și locurile. Datele sunt în `points.json` din volumul `/app/data`.

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

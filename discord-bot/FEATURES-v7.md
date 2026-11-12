# Sahara Cartel — Family Hub v7

V7 păstrează designul original, meniul clasic, bannerul Sahara, clasamentul, profilurile, crafting-ul și panoul liderilor din v6. Adaugă pagina **Cartier**, cu 9 module într-o singură navigație compactă. Meniul este scrollabil pe telefon.

| Modul | Funcții |
|---|---|
| War Room | Liderul creează o operațiune, alege data/locul și capacitatea; membrii se înscriu/renunță; liderul schimbă starea |
| Contract Board | Liderul publică misiuni cu recompense și termen; membrii le acceptă și trimit spre verificare; liderul aprobă/respinge |
| Member Dossier | Dosar din datele existente, puncte, rang, vechime, participări, contracte și jurnal; deschide profilul complet existent |
| Family Treasury | Sold și registru pentru aur, bani și materiale; depuneri/retrageri operate de lider cu verificarea soldului |
| Crafting Orders | Solicitări de arme din catalogul actual, cantități, note și urmărirea statusului |
| Event Calendar | Evenimente viitoare și RSVP (Particip, Poate, Renunță), limită de locuri |
| Family Voting | Vot cu 2–8 opțiuni, termen, un vot/membru modificabil, rezultate agregate și închidere de lider |
| Activity Feed | Jurnal al acțiunilor noi din Cartier, cu filtrare pe tip |
| Notifications Center | Notificări în website despre operațiuni, contracte, comenzi, evenimente și rezultate relevante, marcabile ca citite |

## Fișiere frontend noi

- `web/hub.js` — UI și interacțiuni pentru cele nouă module
- `web/hub.css` — stiluri bazate pe designul existent

## Fișiere frontend actualizate

- `web/index.html` — include doar noile resurse
- `web/app.js` — conectează noul tab Cartier, reîmprospătează datele Hub și integrează secțiunile în Ctrl+K

Pentru diferențele exacte de backend, permisiuni, stocare și deploy, citește [`BACKEND-CHANGES-v7.md`](BACKEND-CHANGES-v7.md).

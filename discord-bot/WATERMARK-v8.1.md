# Sahara Cartel v8.1 — Watermark personalizat

## Ce face
- Pe toate paginile private afișează un watermark diagonal repetat, compus din `SAHARA · username` și `DISCORD ID`.
- În colțul dreapta-jos afișează o etichetă discretă cu nume și ID, pentru atribuirea capturilor de ecran.
- Valorile vin din `S.state.me`, obținut după autentificarea Discord și autorizarea accesului.
- Când nu există o sesiune validă sau accesul a fost respins, watermark-ul este ascuns.
- Funcționează și pe mobil, fără să blocheze clickurile, scrollul sau formularele.
- Numele și ID-ul sunt afișate prin `textContent`; nu se folosesc inserări HTML nesigure.

## Fișiere modificate
- `web/index.html` — două elemente pentru watermark (fundal și etichetă).
- `web/style.css` — stiluri responsive și watermark discret.
- `web/app.js` — construirea watermark-ului din contul conectat, actualizat la render.

## Securitate și limitări
Un watermark **nu poate preveni screenshot-urile**. În browser, utilizatorul poate ascunde elementele din Developer Tools, decupa sau edita imaginea ori fotografia ecranul din exterior. Este o măsură de descurajare și atribuire vizuală, nu o protecție garantată împotriva scurgerilor. Sistemul existent de autentificare și verificare a permisiunilor rămâne măsura principală de securitate.

## Instalare
Publică ZIP-ul complet folosind același deploy ca v8. Nu sunt necesare pachete sau variabile de mediu noi. Păstrează volumul persistent și configurația Discord.

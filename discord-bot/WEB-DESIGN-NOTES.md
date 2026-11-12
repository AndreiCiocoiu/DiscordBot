# Sahara Cartel — The Dynasty Edition

Refacere **exclusiv vizuală** a site-ului. Backend-ul Discord, permisiunile, baza de date, logica de puncte, crafting-ul, comenzile și rutele API nu au fost modificate.

## Fișiere actualizate
- `web/index.html` — layout nou, sidebar, poster principal, galerie de statistici, header și footer fără textele decorative din versiunea anterioară.
- `web/edition.css` — noul strat de design (culoare ciocolatiu/aramă, responsive, tranziții, animații și componentele paginilor). `web/style.css` rămâne baza.
- `web/app.js` — **doar** `paintChrome()` a fost actualizată pentru titlurile în română, numărul secțiunii și câmpurile de prezentare. Toate acțiunile, apelurile API și rutarea sunt intacte.

## Publicare
Instalează acest proiect complet ca pe cel anterior la Railway/GitHub, păstrând setările și volumul persistent. Nu sunt necesare librării noi, API-uri noi sau modificări la OAuth.

## Demo
Fișierul HTML separat inclus în conversație se poate deschide local în browser și conține date **exemplu**, nu datele reale ale botului. Acțiunile de scriere din demo sunt dezactivate. Pe site-ul deployat funcționează backend-ul inițial.

## Accesibilitate
Responsive pentru desktop, tabletă și mobil. Animațiile respectă `prefers-reduced-motion`. Navigarea, profilele, formularul și tab-urile își păstrează interacțiunile.

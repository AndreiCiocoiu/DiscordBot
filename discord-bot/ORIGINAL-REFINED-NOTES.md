# Sahara Cartel — Original Refined (v5)

Această ediție este făcută pornind **direct din `DiscordBot (18).zip`**, nu din variantele vizuale anterioare.

## Ce s-a păstrat
- Bannerul original `assets/sahara.jpg`, efectele de praf/particule și parallax.
- Navigarea aurie și stilul original Western/Arabian.
- Clasamentul original cu podium, medalioane, bare de progres și arhivă.
- Membrii, profilele cu istoricul lor, crafting-ul și panoul Lideri.
- Autentificarea Discord, rutele API, logica de puncte, comenzile, drepturile și datele serverului — **neschimbate**.

## Modificări (doar pe frontend)
- `web/style.css` — pagina este acum lată pe tot ecranul, păstrând stilul original, cu spațiere responsivă și un rezumat compact.
- `web/index.html` — un singur container UI pentru rezumatul săptămânal și metadate browser.
- `web/app.js` — rezumatul săptămânal (date existente `/api/state`), buton pentru profilul propriu, căutare după nume și filtru după rang în **Banda**. Nu a fost introdus niciun endpoint nou.

## Previzualizare vs. site real
Preview-ul HTML standalone are date demonstrative și blochează acțiunile care modifică starea. Arhiva ZIP folosește **în continuare backend-ul și datele reale**, cu autentificare Discord pe serverul tău.

## Publicare
Poți înlocui proiectul la Railway/GitHub cu conținutul arhivei, păstrând variabilele de mediu și volumul persistent. Nu e nevoie de dependențe suplimentare.

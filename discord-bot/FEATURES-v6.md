# Sahara Cartel — funcții adăugate în v6

Proiectul este pornit din v5 Original Refined; toate modificările sunt doar în `web/index.html`, `web/app.js` și `web/style.css`. `index.js`, `src/`, API-urile și comenzile Discord rămân IDENTICE.

- Ctrl/Cmd+K: command palette, navigare și căutare rapidă în membrii disponibili. Nu expune pagina Lideri utilizatorilor fără permisiune.
- Compară doi membri în clasamentul săptămânii curente sau în arhiva selectată; deschis doar la cerere.
- Export CSV pentru clasament, disponibil doar liderilor. Datele sunt deja în răspunsul API pentru utilizatorii autorizați.
- Preferate pentru membri, cu filtru în Banda și buton în profil, memorate local per cont de browser. Nu se sincronizează între dispozitive.
- Crafting: proiectul de comandă se salvează local, per cont, și poate fi exportat într-un fișier text după calcul. Calculele rămân pe API-ul original.

Comenzile de scriere din demo sunt blocate. Browserul web real folosește aceleași rute `/api` originale.

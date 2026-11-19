# Diesel Union: portalul VTC-ului

Site și bot de Discord pentru Diesel Union, VTC pe TruckersMP. Cursele, kilometrii și membrii vin din **Trucky**. Site-ul e servit chiar de bot, deci un singur deploy pe Railway.

## Ce are

- **Acasă**: autostradă animată, contoare cu kilometrii, cursele, tonele și șoferii lunii, următorul convoi, topul lunii, ultimele livrări.
- **Șoferi**: toți membrii din Trucky, cu rang (după kilometri totali), rolul din Trucky și profil: statistici, ultimele șase luni, ultimele curse.
- **Curse**: jurnalul livrărilor, cu filtre (perioadă, joc, oraș, marfă, șofer).
- **Clasament**: săptămâna, luna sau total, după kilometri, venit sau curse.
- **Convoaie**: staff-ul le adaugă pe site, șoferii confirmă (vin / poate / nu vin), botul anunță pe Discord și trimite un mesaj privat cu o oră înainte. Apar și evenimentele VTC-ului de pe TruckersMP.
- **Aplică**: formular de recrutare (cu login Discord). Staff-ul acceptă sau respinge; candidatul primește răspuns în privat, iar la acceptare poate fi adăugat automat în compania din Trucky.
- **Contul meu**: fiecare șofer își leagă contul de Discord de numele din Trucky (verificat cu Steam ID).
- **Staff**: aplicări, starea legăturii cu Trucky, setări (canale, ranguri, nume, motto).

Comenzi pe Discord: `/profil`, `/top`, `/convoi`, `/aplica`, `/portal`. În canalul ales apare fiecare livrare și fiecare rang nou.

## Instalare pe Railway

1. Pune fișierele în repo și dă push.
2. Variabile:
   - `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`
   - `TRUCKY_COMPANY_ID`, `TRUCKY_TOKEN`, `TRUCKY_WEBHOOK_SECRET` (în Trucky: VTC Hub, Company Settings, tab-ul API; doar proprietarul companiei îl vede)
   - opțional `TMP_VTC_ID` (numărul din truckersmp.com/vtc/…), `STAFF_ROLE_ID`, `WEB_GUILD_ID`, `ADMIN_IDS`
3. Settings, Networking: Generate Domain.
4. Discord Developer Portal, OAuth2, Redirects: `https://<domeniu>/auth/callback`.
5. **Volume** montat la `/app/data`, altfel totul se pierde la restart.
6. În Trucky, Company Settings, API: adaugă webhook-ul `https://<domeniu>/trucky/webhook` și bifează evenimentele de curse (Job Completed, Canceled, Deleted) și de membri.
7. Pe site: intră cu Discord, meniul contului, **Staff**, **Setări**: alege canalele. În tab-ul **Trucky** apasă „Sincronizează acum”.

Staff pe site = cine are Manage Server pe server, rolul `STAFF_ROLE_ID` sau e în `ADMIN_IDS`. Setările le pot schimba doar adminii.

## Cum vin datele

- **Webhook Trucky**: fiecare cursă terminată ajunge imediat (semnătura e verificată cu `TRUCKY_WEBHOOK_SECRET`).
- **API Trucky**: la fiecare 5 minute botul citește ultimele curse, iar la 30 de minute lista de membri, ca să nu se piardă nimic cât a fost oprit.
- **TruckersMP API**: evenimentele VTC-ului, la 15 minute.

Totul se salvează în `data/diesel.json`. Rangurile se calculează din kilometri; le schimbi din Staff, Setări.

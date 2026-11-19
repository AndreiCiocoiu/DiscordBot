# Diesel Union: company portal

Website and Discord bot for Diesel Union, a VTC on TruckersMP. Jobs, distances and members come from **Trucky**. The site is served by the bot itself, so it is one deploy on Railway.

## What is on it

**Public (for newcomers)**
- **Home**: full-screen animated cover, live company stats, about us, the next convoy, ranks, how to join, requirements, FAQ.
- **Convoys**: upcoming convoys (RSVP needs a Discord login) and the company's TruckersMP events.
- **Apply**: recruitment form with Discord login. Staff accept or decline; the applicant gets a DM, and on accept they can be added to the company on Trucky automatically.

**Members only** (linked to a Trucky driver, the `MEMBER_ROLE_ID` role on Discord, or staff)
- **Drivers**: every member with rank (by total km), role from Trucky, profile with stats, last six months and recent jobs.
- **Jobs**: the logbook, filtered by period, game, city, cargo or driver.
- **Leaderboard**: week, month or all time, by km, income or jobs.

**Staff**: applications, Trucky connection status, settings (channels, ranks, name, tagline, about text, requirements, Discord invite).

Discord commands: `/profile`, `/top`, `/convoy`, `/apply`, `/portal`. The chosen channel gets every delivery and every rank-up; RSVPs get a DM an hour before a convoy.

## Discord server

Diesel Union is ETS2 only: ATS jobs are ignored everywhere.


Run `/setup` once (as an admin). The bot builds the whole server and can run it again at any time to repair it:

| Category | Channels | Who sees it |
|---|---|---|
| Start Here | 📝┃apply | Only newcomers |
| Finish Setup | ✅┃finish-setup | Only the **Approved** role |
| Truck Details | 🏷┃tag-name-and-colour, 🚚┃truck-colour, 🚛┃trailer-colour-and-livery | Members (read-only; text, colour and picture set in Website → Settings → Truck details) |
| Welcome to Diesel Union | 👋┃welcome, 📜┃discord-rules, 🏅┃ranks, 🔗┃diesel-links | Members (read-only) |
| Diesel Updates | 📰┃vtc-news, 🤎┃new-drivers-and-promotions | Members (read-only) |
| Convoys & Events | 🚛┃convoys, 📸┃convoy-photos, 📻 Convoy Radio 1/2 | Members |
| Logbook | 📦┃deliveries, ❌┃cancelled-jobs, 🏆┃weekly-top | Members (read-only, bot posts) |
| Community | 🇷🇴┃general-romana, 🇬🇧┃general-english, 📷┃screenshots, 🤖┃bot-commands, 🔊 Lounge | Members |
| Support | ❓┃help, 📅┃leave-of-absence | Members |
| Staff (CEO, Co-CEO, Management, HR Team, Staff) | 🗂┃applications, 💼┃staff-chat, 🧾┃bot-logs, 🔊 Staff Meeting | Staff |

Roles: CEO, Co-CEO, Management, HR Team, Event Team, Media Team, Staff, one role per rank (Diesel Legend … Rookie), Union Member (access), Approved (finishing setup).

How someone joins:
1. In #apply they press **Apply**, answer 5 questions, accept the rules.
2. The application lands in #applications with **Accept / Decline** buttons (also on the website).
3. Accepted: they get the **Approved** role and a DM with the Trucky company link, the TruckersMP VTC link (they apply there too), the Trucky download and the website.
4. When they are in the company on Trucky (same Steam account), in the VTC on TruckersMP (checked with the public TruckersMP API) and have logged in on the website, the bot gives **Union Member** and their rank role, removes Approved and welcomes them in #new-drivers-and-promotions. They can press **Check my progress** in #finish-setup; it also happens on its own.
5. Rank roles follow their kilometres. Leaving the company on Trucky removes access (switch it off in Settings).

Staff commands: `/verify member:@x` (check one person, `force:true` gives access anyway), `/setup hide_others:true` hides old channels from newcomers.

The bot needs **Administrator** (or Manage Roles + Manage Channels) and its role must be at the **top** of the role list, above every Diesel Union role.

## Railway setup

1. Put these files in the repo (replace the old ones) and push.
2. Variables:
   - `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`
   - `TRUCKY_COMPANY_ID`, `TRUCKY_TOKEN`, `TRUCKY_WEBHOOK_SECRET` (Trucky: VTC Hub, Company Settings, API tab; only the company owner sees it)
   - optional: `MEMBER_ROLE_ID` (Discord role that unlocks the members area), `STAFF_ROLE_ID`, `TMP_VTC_ID`, `WEB_GUILD_ID`, `ADMIN_IDS`
3. Settings, Networking: Generate Domain.
4. Discord Developer Portal, OAuth2, Redirects: `https://<domain>/auth/callback`.
5. A **Volume** mounted at `/app/data`, or everything is lost on restart.
6. In Trucky, Company Settings, API: add the webhook `https://<domain>/trucky/webhook` and tick the job events (Completed, Canceled, Deleted) and member events.
7. On the site: log in, account menu, **Staff**, **Settings**: pick the channels, add the Discord invite. In the **Trucky** tab press "Sync now".

Drivers can also link their own Discord account on the site (My account), using the Steam profile they use in Trucky.

## Where the data comes from

- **Trucky webhook**: every finished job arrives instantly (signature checked with `TRUCKY_WEBHOOK_SECRET`).
- **Trucky API**: every 5 minutes the latest jobs, every 30 minutes the member list, so nothing is missed while the bot is down.
- **TruckersMP API**: company events, every 15 minutes.

Everything is stored in `data/diesel.json`.

## Images

`assets/img/cover.webp` is the cover (1920×350) and `assets/img/logo-512.webp` the logo. A larger cover (at least 3840×1000) makes the full-screen hero sharper: replace `cover.webp` with the same layout.

# Diesel Union — The editorial redesign

This is a **frontend redesign of the uploaded Diesel Union project**, not a replacement backend or a static demo. Trucky job imports, the Discord bot, login, applications, convoys, member permissions and staff controls remain where they were.

## Design system

**Positioning:** a premium, welcoming European trucking collective. Deliberately avoids generic AI landing-page conventions: floating gradient boxes, giant dashboard mockups, intrusive particle systems, permanent loading splash screens and excessive glowing UI.

- **Palette:** espresso `#100d0a`, leather `#211912`, bronze `#bc8158`, cream `#f1e8db`, parchment `#b9a899`.
- **Typography:** bundled Big Shoulders Display (editorial headlines) + Archivo (interface, buttons, body). Fonts work offline; no external font requests.
- **Imagery:** the brown Volvo artwork from the Diesel Union branding assets supplied earlier in this project, optimised as WebP.
- **System:** 1px dividers, square-edged controls, controlled editorial whitespace, considered typographic rhythm, limited ornament.

## Changes delivered

- Full-bleed landing hero, careful text-safe overlays, visual hierarchy and a clear recruitment action.
- New masthead with descriptive brand line, simplified navigation and quieter active states.
- Statistics use real values from `/api/home`, no dummy counters or invented figures.
- Manifesto + four principles, full-width visual interlude, redesigned convoy and join sections, numbered journey and FAQ.
- Consistent look for jobs, driver cards, profiles, rankings, forms and staff tools through a separate non-destructive CSS layer.
- Purposeful animations: hero establish, slow cinematic drift, entrance reveals, button arrows, subtle hover response, scroll progress. Respects reduced-motion settings.
- No splash delay; compressed images, deferred scripts and local fonts for sensible performance.
- Organic discovery basics: descriptive metadata, Open Graph/Twitter preview, image preview, canonical URL, robots and sitemap.
- Better responsive composition from narrow mobile to large desktop; focus outlines, labels and keyboard-friendly controls maintained.

## Files

- `web/premium.css` — new visual layer, loaded after the existing `style.css`.
- `web/app.js` — only the homepage composition and reduced unused visual code; other VTC pages retain their existing behaviour.
- `web/index.html` — masthead, footer, metadata, no intro overlay.
- `src/web.js` — serves premium CSS and exposes `robots.txt`, `sitemap.xml` and fully qualified Open Graph URLs.
- `assets/img/hero-fleet.webp` (+ `-1400`), `convoy-detail.webp`, `social-share.webp` — real in-game photos of the company trucks, cleaned up and colour-graded.

## Deployment to Railway

Use the **`discord-bot`** folder as your Railway service root if keeping the ZIP folder structure. If you copy the contents of this folder to the repository root, use `/` instead.

- Install/build command: `npm install` (the provided source does not include a lockfile).
- Start command: `npm start`.
- Add your existing Discord, Trucky and TruckersMP variables unchanged as described in `README.md`.
- Use the persistent Railway volume (`/app/data`) for retained jobs and applications.
- Configure a custom domain and set `WEB_URL=https://your-domain.example` (replace with your real domain). Make the corresponding Discord OAuth2 redirect URI match.

## Realistic reach considerations

Design, responsive speed and shareable previews can improve trust and conversions, but cannot guarantee traffic or massive reach. Search-engine discovery is currently strongest for the homepage. This project uses a hash router (`#/convoaie`, `#/aplica`) and therefore **does not yet serve separate crawlable HTML pages** for those routes. For a growth-oriented next phase: add public server-rendered landing pages for convoys and recruitment, an event archive with unique URLs, consistent social distribution and analytics for applications and incoming traffic.

## QA performed

- JavaScript syntax checks on `web/app.js` and `src/web.js`.
- Inline Chromium/Playwright render at desktop (1440), tablet (800) and mobile (390): no page-level JS errors or horizontal overflow; screenshots produced for review.
- API values during rendering QA were simulated, **not connected to your live TruckersMP, Discord or Trucky accounts**.
- A live Railway deployment, real Discord OAuth, Trucky data and production Core Web Vitals were not tested.

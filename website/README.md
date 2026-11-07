# sagepod website

The landing page, as plain HTML, CSS and JavaScript: no build step, no
dependencies, no third-party requests (fonts are self-hosted, there is no
analytics). Deployed to Vercel as a static site.

- `index.html`: the page. Copy was agreed in the copywriting review
  (headline "Podcasts that stay on your phone.") and edited with the
  `copy-editing` skill from the marketing-skills plugin.
- `privacy.html`, `security.html`: the privacy policy (the URL given to
  Google Play) and the security policy. They are the web versions of
  `PRIVACY.md` and `SECURITY.md`; change both together.
- `styles.css`: design tokens and layout (forest ink and lime, after the
  Wise-style reference).
- `main.js`: the demos, each a piece of the app replayed while on screen:
  Add podcast typing, the player's chapter bar, swipe-to-queue and reorder,
  a download that resumes after losing signal, and Echo's story cards. With
  `prefers-reduced-motion`, they show their final state.
- `img/`: app screens from the screenshot harness (`npm run shots`), as WebP.
- `fonts/`: Inter and Inter Display, subset to Latin (SIL OFL, `fonts/OFL.txt`).
- `vercel.json`: security headers (strict CSP) and caching.

Preview locally with any static server, e.g. `npx serve website`.

When the Google Play listing is live, replace the "Coming to Google Play"
badges with a link to it.

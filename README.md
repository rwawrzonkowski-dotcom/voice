# V.O.I.C.E. website

The public site for V.O.I.C.E., a free AAC app. The app itself lives in a separate repository (`AAC-App`) and is never changed from here.

## How it is built

Plain HTML, CSS and JavaScript. There is no build step and nothing is loaded from other sites, so it works by opening `index.html` from a folder with no internet.

| File or folder | What it is |
|---|---|
| `index.html`, `get-started.html`, `features.html`, `videos.html`, `clinicians.html`, `privacy.html`, `about.html` | The seven pages |
| `js/config.js` | **Edit this first.** App link, donation link, contact email, LBA state and license number. Only https links and plain email addresses are accepted. |
| `js/site.js` | Top bar, footer, hidden words, copy-link buttons (shared by every page) |
| `js/home.js`, `js/steps.js`, `js/fade.js` | Home demos, Get started steps, clinician fading demo |
| `js/board-data.js` | A read-only copy of the app's 45-button main page (labels, word types, stages, pictures) |
| `css/site.css` | All styles |
| `fonts/`, `img/` | Bundled fonts, symbols, icons and the QR code |
| `CHANGELOG.md` | What changed and when |

## Rules

- No tracking, ads, cookies or analytics. No files from other sites.
- Plain language on parent pages. Clinical detail only on `clinicians.html`.
- No photo or video of a child without the family's written consent.
- Keep the credits for Universal Core, Mulberry Symbols and OpenMoji.
- Keep the security policy tag at the top of each page. Anything loaded from another site will be blocked by it, on purpose.
- No testimonials from current clients, and no gifts from current client families (BACB Code 5.07 and 1.12).

## Things to do at public release

- Remove the `noindex` tag from each page and change `robots.txt` to allow search engines.
- Change `appUrl` in `js/config.js` and make a new `img/qr-app.svg` for the new address.
- If the app's main page or stages change, refresh `js/board-data.js` and `img/symbols/`.

## Credits

Symbols in `img/symbols/` are unmodified Mulberry Symbols (CC BY-SA 4.0) and OpenMoji (CC BY-SA 4.0) files. Core vocabulary: Universal Core, Project Core (CC BY 4.0). Fonts: Atkinson Hyperlegible and Lexend (SIL Open Font License, texts in `fonts/`).

# VOICE website: change log

Newest first. Add a line here every time the site changes.

## 2026-11-23: Facebook link on

- `facebookUrl` set to the V.O.I.C.E. AAC page (https://www.facebook.com/61596526118540). Every page's footer now shows a plain "V.O.I.C.E. on Facebook" link. No Facebook scripts.
- All CSS and JS links now use `?v=20261123a`.

## 2026-11-20: Wacker the falcon (hot dog easter egg)

- Figure 4, "Lunch break" sticky note: tap ketchup five times (since the last "New hot dog") and Wacker, a peregrine falcon and Dibs's smug rival, swoops in and takes the hot dog. He sits on it for about 3.5 seconds with a speech bubble, then flies off with it. A tap anywhere in the figure sends him off at once. Dibs ruffles his feathers; Wacker never touches him.
- While the hot dog is gone, the note shows an empty plate with crumbs. Mustard and ketchup say "No hot dog to dress. Tap New hot dog." "New hot dog" brings back a fresh one and resets the count.
- Four taunts rotate across steals (starting at a random one). The caption (live region) says what happened and what Wacker said.
- Sound (only when the Figure 3 Sound switch is on): a soft whoosh on the swoop and the taunt in a lower voice, on-device voices only.
- Reduced motion: no swoop or flight. Wacker fades in (0.12 s), then fades out with the hot dog after the same delay. No shake on Dibs.
- The count is kept in the page only. Nothing is saved or sent.
- New art: `img/wacker/wacker.svg` (perched) and `img/wacker/wacker-fly.svg` (flying), original drawings in Dibs's style.
- Credits line in the footer now reads "Dibs the pigeon, V.O.I.C.E.'s mascot, and Wacker the falcon are original drawings." (LICENSE and NOTICE.md are not changed yet.)
- Changed: `js/features.js`, `css/features.css`, `js/site.js`. All CSS and JS links now use `?v=20261120a`.

## 2026-11-18: Facebook link (hidden until set)

- New setting `facebookUrl` in `js/config.js`. When filled with a `https://www.facebook.com/...` address, the footer shows a plain "V.O.I.C.E. on Facebook" link after "What's new". Blank (now) = no link.
- Plain link only: no Facebook scripts, widgets, pixels or embeds; opens with `noopener noreferrer`. Addresses not on facebook.com are ignored.
- All CSS and JS links now use `?v=20261118c`.

## 2026-11-18: Practice games

- New page, `games.html` ("Practice games" in the menu): three short games with Dibs. "Find the favorite" (pick the pretend child's favorite item by offering two at a time and recording each pick), "Why did that happen?" (match 8 short stories to a reason: attention, escape, an item, or feels good) and "Build a goal" (turn a vague goal into one with five parts: specific, measurable, achievable, relevant, time-bound).
- A switch at the top ("I'm a parent" / "I work in a school") changes the stories, items and goals. Clinical terms appear only in the school view, in parentheses after the plain words.
- Nothing is saved or sent. Everything resets when you leave the page. Privacy page has a new line saying so.
- All stories and names are invented. No photos of children.
- New files: `games.html`, `css/games.css`, `js/games.js`. New hidden sentence on the page: "I like that".
- Menu: "Practice games" added after "Questions" (also in the no-JavaScript menu on every page).
- Symbols copied unmodified from the V.O.I.C.E. app's Mulberry folder into `img/symbols/`: `computer.svg`, `stickers.svg`, `teacher.svg`.
- All CSS and JS links now use `?v=20261118b`.

## 2026-11-18: Common questions page

- New page, `faq.html` ("Questions" in the menu): 14 questions in four groups (Getting it, Using it with my child, Privacy and safety, Help). Tap a question to open its answer; it works without JavaScript, and a link like `faq.html#backup` opens that answer.
- For clinicians: new section "What the research says" (Millar, Light & Schlosser 2006; Schlosser & Wendt 2008; Romski & Sevcik 2005), which the family answers on AAC and speech and on readiness link to.
- Home (iPad panel) and Get started (last step) link to the new page. New hidden sentence on the page: "what do you want".
- All CSS and JS links now use `?v=20261118a`.

## 2026-11-17: license and notice

- Added `LICENSE` (© 2026 Richard Wawrzonkowski, all rights reserved) and `NOTICE.md` (third-party parts and their licenses). README has a License section.
- Correction: the Dibs drawings are shared under CC BY-SA 4.0, as the V.O.I.C.E. app's CREDITS.md already does for its critters, so LICENSE and NOTICE now say so.

## 2026-11-17: passcode surprises are saved

- Features, Figure 15: the surprises you find with the 1-2-3 passcode are now remembered in this browser (like the hidden words), and a collection panel under the figure shows all 81: V.O.I.C.E. words, Dibs's friends and celebrations, 27 each, with a progress bar and a Start over button. Privacy page updated to say so.
- Every page links its CSS and JS with a version number (?v=...) so phones load new files right away.

## 2026-11-17: board looks readable on phones

- Home in High contrast, CVI and Dim: the full-name line and the hidden-word tiles in the top area ("I" in the bar, "play" under the buttons) were dark purple or brown on black. They now use the look's light text color; hidden-word tiles get a light outline and a light picture. Every text on Home now passes 4.5:1 contrast in all five looks.
- Home: in High contrast, CVI and Dim, the chosen look's button lost its white card and its dark text disappeared on black. It now keeps a white card (yellow in CVI). Hover effects only apply on devices with a mouse, so they can't stick after a tap on phones.

## 2026-11-17: Figures 15 and 16 centered

- Features: the learners figure and the backup figure now sit centered in their cards (they were pushed to the left).

## 2026-11-17: all 11 guide videos

- Every guide on Videos and guides now plays a silent sample video with English captions (Guides 5–11 added: board looks, scenes, say it with feeling, help that fades, parent summary, sharing one iPad, backups). All title and end cards say V.O.I.C.E. with the full name on the end card. Drawn app screens carry an "Illustration" tag; sample data is labeled "Sample".

## 2026-11-17: the name is V.O.I.C.E.

- Every page now writes the name as V.O.I.C.E. (Variable Output for Individualized Communication and Expression). The full name appears on Home (under the eyebrow), About, the footer and at the first mention on each page. Page titles, the top bar, "Open V.O.I.C.E.", alt text and the text-me link changed too. Code names (VOICE_BOARD and the like) are unchanged.
- Quoted app wording (for example the parent-summary lines) now also says V.O.I.C.E.; the app will be renamed separately.

## 2026-11-17: guide videos 1, 2 and 4

- Guides 1 (Open VOICE and add it to the Home Screen, 54 s), 2 (Set up VOICE for your child, 60 s) and 4 (Grow the board one stage at a time, 58 s) now play silent sample videos with English captions, in the same style as Guide 3. Drawn app screens carry an "Illustration" tag. Seven guides still say "Video coming soon".

## 2026-11-17: first video (test)

- Guide 3 "Model your first six words" now plays a 1-minute sample video (no sound yet), stored in the site's own `video/` folder with a poster picture and English captions (`.vtt`, on by default, can be turned off). If a host can't serve the `.vtt` file, `js/captions.js` holds the same text and the page builds the captions itself. When a new video is added, update both. No outside video service; the page's safety policy already allows video from the site itself. Hidden when printing.

## 2026-11-17: VOICE 3.3 (Dibs is in the app)

- VOICE 3.3 made Dibs the pigeon the app's mascot and default model critter, with Chicago friends to choose from. The Clinicians page, Figure 9 and Guide 8 now say so (the Model prompt is a ring by default; an adult can add the critter).
- Dibs's picture now uses the app's own file, so they match exactly.
- About: "The current app is VOICE 3.3." The 45-button board is unchanged in 3.3.
- Word count: "about 1,200 words" is now "about 1,700 words" on Home and Clinicians (VOICE 3.3 has 1,734 words; 1,715 are placed on the board and in folders).

## 2026-11-17: Features fixes for laptops

- Scene maker: the camera now moves only when you click or drag in the room (or use the arrows), so moving the mouse to "Take photo" no longer drags it along. The page no longer jumps while the camera moves (Chrome was using the moving frame as a scroll anchor).
- Build a board: font names had quote marks that cut each tile's style short, so the look, label position and sizes didn't show. Fixed; the board now matches every option.

## 2026-11-17: new look and two new pages

- New look on every page: cut paper, sticky notes, numbered figures, and the premium buttons (segmented choices, switches, chip cards).
- Dibs the pigeon is the site's guide (an original drawing). The old owl picture is gone.
- New `features.html`: 16 working examples of VOICE, with three Chicago Easter eggs (Dibs rides the L, no ketchup on a hot dog, a dibs chair in the snow). Hidden sentence: "I can do that".
- New `videos.html`: 11 written step-by-step guides with "Video coming soon" spots, and a printable parent quick start.
- Fonts: OpenDyslexic added (SIL OFL, unmodified), for the Build a board example.
- Privacy page: the Features examples speak with on-device voices only and save nothing.
- Clinicians page: the Model-prompt "critter" sentence now says Dibs stands in for it on this site.

## 2026-11-14: spoken "I"

- The hidden word "I" was read aloud as "capital I". It is now spoken from a lowercase "i", the way VOICE does it.

## 2026-11-12: security, credits and privacy review

- Security: a Content-Security-Policy and no-referrer policy on every page; settings in `js/config.js` are only used if they are an https link or a plain email address; outside links open with `noopener noreferrer`.
- Speech: the demo board speaks only with on-device voices (cloud voices in some browsers are skipped).
- Credits: Universal Core credited under CC BY-SA 4.0 (UNC also lists CC BY 4.0), with the federal grant line; OpenMoji's suggested credit wording; links to every license; a note that symbols are shown dimmed or recolored; "not affiliated" and Apple trademark lines.
- Footer: copyright, "provided as is", Licensed Behavior Analyst in Illinois (license number optional in `js/config.js`).
- Privacy page: voices that need the internet (other devices), and that backup files are not encrypted.
- Support: gifts are not tax-deductible; current client families are asked not to give (BACB Code 1.12).
- Accuracy: "words keep their places as the board grows"; "includes all 36 Universal Core words"; "not speech-language therapy".
- Accessibility: resting board tiles brightened to meet 4.5:1 text contrast.

## 2026-11-12: first build (pilot pages)

- Five pages: Home, Get started, For clinicians, Privacy, About.
- Home: touch-the-board hero, unscrambling headline, five board looks, "Watch the board grow" (stages 1 to 4 from the app's own 45-button data), QR and text-me link, "Help keep VOICE free".
- Get started: five tap-through steps (all steps show if scripts are off or when printing).
- For clinicians: design principles, teaching sessions, a Model prompt fading demo, next-stage rule, reports, access options.
- Hidden words on every page (19 in all). Progress is saved only in the visitor's browser.
- Fonts, symbols, icons and the QR code are bundled. No outside files, cookies or analytics.
- Hidden from search engines for the pilot (`robots.txt` and a `noindex` tag on each page).
- Not yet filled in `js/config.js`: donation link, contact email, LBA state.

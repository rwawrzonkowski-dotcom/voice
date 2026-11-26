# VOICE website: change log

Newest first. Add a line here every time the site changes.

## 2026-11-26: Movie Maker quick scene tools

- New Quick tab (first on phones) so a scene takes a few taps:
  - Draw path: trace a line on the floor and the character waddles along it, facing where it walks, with an optional camera follow.
  - Commands: a list per character (Walk path, Wave, Say, Emote, Pose, Hop, Look, Wait, Wear) that runs in order and writes the keys and timing. Characters run at the same time. Hand-made keys are kept.
  - Auto camera: frames each speaker with a gentle push-in and focus. A manual camera key turns it off.
  - Script: type lines like "Dibs: Hey Chicago!" or "Dibs: shrug, question"; "Scene: Hot dog stand" starts a new shot. Unknown words get a plain note.
  - Recipes: save a command list and reuse it on any character. Three built in: Walk in and say hi, Big reveal, Wacker heckle.
- New files `js/movie-actions.js` and `js/movie-quick.js`. IndexedDB version 3 adds a `recipes` store (older data upgrades). Offline cache is now `dibs-photo-mode-v4`. Old `.dibsmovie.json` files still open.

## 2026-11-26: DIBS Movie Maker

- New `photo-mode/movie.html`: turn photo mode scenes into short paper-diorama movies, fully offline. It loads the same scripts as photo mode, so every character, pose, emote, costume, held prop, set, backdrop, bubble, light and filter is available, and no drawing is changed.
- A movie is a list of shots (add a blank shot, copy one, import a `.dibsscene.json`, or take photo mode's current scene). Each shot has a timeline with keys for the camera (position, aim, focal length, aperture, focus) and for each character (place, turn, height, pose). The camera moves smoothly; characters move in stop-motion steps at 12 frames a second.
- Timed speech bubbles, emotes, costumes, light presets, filters and L-sign captions switch on at their key. One-tap camera moves: Dolly in, Slow orbit, Crane up and down, Rack focus and Hold. Undo and redo.
- Optional sound from your own file, off by default, mixed into the export.
- Export video (WebM, or MP4 where only that is offered) at the platform size for 9:16, 16:9, 4:5 or 1:1, with a half-size option for phones, plus Save poster. Frames are drawn one at a time first and then recorded at an exact 30 frames a second, so slow devices still get correct timing. Movies are capped at 60 seconds.
- Movies autosave on the device (new `movies` store; the IndexedDB version is now 2), and can be saved and opened as `.dibsmovie.json`.
- Opens with a 20-second showcase movie of Dibs and Wacker that shows the editing features.
- Photo mode gets a small Movie maker link. Small hooks in `app.js` (boot options, no autosave for the movie page) and `puppets.js` (cached bubble art). Offline cache is now `dibs-photo-mode-v3`.

## 2026-11-25: Photo Mode as a claude.ai artifact

- Photo mode also runs as a private claude.ai artifact (a copy of `photo-mode/` with fonts beside it). Inside an artifact the page cannot start downloads, so `js/ui.js` now saves photos and scene files through the viewer's downloads capability when it is there; everywhere else it downloads as before. The offline cache and home-screen install only work from the published site.

## 2026-11-25: Photo Mode round 2 (more characters, emotes, holding, photo backdrops)

- New paper puppets from the V.O.I.C.E. app drawings, used as drawn and only cut into parts to pose: Chance, Hiram, Ivy, Monty and Sue (`photo-mode/art/`, with the drawings' own README). Also a plain Pigeon extra (Dibs's shape with a solid black neck band) and the L in all 8 line colors.
- Dibs's neck band in photo mode follows the Chicago flag (white, light blue stripes, red six-pointed stars). The site's `img/dibs/` drawings are unchanged.
- The redrawn Dibs eye expressions (happy, wink) are removed so every drawing stays as made. Old saved scenes still load.
- Emotes for every character: 12 pop-up paper emotes above the head, plus body moves (Bounce, Tilt, Lean in, Shiver, Slump).
- Holding and wearing: any prop, symbol or uploaded image can be held in a hand or wing and moves with the pose ("Give to", "Let go"). Costumes (two caps, horns, scarf, hockey stick, football) snap to the head, neck or hand of each critter.
- Photo backdrop: take a picture with the phone camera or choose one. Size, position, distance, flat-on-floor, and floor modes (Paper, Photo only with shadows on the photo, Hidden). Saved with the scene.
- Height off the ground is at the top of every selected item (0 to 8) with a drag handle in the scene; raised items drop their paper stand and can hang on a stick or a string.
- 3D speech bubbles: Speech, Thought, Shout and Sign cutouts with editable text, color and tail. The flat sticker bubbles stay.
- Offline cache is now `dibs-photo-mode-v2`. NOTICE.md lists the new drawings (CC BY-SA 4.0, credit "Richard Wawrzonkowski, V.O.I.C.E.").

## 2026-11-25: DIBS Photo Mode (social media tool)

- New `photo-mode/` tool, not linked from the site menu, `noindex`. Build a 3D paper diorama and take pictures for Instagram, Threads, TikTok, YouTube and X posts and covers.
- Characters stand as die-cut paper cutouts with a white paper edge, a folded stand and cast shadows. Dibs (six body colors) and Wacker are paper puppets with nine poses (Stand, Wave, Shrug, Proud, Peek, Hop, Look, Point and more) plus sliders for head, wings, lean, hop and expression. Dibs on the L, Wacker flying, all word symbols and your own uploaded images can be added as props.
- Six layered cut-paper sets: Paper sweep, Chicago skyline, L platform, Lower Wacker, Hot dog stand, Chicago River.
- Camera: orbit or fly (drag, pinch, keys, on-screen joystick on phones), focal length 14 to 200 mm, aperture f/1.4 to f/22 with depth of field, tap to focus, roll, exposure, thirds grid.
- Light presets (Morning, Noon, Golden hour, Blue hour, Lower Wacker night, Studio), sun direction, warmth, fill, shadow edge and a spotlight. Look filters (Warm, Cool, Newsprint, B&W, Faded film, Chicago night, Pop), vignette and paper grain.
- Stickers (speech and thought bubbles, labels, tape, symbols, uploads) and seven paper frames. Aspect ratios with export sizes per platform, safe-area guides for 9:16, circle guides for profile pictures.
- Take photo makes a PNG at the platform size (1x or 2x) with Download and Share. Scenes autosave on the device; named scenes, a photo roll and `.dibsscene.json` export and import.
- Works offline: opens from a folder with no internet, and on the published site a service worker (`photo-mode/sw.js`, cache `dibs-photo-mode-v1`; bump it when files change) caches everything after one visit. Can be added to a phone home screen (`manifest.webmanifest`).
- three.js r170 (MIT) bundled locally in `photo-mode/vendor/`; NOTICE.md updated. Built-in art is packed into `photo-mode/js/assets.js` by `photo-mode/tools/build-assets.js` (re-run it after changing `img/dibs`, `img/wacker` or `img/symbols`).

## 2026-11-24: Menu, progress, Features start, guide shelf, faster loading

- Menu has five items: Get started, Features, Learn (Videos and guides, Questions, Practice games), For clinicians, and the Open V.O.I.C.E. button last. About and Privacy moved to the footer (pages and addresses unchanged). Learn is a disclosure button (`aria-expanded`, `aria-controls`): click or Enter opens a small panel, Escape closes it and returns focus to the button, Tab out or a click elsewhere closes it. Pages inside Learn get `aria-current="page"` and the Learn button gets `aria-current="true"`. On phones (820px and narrower) the bar is one row: logo (icon only at 440px and narrower), the hidden-word egg slot, Open V.O.I.C.E. and a Menu button that opens a full-width paper panel; Learn's three pages sit indented inside it. `js/site.js` moves the panel after the Menu button in the page order on phones so Tab order matches the look. 404.html still uses `data-root`. No-JavaScript nav fallbacks updated on every page; the no-JavaScript footer now lists About and Privacy.
- Mini scenes: six small inline SVG drawings in `js/site.js` (Dibs beside an iPad, a board of four tiles, a film strip, a speech bubble with a question mark, a maze corner with a hot dog stand awning, a clipboard with a data sheet). Hidden from screen readers. They show in the phone menu panel and the desktop Learn panel; the desktop bar stays clean.
- Time labels as plain text under titles: Dibs's First Day (About 2 minutes.), Find the favorite (3), Why did that happen? (5), Build a goal (4), Escape Lower Wacker (A few minutes per level.), and each guide video, read from the files with ffprobe (all rounded to 1 minute: 46 to 60 seconds). The First Day intro no longer says "two-minute".
- Get started: each step starts with "Step N of 5"; a polite status line announces the step and its title when it changes. Step dots stay.
- Features: new "Start with these" section with four demos first (board grows, hold dial, say it with feeling, scene maker). The other twelve stay under their section headings, each folded behind a `details` disclosure showing the title, one plain line and the number of examples (Show and Hide). Opening one leaves the others alone. Jump links and `#figN` links open the right section. Visible "Figure N" labels removed (internal ids and `data-fig` numbers unchanged); the heat map text names the demos instead of numbers. The "Scenes" section is gone because its only demo moved to the top. The Teaching and Adults hidden-word eggs now sit inside their folded sections. Privacy page no longer says "Figure 15".
- Videos and guides: the "Videos are coming" box is gone. New "Pick a guide" shelf of 11 poster cards (title and length) with CSS scroll-snap, Previous and Next buttons, mouse drag, and Tab through the cards; a card jumps to its guide below (the full guides are unchanged). Smooth scrolling is off with reduced motion.
- Faster on phones: every video is `preload="none"` with its poster; static images below the first screen use `loading="lazy" decoding="async"`.
- All CSS and JS links now use `?v=20261124a` (404.html too).

## 2026-11-23: Style cleanup (fewer dots, no glows, no left borders, no 'real')

Follows Richard's list of overused "AI design" tells.

- Fewer dots: no visible "·" separators left on any page. Home's top line "V.O.I.C.E. · Free AAC for iPad" is gone as a small label; the intro now starts "Free AAC for iPad." The shared footer (`js/site.js`) uses separate lines and short sentences. No-JavaScript nav and footer fallbacks use spaces and sentences. Maze status line and the two Practice games counters use full stops. Guide labels on Videos read "Guide 3 for parents and staff".
- The word "real" is removed as an adjective from all visible text (pages, games, story, maze, captions). Maze level 3 caption and Wacker's line now say "Yes, it exists."
- Left-border accent removed from the "Why did that happen?" stories. Each story now shows a place tile (symbol + word: home, store, bath, barber, kitchen, friend's house, living room, car, classroom, bus, hallway, lunch) beside the text, in a plain ink-outlined box. New symbols copied unmodified from the app into `img/symbols/`: `home.svg`, `bath.svg`, `haircut.svg`, `kitchen.svg`, `living-room.svg`, `car.svg`, `classroom.svg`, `bus.svg`, `lunch.svg` (Mulberry), `grocery-store.svg`, `friends-house.svg` (OpenMoji), `hallway.svg` (drawn for the app, CC BY-SA 4.0).
- Glows replaced by hard paper shapes. Tapped tiles in the First Day story and the Features "photo strip" are now pressed in (drop 3px, paper shadow gone, 3px ink outline, a shade darker, 0.3 s; no animation with reduced motion). Home's "Open V.O.I.C.E." button is a solid round disc with an ink ring and a hard offset shadow, colored per look. Maze street lamps are a post, a lamp head and a flat cut-paper cone (no gradient). Features "glowing" message bar is a crisp ring with a hard offset; the tone-wheel backdrop is a solid disc.
- All CSS and JS links now use `?v=20261123d` (404.html too).

## 2026-11-23: Escape Lower Wacker maze

- Practice games now has a 4th game, "Escape Lower Wacker" (`#maze`, with its own jump link). Dibs is lost on Lower Wacker Drive; the player gets him out with six core-word tiles: up, down, left, right, go and stop. Words practiced: direction words, go and stop.
- A new maze is made every play (randomized depth-first, always solvable, one entrance on the left, one exit on the right with a drawn hot dog stand awning and an EXIT sign). Three levels in a `.seg`: Upper Wacker 5x5 (daylight, river at the edge), Lower Wacker 7x7 (dim, lamp pools, puddles), Lower Lower Wacker 9x9 (darkest, a few amber lamps, "Yes, it's real."; 8x8 on phones where 9 across would make cells smaller than 36px). Levels 2 and 3 unlock after a win, in the page only; nothing is saved.
- Tiles: up, down, left, right, go, stop. Direction tiles set the way Dibs faces (a yellow arrow on Dibs shows it). "Go" walks cell by cell (about 180 ms each; with reduced motion Dibs jumps cell to cell, no gliding) until a wall, a crossing (more than two openings), a dead end or the exit. "Stop" halts him at once. A message bar shows the last four words with a Clear button. Moves = word taps (an arrow key or swipe counts as two: direction + go; Space counts as one). No timer.
- Also: arrow keys (direction + go) and Space (stop) while the maze or a tile has focus; swipe on the maze does the same as an arrow key. Sound switch (off by default) speaks words with the site's on-device voice.
- Wacker heckles from a girder (never chases or takes anything here): a line at each level start, a rotating line at dead ends, a line on each win. Spoken lower (pitch 0.6) with Sound on. Dibs says "Made it! Hot dog time!" on a win, with a small hop and confetti (none with reduced motion). The win panel shows moves used, Play again and Next level.
- The live region narrates level start, each move result and the win. Adult tip follows the Parent / School staff switch.
- New files: `js/maze.js`, `css/maze.css` (loaded on Practice games only). With `?test` in the address, `window.VOICE_MAZE_TEST` shows the maze (for the site's own tests); without it nothing is exposed.
- New symbols copied unmodified from the V.O.I.C.E. app into `img/symbols/` (sources from the app's `data/image-sources.json`, all CC BY-SA 4.0): `down.svg` (Mulberry), `left.svg` (Mulberry), `right.svg` (Mulberry). Already on the site: `up.svg` (Mulberry), `go.svg` (Mulberry), `stop.svg` (OpenMoji, 1F6D1 stop sign). Tile colors follow the app: up/down/left/right blue (place), go green (action), stop pink (social).
- Practice games page text now says "four" games. All CSS and JS links now use `?v=20261123c` (404.html too).

## 2026-11-23: Dibs's First Day story

- Get started now opens with "Dibs's First Day", a tap-through story in six short scenes. Sam gets a talker; the visitor chooses what the grown-up does (start with six words, show don't test, treat every tap as talking, make "stop" work, show "help" before helping). Wrong choices get a gentle "Not quite" and stay visible but marked; the right one makes Dibs hop and shows a reason.
- Wacker watches from the rooftop outside the window with his own bubble, spoken lower; in the last scene he flies off top-left (reduced motion: he just fades). Dibs and Wacker art are reused unchanged.
- The drawn iPad shows the six Stage 1 tiles (help, stop, more pink; eat, drink green; bathroom blue). A tapped tile glows. A small hand taps it, never a face. Sound switch (off by default) speaks the tile words with the site's on-device voice. Nothing is saved or sent.
- Last scene: a printable "Your first day" card (six reminders). "Print this card" prints only the card, black on white. Link on to step 1.
- Without JavaScript the section shows the six reminders as a plain list.
- New files: `js/story.js`, `css/story.css` (loaded on Get started only). All CSS and JS links now use `?v=20261123b`.

## 2026-11-23: Launch polish

- Link preview cards: new `img/og-card.png` (1200x630, cut-paper look with the name, the Stage 1 tiles and Dibs). Every page now has Open Graph and Twitter card tags with its own title, description and absolute address (`https://rwawrzonkowski-dotcom.github.io/voice/...`). Still noindex.
- New `404.html` ("This page flew the coop."): Dibs looks around, Wacker sits smugly with a speech bubble. All its links are absolute from `/voice/` because GitHub serves it at any depth. New `css/notfound.css`. `js/site.js` reads `data-root` on the body (set only on 404.html) and starts the menu and footer links from that root; other pages behave as before.
- About: app version now 3.5; What's new has entries for November 18, 20 and 23.
- All CSS and JS links now use `?v=20261123a`.

## 2026-11-23: Facebook link on

- `facebookUrl` set to the V.O.I.C.E. AAC page (https://www.facebook.com/61596526118540). Every page's footer now shows a plain "V.O.I.C.E. on Facebook" link. No Facebook scripts.

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

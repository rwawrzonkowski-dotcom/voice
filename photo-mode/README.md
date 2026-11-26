# DIBS Photo Mode

A photo mode for making social posts and cover pictures. Dibs, Wacker, a plain pigeon and the Chicago critters (Chance, Hiram, Ivy, Monty and Sue) stand in a small 3D paper diorama as flat cutouts. You pose them, give them emotes, costumes and props to hold, move a 3D camera, set the lens and the light, add stickers and a frame, and take a PNG for the platform you pick.

It works offline. Nothing is loaded from other sites and nothing is uploaded.

## Open it

- On a computer: open `photo-mode/index.html` (double-click works, no server needed), or visit `/photo-mode/` on the site. It is not linked from the site menu.
- On a phone: visit `/photo-mode/` once, then use the browser's Add to Home Screen. After the first visit it works with no internet.

## Using it

- **Scene**: pick a backdrop, or use your own photo (see below). Add a character, the L (eight line colors), a speech bubble, a prop or your own picture. Tap an item in the picture to pick it, drag it along the floor, or use the sliders. **Height off the ground** is the first slider for a selected item, and a small paper tab on its ring does the same when you drag it up or down (works with a finger). A raised item loses its paper stand and can hang from a **Stick** or a **String**.
- **Backdrops**: thirteen drawn Chicago sets (the original six plus Lakefront at sunset, Michigan Avenue with the water tower, Riverwalk with bridges up, Pier with Ferris wheel, Bungalow alley in snow, Ivy ballpark wall and Deep dish pizza parlor). A set can suggest a light, with a one-tap button.
- **Background motion** (Scene tab): **Off**, **Matte pan** (layers slide sideways, far slowly and near faster, like a multiplane camera) or **Paper loop** (the strips scroll and repeat forever, like an old cartoon background). Speed, direction and Play/Pause. Characters stay put. It stops while the tab is hidden, starts paused if your device asks for reduced motion, and the photo freezes the current frame. Motion is saved with the scene. For skits, `App.setBackgroundTime(seconds)` sets the motion phase without the clock.
- **Your photo** (Backdrop, last tile): **Take a picture** opens the camera on a phone, **Choose a picture** opens the library. The picture becomes a big backdrop that keeps its shape (large pictures are scaled to 2048 px). Size, left or right, up or down and distance move it. **Floor** is Paper floor, Photo only (the floor turns invisible and only catches shadows, so the characters cast shadows onto your photo) or Hidden. **Flat on floor** lays the picture down as the ground, for photos taken looking down. The picture is saved with the scene and with exported files.
- **Speech bubbles**: Speech bubble, Thought bubble, Shout bubble and Sign on a stick are paper cutouts in the 3D scene. Type the words (several lines are fine, the type shrinks to fit), pick a color and a tail side. They can float, be turned and sized like any item, or be given to a character so they float by its head. The old flat bubbles in Stickers are still there.
- **Pose**: for the critters, presets and sliders (head, wings or arms, lean, hop), looking left or right and body color (Sue and the L keep their own colors). Eyes are never redrawn: the characters are cut into parts and the parts move.
  - **Emote**: a paper pop-up above the head (heart, two hearts, exclaim, question, music note, sweat drop, sleepy, steam, idea, laughing, tears, shivering) with sliders for left or right of the head and size. Each emote picks a body **Move** (Bounce, Tilt, Lean in, Shiver, Slump), and you can change the move on its own. Emotes also work on Dibs on the L, Wacker flying, props and your own pictures.
  - **Holding**: hold any prop or your own picture in the left or right hand, on the head, around the neck or at the feet. A held item moves with the pose and has its own size, turn and offset sliders, **Let go** drops it into the scene where it is. In the Scene tab, a selected prop has **Give to** for the same thing.
  - **Wear**: caps, horns, scarf, stick and football snap to the head, neck or a hand. Each critter has its own fit. One costume per place.
- **Camera**: Orbit (drag to go around, scroll or pinch to move closer, right-drag or two fingers to slide) or Fly (drag to look, pad or W A S D, Q and E to move). Lens 14 to 200 mm, aperture f/1.4 to f/22 (blur follows the thin-lens formula), tap to focus, focus distance, camera tilt, exposure, thirds grid.
- **Light**: time of day presets, sun direction and warmth, fill light, shadow edge, spotlight.
- **Look**: Craft detail (Crafty is the default: corrugated cardboard edges, rough cut edges, a little curl, brass brads at the joints, tape, glue tabs and torn tops on the set; Clean is the flat paper look), filters (Warm, Cool, Newsprint, B&W, Faded film, Chicago night, Pop), brightness, contrast, color, vignette, paper grain.
- **Stickers**: speech and thought bubbles, text labels, badges, shapes, tape, all the app symbols, your own pictures. Drag to move, drag the corner dot to resize and turn (or pinch and twist).
- **Frame**: platform size (Instagram, Threads, TikTok, YouTube, X, profile pictures, free), 1x or 2x export, safe-area guides, paper frames.
- **Take photo** makes the picture at full size (up to 4096 px on the long side) and opens a sheet with Download and Share.
- **Save**: the scene saves itself on this device. You can also keep named scenes, export a `.dibsscene.json` file, import one, and open the last 12 photos again.

Keyboard: Delete removes the selected item, arrow keys nudge it (Shift for bigger steps). With nothing selected, arrow keys turn the camera and + and - move it closer or farther.

## Movie maker

`movie.html` turns photo mode scenes into short keyframed paper-diorama movies and saves a video. It opens with a 20 second showcase made with its own tools. Photo mode has a Movie maker link at the top right, and the movie maker has a Photo mode link.

- **Shots**: each shot is a photo mode scene. Add a blank starter, copy a shot, import a `.dibsscene.json`, or take the scene last saved in photo mode. Reorder by drag or buttons. A movie can be up to 60 sec.
- **Timeline**: scrub the playhead, tap a diamond key to edit its time, ease or value, drag it to move it. Set key records the picked character (position, turn, height, pose) or the camera at the playhead. Pose chips, emotes, bubbles, costumes, light and filter set their own keys.
- **Motion**: poses step at 12 frames each second (on twos) and the camera is smooth at 30. Emotes, bubbles and costumes pop in with a short overshoot. Camera moves: Dolly in, Slow orbit, Crane up or down, Rack focus, Hold.
- **Captions** draw in an L sign bar inside the safe area. **Sound** is your own file, off until you turn it on, and is mixed into the export.
- **Export**: every frame is drawn one at a time, then played into a recorder at an exact 30 frames each second (.webm, or .mp4 where the browser needs it). Fast, half size is for phones. Save poster makes a PNG.
- **Saving**: the movie saves itself in the browser (IndexedDB, store `movies`). Named copies, and `.dibsmovie.json` export and import, are on the Movie page.
- **Tools sheet**: the stage, transport (Play, time, Set key, Undo, Redo), timeline and shot strip are always showing. One **Tools** button opens the tools in the same style as the settings in the VOICE app: a dark top bar with the title and a **Done** button that never scrolls away, then grouped rows with a colored icon tile, a short value ("3 commands", "35 mm f/2.8") and a chevron (Make it fast: Quick. This shot: Shot, Characters, Camera, Look, Text. Movie: Sound, Movie). Tap a row to open its page, "‹ Tools" goes back, and Tools reopens at the page you used last. On a phone the sheet slides up over the dimmed stage (a tap on the stage, Done, Escape or the browser back button closes it; no slide with reduced motion). From 821 px wide it is docked beside the timeline and Done collapses it; from 1100 px the list sits on the left and the page on the right. Add a command, Script and Export have Close in their top bar.
- **Quick page** (Tools, Make it fast): short command lists for each character, so a busy parent can make a scene without keyframes.
  - **Commands**: pick a character, tap Add a command (Walk path, Wave, Say, Hop, Look, Wait, Wear, a pose, an emote or a recipe). Commands run in order for each character, and characters run side by side. Drag the handle, or use Up and Down, to reorder. Tap a command to change it. Each row shows its time ("1.5 sec"). Say takes 2.5 sec plus 0.06 sec for each letter. The shot grows to fit its commands (the movie stops at 60 sec, with a plain warning).
  - **Draw path**: tap Draw path (the sheet steps aside and a bar over the stage says "Draw on the floor with your finger" with large Done and Cancel; the height handle and selection ring are hidden), then drag on the floor. One stroke finishes the path and returns to Quick with the new Walk command open. Cancel, Escape or the back button leave without adding anything. The path shows as a dashed ribbon in the editor only (never in a picture or the video). It is simplified, then the character faces its direction of travel (limited, because a paper card cannot turn edge on), waddles on twos, and settles with a small squash. Speed is Slow, Normal or Fast. Camera follows is a switch on the command.
  - **Auto camera** (a switch on the Quick page): a wide shot of everyone, then a smooth ease and a gentle push in (about 10 to 14 percent closer) on whoever is talking, with focus on them. It holds half a second before the cut. A camera key you set by hand turns it off.
  - **Script**: type `Dibs: Hey Chicago!` (a line is spoken), `Dibs: shrug, question` (known pose and emote words, `wait 2`, `walk`, `wear blue cap`, `look left`, `hop`, `wave`), `Dibs (wave): Hi!` (wave, then say) and `Scene: Hot dog stand` or `--- L platform` (a new shot). Characters missing from the shot are added, facing the camera and spaced apart. Lines play in order, one at a time. Unknown words become a gentle note under the box. Build asks first if the shot already has commands, and Undo brings them back.
  - **Recipes**: Save as recipe keeps one character's list (paths are saved relative to where it starts). Add a command, then Recipes, applies one to the picked character. Walk in and say hi, Big reveal and Wacker heckle come with the tool. Saved recipes live in IndexedDB (store `recipes`, database version 3).
  - **How it works**: commands live on the shot (`shot.actions`, `shot.autoCamera`, saved in `.dibsmovie.json`; older files without them still open). `MM.compileActions` rebuilds the keys they stand for on ordinary tracks, each marked `gen: true`, whenever a list changes. Keys you make by hand are never touched. Changing a generated key in the timeline makes it yours.
- **Files**: `movie.html`, `css/movie.css`, `js/movie.js` (data, timeline maths, playback, export), `js/movie-actions.js` (command lists, auto camera, script, recipes), `js/movie-ui.js` (screen), `js/movie-quick.js` (the Quick page and the draw bar), `js/movie-showcase.js` (the showcase).

## How it is built

Plain HTML, CSS and JavaScript with no build step at runtime. three.js (MIT) is bundled in `vendor/`.

| File | What it does |
|---|---|
| `index.html`, `css/photo.css` | The page and styles |
| `js/assets.js` | **Generated.** The Dibs, Wacker, critter, costume, L and symbol drawings as SVG text. Run `node photo-mode/tools/build-assets.js` from the repo root after changing any drawing in `img/dibs`, `img/wacker`, `img/symbols` or `photo-mode/art`. |
| `js/puppets.js` | Paper cutouts (die-cut edge, cardstock back, stand), the puppets (each drawing is cut into parts by its own SVG elements), anchors for held and worn items, body moves |
| `js/extras.js` | Emote cutouts, costumes, the L list and the 3D speech bubble drawing |
| `js/craft.js` | Papercraft detail: cardboard flute texture, edge walls from the cutout outline, rough edge, curl, brads, tape, torn tops |
| `js/sets.js` | The backdrops, drawn as layers of flat paper at different depths |
| `js/dof.js` | Depth of field (thin-lens blur), filters, vignette and grain in one pass |
| `js/controls.js` | Orbit and fly camera and touch gestures |
| `js/stickers.js` | Stickers and paper frames, drawn in 2D over the picture |
| `js/store.js` | Saving in the browser (IndexedDB: scenes, photo roll, autosave, movies, recipes) |
| `js/app.js`, `js/ui.js` | The scene, capture and the tool panel |
| `sw.js`, `manifest.webmanifest` | Offline cache and install on a phone. Raise `CACHE` in `sw.js` whenever a file changes (now `dibs-photo-mode-v3`). |

Why the drawings are stored as text: browsers block textures loaded from image files when a page is opened straight from disk. Text works everywhere.

Dibs, Wacker, the critters, costumes, the L and the symbols keep the licenses in `NOTICE.md`; the drawing rules for `art/` are in `art/README.txt`. In photo mode only, Dibs wears a Chicago flag neck band (white, two light blue stripes, red six-pointed stars) and the Pigeon a solid black one; the drawings in `img/dibs` are unchanged. Anything you add stays on your device.

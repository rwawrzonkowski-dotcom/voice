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
| `js/store.js` | Saving in the browser (IndexedDB) |
| `js/app.js`, `js/ui.js` | The scene, capture and the tool panel |
| `sw.js`, `manifest.webmanifest` | Offline cache and install on a phone. Raise `CACHE` in `sw.js` whenever a file changes (now `dibs-photo-mode-v3`). |

Why the drawings are stored as text: browsers block textures loaded from image files when a page is opened straight from disk. Text works everywhere.

Dibs, Wacker, the critters, costumes, the L and the symbols keep the licenses in `NOTICE.md`; the drawing rules for `art/` are in `art/README.txt`. In photo mode only, Dibs wears a Chicago flag neck band (white, two light blue stripes, red six-pointed stars) and the Pigeon a solid black one; the drawings in `img/dibs` are unchanged. Anything you add stays on your device.

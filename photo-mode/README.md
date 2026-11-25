# DIBS Photo Mode

A photo mode for making social posts and cover pictures. Dibs and Wacker stand in a small 3D paper diorama as flat cutouts. You pose them, move a 3D camera, set the lens and the light, add stickers and a frame, and take a PNG for the platform you pick.

It works offline. Nothing is loaded from other sites and nothing is uploaded.

## Open it

- On a computer: open `photo-mode/index.html` (double-click works, no server needed), or visit `/photo-mode/` on the site. It is not linked from the site menu.
- On a phone: visit `/photo-mode/` once, then use the browser's Add to Home Screen. After the first visit it works with no internet.

## Using it

- **Scene**: pick a backdrop, add Dibs, Wacker, props or your own picture. Tap an item to select it, drag it along the floor, or use the sliders (left or right, closer or farther, height, turn, tilt, size).
- **Pose**: presets and sliders for Dibs and Wacker (head, wings, lean, hop), plus face and body color for Dibs.
- **Camera**: Orbit (drag to go around, scroll or pinch to move closer, right-drag or two fingers to slide) or Fly (drag to look, pad or W A S D, Q and E to move). Lens 14 to 200 mm, aperture f/1.4 to f/22 (blur follows the thin-lens formula), tap to focus, focus distance, camera tilt, exposure, thirds grid.
- **Light**: time of day presets, sun direction and warmth, fill light, shadow edge, spotlight.
- **Look**: filters (Warm, Cool, Newsprint, B&W, Faded film, Chicago night, Pop), brightness, contrast, color, vignette, paper grain.
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
| `js/assets.js` | **Generated.** The Dibs, Wacker and symbol drawings as SVG text. Run `node photo-mode/tools/build-assets.js` from the repo root after changing any drawing in `img/dibs`, `img/wacker` or `img/symbols`. |
| `js/puppets.js` | Paper cutouts (die-cut edge, cardstock back, stand) and the Dibs and Wacker puppets |
| `js/sets.js` | The backdrops, drawn as layers of flat paper at different depths |
| `js/dof.js` | Depth of field (thin-lens blur), filters, vignette and grain in one pass |
| `js/controls.js` | Orbit and fly camera and touch gestures |
| `js/stickers.js` | Stickers and paper frames, drawn in 2D over the picture |
| `js/store.js` | Saving in the browser (IndexedDB) |
| `js/app.js`, `js/ui.js` | The scene, capture and the tool panel |
| `sw.js`, `manifest.webmanifest` | Offline cache and install on a phone. Raise `CACHE` in `sw.js` whenever a file changes. |

Why the drawings are stored as text: browsers block textures loaded from image files when a page is opened straight from disk. Text works everywhere.

Dibs, Wacker and the symbols keep the licenses in `NOTICE.md`. Anything you add stays on your device.

# Client Faces

The client serves its two faces itself: Plus Jakarta Sans, the installed app's face (shared with
the cockpit), and Inter, the public website's. `../fonts.css` declares them, `index.html` preloads
the file each surface draws first, and the installed app's worker precaches every file here
(`vite.config.ts`), so a launch with no network still draws the face. Fraunces, the website's
serif, still loads from Google Fonts.

These are the files Google Fonts served on 2026-10-21 for the requests the client made until then:

- Plus Jakarta Sans 2.071 (Google Fonts v12), weight axis 200 to 800, roman and italic:
  `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap`
- Inter 4.001 (Google Fonts v20), weight axis 100 to 900 and optical size 14 to 32, roman and
  italic:
  `https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap`

Each face keeps three of Google's subsets, with the unicode ranges Google gave them:

- `latin`: English, Spanish and Portuguese.
- `latin-ext`: other Latin letters, among them ṣ, and the naira sign.
- `vietnamese`: ẹ, ọ, ị and ụ, and the combining tone marks, which Yoruba and Igbo names use.

Characters outside these subsets (Cyrillic, Greek) draw in the system face.

Both faces are variable files. Sizes, latin subset, roman:

| Face | Variable file | One static weight | Weights the surface draws |
| --- | --- | --- | --- |
| Plus Jakarta Sans | 27.3 KB | 11.9 KB (400) | 400, 500, 600, 650, 700 |
| Inter | 73.0 KB | 23.8 KB (400, no optical size); 35.3 KB with it | 300, 400, 500, 600, 650, 700 |

Static files would need one per weight, could not draw the 650 both surfaces use, and, for Inter,
would drop the optical size the website renders with (`font-optical-sizing: auto` in
`index.css`). All twelve files add 570 KiB to the precache.

To update a face, open the URLs above in a current browser (Google Fonts serves WOFF2 by user
agent), download the files they list under the same names, copy any changed `unicode-range` into
`../fonts.css`, and rebuild. The precache budget check (`scripts/check-pwa-precache-budget.mjs`)
fails a build whose precached stylesheet uses a font the worker leaves out.

Both faces are distributed under the SIL Open Font License 1.1 (`OFL.txt`).

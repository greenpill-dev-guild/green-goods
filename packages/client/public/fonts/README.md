# Client fonts

Inter v20 and Fraunces v38 are the same variable typefaces previously served by
Google Fonts. The Latin and extended-Latin WOFF2 subsets were retrieved on
2026-10-21, and the Vietnamese subsets on 2026-10-23. Latin covers English,
Spanish, and Portuguese; extended Latin remains available for names and other
content. The Vietnamese subset carries the dot-below letters (ẹ, ọ, ị, ụ and
their capitals, U+1EA0 to U+1EF9) that Yoruba and Igbo names use; extended Latin
skips that block.

The font faces and critical sans-serif preload live in `packages/client/index.html`.
Keep the declared weight ranges and both styles when replacing the files. The SIL
Open Font Licenses are in `inter-OFL.txt` and `fraunces-OFL.txt`.

Sources: [Inter](https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap),
[Fraunces](https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&display=swap),
and [Google Fonts licenses](https://github.com/google/fonts/tree/main/ofl).

The installed app retains Plus Jakarta Sans v12 through the presentation-gated
local `pwa.css`. Its normal and italic Latin, extended-Latin, and Vietnamese files preserve
the original 200–800 variable weight range. The SIL license is in
`jakarta-OFL.txt`. The worker precaches the installed stylesheet and font files
so both styles are available on an offline reload.

Source: [Plus Jakarta Sans stylesheet](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap).

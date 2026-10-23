# Client fonts

Inter v20 and Fraunces v38 are the same variable typefaces previously served by
Google Fonts. The Latin and extended-Latin WOFF2 subsets were retrieved on
2026-10-21. Latin covers English, Spanish, and Portuguese; extended Latin remains
available for names and other content.

The font faces and critical sans-serif preload live in `packages/client/index.html`.
Keep the declared weight ranges and both styles when replacing the files. The SIL
Open Font Licenses are in `inter-OFL.txt` and `fraunces-OFL.txt`.

Sources: [Inter](https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap),
[Fraunces](https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&display=swap),
and [Google Fonts licenses](https://github.com/google/fonts/tree/main/ofl).

The installed app retains Plus Jakarta Sans through the presentation-gated local
`pwa.css`. Its Latin and extended-Latin files and SIL license come from the same
v12 normal variable font vendored for admin. The worker precaches the installed
stylesheet and font files so its face is available on an offline reload.

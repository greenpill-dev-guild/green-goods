# READ ME FIRST — Green Goods Admin · Claude Design Export

This bundle hands the Green Goods admin cockpit to **claude.ai/design** for a strict-M3 + Warm Earth direction revamp. It's structured for **bite-sized per-view sessions** rather than one monolithic upload.

---

## Fastest path: paste-ready session messages

**Use the four `SESSION-XX.md` files** at the bundle root. Each one is a self-contained paste-ready message that includes the system context, the per-view prompt, and inline token reference. ~22 KB / ~3400 words each.

For every Claude Design session:

1. Open `SESSION-01-HUB.md` (or 02 / 03 / 04 depending on which route you're working on).
2. `Cmd+A` to select all → `Cmd+C` to copy.
3. Paste into a fresh claude.ai/design chat as the first message.
4. **Attach images** per the "Attach these images" checklist at the top of the file:
   - `reference-image.png` (required — the validated north-star direction).
   - The current admin route from `screenshots/<bucket>/light/` and `dark/` (strongly recommended).
   - Shell composition references from `screenshots/shell/`.
   - Optional primitives / tokens screenshots if the chat allows more attachments.

That's it. Reply with **2 direction variations** per the output format described in § 6 of the system context inside the message.

---

## Recommended session order

1. **`SESSION-01-HUB.md`** — `/hub` first. The reference image is `/hub`-shaped, so this is the cleanest "is the grammar right?" check.
2. **`SESSION-02-GARDEN.md`** — `/garden` second. Different content shape (record, not queue) tests how the system adapts.
3. **`SESSION-03-COMMUNITY.md`** — `/community` third. Portfolio-shaped roster, confirms cross-route consistency.
4. **`SESSION-04-ACTIONS.md`** — `/actions` last. Catalog-shaped, the most visually different from Hub. By session 4 the design language should hold up.

---

## Modular fallback (for reading / editing)

If you want to read the prompts as separate documents rather than the combined paste-ready blobs, the original modular files are also in the bundle:

- `00-SYSTEM.md` — design system context only.
- `01-HUB.md`, `02-GARDEN.md`, `03-COMMUNITY.md`, `04-ACTIONS.md` — per-view prompts only.

These are the source files the `SESSION-XX.md` blobs are built from. Edit them and re-run the bundle to regenerate.

---

## What to do after each session

After Claude Design produces 2 variations for a route:

1. **Pick the strongest direction** (or a hybrid).
2. **Note the token table** — surface / text contrast pairs in dark mode are usable as-is for `theme.css` updates.
3. **Note the composition note** — list of `Admin*` primitives and Canvas shells used. Cross-check against the existing palette in `screenshots/primitives/`.
4. **Flag missing primitives** — if Claude Design called out a needed primitive that doesn't exist, that's a backlog item, not a one-off custom build.
5. **If a direction wins**, run a follow-up session asking Claude Design to refine that direction across edge cases (mobile collapse, state surface variations, sheet open state).

---

## Files in this bundle

```
admin-claude-design-export-<date>/
├── READ-ME-FIRST.md             # this file
├── SESSION-01-HUB.md            # paste-ready /hub session
├── SESSION-02-GARDEN.md         # paste-ready /garden session
├── SESSION-03-COMMUNITY.md      # paste-ready /community session
├── SESSION-04-ACTIONS.md        # paste-ready /actions session
├── 00-SYSTEM.md                 # modular: design system context
├── 01-HUB.md ... 04-ACTIONS.md  # modular: per-view prompts
├── reference-image.png          # north star (every session)
├── DESIGN.md                    # root design system
├── DESIGN.admin.md              # admin dialect
├── DESIGN.browser.md            # public client dialect (context, not in scope)
├── DESIGN.pwa.md                # installed PWA dialect (context, not in scope)
├── theme.css                    # runtime tokens
├── design-md.generated.json     # machine-readable tokens
├── design-md.generated.css      # generated CSS tokens
├── storybook-design-manifest.json  # tool-import manifest
└── screenshots/
    ├── shell/<theme>/           # AppBar, NavigationBar, MainSheet, sheets, FAB
    ├── primitives/<theme>/      # all 14 Admin* primitives
    ├── tokens/<theme>/          # color, typography, animation, shadow surfaces
    ├── hub/<theme>/             # /hub route
    ├── garden/<theme>/          # /garden route
    ├── community/<theme>/       # /community route
    └── actions/<theme>/         # /actions route
```

---

## Notes

- **Banned vocabulary** is enforced — see § 3.3 of the inlined system context inside each `SESSION-XX.md`.
- **Quantitative anti-patterns** (≤2 nesting levels, M3 standard heights only, WCAG AA dark, ≤3% accent budget) are non-negotiable — see § 5 of system context.
- **No new routes, no new components, no new vocabulary.** This is exploration *within* the system, not replacement *of* the system.
- If `reference-image.png` is missing from this folder, save the user-provided image at `~/Downloads/admin-claude-design-reference.png` and re-run the bundle script with `--skip-rebuild --skip-captures`.

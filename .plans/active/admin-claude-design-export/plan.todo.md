# Admin Claude Design Export

Per-view bundle for handing the admin UI to claude.ai/design. Sized for **bite-sized session feeding** — one Claude Design session per route — with a system context + per-view prompt model.

## Goal

Produce `~/Downloads/admin-claude-design-export-<YYYY-MM-DD>/` containing the system context, four per-view prompts, the validated reference image, design system files, and Storybook screenshots organized by view bucket — so each Claude Design session gets exactly the assets it needs and nothing more.

## File layout

```
.plans/active/admin-claude-design-export/
├── plan.todo.md                         # this file
├── READ-ME-FIRST.md                     # bundle entry doc — session model
├── 00-SYSTEM.md                         # design system context (every session)
├── 01-HUB.md                            # /hub session prompt
├── 02-GARDEN.md                         # /garden session prompt
├── 03-COMMUNITY.md                      # /community session prompt
├── 04-ACTIONS.md                        # /actions session prompt
└── scripts/
    └── bundle-export.sh                 # orchestrator → ~/Downloads/...

packages/shared/.storybook/
└── capture-admin-stories.mjs            # screenshot pipeline (lives next to prepare-design-assets.mjs)

tmp/storybook-design-assets/             # staging area, regenerated each run
└── screenshots/<bucket>/<theme>/<TitleSlug>/<Variant>.png
```

## Bundle layout (output)

```
~/Downloads/admin-claude-design-export-<YYYY-MM-DD>/
├── READ-ME-FIRST.md
├── 00-SYSTEM.md, 01-HUB.md..04-ACTIONS.md
├── reference-image.png                  # if user saved it to ~/Downloads/admin-claude-design-reference.png
├── DESIGN.md, DESIGN.admin.md, DESIGN.browser.md, DESIGN.pwa.md, DESIGN.docs.md
├── theme.css, design-md.generated.css, design-md.generated.json
├── storybook-design-manifest.json
└── screenshots/
    ├── shell/<theme>/        # AppBar, NavigationBar, MainSheet, FAB, sheets — every session
    ├── primitives/<theme>/   # 14 Admin* primitives — every session
    ├── tokens/<theme>/       # color, typography, motion surfaces — every session
    ├── hub/<theme>/          # /hub route — Hub session only
    ├── garden/<theme>/       # /garden route — Garden session only
    ├── community/<theme>/    # /community route — Community session only
    └── actions/<theme>/      # /actions route — Actions session only
```

## Capture scope (round 1)

- `Admin/Workspaces/{Hub,Garden,Community,Actions}` → `hub/`, `garden/`, `community/`, `actions/`
- `Admin/Primitives/*` (14 titles) → `primitives/`
- `Admin/Shell/CanvasLayout` + `Shared/Canvas/{AppBar,NavigationBar,MainSheet,LeftSheet,RightSheet,BottomSheet,FabContext}` → `shell/`
- `Shared/Tokens/*` (8 surfaces) → `tokens/`

Default = `--variants=first` (one capture per title, ~34 titles × 2 themes = 68 PNGs).
Full = `--variants=all` (~143 × 2 = 286 PNGs).

## Run

```bash
# One-shot bundle: rebuild + text bundle + captures + copy to ~/Downloads
.plans/active/admin-claude-design-export/scripts/bundle-export.sh

# Skip Storybook rebuild (use existing storybook-static/)
.plans/active/admin-claude-design-export/scripts/bundle-export.sh --skip-rebuild

# All variants (~286 PNGs)
.plans/active/admin-claude-design-export/scripts/bundle-export.sh --variants=all

# Text-only refresh (no screenshots)
.plans/active/admin-claude-design-export/scripts/bundle-export.sh --skip-captures
```

## Status

- [x] Capture script (per-view bucket structure)
- [x] System brief + 4 per-view prompts + READ-ME-FIRST
- [x] Bundle orchestrator (per-view aware)
- [ ] User: save reference image to `~/Downloads/admin-claude-design-reference.png`
- [ ] User: confirm Claude Design intake (file upload / folder drop / URL fetch)
- [ ] Run full bundle end-to-end and verify output structure

## Notes

Per CLAUDE.md script policy: capture script lives in `packages/shared/.storybook/` (storybook-adjacent tooling). Bundle orchestrator + prompts live in `.plans/` (one-shot). Earn a `scripts/` slot only after used twice.

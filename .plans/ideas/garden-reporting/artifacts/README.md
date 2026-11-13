# Garden Reporting Artifacts

## Walkthrough

`walkthrough/` holds the source of the clickable walkthrough of the reporting prototype: six
chapters, 13 screens in the main story and 16 with See Every Step. Each screen is a Storybook story
of the prototype (`packages/admin/src/views/ReportingLab/`), captured headless at 1440×900 with
sample data fixed at Jan 16, 2026. Dashed outlines mark what the prototype adds to each shipped tab.

The published copy is a private claude.ai artifact, visible to its owner until they share it:
https://claude.ai/artifact/8fPPa4Q1MhXGsXtLHG3UC5

| File | What it holds |
|---|---|
| `screens.mjs` | Chapters, screens, the story behind each screen, hotspot and "new" targets, captions |
| `capture.mjs` | Loads each story in headless Chromium, measures its targets, writes `output/screens/*.webp` and `output/boxes.json` |
| `build.mjs` | Writes `output/index.html`: `player.html` with the screens, copy and boxes inlined |
| `player.html` | The player: fixed stage, side panel, hotspot with Next beside it, chapter list, See Every Step |
| `verify-player.mjs` | Checks the built player at 1440 and 1100 wide: blocks keep one place and height, targets sit in the frame, the click path and keys work, no console errors |

Everything under `output/` is generated and gitignored.

## Regenerate

Start Storybook from the repository root (it serves on port 3004):

```bash
bun run --filter @green-goods/shared storybook
```

Then, from the repository root:

```bash
node .plans/ideas/garden-reporting/artifacts/walkthrough/capture.mjs "$PWD" http://127.0.0.1:3004
node .plans/ideas/garden-reporting/artifacts/walkthrough/build.mjs
node .plans/ideas/garden-reporting/artifacts/walkthrough/verify-player.mjs "$PWD"
```

Pass screen ids after the base URL to recapture only those. The server listens on 127.0.0.1 only,
and its style updates keep the network busy, so the capture waits for the rendered screen rather
than network idle. To publish a new version, upload `output/index.html` and `output/screens/*` to
the same artifact.

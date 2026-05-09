# QA pass 1 — animation-polish-editorial-browser

**Owner**: claude (qa_pass_1)
**Closing turn**: 2026-05-09
**Working branch**: `claude/blissful-yonath-9fbbe9` (worktree on `main`)
**Verdict**: `pass-with-followups`

## Scope

Read-only QA pass on the closed UI lane. Goal: verify the implemented motion polish matches the lane handoff with real browser evidence and confirm the deferred Phase C verdicts (C2 aspect ratio, C3 per-card morph duration) hold.

## What I confirmed

### Code on disk matches the UI handoff exactly

I read the three files the lane scoped its work to and they match the handoff verbatim:

- `packages/client/src/views/Public/GardenDialog.tsx` — `CLOSE_STAGGER_DURATION_MS = 480`, `FOCUS_AFTER_MORPH_MS = 350`, `prefersReducedMotion()` short-circuits `close()`, `id`-change effect resets `closing` and cancels the queued navigate, `Dialog.Description` (Radix-wired `aria-describedby`) replaces the prior manual node, `data-closing` flips on `Dialog.Content`. (`GardenDialog.tsx:20-100,159-166`)
- `packages/client/src/styles/editorial.css` — open stagger `[data-state="open"]` rule (lines 339-363), close cascade `[data-closing="true"]` rule with `:nth-last-child` reverse (lines 379-405), reduced-motion `@media` block snaps `.public-garden-dialog-overlay[data-state]` (line 444) and `.public-garden-dialog .public-garden-dialog-stagger > *` (lines 462-466), `editorial-fade-down` keyframe omits `from` (lines 81-86) so a close started mid-open picks up at current computed values.
- `packages/client/src/__tests__/views/PublicGardenDialog.test.tsx` — two tests, both still TDD-shaped (RED note inline, GREEN advance-timers proof). The reduced-motion test mocks `matchMedia` and asserts the synchronous-navigate path.

### Test ↔ code ↔ CSS wiring matches end-to-end

Walked the `data-closing` invariant by hand:

- Test (`PublicGardenDialog.test.tsx:138-139`) — `document.querySelector(".public-garden-dialog")?.getAttribute("data-closing")` must equal `"true"` immediately after click.
- Component (`GardenDialog.tsx:163-165`) — `<Dialog.Content className="public-garden-dialog" data-closing={closing ? "true" : undefined}>` (Radix forwards `data-*` props onto its rendered element).
- CSS (`editorial.css:379-405`) — `.public-garden-dialog[data-closing="true"] .public-garden-dialog-stagger > *` drives `editorial-fade-down` with reverse-cascade delays on `:nth-last-child(n)`.

All three lock to the same selector. The reduced-motion test asserts the attribute is absent and `navigate` fires synchronously — which matches the early return at `GardenDialog.tsx:62-65`.

### `view-transitions.css` reduced-motion override is in place

`view-transitions.css:177-183` applies `animation-duration: 0.01ms !important` to `::view-transition-group(*) | -old(*) | -new(*)` under `prefers-reduced-motion: reduce`. That covers the morph itself even though the body stagger snaps via the editorial.css block.

### Hero image still wraps the wrapper, not the `<img>`

`GardenDialog.tsx:180-189` — the `view-transition-name: garden-card-{id}` is on the `<div>` wrapping `ImageWithFallback`. The Phase A finding (2026-05-04) confirmed this is fine once the H5 fix in `ImageWithFallback` skips `isLoading` for cache hits, so the photo paints from the first frame of the new state. Worth a visual confirmation in qa_pass_2 once the env is healthy.

### Validation ladder (what could run)

| Command | Result |
| --- | --- |
| `git branch --show-current` | `claude/blissful-yonath-9fbbe9` |
| `git status --short --untracked-files=all` | clean (only an `.env` symlink, gitignored) |
| `node scripts/harness/plan-hub.mjs validate` | ✅ `Validated 23 feature hubs.` |
| `bun run lint:vocab` | ✅ `check-vocab: no banned vocabulary found in 3 i18n file(s).` |
| `bun run format:check` | ✅ `Checked 1686 files in 379ms. No fixes applied.` |
| `bun run test -- --run src/__tests__/views/PublicGardenDialog.test.tsx` (`packages/client`) | ❌ environmental failure — `Failed to resolve import "react-router-dom"` (see proof_limit #2) |
| `VITE_CHAIN_ID=11155111 bun run build` (`packages/client`) | not run — same env class blocks Vite (see proof_limit #2) |

## What I could not verify (proof limits inherited and extended)

### 1. Browser visual quality of the morph and stagger

PM2 `client` is online but not actually serving — `https://localhost:3001/` returns connection refused. The lane handoff already noted this (`packages/shared/storybook-static/iframe-CvAdox3U.js` stale `ws` import). I tried to spin up a fresh dev server in this worktree on port 3011 (workaround `.claude/launch.json`, since cleaned up); it failed with `Cannot find package '@tailwindcss/vite' imported from /Users/afo/Code/greenpill/green-goods/node_modules/.vite-temp/...`. Diagnosis: see proof_limit #2.

So the following items remain unverified, the same list the lane handoff flagged:

- Card → dialog morph with real garden image data (H5 photo stays during morph, no grey-rectangle snapshot).
- Reverse stagger feel — whether 50ms cadence + 180ms per-child reads "snappy" rather than "rushed" (lane handoff's `proof_limit` #1).
- Morph-then-close — whether `editorial-fade-down`'s missing `from` keyframe handles a close that interrupts an open without a visible blink (lane handoff's open question).
- Reduced-motion end-to-end — that every editorial keyframe and the morph itself snap to ~0ms (the JS state-machine bypass is unit-tested; the CSS reduced-motion override is on disk).
- Keyboard flow: Tab from card → Enter opens dialog → focus lands on close button after `FOCUS_AFTER_MORPH_MS` (350ms) → trap inside dialog → Escape closes → focus returns to originating card link (Radix's default `onCloseAutoFocus` path).
- Mobile breakpoint — `aspect-[16/9]` (mobile) vs `sm:aspect-[3/1]` (≥768px desktop) on both card and dialog hero, and whether the dialog's `inset: 0` full-screen on `<768px` reads correctly under a soft keyboard.
- Sparse-data idle gap — the `~150ms` window the handoff flagged for gardens with 4 stagger children before navigate fires. Need eyeballs on whether it reads as dead air.

### 2. Repo-wide environmental block — broken `node_modules` symlinks (surface only, do not fix)

The vitest + vite failures are not a code regression in this lane. They are a `node_modules` symlink issue at the main repo level:

```
/Users/afo/Code/greenpill/green-goods/node_modules/@tailwindcss/vite
  → ../../../../node_modules/.bun/@tailwindcss+vite@4.1.18+fea22ae6449b71dc/node_modules/@tailwindcss/vite
```

Resolving 4 levels up from `node_modules/@tailwindcss/vite` lands on `/Users/afo/Code/greenpill/`, then `/node_modules/.bun/...` would expect `/Users/afo/Code/greenpill/node_modules/.bun/...`, which does not exist. The actual `.bun` store is at `/Users/afo/Code/greenpill/green-goods/node_modules/.bun/...` (one level deeper). `react-router-dom` shows the same off-by-one (`../../../node_modules/.bun/...`, breaks the same way).

The same broken-symlink class is what the lane handoff captured at PM2 client (`ws` import from a stale storybook-static); this is wider than that single artifact. **Out of scope to fix from a worktree** per the `feedback_dont_touch_other_agent_workspaces` and `feedback_codex_worktree_env` memory entries — flagged here so Afo can run a clean `bun install` at the main repo when convenient. Once that lands, qa_pass_2 (codex) should re-run the full validation ladder and capture the browser evidence.

### 3. Phase C2 / C3 verdicts (closed-as-deferred in the lane handoff)

The lane closed C2 (drop `sm:aspect-[3/1]`) and C3 (`::view-transition-group(*)` wildcard duration) as deferred without visual signoff. I did not change either. My read of the rationale:

- **C2** — current desktop is `aspect-[3/1]`, mobile is `aspect-[16/9]`. Card heroes are `aspect-[3/2]` (default) or `aspect-[4/3]` (lead). With H5's `ImageWithFallback` cache-hit fix on disk, the morph snapshot now contains the photograph rather than the wrapper bg; the residual reframing is the box ratio interpolating during the morph. Smallest mitigation = drop `sm:aspect-[3/1]` only, reducing desktop's box-aspect change from +100% to +19%. Still aesthetic-judgment-heavy because the 3/1 hero may be intentional editorial drama.
- **C3** — only viable path is the wildcard `::view-transition-group(*) { animation-duration: ... }`. Prior wildcard attempt froze the document timeline; storybook iframe retest was inconclusive (the iframe aborts view-transitions regardless). Shipping a wildcard rule without a clean live client environment risks freezing every view-transition site-wide.

Both verdicts hold from a code review standpoint. The next check on either is Afo's eye on a healthy live client; if the residual morph still reads mechanical, the smaller next move is C2-minimal (drop `sm:aspect-[3/1]` only) before any wildcard view-transition rule.

## Defects found

None. No code change made by this QA pass.

## Files I touched

- `.plans/active/animation-polish-editorial-browser/handoffs/claude-qa-pass-1.md` (this file)
- `.plans/active/animation-polish-editorial-browser/status.json` — `qa_pass_1` lane → `completed`, history entry appended.

Symlink kept (out of git scope, not committed): `.env → ../../../.env` from worktree root, matches the documented `feedback_codex_worktree_env` pattern.

Removed mid-session: `.claude/launch.json` workaround I tried to use for Claude Preview; it could not get past the `@tailwindcss/vite` symlink break either, and I cleaned it up rather than leave a transient artifact.

## Verdict and follow-ups

**Verdict**: `pass-with-followups`. The lane's code, tests, and validation that could run all hold; the items that could not run are inherited proof_limits plus a wider environmental issue that pre-dates this pass.

**Followups for qa_pass_2 (codex)**:

1. Re-run validation ladder once `bun install` has refreshed `node_modules` symlinks at the main repo. Targets:
   - `bun run test -- --run src/__tests__/views/PublicGardenDialog.test.tsx` (`packages/client`) — expect 2/2 green.
   - `bun run test -- --run 'src/__tests__/views/Public'` (`packages/client`) — expect 38/38 green (lane handoff's prior run).
   - `VITE_CHAIN_ID=11155111 bun run build` (`packages/client`) — expect clean build.
2. Capture the browser evidence list under "What I could not verify" §1.
3. Confirm or amend the C2/C3 deferred verdicts after Afo's visual pass on a healthy stack. Order of preference: nothing (if the morph reads right) → C2-minimal (drop `sm:aspect-[3/1]`) → C3 wildcard (last resort, only with a clean repro of the freeze risk).
4. Surface (do not fix from a worktree) the wider symlink issue at `/Users/afo/Code/greenpill/green-goods/node_modules` so Afo can decide when to run `bun install` cleanly.

**No blockers** for promoting `qa_pass_2` from `blocked` once `qa_pass_1` flips to `completed` (the dependency is `["qa_pass_1"]` and `manual_blocked: false` is already set).

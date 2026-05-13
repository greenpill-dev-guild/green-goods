# QA pass 2 — animation-polish-editorial-browser

**Owner**: codex (qa_pass_2)
**Closing turn**: 2026-05-09
**Working branch**: `main` (no worktree, direct-to-main)
**Verdict**: `pass`

## Scope

Independent QA pass for the closed UI lane. This pass repaired the qa_pass_1 dependency blocker,
restarted the client dev stack, captured real Chromium browser evidence for the public browser
animation lane, fixed contained lane defects found during QA, and reran the requested validation
ladder.

This pass stayed in the active feature scope: public browser Garden cards, Garden detail dialog,
image lifecycle, focus management, mobile layout, reduced motion, and plan-hub bookkeeping. I did
not touch unrelated dirty work in `CLAUDE.md` or the untracked
`.plans/backlog/public-endowment-withdrawal-recovery/` files.

## Start-state checks

| Command | Result |
| --- | --- |
| `git branch --show-current` | `main` |
| `git status --short --untracked-files=all` | showed unrelated `CLAUDE.md`, scoped client/shared edits from this unblock, and unrelated untracked `public-endowment-withdrawal-recovery` plan files |
| `git log --oneline -3` | `27d63268 chore(plans): record qa_pass_2 verdict...`; `d2e983b0 chore(routines): align prompts...`; `cc7a649d chore(plans): record qa_pass_1 verdict...` |

`cc7a649d` was no longer HEAD because this pass had already recorded the initial blocked verdict
as `27d63268`. After Afo directed the blocker to be fixed, I continued in-place on `main`.

## Repo-health gate

qa_pass_1's symlink diagnosis was real:

| Command | Result |
| --- | --- |
| `readlink node_modules/@tailwindcss/vite` | `../../../../node_modules/.bun/@tailwindcss+vite@4.1.18+fea22ae6449b71dc/node_modules/@tailwindcss/vite` |
| `test -e node_modules/@tailwindcss/vite/package.json` | exit 1 |
| `readlink node_modules/react-router-dom` | `../../../node_modules/.bun/react-router-dom@7.12.0+bf16f8eded5e12ee/node_modules/react-router-dom` |
| `test -e node_modules/react-router-dom/package.json` | exit 1 |

`bun install --force` did not unblock the repo because a `sharp` rebuild failed under the local
Node 18 headers. I then ran `bun install --linker hoisted --ignore-scripts`, which completed:

```text
2968 packages installed [8.64s]
```

Post-fix confirmation:

| Command | Result |
| --- | --- |
| `readlink node_modules/@tailwindcss/vite` | exit 1 because it is now a real directory |
| `test -e node_modules/@tailwindcss/vite/package.json` | exit 0 |
| `readlink node_modules/react-router-dom` | exit 1 because it is now a real directory |
| `test -e node_modules/react-router-dom/package.json` | exit 0 |
| `node scripts/postinstall/fix-multiformats.js` | applied multiformats shims and fixed 11 `.bun` cache symlinks |

I did not hand-edit symlinks.

## Dev stack

| Command | Result |
| --- | --- |
| `npx pm2 logs client --nostream` | old error log still contained the stale `storybook-static/assets/iframe-CvAdox3U.js` `ws` failure, but the current client out log showed Vite serving |
| `test -e packages/shared/storybook-static/assets/iframe-CvAdox3U.js` | exit 1; stale asset was not present on disk |
| `npx pm2 restart client` | client restarted and served `https://localhost:3001/` |

Current local browser evidence loaded the client at `https://127.0.0.1:3001/` and GraphQL at
`http://localhost:8080/v1/graphql`.

## Defects found and fixed

1. **H5 image lifecycle regression on cached IPFS images**
   Browser evidence showed the dialog hero image was loaded (`naturalWidth: 1127`) but still
   sampled at opacity `0` during the card→dialog morph. Cause: `ImageWithFallback` replayed
   `image-reveal` on cache-hit remounts, so the View Transitions snapshot could capture the
   opacity-0 frame. Fix: cache-hit mounts now paint at full opacity and only uncached/race winners
   replay `image-reveal`.
   - Code: `packages/shared/src/components/Display/ImageWithFallback.tsx:148`
   - Test: `packages/shared/src/__tests__/components/ImageWithFallback.test.tsx:154`

2. **Dialog close focus return missed the originating card**
   Escape and reduced-motion close could leave focus on `body` because the focus attempt ran while
   Radix still had the background inert or before the route had remounted the Garden link. Fix:
   close navigation now retries focus on the exact originating `/gardens/:slug` link through the
   route landing window.
   - Code: `packages/client/src/views/Public/GardenDialog.tsx:33`
   - Test: `packages/client/src/__tests__/views/PublicGardenDialog.test.tsx:129`

3. **Reduced-motion open focus was not immediate**
   The 350ms focus delay was bypassed in code, but the real reduced-motion browser path still did
   not reliably focus the close button at open. Fix: reduced-motion open now focuses the close
   button via layout effect and zero-delay fallback.
   - Code: `packages/client/src/views/Public/GardenDialog.tsx:86`
   - Test: `packages/client/src/__tests__/views/PublicGardenDialog.test.tsx:172`

4. **Mobile dialog hero collapsed to 0px**
   In the full-screen mobile flex column, the hero flex item could shrink to `0px` even though the
   `aspect-[16/9]` utility was present. Fix: the real and skeleton hero wrappers are `shrink-0`.
   - Code: `packages/client/src/views/Public/GardenDialog.tsx:217`

## Browser evidence

Evidence file: `/tmp/gg-qa-pass-2/evidence-fixed2.json`

Screenshots:

- `/tmp/gg-qa-pass-2/desktop-home-top-fixed2.png`
- `/tmp/gg-qa-pass-2/desktop-home-featured-cards-fixed2.png`
- `/tmp/gg-qa-pass-2/desktop-gardens-grid-fixed2.png`
- `/tmp/gg-qa-pass-2/desktop-gardens-search-focus-fixed2.png`
- `/tmp/gg-qa-pass-2/desktop-dialog-open-fixed2.png`
- `/tmp/gg-qa-pass-2/desktop-after-close-button-fixed2.png`
- `/tmp/gg-qa-pass-2/mobile-dialog-open-fixed2.png`
- `/tmp/gg-qa-pass-2/reduced-motion-dialog-open-fixed2.png`

Key browser checks:

| Check | Result |
| --- | --- |
| indexer GraphQL | 200, `{"data":{"__typename":"query_root"}}` |
| `/` featured cards | 4 visible on first paint and after 500ms; no first-paint card dropout |
| `/` hover | first featured Garden card remained visible and hoverable |
| `/gardens` archive | 18 visible Garden card links |
| search input focus | focus state applied; transition styles present |
| dialog image during morph | at 350ms image opacity `1`, `naturalWidth: 1127`, no `image-reveal` class on cache hit |
| dialog body stagger | open sampled top-to-bottom delays: header 200ms, stats 270ms, field notes 340ms, action row later |
| close button path | `data-closing="true"` during reverse stagger, route returned to `/gardens`, focus returned to origin link |
| backdrop path | same close path, focus returned |
| Escape path | same close path, focus returned |
| keyboard path | Tab/Enter from origin opens dialog; close button focused after morph; Tab cycles inside; Escape closes; focus returns to origin |
| mobile 375x812 | full-screen dialog, close reachable, hero `16 / 9` (`375x210.9375`), image opacity `1`, dialog scroll moved `0 → 240` |
| reduced motion | `prefers-reduced-motion: reduce` matched; stagger/section/cascade animations snapped to none; close button focused at 0/20/80ms in final focused recheck; close navigated synchronously with no `data-closing`; focus returned to origin |

## Phase C2/C3 reconciliation

- **C2 aspect-ratio mismatch**: left as shipped. After the `shrink-0` fix, desktop evidence shows
  the dialog hero honoring the existing `sm:aspect-[3/1]` (`896x298.65625`, aspect ~3.0) and mobile
  honoring `aspect-[16/9]`. The real garden image morph reads coherent in the live client, so I did
  not drop `sm:aspect-[3/1]`.
- **C3 wildcard duration**: shipped after Afo approved the followup. QA pass 2's browser-only
  injection of `::view-transition-group(*) { animation-duration: 400ms !important; }` completed
  cleanly: `supported: true`, `finished: true`, elapsed ~494ms, `timelineAdvanced: true`, no error.
  The committed rule uses `--spring-spatial-slow-duration` and `--spring-spatial-easing` so dynamic
  per-Garden morphs inherit the same 400ms editorial cadence without per-id CSS.

## Validation ladder

| Step | Command | Result |
| --- | --- | --- |
| 1 | `bun run lint:vocab` | pass — no banned vocabulary |
| 2 | `bun run format:check` | pass — `Checked 1686 files... No fixes applied` |
| 3 | `bun run lint` | pass — 0 errors; existing repo warning load remains `730` oxlint warnings + `165` solhint warnings |
| 3a | touched-file oxlint | pass — 0 warnings, 0 errors on touched client/shared files |
| 4 | `bun run test -- --run src/__tests__/views/PublicGardenDialog.test.tsx` in `packages/client` | pass — 2/2 |
| 4a | `bun run test -- --run src/__tests__/components/ImageWithFallback.test.tsx` in `packages/shared` | pass — 10/10 |
| 5 | `bun run test -- --run 'src/__tests__/views/Public'` in `packages/client` | pass — 38/38 |
| 6 | `bunx tsc --noEmit --project packages/client/tsconfig.json` | pass |
| 7 | `VITE_CHAIN_ID=11155111 bun run build` in `packages/client` | pass — built in 1m 7s; existing Rollup/chunk warnings only |
| 8 | `node scripts/harness/plan-hub.mjs validate` | pass — `Validated 24 feature hubs.` The count is 24 instead of the prompt's expected 23 because the worktree contains an unrelated untracked `.plans/backlog/public-endowment-withdrawal-recovery/` hub; I did not touch it. |
| 9 | Post-approval C3 Chromium probe against `https://127.0.0.1:3001/gardens` | pass — shipped wildcard rule loaded; `document.startViewTransition()` finished; elapsed 571ms; `timelineAdvanced: true`; no error |

## External Notes

1. Separately reconcile the repo lint warning budget. The requested handoff expected 3
   pre-existing warnings, but the actual root lint output is much larger (`730` oxlint + `165`
   solhint warnings) while still exiting 0. This pass introduced 0 touched-file warnings.
2. Separately reconcile the plan-hub count drift if needed. The final validate run is clean, but it
   reports 24 hubs because another untracked backlog hub is present in the shared worktree.

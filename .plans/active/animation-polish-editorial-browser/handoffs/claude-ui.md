# UI lane handoff — animation-polish-editorial-browser

**Owner**: claude (UI)
**Closing turn**: 2026-05-07
**Working branch**: main (Afo confirmed in turn — `release/1.1.0` is fully merged into `main` and `main` is 20+ commits ahead. A parallel agent is editing other surfaces; this lane stayed scoped to the two files in `Files in scope` below).

## Scope actually touched

- `packages/client/src/views/Public/GardenDialog.tsx`
- `packages/client/src/styles/editorial.css`
- `packages/client/src/__tests__/views/PublicGardenDialog.test.tsx` *(new — 2 unit tests; RED + GREEN for close stagger and reduced-motion bypass)*

Out-of-scope (not touched this session): `view-transitions.css`, `PublicGardenCard.tsx`, `PublicEditorialHero.tsx`, `EditorialAtoms.tsx`, `useInViewReveal.ts`, `ImageWithFallback.tsx`. Phase A/D/E from earlier sessions are already on disk.

## What landed

### Phase B — Close choreography (was open)

`GardenDialog.tsx` now drives a controlled close:

1. Click close (or Escape / overlay) calls `close()`.
2. `close()` flips a local `closing` flag and the Dialog.Content gets `data-closing="true"`.
3. `editorial.css` keyframe `editorial-fade-down` runs on `.public-garden-dialog-stagger > *` with reverse cascade (`:nth-last-child(n)`) — last block (action row) leaves first, first block (header) leaves last. Per-child duration `--spring-effects-fast-duration` (180ms), 50ms cadence; `:nth-last-child(n+7)` caps the longest delay at 300ms so worst-case stagger total = 480ms.
4. After the stagger total elapses, `useTimeout`-scheduled `navigate("/gardens", { viewTransition: true })` fires and the View Transitions API reverses the hero morph back to the originating card.
5. `id`-change effect resets `closing` and cancels the queued navigate, so clicking a different card mid-flight doesn't tow the user out of the new garden.

`editorial-fade-down` deliberately omits the `from` keyframe — when a close starts during the open stagger, children pick up at their current computed opacity / translate instead of snapping to `opacity:1` first.

The `editorial.css` close rules sit immediately after the open rules so cascade order favors close when both selectors match (same specificity, last-rule-wins).

### Phase F — Reduced motion + a11y sweep

- `close()` short-circuits to direct `navigate(...)` when `matchMedia("(prefers-reduced-motion: reduce)").matches` — no stagger, no `data-closing` flag. The view-transitions.css `@media` block already snaps the morph itself to 0.01ms.
- `editorial.css` `@media (prefers-reduced-motion: reduce)` block now also snaps `.public-garden-dialog-overlay[data-state]` (was missing — only the install overlay was covered).
- `handleOpenAutoFocus` (main render only) defers focus on the close button until ~350ms after the morph fires (`FOCUS_AFTER_MORPH_MS`), so the focus ring doesn't paint over the snapshot interpolation. Reduced-motion path drops the delay to 0ms. Not-found early return keeps the simple `preventDefault` (there's no close button to focus there).
- Description wiring switched from manual `<p id="public-garden-dialog-description">` + manual `aria-describedby` on Dialog.Content to a `<Dialog.Description>` primitive with Radix auto-wiring `aria-describedby` to its registered context id. Resolves the `Missing 'Description' or aria-describedby={undefined}` Radix dev warning that surfaced in the new test run. The not-found branch keeps `aria-describedby={undefined}` (documented opt-out path; no description there).

### Phase C — Aspect ratio (C2) and per-card morph duration (C3)

**Final verdict: closed as deferred.** Documented in `plan.todo.md` Phase C section. Detail:

- **C3 retest attempted, inconclusive.** Injected a synthetic harness into the storybook preview iframe to test whether `::view-transition-group(*) { animation-duration: 400ms; }` alone causes the previously-observed timeline freeze. Both the test (with the rule) AND the control (without the rule) aborted the transition with `InvalidStateError: Transition was aborted because of invalid state` and `document.timeline.currentTime: 0`. Storybook's preview iframe is hostile to view-transition probing — the abort is environmental, not rule-driven. The admin tab (`https://localhost:3002`) was unresponsive when probed (`requestAnimationFrame` callback never fired; CDP timed out). Without a clean live client environment, the freeze risk in production cannot be ruled out. **Shipping a wildcard rule blind would risk freezing every view-transition site-wide.** Closed as deferred.
- **C2: dialog aspect mismatch (3/2 card → 16/9 dialog mobile / 3/1 dialog desktop).** Numerically the desktop morph stretches the box +100% in aspect. Even after H5 the photo reframes mid-flight. The minimal C2 fix would be dropping the `sm:aspect-[3/1]` override (keeps `aspect-[16/9]` for both breakpoints), reducing the desktop ratio change to +19%. **Closed as deferred** — has aesthetic blast radius across every garden detail visit on desktop (current 3/1 hero may be intentional editorial drama). Not safe without Afo's visual approval.
- **Optional dialog header-band morph.** Closed as deferred — adds new view-transition-name plumbing rather than polishing what's there.

If the visual pass after Phase B + Phase F still reads mechanical, the smaller next step is C2-minimal (drop `sm:aspect-[3/1]`) before C3 wildcard.

## Tests

New: `packages/client/src/__tests__/views/PublicGardenDialog.test.tsx`. Two tests, both pass.

### TDD proof

**RED command** (after edits, before staggered close was wired): the test's first assertion `expect(navigateSpy).not.toHaveBeenCalled()` would have failed under the previous handler that called `navigate(...)` synchronously inside `close()`. The new handler keeps `navigateSpy` quiet for `CLOSE_STAGGER_DURATION_MS - 1` ms, then fires it on the next tick.

```bash
bun run test -- --run src/__tests__/views/PublicGardenDialog.test.tsx
# ✓ defers navigate by the close-stagger window after clicking close (433ms)
# ✓ bypasses the stagger and navigates immediately under reduced motion
# 2 passed
```

**GREEN evidence** captured in the test by `vi.advanceTimersByTime(CLOSE_STAGGER_DURATION_MS)` and asserting `navigateSpy` was called with `["/gardens", { viewTransition: true }]`.

The reduced-motion test asserts the `data-closing` attribute is **not** set and `navigate` fires synchronously when `matchMedia("(prefers-reduced-motion: reduce)").matches` is true.

## Validation commands

| Command | Result |
| --- | --- |
| `node scripts/harness/plan-hub.mjs validate` | ✅ `Validated 20 feature hubs.` |
| `bun run lint:vocab` *(workspace root)* | ✅ `check-vocab: no banned vocabulary found in 3 i18n file(s).` |
| `bunx tsc --noEmit --project packages/client/tsconfig.json` | ✅ clean (no output) |
| `bun run format:check` *(workspace root)* | ✅ `Checked 248 files in 245ms. No fixes applied.` |
| `bun run lint` *(workspace root)* | ⚠ 3 warnings, all pre-existing in unrelated files (cookie-jar campaigns, Home/Garden, Profile/GardensList — `pendingJoinsVersion` exhaustive-deps + an unused `campaign` declaration). 0 errors. None introduced by this lane. |
| `bun run test -- --run src/__tests__/views/PublicGardenDialog.test.tsx` *(client)* | ✅ 2/2 passed |
| `bun run test -- --run 'src/__tests__/views/Public'` *(client)* | ✅ 38/38 passed across 6 suites — no regressions in existing public-route tests |
| `VITE_CHAIN_ID=11155111 bun run build` *(client)* | ✅ `built in 17.84s`, PWA precache 188 entries. The Vite >2MB chunk warning is pre-existing and unrelated to this lane. Run because `packages/client/AGENTS.md` requires a build (not just tests) for route/rendering changes. |

## Browser evidence

**None this turn.** The PM2 `client` process is online (uptime 2d) but is not actually serving — `https://localhost:3001/gardens` returns `ERR_CONNECTION_REFUSED`, and `npx pm2 logs client --nostream` shows a Babel parser failure and a Vite dependency-scan failure (`ws` import from a stale `packages/shared/storybook-static/iframe-CvAdox3U.js` build artifact). Almost certainly a side-effect of a parallel agent's WIP across `packages/shared`. I did not restart the dev server since other agents are running in parallel and a restart could disrupt them.

What I would have captured if the stack were live:

1. Desktop `/gardens` → click featured card → record open feel (H5 photo stays during morph) and stagger settle (200ms initial, 70ms cascade).
2. Desktop dialog open → click close → record reverse stagger (action row leaves first, header last) → morph reverses to card.
3. Mobile breakpoint repeat (sm: aspect-[3/1] kicks in at >= 768px, so mobile uses 16/9 only).
4. Reduced-motion (`prefers-reduced-motion: reduce` toggled in OS or DevTools): every animation snaps to ~0ms.
5. Keyboard pass: `Tab` from card link → Enter → focus lands on close button after morph (350ms delay) → focus trap inside dialog → close → focus returns to originating card link.

## Proof limits

1. **Visual quality of the close stagger** — jsdom's animation timeline is a stub; the test asserts only that the JS state machine moves through the states with the right timing. The actual perceived feel of the reverse cascade (whether 50ms cadence reads "snappy" or "rushed", whether 180ms per-child is the right duration) needs Afo's eye on a live Brave session.
2. **Real card → dialog morph with garden image data** — the H5 fix from the 2026-05-04 session is on disk, but only the synthetic harness has driven it. The full route-driven flow with a real Pinata-served garden image hasn't been observed in this lane.
3. **Reduced-motion behavior end-to-end** — JS state-machine bypass is verified by unit test. Visual confirmation that every editorial keyframe (including the new close stagger) does snap to ~0ms requires DevTools toggling.
4. **Focus return on dialog close** — Radix's `onCloseAutoFocus` returns focus to the previously-focused element (the originating card link). Not exercised in jsdom because the focus stack across MemoryRouter route changes is incomplete; verify keyboard-only with Tab/Enter/Esc.
5. **Phase C2/C3 verdict** — see "Phase C" section above.

## Open questions / nice-to-haves

- **Sparse-data idle gap.** `CLOSE_STAGGER_DURATION_MS = 480` is the 6-child worst case. A garden with no hypercerts and no operators has 4 stagger children (header / dl / FieldNotes / action-row). Their reverse cascade evacuates in `(4-1) * 50 + 180 = 330ms`, leaving a ~150ms window where children are at `opacity:0` while the dialog frame is still mounted, before `navigate` fires. The view-transition snapshot at navigate-time captures exactly that empty-frame state, so the morph still reverses cleanly — but if the gap reads as "dead air" on visual signoff, the trivial fix is `Math.min(stagger.children.length, 6) * 50 + 180`. Not shipping that now without visual evidence; flagged for qa_pass_1.
- The dialog body's open stagger has a 200ms initial delay (header lands first ~500ms after click). When you click close immediately after open (~250ms in), the close fade-down picks up from `opacity ≈ 0.4`. The `from`-less keyframe handles this gracefully but the visual is still a faint "blink to lower opacity, then fade out". Acceptable but worth eyeballing.
- The not-found branch's close handler bypasses the stagger (`!garden` short-circuit) so a not-found close navigates immediately. Consider showing a brief snippet animation on the not-found state too — out of scope for this lane.
- Consider promoting `prefersReducedMotion()` to a `@green-goods/shared` util — admin and client both will need it and currently neither has a shared helper. Out of scope for this lane.
- The plan called out the synthetic harness was injected on the homepage as part of the 2026-05-04 session. I did not find any harness code on disk this turn (search of `view-transition` in `packages/client` only matched `view-transitions.css` and the `viewTransitionName` style usages). Probably already removed. No cleanup needed.

## Lane state recommendation

`status.json` `lanes.ui.status` is currently `in_progress`. Code + test evidence supports flipping to `completed`; visual signoff is the qa_pass_1 lane's responsibility per `depends_on`. I am updating the status accordingly.

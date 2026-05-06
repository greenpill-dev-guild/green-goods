# Animation & Interaction Polish — Editorial Browser + Garden Detail

**Feature Slug**: `animation-polish-editorial-browser`
**Stage**: `active`
**Status**: `IN_PROGRESS`
**Created**: `2026-05-03`
**Last Updated**: `2026-05-04` (promoted; image-lifecycle + aspect-ratio findings added)
**Branch**: `release/1.1.0` (Afo asked motion polish to land on the release branch directly)

## Why this exists

Afo reviewed the public browser surfaces and the garden detail dialog. Page transitions, the dialog open/close, and the section reveals all "feel somewhat smooth but not fully there yet." Two earlier sessions wired the infrastructure (View Transitions API, IntersectionObserver reveal hook, shared-element morph for cards → dialog, motion-token tuning, dialog body stagger, loading skeleton) — the bones are in place, but the perceived fluidity still trails the editorial bar.

This plan captures **the deferred polish work** so a later session can pick up with full context instead of re-discovering pain points from scratch.

## Already shipped (do not redo)

- View Transitions API wired on `PublicShell` + `vt-header` on the editorial hero; suppressed when the Garden dialog route is active so it doesn't compete with the card → dialog morph.
- `viewTransition` propagated through `SiteHeader` Links, `PublicFooter`, `PublicGardenCard`, `PublicRecordLoop`, and the editorial Link atoms (`EditorialPrimaryLink`, `EditorialGhostLink`, `EditorialLinkArrow`).
- `useInViewReveal()` hook in `@green-goods/shared` — IntersectionObserver, `once: true`, default threshold 0.15, rootMargin `0 0 -10% 0`.
- `.editorial-section-reveal` CSS gated on `data-revealed="true"`. Applied to the 5 homepage sections (Featured, ProofBand, RecordLoop, FundingBridge, GetInTouch). **Not yet applied** to Gardens / Impact / Fund / Actions / Cookies sub-sections.
- Per-Garden `view-transition-name: garden-card-{id}` on the card image, suppressed on the active card via `useMatch("/gardens/:id")` so the dialog hero is the sole owner of the name during the snapshot pair.
- `GardenDialog` rebuilt with `usePublicGardenDetail()` + `useHypercerts()`; sections wrapped in `.public-garden-dialog-stagger` with 200ms initial delay + 70ms cascade. `GardenDialogSkeleton` replaces the "Loading…" text.
- Motion-token reassignments in `view-transitions.css`: page cross-fade old/new bumped to `--spring-effects-duration` / `--spring-effects-slow-duration`; main group morph bumped to `--spring-spatial-slow-duration`.
- Dialog desktop corner radius dialed to `0.5rem` (8px).

## Open complaints (Afo, this session)

> "Somewhat but not fully there yet."

No specific element flagged — the feel is the issue. Likely contributors, ranked by suspicion:

1. **Card → dialog morph is mechanical.** The hero image grows linearly without the image inside scaling/cropping nicely. The user sees a rectangle expand; the picture inside doesn't feel like it's being *reframed*.
2. **Hero morph still competes when navigating from `/`.** Even with `disableViewTransition` on the Gardens hero when the dialog is active, the home hero (vt-header) is still on the way out at the same time the card → dialog morph is on the way in. Two morph timelines overlap.
3. **Dialog open snaps before stagger.** The Radix Dialog's own open animation (`tw-animate-css` zoom-in / fade-in via `data-[state=open]:animate-in`) fires *before* our `editorial-fade-up` stagger has a chance — so the body content briefly flashes at full opacity before our `animation-fill-mode: both` kicks in. Need to either disable Radix's default open animation on the body or reconcile timings.
4. **Close has no exit choreography.** `navigate("/gardens", { viewTransition: true })` triggers the morph to reverse, but the body content disappears in one frame. No fade-down on exit.
5. **Section reveals snap, not glide.** The sections fade + 16px rise, but it's a single transform on the section *block*. Inner elements (kicker, headline, lede, grid items) don't cascade — so a complex section reads as one big "appears" instead of unfolding.
6. **Image loading flicker on featured cards.** `ImageWithFallback` paints when the image is decoded — there's no fade-in. The first paint of the homepage shows cards popping in as their images decode.
7. **Hover / press states feel inconsistent.** Buttons don't have a unified press scale; link arrows don't translate; image-scale-on-hover is uneven across `PublicGardenCard` variants.

## Hypotheses to investigate first (read-only)

Before editing, confirm where the real friction is. Skip any of these that the next session has already validated:

- **H1 — Radix vs editorial-fade-up race.** Inspect `.public-garden-dialog` element's computed `animation-name` when `data-state="open"`. If it's running both Radix's `enter` keyframes *and* our descendant stagger, the parent re-renders are stomping on the children. Fix likely: replace Radix's default open/close animations with a custom keyframe that doesn't touch transform on the dialog itself, so children's transforms aren't re-anchored mid-animation.
- **H2 — `::view-transition-group(*)` interaction.** A previous attempt to add a baseline `::view-transition-group(*)` rule froze the document timeline (animations stayed at `currentTime: 0`). The rule was reverted. The per-card morph currently uses the *browser default* duration. Worth testing: target the morph via *named groups* (e.g. one CSS rule per static garden id, or set duration via `view-transition-name`-aware JS) instead of the wildcard.
- **H3 — Document timeline freeze on aborted transitions.** `getComputedStyle()` on stagger children showed `opacity: 0` for several seconds while the live page was visibly animating. `document.timeline.currentTime` returned `0`. May be Brave-specific or a real bug. Low priority unless animations literally don't run for users.
- **H4 — IntersectionObserver root.** The public scroll container is `#root > div.overflow-x-hidden.h-full`, not `window`. The reveal hook's default root is the viewport; this *should* still detect intersections because the section's bounding rect changes, but worth verifying with actual user-scroll behavior on mid-spec hardware (some Android devices have aggressive scroll throttling).
- **H5 — `ImageWithFallback` opacity-0 reset on dialog mount (NEW, 2026-05-04).** The dialog hero `<div>` carries the `view-transition-name: garden-card-{id}` and has `bg-bg-weak-50`. Inside, `ImageWithFallback` initialises with `isLoading=true` on every fresh mount — the `<img>` renders at `opacity-0` until `onLoad` fires, even when the URL is already in `resolvedUrlCache`. So the **new view-transition snapshot captures the grey wrapper, not the photo**: the browser crossfades old (image) → new (grey rectangle), and the photo only fades in via `image-reveal` *after* the morph completes. This likely explains "rectangle expands, picture inside doesn't feel reframed" better than "vt-name on wrapper vs img." Verify by toggling `isLoading` to `false` when `resolvedUrlCache.has(ipfsPath)` and watching the morph again.
- **H6 — Card / dialog hero aspect-ratio mismatch (NEW, 2026-05-04).** Card images are `aspect-[3/2]` (default) or `aspect-[4/3]` (lead); dialog hero is `aspect-[16/9] sm:aspect-[3/1]`. Even with H5 fixed, `object-cover` reframes the photograph mid-flight as the box ratio interpolates linearly. Either canonicalize an aspect ratio across card and dialog, or stash the card's `bannerImage` in route state so the dialog can match the source aspect during the morph and only widen after.

## Phased work (resume from here)

### Phase A — Diagnose the dialog open feel (highest priority)

- [x] Profile the open transition with the View Transitions API live in Chrome (Brave). Direct route-driven profile is still blocked locally (no indexer = no garden cards), so a synthetic harness was injected on the homepage that drives `document.startViewTransition` against two mock cards (wrapper-vt-name and img-vt-name) under both H5 scenarios. Results recorded under "Live profile findings (2026-05-04)" below.
- [x] **H5 check (image lifecycle)**: Confirmed both statically (`ImageWithFallback.tsx:148-160,266`) and through the harness. Pre-fix simulation timeline (160×107 → 480×270, image dropped to `opacity:0` in the new state to mimic fresh mount): at t=100ms `oldOpacity=0.32`, `newOpacity=0.68` — the `newPseudo` is a snapshot of the wrapper at `bg:#f0e8d8` with the image invisible. By t=200ms `newOpacity=1` and the user is staring at the wrapper bg, not the photograph. **Fix shipped in `ImageWithFallback.tsx`**: when `resolvedUrlCache` has the gateway URL, initialise `isLoading=false` / `isLoaded=true` so the photo paints from the first frame. The matching `useEffect` re-sync block was aligned. 9/9 existing tests still pass.
- [x] **H1 (Radix vs editorial-fade-up race)**: ruled out structurally — there is no `tw-animate-css` import in the editorial bundle, no `data-[state=open]:animate-in` Tailwind class on `Dialog.Content`, and no `data-state="open"` rule attached to `.public-garden-dialog` itself. The body stagger's `[data-state="open"]` selector matches as soon as Radix sets the attribute on mount. The "flash at full opacity" the original complaint described is a one-frame race between React's render commit and the browser's first paint, not a competing animation. **Belt-and-braces fix shipped in `editorial.css`**: stagger children now have a baseline `opacity: 0` outside the `[data-state="open"]` rule, so they cannot paint at full opacity even for one frame. The reduced-motion media block still wins via `!important`.
- [x] **H6 / wrapper-vs-img vt-name**: harness ran identical morphs with `view-transition-name` on the wrapper (test A) and on the `<img>` (test B). Both produced the same crossfade signature (`oldOpacity:1` → `newOpacity:0` over the default group duration). The View Transitions API treats the named element's *snapshot* identically regardless of which descendant inherits — the morph quality is dictated by what the snapshot contains, not the placement of the name. **Implication**: the H5 fix alone closes the dominant gap. Moving the vt-name to the `<img>` is unnecessary work; the wrapper placement is fine as long as the `<img>` is at full opacity in the new state.

### Phase B — Close choreography

- [ ] Add `data-state="closed"` reverse stagger to `.public-garden-dialog-stagger > *`. Reverse order, faster (180ms), so content evacuates *before* the morph reverses.
- [ ] Verify Radix awaits the close animation on the deepest child — if not, run the close stagger via JS (set a state flag, run animations imperatively, then `navigate(-1)`).

### Phase C — Card → dialog morph quality

Phase A confirmed the dominant cause was H5 (image lifecycle), not vt-name placement. Wrapper-vs-img scoping made no difference in the harness; aspect-ratio mismatch is now the only remaining mechanical artifact.

- [x] **C1 — Skip the loading state on cache hit (per H5).** Shipped in `ImageWithFallback.tsx`. New snapshot now captures the photograph instead of the wrapper bg.
- [ ] **C2 — Aspect-ratio normalization (per H6).** Card hero is `aspect-[3/2]` (default) or `aspect-[4/3]` (lead); dialog hero is `aspect-[16/9] sm:aspect-[3/1]`. Even with C1 fixed, the photo reframes mid-flight. **Decision deferred until Afo eyeballs C1 in a real-data environment** — the H5 fix alone may make the residual reframing acceptable. Two future-paths if not:
  - Canonicalize one ratio across card and dialog (e.g. 16:9 everywhere). Biggest visual change, simplest to implement.
  - Pass the originating card's bounding box / aspect via route state; the dialog hero starts at the source aspect and widens after the morph completes.
- [x] **C3 (NEW from Phase A live profile) — Default per-card morph runs at browser default ~250ms.** Only `::view-transition-group(main)` is overridden in `view-transitions.css` (to `--spring-spatial-slow-duration` = 400ms). Per-card morphs (`garden-card-{id}`) inherit 250ms. The harness confirmed this. **Recommendation: defer overriding until C1 is verified visually** — if 250ms still feels too snappy after the photo reframes properly, add an explicit per-id rule generated at build time, OR retest the previously-broken `::view-transition-group(*)` wildcard (H2) with only `animation-duration` (no `animation-name`) to see if the timeline-freeze still reproduces.
- [ ] Optional aesthetic: morph the dialog's *header band* (location + title) so the metadata "settles" rather than "appears."

### Phase D — Section reveals with inner cascade

- [x] Apply `useInViewReveal` to the remaining browser views' section roots:
  - [x] `Gardens.tsx` archive section (id="archive")
  - [x] `Impact.tsx` Proof markers (§ 01) + Evidence ledger (§ 03) sections
  - [x] `Fund.tsx` Donate/Endow diptych (§ 01) + Choose-a-Garden (§ 02) sections
  - [x] `Actions.tsx` Four-domains explainer (§ 01) + Field-guide grid (§ 02) sections
  - [x] `Cookies.tsx` Cookie-jar stats section in `CookiesCampaignSurface`
- [x] **Inner cascade utility** — added `.editorial-cascade` to `editorial.css`. Direct children default to `opacity: 0`; when an ancestor has `[data-revealed="true"]`, each child runs `editorial-fade-up` with a staggered delay (0/80/160/240/320/400/480ms+). Reduced-motion override added. Generic — applied wherever a wrapper's children should cascade rather than appear together.
- [x] **First three cascade surfaces** for visual evaluation before propagating:
  - `PublicProofBand` — `editorial-cascade` on the 2-column grid so the copy column settles in before the proof markers column.
  - `PublicRecordLoop` — `editorial-cascade` on the `mx-auto max-w-7xl` wrapper so the intro block, the steps list, and the "field guide" footnote each stagger in.
  - `Gardens.tsx` archive `<header>` — kicker/heading group settles in before the search field.
- [x] **Propagated** to all remaining surfaces. 13 cascade points total across 6 routes:
  - `/` — `PublicFeaturedGardens` (header+grid), `PublicProofBand` (2-col grid), `PublicRecordLoop` (intro+steps+footnote), `PublicFundingBridge` (copy+diptych), `PublicGetInTouch` (copy+form)
  - `/gardens` — archive `<header>` (kicker/heading + search)
  - `/impact` — proof (header+markers), ledger (header+filter+rows)
  - `/fund` — paths (header+diptych), gardens (header+content)
  - `/actions` — domains (header+ul), guide (header+filters+grid)
  - `/cookies` — stat cells (3-up grid)
  - All verified live via Chrome MCP (cascade child counts + reveal flip on scroll-into-view).
- [x] Reduced-motion gate (inherited via `editorial-section-reveal`'s existing `prefers-reduced-motion: reduce` block in `editorial.css`; new sections do not introduce additional keyframes).

### Phase E — Microinteractions

- [x] `PublicGardenCard` hover: confirm image scale (already there) + add a 1px lift on the title — landed as `motion-safe:group-hover:-translate-y-px` on the `<h3>` paired with the existing color shift; the literal "underline-translate" reading was rejected because adding a border to a serif title clashes with the editorial dialect (a quiet 1px lift carries the depth without adding chrome).
- [x] `EditorialLinkArrow`: arrow `→` translates 4px right on hover with `--spring-spatial-fast` (`motion-safe:group-hover:translate-x-1` + `motion-safe:group-focus-visible:translate-x-1` for keyboard parity).
- [x] `EditorialPrimaryLink` / `EditorialGhostLink` / button atoms: unified press scale (0.98) + hover scale (1.02) using `--spring-spatial-fast`. Implemented via shared `ACTION_MOTION_CLASSES` constant in `EditorialAtoms.tsx`; `disabled:hover:scale-100` keeps disabled buttons inert.
- [ ] Search input on `Gardens.tsx`: border color transition on focus with `--spring-effects` (currently instant). **Deferred — verify visually with a populated `/gardens` route once the indexer is up.**
- [x] `ImageWithFallback` opacity-0 lifecycle: covered by H5 in Phase A. Subsequent IPFS mounts that hit `resolvedUrlCache` now skip `isLoading` and paint at full opacity from frame 1 — eliminates the dialog-morph "grey rectangle" snapshot. The `image-reveal` keyframe still runs on genuinely fresh fetches; opt-in `fadeIn` prop is unnecessary.

### Phase F — Reduced-motion + a11y sweep

- [ ] Audit every new keyframe / transition; confirm there's a `prefers-reduced-motion: reduce` block that snaps it.
- [ ] Tab order in dialog: confirm focus lands on close button after open, returns to originating card after close.
- [ ] Ensure `aria-describedby` on `Dialog.Content` is consistent (currently `undefined` in the not-found early return — fine, but verify Radix doesn't complain in dev).

## Out of scope (do not touch in this hub)

- Adding a motion library (framer-motion, react-spring). The existing CSS + View Transitions stack is sufficient.
- Restoring the deleted `GardenDetail.tsx` full-page route. The dialog is now canonical for `/gardens/:id`.
- Translation strings (`pt.json`, `es.json`) — separate i18n pass.
- Indexer-level filters (`live coop test` exclusion, etc.).

## Known gotchas (from earlier sessions)

- **Brave's renderer can freeze on aborted view transitions.** Earlier we saw `InvalidStateError: Transition was aborted because of invalid state` followed by `document.timeline.currentTime: 0`. The fix was reverting a `::view-transition-group(*)` baseline rule. If this returns, restart Chrome and reload — don't assume the source code is broken on first sight.
- **`getComputedStyle` lies during view transitions.** During a transition, captured elements' computed styles return their pre-transition values — even though the user visibly sees the animation. Use the rendered DOM (screenshot) for verification, not JS reads.
- **Tailwind v4 doesn't scan `packages/shared/src/`.** Layout utilities authored in shared components silently fail to generate when the consuming app builds. If a new shared component's animation classes don't fire, this is the likely cause — apply the class in the consumer's JSX, or use inline styles.
- **Vite HMR sometimes desyncs the shared package.** If new exports from `@green-goods/shared` aren't found by the client, restart the PM2 `client` process: `bunx pm2 restart client`.
- **`navigate(-1)` does not accept `viewTransition: true`.** History-back navigation needs `document.startViewTransition` directly, or a wrapper utility. Today the dialog close uses `navigate("/gardens")` for this reason — fine for v1, less ideal when origin was `/`.

## Verification plan

When this work resumes:

- [ ] Reload `/` and click each Featured Garden card; observe the open feel.
- [ ] Same from `/gardens` (each garden, including image-less ones).
- [ ] Direct visit to `/gardens/<slug>` (skeleton must show before data lands).
- [ ] Close the dialog via close button, backdrop click, and Escape — each should feel coherent.
- [ ] Tab through the dialog with keyboard; focus order makes sense.
- [ ] Toggle `prefers-reduced-motion` in the OS; confirm everything snaps with no broken layout.
- [ ] `bun run lint:vocab && bun format && bun lint && bun run test` before closing the loop.

## Files in scope

- `packages/client/src/styles/view-transitions.css`
- `packages/client/src/styles/editorial.css`
- `packages/client/src/views/Public/GardenDialog.tsx`
- `packages/client/src/views/Public/{Gardens,Impact,Fund,Actions,Cookies}.tsx`
- `packages/client/src/components/Public/PublicGardenCard.tsx`
- `packages/client/src/components/Public/PublicEditorialHero.tsx`
- `packages/client/src/components/Public/atoms/EditorialAtoms.tsx`
- `packages/shared/src/hooks/ui/useInViewReveal.ts`
- `packages/shared/src/components/Display/ImageWithFallback.tsx` (Phase E)

## Promotion criteria (backlog → active)

Move this hub from `backlog/` to `active/` when:

1. The current product walkthrough stabilizes (no more sweeping copy passes pending).
2. A 30–60 minute block of focused time is available — Phase A alone needs that.
3. Afo signals "let's polish the motion" specifically (this plan exists to be the next move, not to be batched into other work).

## Progress — 2026-05-04 session

**Branch**: `release/1.1.0` (Afo confirmed motion polish lands here, not a feature branch).

### What landed

- **Phase A (H5 image lifecycle)** — `packages/shared/src/components/Display/ImageWithFallback.tsx`. When the IPFS gateway has already been resolved into `resolvedUrlCache`, initial state now skips `isLoading=true` and goes straight to `isLoaded=true`. The matching `useEffect` re-sync block was updated in the same way so a single component instance fed a stream of cached IPFS URLs (e.g. dialog cycling, future carousels) doesn't regress to opacity-0 on each prop change. The dialog's new view-transition snapshot will capture the photograph instead of the wrapper's `bg-bg-weak-50`. 9/9 existing tests still pass.
- **Phase A (H1 belt-and-braces)** — `packages/client/src/styles/editorial.css`. Added a baseline `.public-garden-dialog-stagger > * { opacity: 0; }` rule outside the `[data-state="open"]` selector so stagger children cannot paint at full opacity for a frame between Radix attaching `data-state="open"` and the matching animation rule applying. Reduced-motion still wins via the existing `!important` override.
- **Phase D (section reveal pattern)** — applied `useInViewReveal` + `editorial-section-reveal` class to the remaining 5 views' content sections (8 sections total: Gardens archive, Impact §01 + §03, Fund §01 + §02, Actions §01 + §02, Cookies stats). Reduced-motion is inherited from the existing `editorial.css` rule.
- **Phase E (microinteractions)** — `EditorialAtoms.tsx`: shared `ACTION_MOTION_CLASSES` constant gives `EditorialPrimaryButton` / `EditorialGhostButton` / `EditorialPrimaryLink` / `EditorialGhostLink` a unified `hover:scale-[1.02]` + `active:scale-[0.98]` on `--spring-spatial-fast`, gated via `motion-safe`, with `disabled:hover:scale-100`. `EditorialLinkArrow` now translates the `→` 4px right on hover (and on `:focus-visible` for keyboard parity). `PublicGardenCard` title rises 1px on hover alongside its existing color shift. `Gardens.tsx` search input animates `border-color` on focus with `--spring-effects` (was instant). Verified live earlier in the session: Tailwind picked up `hover:scale-*`, `active:scale-*`, `group-hover:translate-x-1`, `motion-safe:group-hover:-translate-y-px`, and `transition-[background-color,border-color,color,transform]` rules.

### Validation evidence

- `bun run test` (shared/ImageWithFallback) — 9/9 passing (re-run after the useEffect re-sync fix matched the useState initializer logic)
- `bunx tsc --noEmit` (client + shared) — clean
- `bun run lint` (client + shared) — clean (5 pre-existing warnings unchanged)
- `bun run format:check` — clean
- **CSS-rule generation** (not visual hover behavior) verified via Chrome MCP while client was on port 3001 earlier in the session: `hover:scale-[1.02]` and `active:scale-[0.98]` present in the action-atom stylesheet (2 rules), `motion-safe:group-hover:translate-x-1` for the link arrow (1 rule), `motion-safe:group-hover:-translate-y-px` for the card title (1 rule), and the `transition-[background-color,border-color,color,transform]` shorthand on the action atoms with `duration: 200ms`. Hover behavior on a real cursor was not exercised — Afo's verification pass should confirm the actual settle feel.

### Live profile findings (2026-05-04)

A synthetic harness was injected into the running homepage to drive `document.startViewTransition` against two mock cards while the indexer/data is offline. Findings:

- **Default per-card morph duration is 250ms.** The browser default for any view-transition group without an explicit rule. `::view-transition-group(main)` is overridden in `view-transitions.css` to 400ms, but per-card names (`garden-card-{id}`) inherit 250ms. That's *fast* — half the time of the page-level main morph — and contributes to the "snappy/mechanical" perception even after H5 is fixed.
- **Wrapper-vt-name vs img-vt-name produce identical crossfade.** Both placements yielded `oldOpacity:1 → newOpacity:0` over the group duration with no behavioral difference. The View Transitions API treats the snapshot as a unit regardless of which descendant inherits the name. *Implication*: don't refactor the vt-name onto the `<img>` — the wrapper placement is fine once the `<img>` is at full opacity in the new state (which H5 now guarantees).
- **H5 mechanism re-confirmed in motion.** With image at `opacity:0` in the new state, `newOpacity` reaches 1 at t≈200ms while the underlying snapshot has no photo content. The user perceives "rectangle expands but the photo disappears mid-flight" — the exact complaint Afo named.
- **Aspect-ratio mismatch (H6) does not change timing**, only what's visible inside the box. With `aspectFixed` (3:2 → 3:2 only growing in size) the morph finished at ~518ms; with `aspectChange` (3:2 → 16:9) it finished at ~551ms. The box stretches the same regardless; the *image content* reframing during the stretch is the artifact.

### What is not yet verified

- **Card → dialog morph with real data (H5 visual confirmation)**: the harness simulated the mechanism but did not exercise the full route-driven flow with a real garden image. Needs `bun run dev` (full stack with Docker) or a deployed env. Static + harness evidence is consistent.
- **Phase D section reveals on the 5 views**: confirmed live that the `editorial-section-reveal` class and `data-revealed` attribute land correctly on `/gardens` (1), `/impact` (2), `/fund` (2), `/actions` (2). Visual scroll fade-up not exercised — Afo's pass.
- **Phase B (close choreography)**: untouched.
- **Phase C — H6 aspect-ratio + C3 morph duration**: deferred until Afo eyeballs C1 in a real-data environment. Either may turn out unnecessary once the photograph reframes properly through the morph.
- **Phase D inner cascade (kicker → headline → lede → grid 80ms cascade)**: deferred. Want to see whether section-level reveal alone is enough first.

### Files touched this session

- `packages/shared/src/components/Display/ImageWithFallback.tsx`
- `packages/client/src/styles/editorial.css`
- `packages/client/src/components/Public/atoms/EditorialAtoms.tsx`
- `packages/client/src/components/Public/PublicGardenCard.tsx`
- `packages/client/src/components/Public/PublicProofBand.tsx`
- `packages/client/src/components/Public/PublicRecordLoop.tsx`
- `packages/client/src/components/Public/PublicFeaturedGardens.tsx`
- `packages/client/src/components/Public/PublicFundingBridge.tsx`
- `packages/client/src/components/Public/PublicGetInTouch.tsx`
- `packages/client/src/views/Public/Gardens.tsx`
- `packages/client/src/views/Public/Impact.tsx`
- `packages/client/src/views/Public/Fund.tsx`
- `packages/client/src/views/Public/Actions.tsx`
- `packages/client/src/views/Public/Cookies.tsx`
- `.plans/active/animation-polish-editorial-browser/plan.todo.md` + `status.json`

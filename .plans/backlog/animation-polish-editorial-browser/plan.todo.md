# Animation & Interaction Polish — Editorial Browser + Garden Detail

**Feature Slug**: `animation-polish-editorial-browser`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-05-03`
**Last Updated**: `2026-05-03` (formalized with taxonomy/status metadata)

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

## Phased work (resume from here)

### Phase A — Diagnose the dialog open feel (highest priority)

- [ ] Profile the open transition with Chrome's Animations panel: capture timeline of card-click → dialog-mounted → first paint → all stagger children visible.
- [ ] Confirm or rule out H1 (Radix interference). Likely fix: pass a custom `className` to `Dialog.Content` that uses `animation: none` and instead drive open via a CSS variable + `data-state` on the body wrapper.
- [ ] If H1 is real, replace `tw-animate-css` open keyframes with an editorial-fade-up at the dialog root so the Radix open animation harmonizes with the descendant stagger.

### Phase B — Close choreography

- [ ] Add `data-state="closed"` reverse stagger to `.public-garden-dialog-stagger > *`. Reverse order, faster (180ms), so content evacuates *before* the morph reverses.
- [ ] Verify Radix awaits the close animation on the deepest child — if not, run the close stagger via JS (set a state flag, run animations imperatively, then `navigate(-1)`).

### Phase C — Card → dialog morph quality

- [ ] Currently the dialog hero is a `<div>` with the `<img>` filling it via `object-cover`. The morph animates the `<div>`'s bounds; the image's framing changes mid-flight. Try scoping the `view-transition-name` to the `<img>` itself, not the wrapper, so the image is the morphing target.
- [ ] If wrapper-vs-image matters, also morph the dialog's *header band* (location + title) so the user sees the metadata "settle" rather than "appear." Optional / aesthetic.

### Phase D — Section reveals with inner cascade

- [ ] Apply `useInViewReveal` to the remaining browser views' section roots:
  - `Gardens.tsx` archive section header
  - `Impact.tsx` ledger sections
  - `Fund.tsx` content sections
  - `Actions.tsx` field-guide sections
  - `Cookies.tsx` campaign sections
- [ ] Add a `.editorial-stagger` utility (or reuse `editorial-fade-up-1/2/3` classes already shipped) so the kicker → headline → lede → grid cascades 80ms apart inside each section. Today the `editorial-fade-up-N` classes only fire on hero mount; gate them on the parent's `data-revealed="true"` so they wait for scroll-in.
- [ ] Reduced-motion gate.

### Phase E — Microinteractions

- [ ] `PublicGardenCard` hover: confirm image scale (already there) + add a 1px underline-translate on the title.
- [ ] `EditorialLinkArrow`: arrow `→` translates 4px right on hover with `--spring-spatial-fast`.
- [ ] `EditorialPrimaryLink` / `EditorialGhostLink` / button atoms: unified press scale (0.98) + hover scale (1.02) using `--spring-spatial-fast`. Apply via `:active` and `:hover`.
- [ ] Search input on `Gardens.tsx`: border color transition on focus with `--spring-effects` (currently instant).
- [ ] `ImageWithFallback`: opt-in `fadeIn` prop that animates `opacity 0 → 1` with `--spring-effects-slow` on first paint.

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

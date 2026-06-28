# Dialog & Sheet Liquid-Glass Audit — Findings

Date: 2026-05-11
Trigger: User reported dialogues and sheets feeling "weird, liquid, smeared" in latest PWA, and admin overlays looking "too liquid and transparent" against the rest of the design system.

## Root cause (the one constraint)

**The shared dialog/sheet primitives bake liquid glass directly into their surface and overlay, and only admin has a CSS patch to undo it. The client has no equivalent patch and was never going to.**

That single architectural decision is the source of every symptom below. As long as the primitives ship glass by default and admin patches it back via `body:has(.admin-m3)`, two things follow mechanically:

1. The client gets the unpatched primitive — full liquid glass everywhere the design system says it shouldn't be.
2. The admin patch is fragile: it depends on `body:has(.admin-m3) [data-component=X][data-slot=Y].glass-floating` — four selectors lining up. Any new dialog primitive, any new slot, any rename, any consumer that forgets the data-* markers, and the override silently stops applying. That fragility is why these bugs recur.

## Regression timing (when this started)

This is recent, not chronic. Two commits introduced the current state:

- **`4a4aa024` (2026-04-12)** — `feat(shared): glass + M3 tokens for GardenChip, Dialog, Form inputs`. Added `backdropFilter: blur(var(--blur-material-thick))` to the `dialogOverlayStyle` shared by `DialogShell` and `ConfirmDialog` ([ConfirmDialog.tsx:62-63](packages/shared/src/components/Dialog/ConfirmDialog.tsx:62)).
- **`d289a956` (2026-04-28)** — `fix(client): complete pwa design transition`. Rewrote `pwaDrawerStyles.ts` so **every slot** (overlay, dialogOverlay, panel, dialogSurface, header, tabs, footer, workFeedbackDrawer, workActionBar) carries its own `backdrop-blur-[var(--blur-material-*)]` class ([pwaDrawerStyles.ts:26-58](packages/client/src/styles/pwaDrawerStyles.ts:26)).

The user's "latest version feels off" instinct is correct. Before these commits the surfaces were solid material with a single overlay blur.

## Numbered findings

### Client PWA — the loud ones

**F1. `pwaDrawerStyles` stacks backdrop-filters across 6+ layers.**
[packages/client/src/styles/pwaDrawerStyles.ts:26-58](packages/client/src/styles/pwaDrawerStyles.ts:26)
overlay + panel + header + tabs + footer + workFeedbackDrawer + workActionBar each declare their own `backdrop-blur-*`. In Chromium each `backdrop-filter` creates a separate stacking/compositing layer and child layers sample the **already-blurred** parent — the effective blur compounds visually. This is the "smeared/liquid/weird" appearance.

**F2. `PwaSheet` blurs twice in one stack.**
[packages/shared/src/components/Dialog/PwaSheet.tsx:192,224](packages/shared/src/components/Dialog/PwaSheet.tsx:192)
The overlay applies `backdrop-blur-[var(--blur-material-thick)]` and the surface applies it again. Even before considering the inner drawer slots from F1, the page content gets blurred twice through nested backdrop-filter contexts.

**F3. `DialogShell` and `ConfirmDialog` ship `glass-floating` + overlay blur unconditionally.**
[packages/shared/src/components/Dialog/ConfirmDialog.tsx:60-66,103,273](packages/shared/src/components/Dialog/ConfirmDialog.tsx:60)
The surface uses the `glass-floating` utility (20px blur, 55% white, saturate 1.5 — [utilities.css:149-156](packages/shared/src/styles/utilities.css:149)). The overlay adds `blur(var(--blur-material-thick))` (8px). No prop, no variant — every consumer gets this. The client `DraftDialog` is the visible consumer ([DraftDialog.tsx:32](packages/client/src/components/Dialogs/DraftDialog.tsx:32)); the admin uses the same primitive but is patched back to solid via CSS.

**F4. Cognitive load rule is violated.**
[`.claude/skills/design/materials.md:17-25`](.claude/skills/design/materials.md) says paragraphs, forms, and data tables require **thick or solid** surfaces, and explicitly warns blur reduces readability. The drawer carries forms (TreasuryDrawer, WalletDrawer), lists (ConvictionDrawer), and tables — all rendered on top of the F1 stack. Form inputs inside the drawer get filtered through 3-4 nested backdrop-filter layers.

**F5. `glass-floating` hardcodes opacity and blur outside the token system.**
[packages/shared/src/styles/utilities.css:149-156](packages/shared/src/styles/utilities.css:149)
Uses `blur(20px) saturate(1.5)` literals. The materials spec defines `--blur-material-*` tokens (8/12/20/30px) that this class doesn't reference. The rest of the codebase uses tokens; this class is a parallel system.

**F6. `WorkDashboard` is a second consumer path for `PwaSheet`.**
[packages/client/src/views/Home/WorkDashboard/index.tsx:314](packages/client/src/views/Home/WorkDashboard/index.tsx:314)
Calls `PwaSheet` directly, not via `ModalDrawer`. Any fix scoped to `ModalDrawer` will leave this path broken. Worth flagging upfront so it doesn't get missed at scope-lock.

**F11. WorkDashboard nested `overflow-y-auto` + cards that navigate = scroll appears to "close the dialog".**
Two overlapping problems regressed together in `f773e40e` (2026-05-09):

1. **Nested scrollers.** WorkDashboard wraps its tab content in `<div className="flex-1 min-h-0 overflow-y-auto">` ([WorkDashboard/index.tsx:367](packages/client/src/views/Home/WorkDashboard/index.tsx:367)) AND `WorkListTab` declares its own inner `<div className="flex-1 overflow-y-auto overflow-x-hidden ...">` ([WorkListTab.tsx:64](packages/client/src/views/Home/WorkDashboard/WorkListTab.tsx:64)). Two stacked `overflow-y-auto` containers inside a flex column under a drag-to-dismiss panel. On iOS Safari neither container reliably owns the touch — the inner has `h-full` sized against an outer with `flex-1 min-h-0`, so its scroll height is fragile, and the outer is wrapping a child that already wants to scroll itself.

2. **Cards swallow short flicks as taps and navigate away.** Each list item is a `MinimalWorkCard` with `onClick={() => onWorkClick(work)}` ([WorkListTab.tsx:141](packages/client/src/views/Home/WorkDashboard/WorkListTab.tsx:141)) which calls `navigate("/home/.../work/...")` ([WorkDashboard/index.tsx:200](packages/client/src/views/Home/WorkDashboard/index.tsx:200)). When the nested scrollers fail to consume the touch and the user's flick is shorter than iOS Safari's ~10px tap threshold, the touchend fires a `click` on the card button and the app navigates. PwaSheet unmounts because the route changed. From the user's POV: "I tried to scroll and the dialog closed."

The combination is what makes it look like a drag-to-dismiss bug. It isn't — `PwaSheet.bind()` is correctly scoped to the drag-handle only ([PwaSheet.tsx:245](packages/shared/src/components/Dialog/PwaSheet.tsx:245)), confirmed by reading `useDrag` semantics (`setPointerCapture` on the bound element; gestures don't initiate on siblings). The close fires because **navigation unmounts the sheet**, not because the gesture is leaking.

**Fix shape (smallest possible):**
- Remove the outer `overflow-y-auto` wrapper in WorkDashboard ([WorkDashboard/index.tsx:367](packages/client/src/views/Home/WorkDashboard/index.tsx:367)) — `WorkListTab` already owns the scroll. The outer wrapper just gets `<div className="flex-1 min-h-0">` (no overflow), so the inner scroller is the only one and gets full panel height.
- For belt-and-braces, set `overscroll-behavior: contain` on `WorkListTab`'s inner scroll container so iOS doesn't propagate the touch chain to ancestors when the user reaches the boundary.
- Optionally raise `DISMISS_VELOCITY_THRESHOLD` from `0.5` to `0.7-0.8` ([springConfig.ts:19](packages/shared/src/components/Canvas/springConfig.ts:19)) so accidental drag-handle taps don't dismiss on first flick — separate issue but cheap to address while we're here.

I'd ship this fix on its own (independent of the F1-F10 liquid-glass lane) — the user-facing harm is severe and the diff is ~3 lines.

### Admin — the over-layered ones

**F7. Sheet shell blur + canvas recession blur compound on every sheet open.**
[packages/admin/src/styles/admin-m3-overrides.css:239-246](packages/admin/src/styles/admin-m3-overrides.css:239)
Admin's `RightSheet`/`LeftSheet`/`BottomSheet` shells keep `backdrop-filter: blur(var(--admin-chrome-blur)) saturate(1.14)` over `--admin-sheet-bg` (a gradient, not solid). When a sheet opens, the language spec ([language.md § Material Behaviors](.claude/skills/design/language.md)) also recedes the canvas with `scale(0.97) + opacity(0.85) + blur(2px)`. The canvas blur and the sheet-shell blur multiply — the canvas behind reads as smeared mush. This is the same "sheet animation over-layered" issue noted in the 2026-04-19 known-pains memo; still unresolved.

**F8. `--admin-sheet-bg` is a translucent gradient, not a solid.**
[packages/admin/src/index.css:292](packages/admin/src/index.css:292)
Combined with F7's backdrop-filter, the sheet shell is visually translucent + blurred gradient. With sufficient content the recessed canvas color bleeds through, which is the "too liquid and transparent to fit with the other aspects of the design" complaint.

**F9. Admin uses two dialog systems that look different.**
- `AdminDialog` ([packages/admin/src/components/AdminDialog.tsx](packages/admin/src/components/AdminDialog.tsx:1)) — strict M3, solid `--m3-surface-container-high`, opaque scrim. **Correct.**
- `DialogShell` (the shared one) patched via CSS in [admin-m3-overrides.css:249-261](packages/admin/src/styles/admin-m3-overrides.css:249). **Correct *if* the patch applies.**

The Hub Cookie Jar modals + Cookies campaign panel use `AdminDialog`. Garden modals (GardenProfile, ManageRoles, Members) and Hypercerts MintingDialog use `DialogShell`. So admin has two dialog systems with two visual paths, and only one is solid by construction — the other is solid by CSS patch.

**F10. The override mechanism itself is fragile.**
[admin-m3-overrides.css:249-261](packages/admin/src/styles/admin-m3-overrides.css:249)
Requires `body:has(.admin-m3)` + `[data-component="DialogShell"|"ConfirmDialog"]` + `[data-slot="surface"|"overlay"]` + `.glass-floating` to all line up. Drop any one (rename a component, add a new dialog primitive, forget a data-slot marker, swap the utility class) and admin silently regresses to client styling. This is why these bugs keep coming back even after they're "fixed" — the patch's contract is invisible at the call site.

## Proposal — one path forward

**Invert the default**: shared dialog/sheet primitives ship a **solid** surface by default, with explicit opt-in for glass via a prop.

**Why this and not anything else:**
- Solid is the right default for paragraphs, forms, lists, tables — the materials spec already says this.
- Both admin and client want solid for most dialogs; only specific surfaces (e.g. governance/treasury drawer over a hero page) actually need translucency.
- It deletes the entire `body:has(.admin-m3) [data-component=…]` override scaffolding. The patch goes away because the bug goes away. No more silent regressions.
- The fix surface in primitives is small (~5 files) and consumers don't change unless they want glass.

**Shape of the change:**

1. `DialogShell`, `ConfirmDialog`, `PwaSheet` gain a `surface?: "solid" | "thick" | "floating"` prop, default `"solid"`. Solid = `bg-bg-white-0` + opaque scrim, no `backdrop-filter`. Thick/Floating = current behavior via material tokens (no `glass-floating` hardcoded fallback).
2. `pwaDrawerStyles.ts` loses `backdrop-blur-*` from `panel`, `header`, `tabs`, `footer`, `workFeedbackDrawer`, `workActionBar`. Only `overlay`/`dialogOverlay` may carry blur — and only when the consumer asks for `"floating"`. F1 collapses from 6 stacked filters to 0 or 1.
3. `glass-floating` utility either gets retired or migrated to reference `--color-material-*` + `--blur-material-*` tokens so it's part of one system (F5).
4. Admin sheet shells: drop either the sheet-shell `backdrop-filter` or the canvas recession blur — not both (F7). Recommend keeping the recession, dropping the sheet-shell blur, and switching `--admin-sheet-bg` to a solid `--m3-surface-container-high` (F8). One source of depth is enough.
5. Admin dialogs converge on `AdminDialog` only — migrate the 4 remaining `DialogShell` consumers in admin and delete the admin-side CSS patch (F9, F10).
6. Two consumers to verify for `PwaSheet`: `ModalDrawer` and `WorkDashboard` (F6).

**What gets deleted** when this lands:
- `body:has(.admin-m3) [data-component="DialogShell"|"ConfirmDialog"]` overrides (~13 CSS lines)
- `backdrop-blur-*` on ~6 layers in `pwaDrawerStyles.ts`
- `glass-floating` class on shared dialog surfaces
- The 2026-04-19 "sheet animation over-layered" pain note

## Full PWA dialog consumer inventory

Every place liquid glass is currently bleeding into the PWA. Categorized by primitive.

### Via `PwaSheet` directly
- [WorkDashboard](packages/client/src/views/Home/WorkDashboard/index.tsx:314) — mounted under `{isWorkDashboardOpen && <WorkDashboard />}` from the bottom AppBar

### Via `ModalDrawer` (which wraps `PwaSheet`)
- [WalletDrawer](packages/client/src/views/Home/WalletDrawer/index.tsx:23) — wallet/cookie-jar/send/pools tabs, mounted from Home AppBar
- [GardensFilterDrawer](packages/client/src/views/Home/GardenFilters/index.tsx:137) — scope + sort filter, mounted from Home filter button
- [ConvictionDrawer](packages/client/src/components/Dialogs/ConvictionDrawer.tsx:271) — staking/voting drawer, mounted from Garden view
- [TreasuryDrawer](packages/client/src/components/Dialogs/TreasuryDrawer/index.tsx:168) — treasury / cookie-jar deposits
- [TopNav drawer](packages/client/src/components/Navigation/TopNav.tsx:100) — top-nav context menu drawer

### Via `DialogShell` (centered modal, has `glass-floating` baked in)
- [DraftDialog](packages/client/src/components/Dialogs/DraftDialog.tsx:32) — work draft resume prompt
- [Gardeners member detail dialog](packages/client/src/components/Features/Garden/Gardeners.tsx:202) — **the "gardener" dialog you mentioned looks off**
- [Profile/Badges detail](packages/client/src/views/Profile/Badges.tsx:390) — badge detail modal

### Via `ConfirmDialog` (centered confirm, same `glass-floating`)
- [TreasuryDrawer/MyDepositRow confirm](packages/client/src/components/Dialogs/TreasuryDrawer/MyDepositRow.tsx:136)
- [TreasuryDrawer/CookieJarCard confirm](packages/client/src/components/Dialogs/TreasuryDrawer/CookieJarCard.tsx:161)
- [WorkDashboard/Drafts confirm](packages/client/src/views/Home/WorkDashboard/Drafts.tsx:189)
- [WalletDrawer/CookieJarTab confirm](packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx:143)
- [Profile/GardensList confirm](packages/client/src/views/Profile/GardensList.tsx:251)
- [Profile/AppSettings confirm](packages/client/src/views/Profile/AppSettings.tsx:307)
- [Profile/ENSSection confirm](packages/client/src/views/Profile/ENSSection.tsx:637)

**16 PWA dialog/drawer call sites total. All hit the same three broken primitives.** The "Gardener dialog looks off" and "every filter/wallet drawer is wrong" symptoms are not coincidence — they are the same root cause from F1-F5 hitting different consumers.

---

## F12. ModalDrawer & DialogShell render the backdrop but not the surface on open ("blurred screen, nothing pops up")

**Symptom (your report):** open the filter or wallet drawer → blurred screen appears but no panel content. Going back doesn't help.

**Probable mechanism (PwaSheet mount race):**

[PwaSheet.tsx:80-118](packages/shared/src/components/Dialog/PwaSheet.tsx:80) implements opening as:

1. `const [mounted, setMounted] = useState(open)` — consumer renders ModalDrawer with `isOpen=false` initially, so `mounted=false`. `useSpring` initializer sets `{ y: 100, overlay: 0 }` — sheet off-screen, scrim transparent.
2. Consumer toggles `isOpen=true`. PwaSheet re-renders with `open=true`. **`mounted` is still `false` until `setMounted(true)` flushes.** `if (!mounted) return null` returns null. No DOM.
3. `useEffect` fires after commit: `setMounted(true)` + `api.start({ y: 0, overlay: 1 })`.
4. Re-render: `mounted=true`. The `animated.div` mounts for the first time and reads the spring's *current* value, which is still ~`y=100` because the animation has just started.
5. RAF cycle ticks animate `y: 100 → 0` over ~300-500ms.

**During steps 4-5, the OUTER overlay div is already rendered with `backdrop-blur-[var(--blur-material-thick)]` applied as a static class** ([PwaSheet.tsx:192](packages/shared/src/components/Dialog/PwaSheet.tsx:192)). That's why you see a blurred screen: the backdrop class doesn't wait for any spring value. But the surface is at `translateY(100%)` (below the viewport) until the spring finishes interpolating.

The bug: **if the spring never finishes interpolating, you stay in step 4 forever.** Suspected causes:

- **Spring initial state baked at first render.** `useSpring(() => ({...}))` runs its initializer *once*. If the consumer mounts ModalDrawer with `isOpen=false`, the spring is permanently born at `{y:100, overlay:0}`. The `api.start` call in the `useEffect` is supposed to animate it back, but `api.start` is async and depends on RAF being scheduled. If the consumer's parent re-renders while the spring is mid-animation, react-spring sometimes restarts from the *new initial value* and gets stuck.
- **`prefersReducedMotion` race.** `useMediaQuery` can return `undefined` on first render in some environments, then flip to a real boolean. The spring was initialized with `immediate: prefersReducedMotion` (possibly `undefined` → falsy → animation). If the value flips to `true` after the first render and `api.start` is then called with `immediate: true`, the spring should jump to the target instantly. If it instead resolves while a non-immediate animation is queued, the values can desync.
- **DraftDialog / Gardeners detail rendering pattern.** DialogShell uses Radix's `Dialog.Content` with Tailwind `animate-in` classes driven by `--spring-spatial-duration` ([ConfirmDialog.tsx:68-71](packages/shared/src/components/Dialog/ConfirmDialog.tsx:68)). If that CSS variable doesn't resolve to a valid duration (e.g. `0ms` from a reduced-motion override), the open animation completes in zero time but Radix's `data-state=open` transition may stall on certain Chromium versions when paired with `backdrop-filter` on the overlay.

I need a **live repro in Chrome MCP** to lock down which of the three it is — the symptom is the same but the fix differs (replace mount race with `useSpring` controlled-value pattern, vs. drop the static backdrop-blur class until the spring is mid-flight, vs. give DialogShell a `forceImmediate` opt-out).

What I can say without live repro: **F1-F5 (the liquid stack itself) are the reason this is fragile.** Even if F12 is independently fixable, the deeper architectural fix (invert default to solid) removes the backdrop-blur from the outer overlay class entirely, which eliminates the "blurred screen without content" symptom by construction — there's no blur to apply if the surface isn't ready.

---

## Action plan — what I'll do, in order

Given the severity ("absolutely fucking ridiculous" is a fair read), I'm going to **stop asking you to pick from a menu and commit to a single path**. Two phases. You can stop me between them; you can stop me mid-phase. But I'd rather not paralyze on scope-lock while users are hitting broken drawers.

### Phase A — Ship the liquid-glass collapse + WorkDashboard scroll fix (≤ 1 hour of editing, no design ambiguity)

Goal: every PWA dialog gets a **solid surface** and a **single scrim**, with no per-slot backdrop-filters and no `glass-floating`. The recently-introduced "PWA native-feel" liquid look gets reverted to solid material. Admin override scaffolding gets deleted. Apps look like the design system says they should.

Files I'll touch (~7 files, ~80-line diff):
1. [pwaDrawerStyles.ts](packages/client/src/styles/pwaDrawerStyles.ts) — strip `backdrop-blur-*` from panel/header/tabs/footer/work-drawer/work-action-bar. Switch `bg-[var(--color-material-thick)]` → `bg-bg-white-0` (solid). Overlay keeps a single subtle scrim (no blur, or blur-`thick`=8px only). **F1, F4, F5.**
2. [PwaSheet.tsx](packages/shared/src/components/Dialog/PwaSheet.tsx) — drop `backdrop-blur-[var(--blur-material-thick)]` from outer overlay class (this is the F12 blurred-screen-no-content surface). Drop `bg-[var(--color-material-thick)] backdrop-blur-[var(--blur-material-thick)]` from surface — switch to `bg-bg-white-0`. **F2, F12 (likely).**
3. [ConfirmDialog.tsx](packages/shared/src/components/Dialog/ConfirmDialog.tsx) — `DialogShell` and `ConfirmDialog`: drop `glass-floating`, switch to `bg-bg-white-0 border border-stroke-soft-200 shadow-[var(--shadow-float)]`. Drop the overlay's `backdrop-filter: blur(...)` — keep the dim scrim only. **F3, F12 (likely).**
4. [WorkDashboard/index.tsx](packages/client/src/views/Home/WorkDashboard/index.tsx:367) — drop the redundant outer `overflow-y-auto`. **F11 (a).**
5. [WorkListTab.tsx](packages/client/src/views/Home/WorkDashboard/WorkListTab.tsx:64) — add `overscroll-behavior: contain`. **F11 (b).**
6. [springConfig.ts](packages/shared/src/components/Canvas/springConfig.ts:19) — raise `DISMISS_VELOCITY_THRESHOLD` from `0.5` to `0.75`. **F11 (c).**
7. [admin-m3-overrides.css](packages/admin/src/styles/admin-m3-overrides.css:249-261) — DELETE the `body:has(.admin-m3) [data-component="DialogShell"|"ConfirmDialog"]` block. It's no longer needed because the primitives are solid by default. **F10.**

Validation before reporting done:
- `bun run test` (vitest covers DialogShell + PwaSheet stories)
- Open client in Chrome MCP, manually open each drawer (filter, wallet, work dashboard) and confirm the surface renders solid + no blurred-screen-no-content state.
- `bun run lint`

### Phase B — Admin sheet over-layering (F7 + F8 + F9), follow-up lane

Separate diff because it touches admin canvas behavior and the recession motion. Doesn't block the PWA fix. Estimate: another ~hour. I'll spin this out only after Phase A lands.

---

## Sign-off question — yes/no

**Phase A starts now.** If you want a different scope (e.g., revert the two regressing commits instead, or keep glass on some specific surface), tell me before I start editing. Otherwise I take silence (or "go") as authorization for Phase A only — Phase B will pause again at scope lock.

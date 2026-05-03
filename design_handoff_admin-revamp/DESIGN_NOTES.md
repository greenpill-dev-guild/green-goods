# Design Notes — Rationale

These notes explain *why* the v2 review proposes what it does. Use them to make implementation judgement calls when the spec underspecifies a detail.

---

## Tone system

**Problem:** v1 used per-view brand tones (blue / green / warm / clay) too aggressively — they tinted headers, cards, and accents. The result felt like four different products.

**Fix:** tone becomes a *peripheral* signal, not a *dominant* one. It applies to four surfaces only:

1. **Canvas background** — barely-there wash. Saturation ≤ 0.02 in oklch.
2. **Garden-pill leaf** — the small icon inside the appbar's garden switcher tints to active view's tone.
3. **Active tab underline** — the 2px indicator only.
4. **Page-header bottom hairline** — the single divider under the header. ~18% saturation max.

**Tone does NOT touch:**
- Header background — stays warm-cream / stone neutral, identical across views.
- Title / eyebrow / subtitle text — neutral ink / stone.
- Cards, status chips, filter chips, search field.
- Primary buttons, FAB, conviction meter — green stays green. **Action color is single-source.**
- Status semantics — flagged stays amber, error stays red regardless of view tone.

**Strength axis:** the tweak panel exposes `off · subtle · default`. Implement as a multiplier on the tone-canvas variable. `off` reverts every view to the baseline warm-cream canvas (identical across views). `subtle` is half-strength.

**Why this matters:** members navigating between views should feel the difference without being able to point to it. Color identifies *context*, not *content*.

---

## Conviction voting

**Problem:** v1 used for/against/abstain tallies. That's a *referendum* model — single vote per member, decision happens at a deadline. Green Goods doesn't work that way.

**The actual mental model:** each member has **100% conviction weight** total. They split it across active proposals. As weight stays on a proposal, that proposal's conviction *accrues* over time. The proposal passes when its conviction crosses its threshold. Withdrawing weight from a proposal is the only opposing signal — there is no "against" vote.

**Implications for UI:**

- **No vote buttons.** No "👍 / 👎 / ⊘". Members allocate weight, period.
- **Proposals have continuous state, not discrete state.** A proposal is *accruing* (below threshold) or *passing* (above threshold), and the bar moves daily.
- **Members see two views of conviction:**
  - Per-proposal: the meter, threshold tick, accrual rate, ETA.
  - Personal: their allocator — "you have 40% on PRP-024, 35% on PRP-025, 25% unallocated".
- **Activity feed loses tallies.** A "decided" card just shows: passed at X conviction, funded on date Y.

**Decay:** when weight is withdrawn from a proposal, conviction decays at the same rate it accrued. The UI should show a "ghost" trailing fill on the meter for ~24h after a withdrawal so the change is visible.

**Threshold UX:** the threshold tick on the bar should pulse subtly when conviction is within 5% of crossing — gives members a felt sense of "almost there" without being a notification.

---

## FAB rule

**Problem:** v1 had a green FAB on every screen at every breakpoint. On desktop, this is redundant — the page header already has room for inline buttons (Garden and Community already do this).

**Fix:**

| Breakpoint | FAB | Header actions |
|---|---|---|
| Desktop ≥ 1024px | hidden | inline ghost + primary buttons |
| Tablet 640–1023px | visible | collapsed into FAB; speed-dial if >1 creation flow |
| Mobile < 640px | visible (above navbar) | same as tablet |

**Why speed-dial vs. single-action:** views with multiple distinct creation flows (Hub: log-impact / new-proposal / new-action; Garden: invite / new-plot / new-event) need to disambiguate. A single FAB that opens a small radial menu is faster than a sheet picker.

**Per-view dial composition** is in `screens/UI Review.html` (search for `FabAuditTable` in `review.jsx`).

---

## Header anatomy

**Problem:** four screens, four header structures. Garden and Community share `g-id-strip`; Actions has its own `act-page-header`; Hub has `hub-header-tight`. Members' eyes don't land in the same place.

**Fix:** keep all three structures, but normalize the **slots** so any header can use a subset of:

1. **Eyebrow** — optional 11px caps label (route name, breadcrumb, status).
2. **Title** — h1 / 22px / -0.015em.
3. **Identity slot** — Garden's avatar lives here; other views skip it.
4. **Stats line** — small inline numbers under the title (Actions already does this).
5. **Action group** — right side. Inline ghost / primary buttons (desktop only).

Implement as a single `<PageHeader>` component with optional slots. Each screen's wrapper composes the slots it needs.

**What stays untouched** (already consistent):
- `seg-tabs` with `tab-count` chips — Hub / Garden / Community use the same pattern.
- `g-mem-toolbar` + `g-chip-row` + `g-filter-chip` — Garden, Community, and Actions filter rows already share.
- Header background palette (warm-cream / stone neutral) across all four views.

---

## Open questions for the dev to flag back

1. **Conviction allocator placement.** Inline at the top of Community → Proposals, or in a dedicated sheet opened from the appbar? The prototype shows it inline; that's the recommendation, but if the proposal list is long it may need to move.
2. **Decay UI fidelity.** A "ghost trailing fill" on the meter is described above but not built. Decide based on engineering complexity vs. clarity gain.
3. **Tone strength on dark mode.** Recommend `subtle` default since dark canvases already feel saturated. The host codebase's dark-mode policy supersedes this.
4. **FAB on routes with zero creation flows.** A read-only screen (e.g. an audit-log detail) shouldn't show a FAB at all on tablet/mobile. Default to hidden unless the screen declares actions.

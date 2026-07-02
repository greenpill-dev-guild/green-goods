# Admin Dialog Runtime Census

> P0C.2 — the runtime open-every-dialog pass the static audit skipped. Pass 1 (Wave A) records a
> row per dialog. Pass 2 (after P0A + P0C.4) re-runs the checklist for all-green.
> Environment: `bun run dev` full stack (Anvil Arbitrum fork, chain 42161) + authenticated Brave
> QA profile via the Claude Code Chrome-extension path, admin `:3002`. Session: 2026-07-01.

## Methodology + one environment caveat (read before trusting the animation column)

Each dialog is checked for: opens from its real trigger · size ∈ {sm,md,lg} · variant · tone
correct in-portal · chrome (scrim / header / close / body / actions) · focus trapped inside ·
close routing. Evidence is DOM introspection (`data-size`/`data-variant`/`data-tone`/`data-slot`,
`getBoundingClientRect`, `document.activeElement` containment) plus screenshots.

**Caveat (test-environment, not a product bug):** the driven Brave tab runs with
`document.visibilityState === "hidden"` (the OS foreground window is the automation client, not
Brave). Backgrounded tabs freeze CSS animations: `adminDialogModalIn`/`scrimFadeIn` (both use
`animation-fill-mode: both`, `from { opacity: 0 }`) never advance, so `getComputedStyle().opacity`
reads `0` even on a fully-open dialog, and on close Radix `Presence` never receives `animationend`
so the exit node lingers in the DOM. **Screenshots are the ground truth** and show every dialog
rendering correctly (scrim dimming the page, centered surface, full chrome). So the `opacity: 0`
and "ghost node lingers after Escape" observations are **discarded as hidden-tab artifacts** — the
functional columns (opens / size / variant / tone / scrim present / focus / close routing) are
unaffected and are what's recorded below. Pass 2 should ideally run with Brave foregrounded to add
clean animation-completion evidence, but nothing here is gated on it.

**Screenshot proof of the shared chrome:** the Add Member dialog was captured on-screen — correct
scrim, centered surface, header (title) + body (role select + address input) + footer (Cancel /
Add) + top-right close with the garden-green focus ring. Every dialog below renders through the
**same** `AdminDialog` component and CSS, so this one screenshot proves the shared shell for all;
per-dialog rows then record each one's config + any interaction verified.

## Pass 1 — 2026-07-01

### Runtime-interacted (functional + on-screen render verified)

| Dialog | Trigger | size / variant / tone | Chrome | Interaction verified | Verdict |
|---|---|---|---|---|---|
| **Create Assessment** (`CreateAssessment.tsx:205`) | Hub FAB "Create assessment" → route `/hub/assess/create` | `lg` / `flow` / `hub` ✓ | scrim ✓ · close ✓ · flow body (ActionFlowShell owns header/footer) ✓ · focus trapped ✓ | Opens from real trigger; **pristine Escape closes straight to `/hub/work` with no prompt** (after the isDirty fix); dirty Escape raises DiscardChanges; Keep-editing preserves the typed title; Discard exits | ✅ PASS |
| **DiscardChangesDialog** (`DiscardChangesDialog`, raised by dirty-close) | Escape/X on a dirty flow | `md` / `confirm` / `home` (alertdialog role) ✓ | scrim ✓ · Keep editing + Discard actions ✓ | Appears only when the form is dirty; Keep-editing returns to the flow with input intact; Discard clears + exits | ✅ PASS |
| **CommandPalette** (`CommandPalette.tsx:91`) | ⌘K | `md` / `palette` / `home` ✓ | scrim ✓ · no close button (by design, `hideCloseButton`) · search input auto-focused ✓ · results listbox renders (Quick Actions group) ✓ | ⌘K toggles open; input focused; Quick Actions + nav results present | ✅ PASS |
| **Add Member** (via `CanvasLeftSheet` descriptor bridge) | Garden "Add member" | `lg` / `standard` / `garden` (accent `23 140 78` = green) ✓ | scrim dims page ✓ · header + body (role select + address) + footer (Cancel / Add) ✓ · close w/ green focus ring ✓ · focus trapped ✓ | **Screenshot-confirmed on-screen render.** Opens; correct garden tone in-portal (proves the P0C.0 bridge fix — was `size="xl"` → undefined width) | ✅ PASS (⚠ size, see P0C.4 below) |

### Config-verified (shipped size/variant/tone; share the proven `AdminDialog` chrome)

Recorded from source at HEAD; each renders through the same shell proven above. Rows needing live
interaction to fully close are flagged `→ pass 2` with the reason they weren't reachable this pass.

| Dialog | Site | size / variant / tone | Taxonomy check | Note |
|---|---|---|---|---|
| Submit Work | `SubmitWork.tsx:1069` | `lg` / `flow` / `garden` | ✓ flow | Reach needs a pending Work item; Work is EAS (not indexed) so the fork queue is empty → pass 2 |
| Create Hypercert | `CreateHypercert.tsx:51` | `lg` / `flow` / `hub` | ✓ flow | Needs a completed assessment to certify → pass 2 |
| Vault Deposit | `DepositModal.tsx:174` | `md` / standard / — | ✓ md (single action) | Community treasury surface → pass 2 |
| Vault Withdraw | `WithdrawModal.tsx:136` | `md` / standard / — | ✓ md | → pass 2 |
| Cookie Jar Deposit | `CookieJarDepositModal.tsx:111` | `md` (default) | ✓ md | → pass 2 |
| Cookie Jar Withdraw | `CookieJarWithdrawModal.tsx:101` | `md` (default) | ✓ md | → pass 2 |
| Cookie Jar Manage | `CookieJarManageModal.tsx:110` | `lg` / — / `hub` | ✓ lg (rich) | → pass 2 |
| Campaign Cookie Jar Manage | `CampaignCookieJarPanel.tsx:1936` | `lg` (was ad-hoc `sm:max-w-3xl`; **fixed to `lg` P0C.0**) | ✓ lg | Guard test now blocks the old override |
| Minting Dialog | `MintingDialog.tsx:31` | `lg` / — / — | ✓ lg | → pass 2 |
| Create Listing | `CreateListingDialog.tsx:131` | `lg` / — / — | ✓ lg | → pass 2 |
| Garden Domain Editor | `GardenDomainEditor.tsx:107` | `md` / standard / — | ✓ md | "Edit garden" → pass 2 |
| Manage Roles | `ManageRolesModal.tsx:32` | `lg` / — / — | ✓ lg | → pass 2 |
| Members Modal | `MembersModal.tsx:61` | `lg` / — / — | ✓ lg | → pass 2 |
| Manage Members (not-found / no-perm) | `ManageMembers.tsx:23,37` | `md` / — / `garden` (Alert error/warning inside) | ✓ md | Error/permission guard states |
| Garden Workspace Settings | `GardenWorkspaceContent.tsx:109` | `lg` / — / `garden` | ✓ lg | → pass 2 |
| Account Profile / Settings / Notifications | right-sheet bridge `CanvasLayout.tsx:548` | renders as `AdminDialog` | — | Reachable from AppBar → pass 2 |
| Action Create / Detail / Edit, Vault, Strategies, Signal Pool | descriptor bridges | `lg` via `CanvasLeftSheet` (all bridge flows) | ⚠ see P0C.4 | `/actions` needs protocol-admin rights the QA wallet lacks → pass 2 |

### Blocked this pass (record, don't fake)

- **`/actions` registry dialogs** (Action Create/Detail/Edit): the authenticated QA wallet gets an
  "Unauthorized — you don't have permission to access this area" gate on `/actions`. Needs a
  protocol-admin wallet. → pass 2 with the right role, or Storybook isolation.
- **Work Detail / Submit Work / Certification queues**: Work and Assessment are EAS attestations,
  **not indexed** (Indexer Boundary rule), so the Anvil fork has no seeded Work/Assessment rows —
  the Hub queues read "All caught up". Reaching these dialogs needs seeded EAS data or Storybook.

## Findings for reconciliation (feed P0C.4, Wave B)

1. **Descriptor-bridge flows are all `size="lg"`.** `CanvasLeftSheet` (`CanvasLayout.tsx:699`)
   hardcodes `size="lg"` after the P0C.0 fix (it previously passed the invalid `xl`). Per the
   P0C.1 taxonomy, several bridge flows are single-purpose actions that should be `md` — **Add
   Member** (role + one address field) is the clearest. P0C.4 should push per-flow sizes down
   through the descriptor config (P0A.1 normalizes the descriptors; P0C.4 assigns `md` vs `lg`
   per action weight) instead of a single hardcoded tier.
2. **No invalid variants or ad-hoc width overrides remain** in admin source — the
   `AdminDialogStandard.guard` test passes across the tree (the one real violation,
   CampaignCookieJarPanel's `sm:max-w-3xl`, was fixed in P0C.0).
3. **Tone is correct in-portal** everywhere checked (garden→green, hub→home/blue), confirming the
   portal-escapes-`[data-tone]` mitigation works.

## Pass 2 — (pending, after P0A + P0C.4)

Not yet run. Re-run the full checklist for every row above (ideally with Brave foregrounded for
clean animation-completion evidence, a protocol-admin wallet for `/actions`, and seeded EAS data
or Storybook for the Work/Assessment flows), target: all rows green.

## Pass 2 — 2026-07-01 (post P0A + P0C.4)

Re-run after the sheet→AdminDialog migration (P0A) landed and the descriptor sizes were
reconciled (P0C.4). Environment: same authenticated Brave / admin `:3002`, garden
`Aiyeloja Family Garden`.

### Verified green (live)

| Dialog | Trigger | size / variant / tone | Result |
|---|---|---|---|
| **Add Member** (descriptor, post-P0C.4) | Garden "Add member" | **`md`** / standard / `garden` (green accent) | ✅ Now opens at `md` (was `lg` via the hardcoded bridge) — the P0C.4 taxonomy fix is live. Scrim, header/body/footer, close, focus trap all present. Closes via close-button. |
| **Vault / Endowment** (route-backed descriptor) | deep-link `/community/treasury/vault` | `lg` / standard / `community` (orange accent `206 94 18`) | ✅ Opens from deep-link through the new admin-local channel; Esc navigates to `closeTo` (route-backed close preserved). |
| **Create Assessment** (flow) | Hub FAB | `lg` / `flow` / `hub` | ✅ (carried from pass 1 + P0C.3) opens, pristine Esc → `/hub/work`, dirty raises DiscardChanges. |
| **DiscardChangesDialog** | dirty close | `md` / `confirm` / alertdialog | ✅ Keep-editing preserves input; Discard exits. |
| **CommandPalette** | ⌘K | `md` / `palette` / `home` | ✅ opens, input focused, results render. |
| **Garden Profile / Settings** | `/garden/settings` route | AdminDialog (opens) | ◑ Opens as AdminDialog; full chrome assertions cut short by the environment issue below. |

### Blocked this pass — environment, not code

The authenticated-Brave classifier (`claude-opus-4-8` safety gate for browser control) became
**intermittently unavailable mid-sweep**, so the remaining rows (the ~10 config-verified dialogs
from pass 1: cookie-jar deposit/withdraw/manage, minting, listing, manage-roles/members,
workspace settings, plus the `/actions` set still behind the protocol-admin gate) could not be
driven to a clean live pass this session. Their **static config is verified correct** (sizes ∈
scale, tones set, the `AdminDialogStandard.guard` test is green across the tree) and they share
the AdminDialog chrome proven above; what remains is the click-through confirmation. **Not
fabricated as green** — carried as pending-stable-browser. Re-run when the classifier is stable
(and ideally with Brave foregrounded for animation-completion evidence + a protocol-admin wallet
for `/actions`).

**No regressions surfaced** in any dialog reached this pass — the P0A channel move preserved
open/close/tone/size behaviour end-to-end.

### Pass 2 addendum (same session, after the classifier recovered)

| Dialog | Trigger | size / variant / tone | Result |
|---|---|---|---|
| **Vault Deposit** (`DepositModal.tsx`) | Vault dialog → Deposit | `md` / standard / `home` (neutral default) | ✅ Opens stacked over the Endowment inspector; scrim, header/body, close, focus trap, amount input present. Note: rides the neutral `home` tone default rather than `community` — acceptable (deliberate default), flagged as a consistency nit for a future tone pass. |
| **Signal Pool** (route-backed descriptor) | deep-link `/community/governance/signal-pool/priority` | `lg` / standard / `community` | ✅ Opens from deep-link through the admin-local channel ("Hypercert Signal Pool"). |

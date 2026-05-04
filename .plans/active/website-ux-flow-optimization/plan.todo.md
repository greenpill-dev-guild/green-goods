# Website UX Flow Optimization

## Why this plan

The visitor-facing website has been polished at the surface level (rounds 1–4: copy, hero parity, four-domain parity, footer links, install dialog flatten, plain-blockchain phrasing, EditorialLinkArrow color, Fund-empty + Impact-filter wayfinding, GardenDetail "Work entry" rewrite, GardenCoverFallback tokens, /cookies dialog focus + corner). Surfaces look good. Now the goal is FLOW-level quality: simple, optimal, friendly for a first-time visitor who doesn't speak web3.

Three judgments we'll trade off against:
- **Simplicity beats completeness.** Cut steps before adding screens.
- **One mental model.** Garden is the unit; everything else is a verb on a Garden.
- **Trust through honesty.** Show real states (loading / empty / error) instead of hiding them.

---

## The seven visitor flows (current state in one line each)

| # | Flow | Surface chain | Status |
|---|---|---|---|
| 1 | Land + understand | `/` Hero → ProofBand → Loop → FundingBridge → GetInTouch → Footer | Reads well; secondary CTA is buried 4 sections down |
| 2 | Find a Garden | `/gardens` search → card → dialog → detail | Search-only; no filters; cards look identical |
| 3 | Fund a Garden | `/fund` paths → row → MethodSelector → wallet/card → receipt | Two-step modal still web3-heavy; no success wayfinding |
| 4 | Read impact | `/impact` markers → pipeline → filtered ledger → source dialog | Solid after round 3–4; reset filter just landed |
| 5 | Browse Actions | `/actions` 4 domains → field guide → action dialog | Read-only; clean |
| 6 | Cookie Jar campaign | `/cookies` campaign list → jar dialog → deposit/claim | Functional, but unreachable from Home/Nav |
| 7 | Install the app | Any page Install CTA → install dialog | Recently flattened; mobile fallback now has an action |

---

## Audit themes (across flows)

These are the FLOW-level failure modes worth fixing, distinct from surface polish:

1. **Web3 jargon still leaks into critical decision moments.** The funding method selector body (`PublicFundingMethodSelector.tsx:186-201`) still tells the visitor "smart contract, token, yield, provider, and wallet recovery risks" — exactly the language we just removed from the homepage funding bridge. Decision moment is the worst place for jargon.
2. **`/cookies` is invisible.** Not linked from `/`, `/fund`, the nav, or the footer. A visitor who didn't paste the URL will never find it.
3. **No success wayfinding.** After funding (receipt), after subscribing, after closing a source dialog — the visitor is left at a dead-end with no "what next" affordance.
4. **Loading states are missing in the funding dialogs.** Open the deposit dialog and the jar/vault list mounts silently. Slow indexer = empty dialog.
5. **Error recovery is reload-only.** Receipt fetch fails → reload. Subscribe fails → toast disappears, form goes idle. No retry button anywhere.
6. **Funding method selector visual is off-brand.** `rounded-2xl` cards inside `rounded-3xl` modal — both use the old curved language we already retired across `PublicInstallDialog`, `PublicSourceDialog`, `Cookies` jar dialog.
7. **Mental model isn't introduced.** "Cookie Jar," "Vault," "Endow," "Hypercert," "Impact Certificate" — all introduced without first-time explanation. There's no glossary, no hover tooltip, no progressive disclosure.
8. **Mobile-tight inputs.** Subscribe form (`PublicGetInTouch.tsx:131-185`) inlines the email input and the Submit button — at 375px the button truncates the placeholder.
9. **Stale-query banner steals vertical space on `/fund`** — it sits between hero and § 01 even when the page is otherwise mid-funnel. Should inline near the affected garden or use a toast.
10. **Empty proof markers read as bug, not signal.** When all four homepage stats are zero, the band looks broken. Only Certificates says "Not public yet"; the others just show 0.

---

## Recommended phasing

Three tight phases. Each phase is independently shippable. Each item below is small enough to land in a single edit + test.

### Phase 1 — Decision-moment plain language + flow continuity (≈1–2 h)

The visitor should never read web3 risk vocabulary at the moment they're deciding to fund. They should always have a "what next" after a successful action.

- **P1-1** Rewrite `PublicFundingMethodSelector.tsx` Endow risk + tax disclaimer in plain English. Mirror the `PublicFundingBridge` copy already approved.  
  Files: `components/Public/PublicFundingMethodSelector.tsx:186-201`, `i18n/{en,pt,es}.json`.
- **P1-2** Replace "onchain" in the same selector's card description (`public.fund.dialog.card.description` was already touched in en, but the IN-COMPONENT default at `:236-238` still reads "onchain"). Sync defaults to "on a public blockchain" or omit blockchain entirely if the visitor doesn't need to know.
- **P1-3** Flatten `PublicFundingMethodSelector` to match the editorial dialect: drop `rounded-3xl` on the modal frame, drop `rounded-2xl` on the two intent cards + two method cards, keep `rounded-full` on Back / Close affordances.
- **P1-4** Success-receipt wayfinding. `PublicFundingReceipt.tsx:104-112` adds a `EditorialLinkArrow` row when status is success: "Support another Garden →" (`/fund`) and "View public evidence →" (`/impact`).
- **P1-5** Subscribe form mobile layout: stack input above button at sm; clear form state after success (currently it just hides — the email lingers in the field).  
  Files: `components/Public/PublicGetInTouch.tsx:146-174`.

**Acceptance**: a visitor never sees "smart contract / yield / wallet recovery / onchain" inside the funding dialog. After submitting, they see one of: Garden detail, /fund, /impact, /gardens. Subscribe form clears + shows confirm at 375px.

### Phase 2 — Loading + empty + error honesty (≈2–3 h)

Show real states. Never silent. Always recoverable.

- **P2-1** `WalletRuntimeProviders` Suspense fallback — small inline "Preparing wallet…" affordance at the modal level. Files: `views/Public/Fund.tsx:402-432`.
- **P2-2** Loading state inside `CookieJarDepositDialog` and `VaultDepositDialog` while `useGardenCookieJars` / `useGardenVaults` resolve. Dimmed select with skeleton inline. Files: `components/Dialogs/{CookieJarDepositDialog,VaultDepositDialog}.tsx`.
- **P2-3** Receipt fetch retry button on network error. `PublicFundingReceipt.tsx:50-70` — add a "Try again" button that re-runs the fetch.
- **P2-4** Empty proof markers — when ALL four homepage stats are zero, the band shows a single explanatory line ("The first records will appear here as Gardens publish their work.") instead of four zeros. Files: `components/Public/PublicProofBand.tsx`.
- **P2-5** Stale/ambiguous garden query banner moves OUT of the page-flow position and INTO a toast (use `toastService` already imported in `PublicGetInTouch`). Files: `views/Public/Fund.tsx:235-258`.
- **P2-6** Gardens search zero-results announcement — `aria-live="polite"` region announces "{n} gardens match" / "No gardens match" on filter change. Files: `views/Public/Gardens.tsx:106-157`.

**Acceptance**: every visitor-facing async surface has a loading state, a recovery path on error, and an explanation when empty. No silent skeletons.

### Phase 3 — Discovery + first-time mental model (≈3–4 h)

Make the seven flows reachable. Introduce vocabulary the first time a visitor encounters it.

- **P3-1** Surface `/cookies` from `/fund`. Below § 02 (the garden row list), add an inline editorial line: "Looking for community campaigns? Browse Cookie Jar campaigns →" linking to `/cookies`. Files: `views/Public/Fund.tsx`.
- **P3-2** Surface `/actions` from Home. Below the regenerative loop section, add a single editorial line: "See the templates Gardens use to plan their work — A field guide →" linking to `/actions`. Files: `views/Public/Home.tsx`.
- **P3-3** First-mention glossary tooltip. Build a small `EditorialTermTooltip` atom in `EditorialAtoms.tsx` that wraps a term with `<button>` opening a tiny popover (Radix Tooltip). Use it for first occurrence of: "Cookie Jar", "Vault", "Endow", "Impact Certificate" on each visitor page. Single short sentence each.
- **P3-4** GardenDetail h2 hierarchy + section semantics. Wrap each section in `<section aria-labelledby>` with a more semantic label level. Files: `views/Public/GardenDetail.tsx:96-180`.
- **P3-5** Loop steps gain quiet CTAs. Each numbered step on `PublicRecordLoop` already routes to a page. Change the visual: instead of the title hovering green, add a `→` arrow at the end of the title row that's visible at rest, communicating "this is a link." Files: `components/Public/PublicRecordLoop.tsx`.

**Acceptance**: visitor lands cold and within 2 clicks reaches every flow. First-time encounter with each web3-adjacent term has a one-sentence inline explanation.

---

## Out of scope for now (defer or parking lot)

- Wallet disconnect mid-flow re-validation (still on the round-3/4 deferred list — non-trivial, requires reproducing & testing the disconnect path).
- Filter-chip 0-count visual hint (P2 polish only — nice but not flow-critical).
- `CookieJarDepositDialog` → `FormField` migration (form pattern drift, not a UX hit).
- "What you've supported" return-visitor memory (Phase 5 territory; design needs work).
- More distinctive garden cards (state badges) — needs design judgment, not just code.
- Garden filters by location/domain (search alone is acceptable for current corpus size).
- `Cookies.tsx` hardcoded access-model label.
- Garden-highlight `matchHighlightRef` leak (low impact).

---

## Open questions for you (please answer before I start)

1. **Phase order**: ship Phase 1 → 2 → 3, or pick a different order? (Recommended: 1 → 2 → 3, but if you'd rather ship discovery (3) before honesty (2), say so.)
2. **Glossary tooltip pattern (P3-3)**: do you want a hover/click popover, or an inline parenthetical first-mention ("Cookie Jar — a Garden's open jar for everyday gifts") that doesn't add a new component? Tooltip = cleaner; parenthetical = less code.
3. **Loop CTAs (P3-5)**: arrow-on-title (subtle), or end-of-row "Read more →" link (explicit)?
4. **Rolling shipping**: should I push each phase as a separate set of commits, or land them as one big diff and verify together?

---

## Critical files (for implementation reference)

**Phase 1**
- `packages/client/src/components/Public/PublicFundingMethodSelector.tsx`
- `packages/client/src/components/Public/PublicFundingReceipt.tsx`
- `packages/client/src/components/Public/PublicGetInTouch.tsx`
- `packages/shared/src/i18n/{en,pt,es}.json`

**Phase 2**
- `packages/client/src/views/Public/Fund.tsx`
- `packages/client/src/views/Public/Gardens.tsx`
- `packages/client/src/components/Public/{PublicProofBand,PublicFundingReceipt}.tsx`
- `packages/client/src/components/Dialogs/{CookieJarDepositDialog,VaultDepositDialog}.tsx`

**Phase 3**
- `packages/client/src/views/Public/{Fund,Home,GardenDetail}.tsx`
- `packages/client/src/components/Public/PublicRecordLoop.tsx`
- `packages/client/src/components/Public/atoms/EditorialAtoms.tsx` (new `EditorialTermTooltip`)
- `packages/shared/src/i18n/{en,pt,es}.json`

---

## Verification plan (per phase)

Each phase ends with the same gate:
1. `bun run test --run src/__tests__` — touched files green.
2. `bunx tsc --noEmit` clean.
3. `bun lint` 0 errors.
4. Chrome MCP at 1440 + 375 walkthrough of the affected surface.
5. One screenshot per major change, attached to the response.

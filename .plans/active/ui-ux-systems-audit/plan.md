# Green Goods — UI/UX & Systems Improvement Plan (detailed, executable)

> **Companion to** [`audit.md`](./audit.md) (findings + rationale). This file is the **what-to-do**: tasks, files, exact changes, acceptance criteria, sequencing.
> **Status:** Plan for review. No code changed yet.
> **Date:** 2026-06-30

## Decisions locked with Afo
- **Scope:** full detail across all six phases.
- **Admin sheets:** **finish the dialog migration** (real refactor — see Phase 0A; investigation showed it's largely dead-code removal, not a UX rewrite).
- **Em-dashes:** **public-facing strings only** (~5–8), not the full 163.
- **Sequence:** foundation-first (design system + skills → shared patterns → surfaces → docs).

## How to read this
- Task IDs: `P<phase>.<n>`. Effort: **S** = hours · **M** = 1–2 days · **L** = multi-day.
- Each task: **change** · **files** · **acceptance**. "Reuses" / "Depends on" call out ordering.
- `critical` marks paths under the repo's critical criticality matrix (wallet/cookie-jar/contracts) — needs `web3`/`mutation-reliability` review depth, no log-only error handling.

## Global critical path (execution waves)
```
Wave A (no collisions, start now):  P0A (sheet migration) ─┐
                                    P1  (skills cleanup) ──┤
Wave B (after A):                   P0B (contract truth-up, needs P0A done)
                                    P0C (dialog standardization + runtime QA/repair — needs P0A; fixes Create Assessment)
                                    P3  (admin polish, parallel-safe with P0B/P0C)
Wave C (gated on in-flight WIP):    P2  (shared funding primitives) ── git-log gate
Wave D (after P2):                  P4 (PWA), P5 (editorial) — both consume P2 primitives
Wave E (last):                      P6 (docs) — reflects the now-coherent system
```
Rationale: P0A makes the design contract *true*, so P0B documents reality (not aspiration). P2 is the only `L` touching `critical` hooks and overlaps active send/cookie-jar commits, so it waits for that work to land. P4/P5 depend on P2's primitives. Docs go last.

---

# PHASE 0A — Finish the admin sheet → AdminDialog migration  `critical-adjacent`

**Why:** The design contract says "side sheets are retired," but `LeftSheet`/`RightSheet`/`BottomSheet` renderers + a `CanvasLeftSheet` bridge still exist. Investigation confirmed **all 11 sheet flows already render as `AdminDialog`** through that bridge — so this is dead-indirection removal, not a behavioral rewrite. Removing it makes the contract true and deletes ~2,600 lines.

> **Scope caveat (corrects an audit blind spot):** that census covered only the *sheet-descriptor inspector* flows. The Hub **full-surface flows** (Submit Work, Create Assessment, Create Hypercert) are a separate `ActionFlowShell`-in-`AdminDialog` path and were **not** in scope — which is exactly why the reported **Create Assessment "doesn't open"** bug slipped through. Those flows + the dialog-consistency work live in **Phase 0C**.

**Keep (do not touch):** `SheetBody` / `SheetFooter` / `SheetDivider` (layout primitives used *inside* dialogs), `useSheetOrchestrator(+Store)`, `ADMIN_RIGHT_SHEET_REGISTRY`, route-parsing in `sheetRegistry.ts`. Right-sheet Profile/Settings/Notifications are already `AdminDialog` (`CanvasLayout.tsx:550-560`) — no change.

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P0A.1** (M) | Normalize the 4 view descriptors: rename `width`→`size` (`wide`→`xl`, default→`lg`), drop sheet-only layout props, emit `AdminDialog` props (incl. `tone`) directly. | `views/Garden/components/GardenSheetDescriptor.tsx`, `views/Hub/components/HubSheetDescriptor.tsx`, `views/Actions/ActionsSheetDescriptor.tsx`, `views/Community/components/CommunitySheetDescriptor.tsx` | All 11 flows (Add Member, Hypercert, Work Detail, Certification, History, Action Create/Detail/Edit, Vault, Strategies, Signal Pool) open as `AdminDialog` with correct size+tone; route-backed deep-links still work. |
| **P0A.2** (M) | Collapse the `CanvasLeftSheet` bridge — render `AdminDialog` directly from the (now-normalized) descriptor config in `CanvasLayout`; remove `LeftSheetProvider` / `useLeftSheetConfigValue` wiring. Confirm at impl whether descriptors keep shape (preferred) or feed a thin `useAdminDialogDescriptor`. | `packages/admin/src/components/Layout/CanvasLayout.tsx` (bridge at `:696-714`, provider at `:456`, render at `:562-567`) | No `CanvasLeftSheet`; left-inspector flows render via the same `AdminDialog` path as right-sheet; `bun run --filter @green-goods/admin test` green. |
| **P0A.3** (S) | Delete dead renderers + their tests/stories; remove `Canvas/index.ts` exports. | Delete `packages/shared/src/components/Canvas/{LeftSheet,RightSheet,BottomSheet,CanvasSheetInternals}.tsx` + sheet `*.stories.tsx`/`*.test.tsx`; prune `Canvas/index.ts`. Evaluate `LeftSheetContext.tsx` for removal (optional). | ~2,600 lines removed; `bun build` + `knip` show no dangling imports/exports. |
| **P0A.4** (S) | Update tests/stories that referenced sheets. | `__tests__/components/CanvasLayout.test.tsx`, `__tests__/routes/sheet-registry.test.ts`, `__tests__/routing/route-folding.test.ts`, `GardenSheetDescriptor.test.tsx`, `ActionsSheetDescriptor.stories.tsx` | All pass; story coverage gate (`check:stories`) green. |

**Verification:** Storybook (`:3004`) for each descriptor's dialog at mobile + desktop; authenticated Brave QA on admin (`:3002`) for the route-backed flows (deep-link, close-nav, tone). **Order:** P0A.1 → P0A.2 → P0A.3 → P0A.4 (descriptors first while bridge still exists, then collapse, then delete).

---

# PHASE 0B — Design-contract truth-up + agentic guards  (after P0A)

**Why:** Once sheets are gone, update the contracts to describe reality and close the agentic-output gaps. The token layer is already healthy (synced today, 2.4.0) — this is doc-layer work.

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P0B.1** (S) | Rewrite the overlay sections to describe the dialog-only architecture as *shipped*; remove "retired/aspirational" hedging; state `SheetBody/Footer/Divider` survive as in-dialog primitives. | `.claude/skills/design/prompt-contract.md`, `client-prompt-contract.md` | An agent reading the contract sees only `AdminDialog`; no reference to live sheets. |
| **P0B.2** (S) | Add `AdminSortSelect` + `AdminViewActions` to the palette; replace the hardcoded "13" with a filesystem-derived count (or drop the number). | `prompt-contract.md:125`, `design/ARCHITECTURE.md` | Palette lists all 15 real primitives; no stale count. |
| **P0B.3** (S) | Add a Never-Rename guard: `--color-primary` is the canonical **tertiary accent** token. | `prompt-contract.md`, `client-prompt-contract.md` | Caveat present in both contracts. |
| **P0B.4** (M) | Add a **concentricity reference block** (before/after CSS + concrete px) to `language.md`; document the 4-role volume hierarchy as a review-time principle with an explicit "no automated checker yet" note. | `.claude/skills/design/language.md`, `quick-reference.md` | Concrete example an agent can copy; honest enforcement note. |
| **P0B.5** (S) | Add short **Motion Scheme** (Standard vs Expressive) + **Workspace Tone** (`[data-tone]`→`--tone-*` fallback) subsections. | `prompt-contract.md` | Both documented with token names. |

**Verification:** `bun run check:design-md`, `check:design-generated`, `check:design-tokens`, `lint:vocab` all green.

---

# PHASE 0C — Admin dialog system: standardize + runtime QA / repair  (after 0A — the consistency + broken-dialog ask)

**Why:** Removing sheets isn't enough. Admin **action dialogs are not a system**: sizes are assigned ad hoc per descriptor (Add Member `xl`, Hypercert `lg`, Work Detail `xl`, Certification `lg`, create-flows `2xl`) with no rule for *why*, the chrome/CSS isn't standardized across actions, and at least one action — **Create Assessment — reportedly doesn't open at all**. The static audit missed all of this because it never ran the UI. This phase makes dialogs a system, audits every one at runtime, and repairs the broken/inconsistent ones.

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P0C.1** (S) | Define the canonical dialog standard: a **size taxonomy keyed to action type** + one shared chrome spec (header/footer/padding/scrim, mobile bottom-sheet, `tone` pass-through), centralized in `AdminDialog` and documented in the contract. **Taxonomy:** `sm`=confirm/destructive · `md`=quick form/config · `lg`=detail/inspector (Hypercert, Certification, History, Action Detail, Vault, Strategies, Signal Pool) · `xl`=multi-field create/edit (Add Member, Action Create/Edit) · `2xl variant="flow"`=full-surface wizard (Submit Work, Create Assessment, Create Hypercert). | `components/AdminDialog.tsx`, `.claude/skills/design/prompt-contract.md` | One documented standard; every size choice traceable to action type. |
| **P0C.2** (M) `debug` | **Runtime dialog census** — with `bun run dev` + authenticated Brave QA on admin (`:3002`), open EVERY action dialog and record open?/size/tone/chrome. Targets: Submit Work, Create Assessment, Create Hypercert, Add Member, Action Create/Detail/Edit, Vault, Strategies, Signal Pool, Profile, Settings, Notifications, all confirms. | — (produces a pass/fail table) | The step the static audit skipped; every dialog has a verified state. |
| **P0C.3** (M) `debug` | **Fix Create Assessment "doesn't open."** Reproduce on the rendered surface FIRST. Static facts in hand: route `/hub/assess/create` mounts `CreateAssessment` → renders `<AdminDialog open>` unconditionally ([CreateAssessment.tsx:200](packages/admin/src/views/Hub/CreateAssessment.tsx)); the known stale-domain crash is already guarded ([DomainContextStep.tsx:53](packages/admin/src/components/Assessment/CreateAssessmentSteps/DomainContextStep.tsx)). Candidate live causes to verify: Hub trigger/FAB (`cockpit.hub.action/fab.create-assessment`) not navigating; `useCreateAssessmentController` garden=null (would show an error Alert *inside* a dialog, not "no dialog"); a runtime throw caught upstream; the route swapping the whole Hub view rather than layering. Fix the actual cause; add a regression test/story. | `views/Hub/CreateAssessment.tsx`, the Hub trigger (`views/Hub/**`), `useCreateAssessmentController` (shared) | Create Assessment opens reliably; regression guard added. |
| **P0C.4** (M) | Reconcile every dialog to the P0C.1 standard; remove per-descriptor size guesses (ties into P0A.1). | the 4 descriptors + create-flow views | Every action dialog opens at its standard size with identical chrome, verified in authenticated Brave at mobile + desktop. |

**Process fix (so this doesn't recur):** any "dialogs/flows work" claim requires a **runtime open-every-dialog pass**, not code reading. The static-only audit is what let Create Assessment slip.

---

# PHASE 1 — Skills cleanup  (foundation; no collisions, start now)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P1.1** (S) | Extract the duplicated Linear-routing block to a shared fragment; reference it from the 5 consumers. | new `.claude/context/linear-routing-rules.md`; edit `audit/SKILL.md:375`, `clean/SKILL.md:474`, `principles/SKILL.md:201`, `architecture/SKILL.md:188`, `debug/SKILL.md:491` | One source of truth; consumers reference, don't inline. |
| **P1.2** (S) | Extract the validation-pipeline command to a shared fragment; reference from consumers. | new `.claude/context/validation-pipeline.md`; edit `ship`, `clean`, `audit-then-ship`, `plan`, `testing` SKILL.md | `bun format && bun lint && bun run test && bun build` defined once. |
| **P1.3** (S) | Fix the broken i18n reference: repoint to the real gate — the vitest `packages/shared/src/__tests__/i18n/locale-coverage.test.ts` (runs under `bun run test`). | `audit/SKILL.md:130` | Referenced check exists and runs. |
| **P1.4** (M) | Split the 683-line `posthog-questions` into `SKILL.md` (intro+TOC) + `queries.md` + `privacy.md`. | `.claude/skills/posthog-questions/**` | No single file >~300 lines; navigation clear. |
| **P1.5** (M) | Add a skill-selection decision tree to `index.md`; clarify `debug` (passive/immediate) vs `audit-then-ship` (explicit/gated); rewrite the `status` mode table to be self-explanatory. | `.claude/skills/index.md`, `status/SKILL.md` | A reader picks the right skill without reading implementations. |
| **P1.6** (S) | Document the lens dependencies (`review`→architecture/principles/testing/audit). | frontmatter or new `.claude/context/skill-dependencies.md` | Dependencies explicit. |

**Verification:** grep shows no duplicated rule blocks; every referenced script/path resolves; `bun run check:skills` (if present) / skill lint green.

---

# PHASE 2 — Shared funding & transaction primitives  `critical` · GATED

> ⚠️ **Gate:** Start only after the in-flight send/cookie-jar commits (`b28bb303`, `571ac75f`, `8a1c3af5`) have landed/merged. Confirm with `git log`/branch state. Re-verify each flow's line numbers against the working tree before editing.

**Why:** Five flows (endow / donate / claim / PWA cookie-jar withdraw / PWA send) re-implement amount-input, wallet-connect, and tx-feedback. Extract three primitives and adopt them so the cookie jar reads as one concept and the funding flows converge.

**Primitive APIs (from investigation):**
- **`FormattedAmountInput` + `useFormattedAmountInput(value, decimals, maxAmount?)`** → `{ parsedAmount, formatErrorId, exceeds, isEmpty }`. **Lives in `packages/shared/src/components/form/`.** Use **semantic tokens** (`border-error-light`, not `border-error-base`) so it compiles under shared's own Tailwind build (the shared-scan gotcha).
- **`WalletConnectButton`** (label transitions connect→submitting→primary, consistent loading). **Lives in `packages/client/`** (depends on `useAuth()`); accepts `className` for editorial vs standard styling.
- **`TransactionSuccessAffordance`** (`mode: screen | toast | receipt | none`). **Lives in `packages/shared/src/components/feedback/`** (extends the existing `TxInlineFeedback` pattern). Display only — each flow keeps its own reset callback.

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P2.1** (M) | Build `FormattedAmountInput` + `useFormattedAmountInput` (fold in `validateDecimalInput`/`normalizeDecimalInput`/`parseUnits`). | new `packages/shared/src/components/form/FormattedAmountInput.tsx`; export via barrel | Unit tests for parse/validate/max/empty; renders with semantic tokens. |
| **P2.2** (M) `critical` | Adopt in **Send** first (validation already structured). | `views/Home/WalletDrawer/Send/AmountStep.tsx:105-127`, `Send/validation.ts` | Review-step gating unchanged; send tests pass. |
| **P2.3** (M) `critical` | Adopt in **PWA cookie-jar withdraw**, **donate**, **claim**. | `views/Home/WalletDrawer/CookieJarTab.tsx:109-134`; `components/Public/PublicCookieJarCard.tsx` deposit `:665-680` + claim `:613-630` | Max button + inline errors preserved; withdraw/deposit/claim behavior unchanged. |
| **P2.4** (M) | Build `TransactionSuccessAffordance`; adopt in **Endow** (replace `SuccessBody:499-552`); **decide donate/claim success** (toast vs panel — see Open Decisions). | new shared component; `components/Public/PublicFundingCard.tsx` | Endow success unchanged visually; donate/claim get the chosen affordance. |
| **P2.5** (M) | Build `WalletConnectButton` (client); adopt in Endow/Donate/Claim for consistent connect-loading. | new `packages/client/src/components/WalletConnectButton.tsx`; the 3 editorial flows | Endow's "Preparing wallet…" inconsistency resolved; one connect UX. |

**Verification:** `bun run test` (shared + client); authenticated Brave QA on PWA (`:3001` `?presentation=pwa`) for send + cookie-jar; editorial (`:3001` browser) for endow/donate/claim; confirm `critical` hooks' error paths still surface (not log-only).

---

# PHASE 3 — Admin polish (non-sheet)  (parallel-safe with P0B)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P3.1** (S) | Replace shared `<Surface>` / ad-hoc `<div className="p-4">` with `AdminCard`. | `views/Actions/ActionDetail.tsx:93,133`, `views/Garden/Assessment.tsx:154`, `views/Garden/{SignalPool,Vault}.tsx` | No shared `Surface` in admin views; spacing matches M3. |
| **P3.2** (M) | Add `AdminCard variant="compact"` (p-3); remove per-view `className="p-3"` overrides. | `components/AdminCard.tsx`; consumers in `views/Garden/components/OverviewTab.tsx`, Hub modals | No padding overrides; one density ladder. |
| **P3.3** (S) | Normalize `.canvas-route-card` padding to symmetric; reduce mobile gutters (`main px-5`→responsive). | `packages/admin/src/index.css:1231`, `CanvasLayout.tsx` main padding | 375px viewport gutters reduced; symmetric card padding. |
| **P3.4** (S) | Sweep raw type utilities → M3 (`text-title-*`/`label-*`); unify icon sizes; add missing `sm:` breakpoints; `aria-current` on nav; empty-state type. | `views/Garden/Assessment.tsx:148`, `CanvasWorkspaceSelectionState.tsx:35`, et al. | Consistent type/icon/breakpoints; nav announces active. |

**Verification:** Storybook geometry guard; authenticated Brave QA on admin at mobile + desktop. **Gotcha:** author any new utilities in admin JSX/CSS, not shared.

---

# PHASE 4 — PWA flows, onboarding & wallet  (after P2; reuses its primitives)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P4.1** (M) | Add a first-run / join-a-garden path from the empty garden list (gated on the onboarding product decision — see Open Decisions). | `views/Home/GardenList.tsx:106`, `views/Home/index.tsx`, `views/Login/index.tsx` | New user has a clear CTA, not a dead end. |
| **P4.2** (S) | Add explanatory copy to skeleton loaders. | `views/Garden/index.tsx:53-96`, `Send/AmountStep.tsx:40`, `CookieJarTab.tsx:233` | Every skeleton states what's loading. |
| **P4.3** (M) `critical` | Surface offline state inline + early (not just review step); explain disabled withdraw + pull-to-refresh. | `Send/ReviewStep.tsx:82` (move earlier), `CookieJarTab.tsx:150`, `Home/index.tsx:213` | Offline reason shown before action attempt. |
| **P4.4** (M) | a11y sweep: `aria-current="page"` on AppBar tabs; `role="group"` on token list; `aria-label` on QR `<video>`; mark + explain the cookie-jar "purpose" field. | `components/Layout/AppBar.tsx:88`, `Send/AmountStep.tsx:34`, `Send/QRScanner.tsx:122`, `CookieJarTab.tsx:141` | axe clean on these; required field marked. |
| **P4.5** (S) | Brief send success confirmation before auto-reset; guard back-button amount discard. | `Send/SendTab.tsx:43-92` | No silent data loss; success acknowledged. |

**Verification:** authenticated Brave QA on PWA; axe/keyboard pass; offline simulation.

---

# PHASE 5 — Editorial copy & flows  (after P2)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P5.1** (S) | Convert the ~5–8 **public-facing** em-dashes to periods/colons (mirror en+es+pt). Candidates: `public.fund.dialog.endow.risk`, `app.home.work.offlineInfo`, `public.cookies.unknownCampaign`, `public.fund.garden.ambiguous`, + the 2–3 other public funding/info strings flagged in the audit. | `packages/shared/src/i18n/{en,es,pt}.json` | Targeted dashes gone; **locale-coverage test passes**; admin/status dashes left untouched. |
| **P5.2** (S) | Human-grounding rewrites of cold strings. | `en/es/pt.json`: `public.fund.card.conversionUnavailable`, `wethUnavailable`, `public.fund.endowments.connect.lede` | Warmer copy; passes `lint:vocab`; mirrored in 3 locales. |
| **P5.3** (M) | Funding-surface state fixes: donate "you've contributed X" echo; stale-price severity (>2 min); real-time (onBlur) validation; explicit endowment-panel close while wallet modal opens; endowment-data error state. | `components/Public/{PublicCookieJarCard,PublicFundingCard,PublicEndowmentPanel}.tsx` | Each state present and verified. |
| **P5.4** | Flow unification — **inherited from P2** (donate/claim success affordance, unified connect). | — | Covered by P2. |

**Verification:** `bun run test` (locale-coverage + components); `bun run lint:vocab`; authenticated Brave QA on editorial. **Hard constraint:** every `en.json` edit needs es+pt mirrors and must pass the 4-part locale gate.

---

# PHASE 6 — Documentation  (last; reflects the now-coherent system)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P6.1** (S) | Reconcile the domain count: present 4 canonical domains (`SOLAR·AGRO·EDU·WASTE`); fence the historical 5th clearly (not present-tense). | `docs/docs/builders/specs/v1-0.mdx:183-332` | Count matches `packages/shared/src/types/domain.ts`. |
| **P6.2** (S) | Resolve entity-matrix status: either `list: true` or remove/caveat the CLAUDE.md citation. | `docs/docs/builders/integrations/entity-matrix.mdx:5`, `CLAUDE.md:96` | No "canonical reference" pointing at a draft. |
| **P6.3** (S) | Tighten the Assessment definition into timing → purpose → scope; keep baseline-first lifecycle. | `docs/docs/reference/glossary-community.md:51,182` | Reversed-order misreading removed. |
| **P6.4** (S) | Mirror the capital-ordering note (presentational vs enum) into design-research. | `docs/docs/reference/design-research.md:68-79` | Both docs explain the two orderings. |
| **P6.5** (M) | Add a legend + 3-sentence intro to the architecture diagram; add a reader-routing map to the docs home. | `docs/docs/builders/architecture.mdx:47-109`, docs home | Diagram legible; readers routed by persona. |

**Verification:** Docusaurus build (`:3003`); link check; re-grep domain/capital claims against `domain.ts`.

---

## Cross-cutting constraints (every phase)
- **i18n:** `en.json` edits require es+pt mirrors and must pass `packages/shared/src/__tests__/i18n/locale-coverage.test.ts`; copy must clear `lint:vocab`.
- **Tailwind v4 shared-scan:** utilities authored in `packages/shared/src/` don't compile into admin/client — use semantic tokens in shared components, or author utilities in the consumer.
- **Design-token gate:** never put `#<number>` PR refs in source comments; run `check:design-tokens` before pushing token/CSS work.
- **Multi-agent repo:** stay on the current branch; stash unknown diffs (don't revert); P2 especially must not start on a moving tree.
- **Global gate per PR:** `bun format && bun lint && bun run test && bun build` + the `/ship` gate.

## Remaining open product decisions (don't block planning; resolve before the relevant phase)
1. **Donate/claim success affordance (P2.4):** transient toast (matches current) vs a small success panel/receipt like endow? Affects P2.4 + P5.4 scope.
2. **Onboarding join path (P4.1):** is there a defined "request/join a garden" flow to wire to, or is that undecided product scope? P4.1 can't fully land without this.
3. **Endow denomination reuse:** keep USD↔WETH toggle endow-only, or generalize `useEthUsdConversion` for future multi-asset donate? (Deferred; not required this pass.)

## Suggested first move
Start **Wave A** now — P0A (sheet migration) and P1 (skills) have no WIP collision and are pure foundation. P0A is the highest-value single change: it deletes ~2,600 dead lines and makes the design contract truthful, which is the whole "single source of truth" spine.

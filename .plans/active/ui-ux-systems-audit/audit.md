# Green Goods — Deep UI/UX & Systems Audit + Improvement Roadmap

> **Status:** Audit deliverable (findings + improvement outline). **Not** an execution plan — no fixes are started by this document.
> **Date:** 2026-06-30 · **Author:** Claude Code session (six parallel Explore audits + targeted verification)

## Context

Afo asked for a deep audit across six areas and an outline of the improvements we can make:

1. **Admin dashboard** — polished, consistent, clean UI
2. **Client PWA** — optimize user flows, onboarding, and wallet functionality (cookie jar, sending funds)
3. **Editorial website** — human-grounded copy, remove em-dashes where applicable, polish the donate/endow/claim cookie-jar UX, and bring those flows into consistency via shared patterns
4. **Design system** — capture drift, create coherency, enable stronger agentic UI design outputs going forward
5. **Skills** — polish/fix drift, streamline, reduce duplication, clarify rules and expectations
6. **Documentation** — accuracy, clarity, human-friendly to read and digest

This document is the **deliverable** for this pass: findings + a prioritized improvement roadmap. **No code changes happen now** — implementation is a separate, approved step. (Confirmed: *audit + outline only*.)

**Scoping decisions (locked with Afo this session):**
- **Deliverable:** Audit + outline only.
- **Sequence:** **Foundation first** — design-system coherency + shared patterns + skills before surface polish, so admin/PWA/editorial work lands on one consistent base.
- **Format:** One **combined roadmap** organized around a *reduce-divergence / single-source-of-truth* spine, persisted here at `.plans/active/ui-ux-systems-audit/audit.md`.

**Evidence base:** six parallel Explore agents (one per area) + targeted verification of the load-bearing claims. Findings are grounded in file reads; the four most important were re-verified against ground truth before being written here.

---

## The spine: reduce divergence, converge on a single source of truth

Every one of the six asks is the same problem wearing a different hat:

- **Editorial** — donate / endow / claim are three bespoke flows that should share patterns.
- **Cookie jar** — rendered two completely different ways (PWA wallet drawer vs editorial `/cookies`) with duplicated amount-input / wallet-connect / tx-feedback logic.
- **Design system** — the canonical contract has drifted from the shipping code (sheets), so there is no single source of truth for an agent to follow.
- **Skills** — the same rules (Linear routing, validation pipeline) are copy-pasted across 4–5 skills and drift independently.
- **Docs** — two docs disagree (domain count, capital ordering); one "canonical" reference is marked draft.
- **Admin** — shared `Surface` and ad-hoc `<div className="p-4">` used where canonical `Admin*` wrappers exist.

So the roadmap is sequenced **foundation → shared patterns → surfaces → docs**, and every phase is framed as "collapse N divergent things into 1 canonical thing."

---

## Verified this session (corrections to the raw agent reports)

| Claim | Raw report | Verified truth |
|---|---|---|
| Admin `Admin*` component count | "13 documented, 31 actual (2.4× under-documented)" | **13 documented, 15 actual.** The "31" counted stories/tests. Only `AdminSortSelect` + `AdminViewActions` are undocumented. |
| Admin sheets "retired" | Flagged as contradiction | **CONFIRMED.** `prompt-contract.md` says retired; `CanvasLayout.tsx` actively uses Left/RightSheet. Headline design-system finding. |
| `check-i18n-completeness.mjs` | "missing, critical" | **CONFIRMED missing.** `audit/SKILL.md:130` references a script that doesn't exist; repoint to the real locale-coverage gate. |
| Em-dashes in i18n | "163 across en/es/pt" | **CONFIRMED:** 60 + 44 + 59 in `packages/shared/src/i18n/`. |

---

# PHASE 0 — Design-system coherency (FOUNDATION, do first)

**Framing:** The *token* layer is healthy. The *contract/doc* layer has drifted from shipping reality, and the design rules are prose-only (not machine-checkable), which is exactly what weakens agentic UI output. Fix the contract so it describes what ships, then add machine-checkable guards where cheap.

**What's already good (leave alone):** tokens synced today (token_version 2.4.0 across `design`+`ui`), no hardcoded cubic-bezier/duration/color drift outside baseline, dark-mode parity enforced in CI, glass restriction enforced, admin/client surface-identity separation clean (no Plus Jakarta Sans in client, no stray glass in admin).

### Findings
- **F0.1 — `prompt-contract.md` ↔ shipping layout contradiction (HIGH).** Contract says side sheets are retired and "never propose a slide-in side panel"; `packages/admin/src/components/Layout/CanvasLayout.tsx` is built on `LeftSheetProvider` / `useAdminRightSheetDescriptor` / `CanvasLeftSheet` and right-sheet profile/settings/notifications. An agent following the contract will refuse to touch or will try to rip out the actual architecture.
- **F0.2 — Undocumented primitives (LOW).** `AdminSortSelect`, `AdminViewActions` exist but are absent from the canonical palette in `prompt-contract.md:125`. Agents will re-invent them.
- **F0.3 — `--color-primary` = tertiary caveat not in the prompt contracts (MEDIUM).** The "do not rename" caveat lives in `language.md` / `quick-reference.md` but not in the two files agents actually load as contracts.
- **F0.4 — Prose-only invariants (MEDIUM).** 4-role volume hierarchy (80/8/3/1) and concentricity (`child_radius = parent_radius − padding`) are described but not checkable and have no canonical before/after example for an agent to match.
- **F0.5 — Motion schemes + workspace-tone scoping under-documented for agents (MEDIUM).** Standard-vs-Expressive and the `[data-tone]` → `--tone-*` fallback chain are implied, not spelled out in the contracts.

### Improvements (outline)
- **Resolve the sheet contradiction** — this is a *decision*, then an edit (see Open Questions). Either (a) update `prompt-contract.md` + `client-prompt-contract.md` to describe the real sheet+dialog architecture, or (b) commit to finishing the dialog migration and mark sheets deprecated-in-progress with a concrete pointer. **Recommend (a)** given how load-bearing sheets are in `CanvasLayout`.
- Add `AdminSortSelect` + `AdminViewActions` to the palette; regenerate any count claims from the filesystem instead of hardcoding "13."
- Embed the `--color-primary` caveat as a Never-Use guard in both prompt contracts.
- Add a **concentricity reference block** (before/after CSS + concrete numbers) to `language.md` and link it from the contracts; document the volume hierarchy as a review-time principle with an honest "no automated checker yet" note.
- Add short **Motion Scheme** and **Workspace Tone** subsections to `prompt-contract.md`.
- *(Optional, higher effort)* a Storybook/CI lint that flags a child radius token ≥ its parent's, and a color-volume reporter.

### Representative files
`.claude/skills/design/prompt-contract.md`, `client-prompt-contract.md`, `language.md`, `quick-reference.md`, `ARCHITECTURE.md`, `defect-grammar.md`; `packages/admin/src/components/Layout/CanvasLayout.tsx` (reference, not edited in audit).

**Effort:** Contract/doc fixes **M** (mostly writing, decision-gated on the sheet question). Optional machine checks **L**.

---

# PHASE 1 — Skills cleanup (FOUNDATION, enables agentic output)

**Framing:** Collapse duplicated rule-blocks into shared fragments, kill drift, and make skill selection unambiguous. This directly serves "stronger agentic UI design outputs going forward."

### Findings
- **F1.1 — Duplicated rule blocks (MEDIUM).** The **Linear routing** block is near-verbatim in `audit`, `clean`, `principles`, `architecture` (+ a variant in `debug`). The **validation pipeline** (`bun format && bun lint && bun run test && bun build`) is repeated across `ship`, `clean`, `audit-then-ship`, `plan`, `testing`. These drift independently.
- **F1.2 — Drift (MEDIUM/CONFIRMED).** `audit/SKILL.md:130` calls a non-existent `check-i18n-completeness.mjs`. Admin component-count claims in `design/ARCHITECTURE.md` + `prompt-contract.md` should be derived, not hardcoded.
- **F1.3 — `posthog-questions` is a 683-line outlier (LOW).** Reads like a query dump; hard to navigate. Split into intro + queries + privacy.
- **F1.4 — Selection ambiguity (MEDIUM).** `review` vs `audit` vs `principles` vs `architecture` overlap; `index.md` has a table but no decision tree. `debug` vs `audit-then-ship` precedence is unstated. `status` mode descriptions are ambiguous.
- **F1.5 — Implicit dependencies (LOW).** `review` uses `architecture`/`principles`/`testing`/`audit` as lenses but those aren't declared anywhere; changing one can silently break another.

### Improvements (outline)
- Extract `.claude/context/linear-routing-rules.md` and `.claude/context/validation-pipeline.md`; reference them from the 4–5 consumers instead of inlining.
- Fix the `audit` skill's i18n reference → point at the real shared locale-coverage gate command.
- Split `posthog-questions/SKILL.md` into `SKILL.md` (intro + TOC) + `queries.md` + `privacy.md`.
- Add a **skill-selection decision tree** to `index.md`; clarify `debug` (passive/immediate) vs `audit-then-ship` (explicit/gated); rewrite the `status` mode table to be self-explanatory.
- Add an explicit dependency note (frontmatter or `.claude/context/skill-dependencies.md`) for the lens relationships.

### Representative files
`.claude/skills/{audit,clean,principles,architecture,debug,ship,plan,testing,review,status}/SKILL.md`, `.claude/skills/index.md`, `.claude/skills/posthog-questions/SKILL.md`, new `.claude/context/*.md` fragments.

**Effort:** Quick wins (fragments, i18n fix, count fix, status table) **S**. Decision tree + posthog split + dependency map **M**.

---

# PHASE 2 — Shared funding & transaction patterns (the reconciled "cookie jar" story)

**Framing:** This is the cross-cutting heart of the editorial ask *and* the PWA wallet ask. The cookie jar is rendered two ways and the funding flows are five bespoke implementations of the same shape. Extract a small shared transaction-flow toolkit and adopt it everywhere.

**The full picture (reconciled across the PWA + editorial audits):**

| Flow | Surface | Container | Amount input | Wallet connect | Success state |
|---|---|---|---|---|---|
| Endow | editorial `/fund` | modal | USD+WETH toggle | inline "Preparing wallet…" | dedicated success screen + receipt |
| Donate | editorial `/cookies` | inline card | token only | login prompt | input clears only |
| Claim | editorial `/cookies` | inline card | token (fixed/variable) | login prompt | input clears only |
| Cookie-jar withdraw | PWA wallet drawer | drawer tab | token + purpose | (authed) | drawer closes |
| Send | PWA wallet drawer | drawer tab | token | (authed) | toast, auto-reset |

They already share hooks (`useVaultDeposit`, `useCookieJarDeposit`, `useCampaignCookieJarWithdraw`, `useCookieJarWithdraw`, `useSendToken`) and `validateDecimalInput` / `classifyTxError`, but the **UI is duplicated five times** with inconsistent success/error/loading treatment.

### Improvements (outline)
- Extract a shared **`FormattedAmountInput`** (parse/validate/max/denomination) — kills the duplicated amount logic across `PublicFundingCard`, `PublicCookieJarCard`, `AmountStep`, `CookieJarTab`.
- Extract a shared **`WalletConnectButton`** with a consistent loading state (endow's "Preparing wallet…" vs donate/claim's instant blank button is the most visible inconsistency).
- Standardize **transaction feedback**: one success affordance (donate/claim currently give none beyond clearing the field) and one inline error pattern (`TxInlineFeedback`).
- Decide whether donate gets a **receipt** like endow (currently only endow has `PublicFundingReceipt`).
- These primitives live in shared (hooks already do); adopt them in both surfaces so the cookie jar reads as *one* concept.

### Representative files
`packages/client/src/components/Public/{PublicFundingCard,PublicCookieJarCard,CampaignCookieJarInlineActions,PublicEndowmentPanel,PublicFundingReceipt}.tsx`; `packages/client/src/views/Home/WalletDrawer/{CookieJarTab,SendTab,Send/*}.tsx`; new shared primitives under `packages/shared/src/`.

**Effort:** **L** (shared extraction + 5 adoption sites). High leverage — unblocks consistency in both Phase 4 and Phase 5. **Carries the WIP risk below.**

> ⚠️ **In-flight collision.** Recent commits (`b28bb303`, `571ac75f`, `8a1c3af5`) are active send/cookie-jar work. Re-verify the wallet-drawer findings against the working tree before extracting; coordinate so this doesn't collide with another session.

---

# PHASE 3 — Admin dashboard polish

**Framing:** The layout system is sound; the gaps are consistency (canonical wrappers, spacing, type utilities) not architecture. Most findings are S.

### Findings (high-leverage subset; the agent produced ~20)
- **F3.1 — Canonical-wrapper bypass (MEDIUM).** Shared `<Surface>` and ad-hoc `<div className="p-4">` used inside admin views (e.g. `ActionDetail.tsx:93,133`, `Garden/Assessment.tsx:154`) instead of `AdminCard` → shared styling diverges from admin M3.
- **F3.2 — Padding compounding on mobile (MEDIUM, CONFIRMED).** `main px-5` (20px) + `.canvas-route-card` (16px) + inner padding (16px) ≈ 52px gutters on a 375px viewport. `.canvas-route-card` is also asymmetric (`0.875rem 1rem 1.25rem`). (Sheet over-layering claim was **refuted**.)
- **F3.3 — Missing `AdminCard` density variant (MEDIUM).** Views override with `className="p-3"` because there's no `compact` variant → add one, remove the overrides.
- **F3.4 — Type/icon/breakpoint inconsistency (LOW).** Raw `text-base font-medium` instead of M3 type utilities; mixed icon sizes; grids skipping the `sm:` breakpoint.
- **F3.5 — `aria-current` / eyebrow / empty-state polish (LOW).**

### Improvements (outline)
Replace `Surface`/ad-hoc divs with `AdminCard`; normalize `.canvas-route-card` padding and reduce mobile gutters; add `AdminCard variant="compact"`; sweep type/icon/breakpoint utilities; add the 2 undocumented wrappers to the palette (ties to Phase 0).

### Representative files
`packages/admin/src/views/{Actions/ActionDetail,Garden/Assessment,Garden/SignalPool,Garden/Vault}.tsx`, `packages/admin/src/components/AdminCard.tsx`, `packages/admin/src/index.css` (`.canvas-route-card`), `admin-m3-overrides.css`.

**Effort:** Mostly **S**, a couple **M** (compact variant + its adoption). **Gotcha:** any new utility classes must be authored in admin/client JSX, not shared (Tailwind v4 doesn't scan `packages/shared/src/`).

---

# PHASE 4 — PWA flows, onboarding & wallet

**Framing:** Core loop works; the gaps are onboarding dead-ends, ambiguous loading/offline states, and a11y. Builds on Phase 2's shared primitives.

### Findings (high-leverage subset)
- **F4.1 — Onboarding dead-end (HIGH).** After passkey creation a new user lands on an empty garden list ("You don't steward any gardens yet") with **no join/request CTA and no first-run guidance**. (`views/Home/GardenList.tsx:106`, `views/Login/index.tsx`.)
- **F4.2 — Ambiguous loading states (HIGH).** Skeletons with no explanatory text in Garden submission, Send amount step, and Cookie-jar tab → on slow/offline networks users can't tell loading from broken.
- **F4.3 — Offline feedback is late/implicit (HIGH).** Send shows the offline warning only at the review step; cookie-jar withdraw and pull-to-refresh disable silently with no inline reason.
- **F4.4 — a11y gaps (MEDIUM).** AppBar tabs lack `aria-current="page"`; token list isn't a semantic group; QR `<video>` has no label; cookie-jar "purpose" is required but unmarked/unexplained.
- **F4.5 — Send success/back ergonomics (LOW/MEDIUM).** No confirmation screen before auto-reset; Back can silently discard amount.

### Improvements (outline)
Add a real first-run/join path; give every skeleton an explanatory line; surface offline state inline and early; a11y sweep (`aria-current`, `role="group"`, video label, mark required + explain purpose); consider a brief success confirmation before reset. Reuse Phase 2 primitives for the wallet flows.

### Representative files
`packages/client/src/views/Home/{index,GardenList}.tsx`, `views/Garden/index.tsx`, `views/Login/index.tsx`, `views/Home/WalletDrawer/{CookieJarTab,SendTab,Send/*}.tsx`, `components/Layout/AppBar.tsx`.

**Effort:** Onboarding path **M**; state/a11y sweeps **S–M**. **Same WIP caveat as Phase 2.**

---

# PHASE 5 — Editorial website copy & flows

**Framing:** Copy is already mostly warm (no banned vocabulary found). The work is targeted em-dash/tone edits + adopting Phase 2's shared funding patterns. Flow consistency is largely *delivered by Phase 2*.

### Findings
- **F5.1 — Em-dashes (CONFIRMED).** 163 in `packages/shared/src/i18n/{en,es,pt}.json`. ~5–8 are user-facing public-flow candidates for periods/colons (e.g. endow risk disclosure, offline-save info). Most others are admin/status strings — lower priority.
- **F5.2 — A few cold/utility strings (LOW).** e.g. `public.fund.card.conversionUnavailable` ("ETH price unavailable"), `wethUnavailable` ("price feed unavailable"), endowment-connect lede reads functional rather than warm.
- **F5.3 — Flow divergence (MEDIUM)** — addressed by Phase 2 (donate/claim lack receipt/success; endow's wallet-connect differs).
- **F5.4 — Funding-surface rough edges (LOW–MEDIUM).** No personal-contribution echo after donating; stale-price shows timestamp without severity; validation only on submit; endowment panel hard to dismiss while wallet modal opens; no error state when endowment data fails to load.

### Improvements (outline)
Targeted human-grounding rewrites of the cold strings; convert the ~5–8 public-facing em-dashes; adopt Phase 2 shared funding patterns to unify donate/endow/claim; add the small funding-surface state fixes.

### Representative files
`packages/shared/src/i18n/{en,es,pt}.json`, `packages/client/src/components/Public/*`, `packages/client/src/views/Fund.tsx`.

**Effort:** Copy/em-dash **S**; flow unification inherited from Phase 2. **Hard constraint:** every `en.json` edit needs `es`+`pt` mirrors and must survive the 4-part locale-coverage gate (parity, counts, source-usage, identical-string quality); rewrites must avoid the `lint:vocab` banned list.

---

# PHASE 6 — Documentation

**Framing:** Broadly accurate; fix the confirmed contradictions and add reader-friendly scaffolding. Do last so docs reflect the now-coherent system.

### Findings
- **F6.1 — Domain count (MEDIUM).** `v1-0.mdx` narrates 5 action domains; code implements 4 (`SOLAR·AGRO·EDU·WASTE`). A note exists but sections read present-tense; easy to misread.
- **F6.2 — `entity-matrix.mdx` is `unlisted: true` / self-described "draft" but CLAUDE.md cites it as canonical (MEDIUM).**
- **F6.3 — Assessment definition dense (LOW).** Glossary is *correct* (Assessment is baseline-first) but the phrasing risks the reversed reading; tighten into timing → purpose → scope.
- **F6.4 — Eight Forms of Capital ordering (LOW).** Presentational vs enum order explained in glossary, not in `design-research.md`.
- **F6.5 — Architecture diagram lacks legend/intro; Action Registry §3.5 incomplete; Figma links inconsistent (LOW).**

### Improvements (outline)
Reconcile domain count to 4 (or clearly fence the historical 5th); fix the entity-matrix status↔CLAUDE.md mismatch; tighten the Assessment definition; mirror the capital-ordering note; add a diagram legend + reader-routing map. Coordinate with the Phase 0/glossary work so banned-vocabulary + lifecycle stay aligned.

### Representative files
`docs/docs/builders/specs/v1-0.mdx`, `docs/docs/reference/{glossary-community.md,design-research.md}`, `docs/docs/builders/{architecture.mdx,integrations/entity-matrix.mdx}`, `CLAUDE.md` (entity-matrix reference).

**Effort:** **S–M** (writing/reconciliation).

---

## Cross-cutting constraints & gotchas (carry into every phase)
- **i18n:** `en.json` edits require `es`+`pt` mirrors and must pass the locale-coverage gate; rewrites must clear `lint:vocab`.
- **Tailwind v4 shared-scan gap:** utility classes authored in `packages/shared/src/` don't compile into admin/client — author them in the consumer JSX or restate as CSS.
- **In-flight work:** send/cookie-jar is actively changing; re-verify Phases 2/4/5 against the working tree and coordinate (concurrent sessions on `develop`).
- **Design-token gate:** never put `#<number>` PR refs in source comments (read as hex); run `check:design-tokens` before pushing token/CSS changes.
- **Criticality:** wallet/cookie-jar/send hooks are `critical` — changes there need the `web3`/`mutation-reliability` depth, not log-only error handling.

## Verification strategy (for the eventual implementation PRs)
- **Design/skills (Phase 0–1):** `bun run check:design-md`, `check:design-generated`, `check:design-tokens`, `lint:vocab`; confirm the i18n gate command the `audit` skill now points to actually runs.
- **Admin/PWA/editorial (Phase 2–5):** `bun run dev` + authenticated Brave QA profile for live DOM (admin at `:3002`, client PWA/website at `:3001` with `?presentation=` override); Storybook (`:3004`) for `Admin*` + shared primitives, plus `check:stories` / `check:story-quality`; `bun run lint:vocab` + locale gate for copy.
- **Docs (Phase 6):** build the Docusaurus site (`:3003`), check links, re-grep domain/capital claims against `packages/shared/src/types/domain.ts`.
- **Always:** `bun format && bun lint && bun run test && bun build` before any merge; `/ship` gate.

## Suggested first slice (if/when we move to implementation)
The highest-leverage, lowest-risk opener that honors foundation-first:
1. **Resolve + correct the sheet contract** (F0.1) and add the 2 missing primitives + `--color-primary` caveat (F0.2/F0.3) — restores the single source of truth agents depend on.
2. **Extract the two skills fragments + fix the i18n reference** (F1.1/F1.2) — immediate duplication/drift kill.
3. Then green-light **Phase 2 shared funding primitives** as the first real surface-affecting work, since it unblocks both PWA and editorial consistency — **but only after the in-flight send/cookie-jar commits land/merge** (confirm with `git log` + branch state at implementation time). Phase 2 is the only `L`, touches `critical` wallet hooks, and overlaps active work, so it must not start on top of a moving tree. Phases 0–1 (foundation docs/skills) have no such collision and can proceed immediately.

## Open questions / decisions needed before implementation
1. **Sheets:** correct the contract to describe the real sheet+dialog architecture (recommended), *or* commit to finishing the dialog migration? This gates Phase 0.
2. **Donate receipt:** should donate/claim get an endow-style receipt, or is a lightweight success toast enough? Gates Phase 2 scope.
3. **Onboarding:** is there a defined "join/request a garden" path we should wire to (F4.1), or is that itself undecided product scope?
4. **Em-dash scope:** all 163, or only the ~5–8 public-facing strings (recommended for this pass)?

# Audit the commitment pooling interface: design conformance and experience quality

Dispatch prompt for a fresh agent session. **Read-only audit — you fix nothing, redesign
nothing, and edit no product code.** The deliverable is a written audit with a ranked
improvement backlog that Afo triages; building comes later, after he chooses what to act on.
Written 2026-08-24 from `develop@557abcb74` with all three D1 surfaces merged
(#748 editorial, #749 client loop, #752 steward console).

`CLAUDE.md` and `AGENTS.md` bind you. Concurrent agent sessions share this checkout:
working-tree changes you did not make are another agent's work — never revert or stash them.
Never restart a PM2 stack another session owns.

This pass is judgment-heavy visual work. **Recommended model: Fable/Claude (high)** — the
repo's recorded experience is that Codex is a strong plan-follower and code reviewer but weak
at visual judgment; do not dispatch this audit to it.

## Why this pass exists, and what it is not

QA Pass 1 (PRD-729) already has two waves recorded in `handoffs/claude-qa-pass-1.md`:
Wave 1 (agent, functional — "does it work") and Wave 2 (Afo, human experience judgment).
This audit is the **agent-run design pass that feeds Wave 2**: it asks "is it *right*" — does
the shipped UI follow the design system, and does the experience hold up — so Afo's human
wave starts from a ranked backlog instead of a blank page. It needs no signatures and no
ledger flip, so it can run unattended, before or in parallel with functional Wave 1.

It is **not** the functional wave (broken behavior found here gets recorded and routed, not
chased), and it is **not** a license to propose a new design language. The design system is
the yardstick, not the defendant — except where a rule itself produces a bad experience, in
which case say exactly that, as a finding against the rule with evidence.

## The two halves

**Half 1 — Conformance: is it built to the system?** Anchored, checkable rules: tokens,
materials, anatomy, component palette, the five review lenses. A conformance finding cites
the rule it breaks.

**Half 2 — Experience: does it feel right?** The house method from `flow-audit-prompt.md`,
applied to the shipped product instead of the prototypes. An experience finding is **a
sentence about what a person experiences, never a count**, and names who, where, what they
experience, which quality fails, and a direction.

## Design truth (read in this order, before auditing)

1. `.claude/skills/design/SKILL.md` — paradigms, materials, surface identities, anti-patterns.
   Load the `design` skill if your harness supports it.
2. `.claude/skills/design/review-checklist.md` — the audit's conformance spine: Lens 1
   Regenerative, Lens 2 Spatial, Lens 3 Ecosystem, Lens 4 Compliance, and the numbered admin
   rows (4.11–4.15). Findings cite rows by number.
3. Admin only — both MANDATORY before judging any admin screen:
   `.claude/skills/design/interaction-patterns.md` (action placement, dialog taxonomy, shell
   continuity, flow anatomy, row/status anatomy, component parity — Lens 5 runs as an
   explicit checklist pass) and `.claude/skills/design/admin-ux-brief.md`.
4. `.claude/skills/design/defect-grammar.md` — every admin finding resolves to a canonical
   `data-component` / `data-region` / `data-workspace` identifier via the live-DOM workflow
   there; never a vague "the card on the pool page".
5. Surface identity contracts: root `DESIGN.md`, `packages/client/DESIGN.pwa.md`,
   `packages/client/DESIGN.browser.md`, `packages/admin/DESIGN.md`, `docs/DESIGN.md`. The
   identities never mix: client PWA is a warm garden journal (hero moments live here); admin
   is a restrained operator cockpit (if it would be inappropriate for Linear or Stripe
   Dashboard, it is inappropriate here); editorial is the public linen-canvas record.
6. `flow-audit-prompt.md` (this hub) — the experience method you will reuse: the six
   qualities (Orientation, Focus, Decision load, Density and placement, Language, Momentum),
   the relay audit, continuity across flows, the emotional arc, the hard limits on what an
   audit may propose, and the finding grammar. Its § Known leads were written against the
   prototypes — re-verify each against the shipped product before repeating it; some were
   fixed in the merged rounds.
7. `flow-audit.md` — the prototype audit's findings. Anything it flagged that shipped
   unchanged is a pre-seeded lead.
8. `uiux-spec.md` (per-screen, consult as needed) and the prototypes artifact
   (`bun .plans/active/commitment-pooling/prototypes-artifact.build.ts` to build locally) —
   the design contract the shipped screens were built against. Divergence from the prototype
   is a finding **only if unrecorded**: the PR #748 body records six accepted editorial
   deviations (header on canvas, static heading, label-above-numeral, font-normal, square
   corners, dark panel darker than canvas), and `reports/admin-console-2026-08-21.md`
   records the admin decisions — do not re-flag accepted deviations; do flag new ones.
9. `acceptance-matrix.md` §1 (state/copy) and §3 (public claims) for copy-grammar checks —
   member-facing copy never shows internal state nouns.

## What you audit (scope)

The three shipped pooling surfaces at `develop` head:

- **Client PWA**: Pool tab, commitment detail (82-state contract in
  `handoffs/commitment-view-state-reference.md` — seat decides person, phase decides
  affordances, a seat with no act gets no bar), composer, proof composer, claims/confirm
  sheets, CommitmentsDrawer, offline/queue states.
- **Admin steward console**: `/garden/pool` (+ seed, + commitment inspector), `/hub/confirm`,
  `/community/pools`, setup and seeding flows, pause/resolve/reason dialogs.
- **Editorial**: `/gardens/:id` § 02 Commitments, `/impact` band, evidence pipeline, and
  their gate states.

Each screen family is audited across: **both themes** (client dark mode; admin dark is
currently *unproven* — attempting it is part of the audit), **three widths** (320 / 768 /
1280, plus the 465px admin QA viewport precedent), and **en/es/pt** (copy fit and overflow —
tone judgment stays with Afo, breakage is yours).

## Capture paths (how you see states without signing)

No transactions, no ledger flip, no signatures:

- **Storybook** `http://localhost:3004` — the component stories are the deep-state path
  (~38 pooling story files; `http://localhost:3004/index.json` lists ids; capture via
  `iframe.html?id=<id>&viewMode=story`). The `Admin/Workspaces/*` route stories stop at the
  availability gate — use component stories (`Admin/Pool/*`, `Admin/Hub/HubConfirmQueue`,
  `Admin/Community/CommunityPools`, `Client/Public/*`) for populated content.
- **Client fixture world** — `https://localhost:3001/home?mockAuth=user&presentation=pwa&mockPooling=1`
  (and `mockAuth=deployer` for the second viewer): 3 pools / 21 commitments across seats and
  states, walkable as a person would.
- **Live gate states** — editorial pages and the availability-off client on the running
  stack.
- Browser: the authenticated Brave extension path per repo rule; Storybook/fixture capture
  may use the Browser pane where authentication is irrelevant, but label the channel per
  capture. Stack: `bun run dev` profile (§ Environment of `prompt-qa-functional.md` — reuse
  its preflight, ownership rules, and traps).

## Method

**Phase 0 — wired automation first.** Run and record: `bun run lint:vocab`,
`bun run check:design-tokens`, `bun run check:design-md`, `bun run agentic:check`, and the
Storybook story-quality checks (`bun run check:stories`, `bun run check:story-quality`) if
present at head. These are the cheap conformance gates; everything they cannot catch (most of
Lenses 2–3, all of Half 2) is manual by design — the review-checklist's automation table says
which rows are Wired vs Proposed.

**Phase 1 — capture inventory.** Systematically screenshot screen × state × theme × width
from the capture paths into `reports/evidence/qa-experience-audit/` (fixture and Storybook
captures are committable; anything rendering real mainnet records stays outside the repo —
same privacy rule as the functional prompt). Name captures
`<surface>-<screen>-<state>-<theme>-<width>.png`. The inventory is evidence, not the audit.

**Phase 2 — conformance sweep (Half 1).** Per surface, against the numbered rules:

- Client: Warm Earth tokens only (no raw values), material/blur discipline by content
  density, radius scale, spring-only motion with `prefers-reduced-motion` degradation,
  browser-vs-PWA chrome separation, shared primitives only.
- Admin: strict M3 anatomy — single elevation ladder `--m3-elevation-0/1/2` (4.11), radius
  set 4/8/12/16/9999 (4.12), tone budget's four sanctioned uses (4.13), hover discipline
  (4.14), `AdminButton` sentence case and no shared `Button` (4.15), canonical `Admin*`
  palette only (an invented component is a finding, per interaction-patterns § component
  parity), and the full Lens 5 checklist pass against `interaction-patterns.md`.
- Editorial: the `EditorialPanel` grammar (hairline border, soft shadow, square corners on
  linen), editorial dialect class `s-editorial`, planned-vs-live claim discipline, kept-rate
  suppression copy.
- Cross-surface: Lens 1 (no gamification, no urgency, semantic status colors, value flow
  visible), Lens 3 (cascade visibility before governing acts — does Accept/Decline/pause
  show blast radius; autonomic actors visible — sync/queue/indexer freshness), Lens 4
  compliance rows (labels, error association, color-not-sole-indicator, focus management,
  keyboard, dark, responsive, i18n readiness, stories exist, offline states).

**Phase 3 — experience walk (Half 2).** Run `flow-audit-prompt.md` Parts 1–5 against the
*shipped* product: build the action map first (roles × actions × flows, first-time vs
repeat, initiating vs responding vs watching); walk every flow in order holding only what
the person would know; audit the relay (one commitment across every person who touches it —
the handoffs, the waiting states, the on-behalf-of flows); audit continuity (parallel acts
feel parallel, one name per concept, repeated shapes teach, exits feed entrances, the
composite season as one coherent story); map the emotional arc (anticipation, ownership,
pride, recognition, closure — warmth and milestones, never game mechanics) and name the
single highest moment and whether the design treats it as one. The walk uses the fixture
world and Storybook; where a flow segment is unreachable without signing, judge the
reachable segments and mark the gap instead of imagining the rest.

**Phase 4 — seeded leads.** Verify each, then keep or clear with evidence:

1. `AdminTabRail` does not scroll the active tab into view; Garden rail overflows by ~31px
   at 465px with Pool added; Hub's Confirm tab can sit off-screen.
2. `AdminButton size="sm"` row acts (59 uses at last count) sit under the 44px target (4.2 /
   2.4).
3. Admin validation errors not linked via `aria-describedby` (4.2).
4. Admin dark mode unproven; admin `:root` needs explicit dark overrides (cascade-layer
   history) — attempt dark captures and report what actually happens.
5. Editorial dark-mode panel token follow-up (panel darker than canvas — accepted for
   `/fund` parity, but check it holds across the § 02 states).
6. Client commitment rows: the title-truncation class was fixed once (`4395dfd14`) — check
   the fix held across casts at 320px.
7. `PublicEvidencePipeline` had a 3-column/hardcoded-tone/literal-English history — verify
   the shipped five-stage version in all three locales.
8. § 01 "Show more entries" focus behavior (recorded out-of-diff in the editorial round).
9. The prototype flow-audit's leads (request wearing the offer's identity; the always-on
   "See Team and Contributions" bar; "Cycle:" machine word; the on-chain sync sentence at
   the emotional high point) — re-verify against shipped code before repeating.

## Findings and report

Write `reports/qa-experience-audit-<YYYY-MM-DD>.md`:

1. **What ran** — commands, capture counts, channels, anything unreachable.
2. **What conforms well** — genuinely, briefly; an audit that is only negative is not
   calibrated.
3. **Conformance findings (Half 1)** — grouped by surface, each with: rule anchor
   (checklist row / interaction-patterns section / token spec), screen + state, canonical
   component identifier (admin: `data-component`/`data-region` per defect-grammar), evidence
   path, severity — `breaks-identity` (violates a surface's core identity or a hard rule) /
   `erodes-quality` (inconsistency a user would feel) / `polish` — and effort (S/M/L).
4. **Experience findings (Half 2)** — in the flow-audit grammar, **structural before
   local**, ranked by felt friction removed, each with who/where/what/which-quality/direction.
   If three findings share a root cause, name the root as the finding.
5. **The three changes that would most change how this feels** — and what each costs.
6. **Improvement backlog** — one ranked table merging both halves: rank, finding, severity,
   effort, suggested owner lane (`ui_client` / `ui_admin` / `editorial` / docs / design
   skill). Directions, not implementations.
7. **Wave 2 shortlist** — the judgment calls only Afo can make (taste, tone, tradeoffs),
   each framed as a question with its evidence.

Functional defects discovered in passing (a crash, a dead control) go in a short separate
section routed to the functional wave — do not expand into functional QA. When the report is
complete, append a dated summary block (finding counts by severity, the three changes,
capture counts) under `## Experience audit runs` in `handoffs/claude-qa-pass-1.md` —
append-only.

## Boundaries

- Audit only: no product-code edits, no fixes, no regenerated design artifacts, no new
  components proposed by name (a missing primitive is reported as missing, per the hard
  limits in `flow-audit-prompt.md` — which bind this audit in full: never propose hiding a
  consequence; the contract wins over UI convenience; recovery states get quieter, never
  deleted).
- Your only writes: the report, `reports/evidence/qa-experience-audit/**`, and the
  append-only handoff block.
- No Linear writes; Afo triages the backlog. No commits unless the dispatch authorizes one.
- No ledger flip, no transactions, no signature requests — this pass never needs them.
- Screenshot privacy rule as above; concurrent-session and stack-ownership rules as in
  `prompt-qa-functional.md`.

## Stop conditions

- **Complete**: both halves audited across the scope grid, seeded leads dispositioned,
  report + backlog + Wave 2 shortlist written, handoff block appended.
- **Blocked**: a named capture path is unavailable (stack, Storybook, browser channel) —
  finish everything not dependent on it, then report the exact missing piece.
- **Out of scope**: anything that would mean editing product code, restyling, or deciding a
  taste question — record it as a finding or a Wave 2 shortlist item and continue.

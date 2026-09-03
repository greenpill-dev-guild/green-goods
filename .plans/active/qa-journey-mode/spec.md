# QA Journey Mode Specification

## Users

The primary users are the two people running a Green Goods QA call. One leads protocol and review
steps; the other leads Garden and member steps. A solo tester can still walk the same journey by
selecting all parts.

## Requirements

1. Journey Mode presents authored catalog cases in service-flow order without duplicating their
   test instructions or persistence state.
2. A tester can select the whole journey or one participant part, and counts reflect the visible
   active cases.
3. Each step names its phase, lead participant, verification participants, handoff, and known gate
   when those fields apply.
4. Known gates remain informative and never preselect a verdict. Verdict controls stay available so
   a tester can record Blocked after encountering the visible gate.
5. Walk stays the default view; Priority and Journey remain explicit alternatives.
6. Journey data must contain at least one lane, phase, and step, and every reference must resolve to
   an active catalog case and declared lane or phase.

## Existing Sources

- `scripts/data/qa-test-catalog.json` owns the cases and authored journeys.
- `scripts/data/qa-test-id-ledger.json` owns the append-only identifier history.
- `scripts/agents/qa-workbook-build.ts` owns catalog validation and workbook projection.
- `packages/qa/index.html` owns the static QA interface and its view-specific rendering.
- `scripts/agents/qa-app-client.test.ts` and `scripts/agents/qa-app-build.test.ts` exercise the real
  built page and generated assets.

## Human Judgment

The final production signal requires a redeployed QA application and two authenticated wallets.
Automated tests and a single-browser rehearsal cannot establish that cross-wallet handoffs remain
clear during a live call.

## Risks and Mitigations

- A stale journey reference could hide or misorder a required check. Catalog validation rejects
  inactive, unknown, duplicate, or structurally empty journey data.
- A Journey-only UI could disrupt familiar QA work. Walk remains the default and Priority remains
  available.
- A known product gap could be mistaken for an automatic result. Known-gate rows explain the gate,
  leave every verdict unselected, and let the tester record Blocked only after attempting the step.
- The desktop layout could conceal mobile overflow. Release proof includes a visible 375 px-wide
  rehearsal and accessible-name inspection.

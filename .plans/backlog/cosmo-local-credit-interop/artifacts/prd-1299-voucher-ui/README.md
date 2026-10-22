# PRD-1299: Cosmo-Local voucher UI design

Design for the Green Goods member and steward experience with Cosmo-Local vouchers, including
cross-garden personal G$ purchases. PRD-1299 owns design approval; PRD-1297, PRD-1323 and
PRD-1324 implement it after approval.

| Version | Date | Status | Start with |
|---|---|---|---|
| [v1](v1/handoff.md) | 22 Oct 2026 | For Afo's review; not approved | [`v1/prototype.html`](v1/prototype.html) (open in a browser) |

Each version is a frozen folder. A revision becomes `v2/` beside it; nothing in an approved
version is edited in place.

## What a version holds

- `prototype.html`: the navigable prototype, generated. Member app and steward cockpit screens
  with every state, EN/ES/PT copy, light and dark frames, ten walks from real entry screens,
  architecture and journey diagrams, the screen and state inventory, the role and action matrix,
  the copy sheet, accessibility notes and the handoff summary.
- `handoff.md`: the implementation handoff (sources and their status, architecture boundaries,
  rules, both routes, component mapping, contract and projection facts, decisions, evidence).
- `matrices.md` and `copy-sheet.md`: generated from the prototype's data, so they always match it.
- `evidence/`: labeled prototype renders and the checks that ran.
- `src/` and `build.mjs`: the sources. Edit `src/`, then run `node build.mjs`; it refuses to
  write if a state fails to render, a string or link is missing, or copy carries an em dash or a
  dollar figure. `node build.mjs --publish <file>` also writes the artifact-ready page.
- `render-evidence.mjs`: re-renders `evidence/` and sweeps every state for clipped text.

These files are design artifacts. Code, tests and CI must not depend on them.

# Commitment Pooling Prototype Coverage

Updated 2026-07-22. This is the human-readable screen-by-state audit for the self-contained hi-fi artifact. The executable registry in `hifi/screens/index.ts` remains authoritative; `hifi/validate.ts` fails the build for empty states, invalid journey references, orphaned hotspots, and invalid navigation targets.

## Build snapshot

- 31 registered screens / 141 rendered states in the full source registry
- 24 presentation-visible hi-fi screens / 134 states: 9 Client PWA, 13 Admin Console, 2 Public
- 246 registered hotspots
- 14 validated source flows / 155 scenes; 13 presentation-visible flows: 4 Client PWA, 4 Admin Console, 5 End-to-end
- 0 build warnings

Community `C*` wireframes and source flow 14 remain registered, validated, and directly addressable, but are hidden from the presentation catalogs until their high-fidelity pass.

## Presentation coverage classification

- `W2a` is guided-flow-covered: evidence composition is shown before evidence-submitted outcomes.
- `W5` and `W16` are intentionally Screen-library-only because they are exhaustive drawer/editorial state references rather than consequential flow transitions.
- Guided flows own the primary transitions and consequential intermediate states; Screen library owns exhaustive loading, empty, validation, recovery, and alternate states.

## Cross-cutting recovery coverage

| Requirement | Built states |
| --- | --- |
| Loading / skeleton preserves layout | `W1@loading`, `W2@loading`, `W5@loading`, `W7@loading` |
| Not-found / sentinel recovery | `W1@not-found`, `W2@not-found`, `W5@not-found`, `W10@not-found` |
| Read error with retry | `W1@read-error`, `W2@read-error`, `W5@read-error` |
| Scope-named empty | `W1@empty-open`, `W1@no-season`, `W5@empty`, `W7@empty`, `W13@empty` |
| Offline queue / exhausted retry | `W1@queued`, `W1@sync-failed`, `W1@waiting-membership`, `W2a@queued`, `W2a@failed` |
| Confirmation outcome / retry | `W4@confirmed-pending`, `W4@confirmed`, `W4@not-yet`, `W4@not-yet-failed` |
| Wallet send retention / retry | `W23@send`, `W23@send-pending`, `W23@send-failed` |
| Cycle banners | `W1@reviewing`, `W1@paused`, `W1@closed`, `W1@cancelled-cycle`, `W1@cycle-summary` |
| Steward send / override / cancel | `W10@accepted`, `W10@mark-ready-override`, `W10@cancel` |

## Screen registry

| Screen | Surface | States | State ids |
| --- | --- | ---: | --- |
| W1 | Client PWA | 21 | open, not-ready, ready, seeded, reviewing, paused, closed, cancelled-cycle, empty-open, no-season, queued, sync-failed, waiting-membership, cycle-summary, claim-pending, claim-declined, claim-superseded, claim-accepted, loading, not-found, read-error |
| W2 | Client PWA | 22 | accepted, offered, requested, active, evidence-submitted, partially-approved, ready-confirmer, fulfilled, reward-released, support-en-route, support-reported, support-checking, support-arrived, support-failed, reconciled, cancelled, expired, disputed, captured, loading, not-found, read-error |
| W2a | Client PWA | 3 | compose, queued, failed |
| W3 | Client PWA | 7 | step-what, step-howmuch, step-anchors, step-review, request-variant, draft-resume, validation |
| W4 | Client PWA | 7 | confirm-domain, confirm-support, not-yet, provider-view, confirmed-pending, confirmed, not-yet-failed |
| W5 | Client PWA | 7 | default, queued, waiting-membership, empty, loading, not-found, read-error |
| W23 | Client PWA | 5 | balance, send, send-pending, send-failed, delivery-blocked |
| W25 | Client PWA | 3 | card, context-chooser, pending |
| WFLOW | Client PWA | 1 | review |
| W7 | Admin console | 9 | open, not-ready, ready, paused, reconciled, claim-outcomes, expiry-queue, loading, empty |
| W8 | Admin console | 5 | step1, step2, step3, step4, captured-for |
| W9 | Admin console | 2 | pick-member, capture-kind |
| W10 | Admin console | 10 | detail, record-payout, fallback-confirm, raise-dispute, resolve-dispute, attach-assessment, accepted, mark-ready-override, cancel, not-found |
| W11 | Admin console | 2 | presets, invalid-sum |
| W12 | Admin console | 2 | protocol, current-garden |
| W13 | Admin console | 3 | queue, context-chip, empty |
| W14 | Admin console | 2 | baseline, delta |
| W21 | Admin console | 4 | queue, unregistered, failed-recovery, gate-status |
| W22 | Admin console | 6 | ready, executing, reported, checking, outcome, role-guard |
| W24 | Admin console | 3 | queue, oracle, flows |
| W26 | Admin console | 4 | review, shares, certificate, rest |
| HUBWORK | Admin console | 1 | approve |
| W15 | Public pages | 3 | counts-only, above-threshold, pre-launch |
| W16 | Public pages | 2 | band, pipeline-delta |
| C1 | Community PWA — September preview (lo-fi) | 1 | default |
| C3 | Community PWA — September preview (lo-fi) | 1 | default |
| C4 | Community PWA — September preview (lo-fi) | 1 | default |
| C5 | Community PWA — September preview (lo-fi) | 1 | default |
| C6 | Community PWA — September preview (lo-fi) | 1 | default |
| C9 | Community PWA — September preview (lo-fi) | 1 | default |
| C10 | Community PWA — September preview (lo-fi) | 1 | default |

## Compatibility aliases

Legacy deep links remain registered in `hifi/screens/index.ts`, including `W6` → `W5`, `W23G` → `W23@delivery-blocked`, and `MF8` → `W25@context-chooser`. Guided-flow hashes use `#sbN/ix`; Screen-library hashes use `#screens/SCREEN@state`, including the hidden Community source material.

## Open product decisions

Five decisions remain open and are represented consistently here and in the artifact's Implementation reference:

- MF-2b — final steward-cancel placement.
- Cancelled-disbursement — final member-facing copy in `prototypes.md` §17.5.
- MF-7 — final placement of the “fulfills this promise” row in the work-flow Review step.
- MF-8 — final placement of the personal/garden provider-context chooser.
- MF-13 — final placement of the attach-assessment picker.

These placements are drawn for review, not silently treated as locked shipping behavior.

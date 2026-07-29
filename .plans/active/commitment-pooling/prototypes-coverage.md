# Commitment Pooling Prototype Coverage

Updated 2026-07-29. This is the human-readable screen-by-state audit for the self-contained hi-fi artifact. The executable registry in `hifi/screens/index.ts` remains authoritative; `hifi/validate.ts` fails the build for empty states, invalid journey references, orphaned hotspots, invalid navigation targets, and contract calls that are illegal for a state's declared pool/cycle/commitment/settlement facts.

## Build snapshot

- 32 registered screens / 280 rendered states in the full source registry
- 25 presentation-visible hi-fi screens / 273 states: 10 Client PWA (154 states), 13 Admin console (114 states), 2 Editorial website (5 states)
- 381 registered hotspots
- 38 validated source flows / 310 scenes; 37 presentation-visible flows / 301 scenes: 16 Client PWA, 20 Admin console, 1 Editorial website
- 0 build warnings

The build prints this snapshot on every run; when it disagrees with the numbers
above, the build is right. The per-screen table below drifted once already (W2
carried 24 states after two were added), so treat the build line as the source
and this file as its transcription.

**Restructure (2026-07-25).** Flows are grouped by the surface where their actor
acts — Client PWA, Admin console, Editorial website — and the End-to-end group is
retired: `sb3`, `sb4` and `sb6` split at their surface seam, `sb5` and `sb13`
re-homed to the client. A scene landing on another surface is marked `echo` and
drawn in "Meanwhile" chrome; validate.ts enforces that pairing in both
directions. Old `#sb3` / `#sb4` / `#sb6` hashes retire exactly as `#sb9` did.

Community `C*` wireframes and the September Need→triage flow remain registered, validated, and directly addressable, but are hidden from the presentation catalogs until their high-fidelity pass.

**Lifecycle audit closure (2026-07-25).** State metadata now declares the
relevant pool, cycle, commitment kind/state, or settlement state.
Audited lifecycle-sensitive write hotspots declare ordered `calls`; the build
simulates claim, evidence, assessment, cancellation, dispute, reward, pool,
cycle, settlement, batch, dispatch, and retry calls and rejects illegal source
states, kind mismatches, compound-order violations, contradictory result-state
facts, and changes to overlapping facts a call does not touch. The same pass
adds guided walks for campaign opening and
member use, Community→Garden navigation, assessment entry, settlement
registration, route-gate inspection, batch creation/cancellation, and
individual requeue/cancellation.

Paused wind-down is an executable regression fixture: `closeCycle`,
`compostCycle`, and `cancelCycle` advance only the cycle, while every
confirmation, wizard step, result, and member echo keeps the pool Paused.

`sb9` was split into `sb9a` (pool readiness → season open), `sb9b` (pause and resume),
and `sb9c` (end a season — close, compost, or cancel). One 33-scene ribbon covering seven
stewardship tasks left a reviewer with no chapter to orient against mid-flow.

**Promise cast (2026-07-25).** The commitment detail, evidence sheet and
confirmation sheet carry six casts, and identity follows the promise rather
than the fixture: the neighbour-to-neighbour **offer** (Maria → João, 6 hours),
the **request** (Ana asks, João provides, Ana confirms — 1 ride), and the
evidence-only **service offer** (Maria provides, João confirms — 1 repair
session), the Campaign-scoped request, the steward-recorded
**StewardCaptured** promise, plus the
**garden-provided** protocol commitment (Awka Hub provides, protocol stewards
confirm — 1 survey). A request that renders offer copy mid-flow is a fiction
break, not a styling detail: direction, title, unit and cast all differ.

**Group architecture (2026-07-28).** `W2b` makes the accountable lead, contributor roster,
contribution record, roster freeze, and recognition preview directly reviewable. `W3` renders
repeatable action/count requirements without a four-item product rule. `W10`, `W11`, `W21`, and
`W23` keep recognition, garden retention, contributor child payouts, partial recovery, and the
member receipt linked but distinct. SB-33 walks the complete cross-surface path.

## Presentation coverage classification

- `W2a` is guided-flow-covered: evidence composition is shown before evidence-submitted outcomes.
- `W16`'s states are walked by the editorial flow and `W5`'s by the wallet-drawer flow; only their error/loading states stay Screen-library-only because they are exhaustive drawer/editorial state references rather than consequential flow transitions.
- SB-5 walks the complete “Not yet” dispute lifecycle once. Request, Campaign-request, service-offer, and StewardCaptured variants remain Screen-library cast fixtures of that same call path so reviewers can verify identity and retry continuity without duplicating the journey.
- Guided flows own the primary transitions and consequential intermediate states, including the actionable open-pool empty state. Screen library owns exhaustive loading, non-action empty, validation, recovery, and alternate states.

## Cross-cutting recovery coverage

| Requirement | Built states |
| --- | --- |
| Loading / skeleton preserves layout | `W1@loading`, `W2@loading`, `W5@loading`, `W7@loading` |
| Not-found / sentinel recovery | `W1@not-found`, `W2@not-found`, `W5@not-found`, `W10@not-found` |
| Read error with retry | `W1@read-error`, `W2@read-error`, `W5@read-error` |
| Scope-named empty | `W1@empty-open` and `W1@no-season` are guided because they offer legal next acts; `W5@empty`, `W7@empty`, and `W13@empty` remain exhaustive Screen-library references |
| Offline queue / exhausted retry | `W1@queued`, `W1@support-queued`, `W1@sync-failed`, `W1@waiting-membership`, `W2@support-evidence-queued`, `W2a@queued`, `W2a@failed` |
| Confirmation outcome / retry | `W4@confirmed-pending`, `W4@confirmed`, request- and service-specific pending/synced variants, `W4@not-yet`, `W4@not-yet-failed` |
| Wallet send retention / retry | `W23@send`, `W23@send-pending`, `W23@send-failed` |
| Cycle banners | `W1@reviewing`, `W1@paused`, `W1@closed`, `W1@cancelled-cycle`, `W1@paused-cancelled-cycle`, `W1@cycle-summary`; reviewing and paused wind-down both have guided legal paths |
| Steward send / override / cancel | `W10@accepted`, `W10@mark-ready-override`, `W10@cancel` |

## Confirmation before consequence

Every irreversible pool, cycle, and settlement act names its blast radius and —
when the contract stores one — takes its reason before it happens. `closePool`
takes no reason (CS:556), so its confirmation is banner-only; validate.ts's
`REASON_CONFIRMS` enforces both directions (a reason-taking act must show the
field, a reason-less act must not invent one). Each control whose label ends in
`…` resolves to one of these, never straight to the outcome state:

| Act | Confirmation state | Blast radius named |
| --- | --- | --- |
| Pause pool | `W7@pause-confirm` | 23 members · 7 open promises · what stays open |
| Close pool | `W7@close-pool-confirm` | ends participation for 23 members · reachable only once the last cycle composts (`W7@cycle-composted`) · no stored reason |
| Close paused pool | `W7@paused-close-pool-confirm` | pool remains Paused through cycle compost · `closePool` alone changes it to Closed · no stored reason |
| Compost pool | `W7@compost-pool-confirm` | archives the closed pool · history remains readable · no stored reason |
| Reopen pool | `W7@reopen-confirm` | Composted → Ready · history preserved · participation stays closed |
| Cancel season | `W7@cancel-cycle-confirm` | 8 promises, 5 kept · records survive |
| Cancel season while paused | `W7@paused-cancel-cycle-confirm` | pool remains Paused · cycle alone becomes Cancelled · records survive |
| Decline claim | `W7@decline-claim-confirm` | Maria's request only · João stays pending |
| Cancel batch | `W22@cancel-batch-confirm` | all 2 members atomically · no partial path |
| Close delivery | `W21@close-delivery-confirm` | attempt + failure code survive · no new key |
| Cancel queued delivery | `W21@cancel-queued-confirm` | one unbatched Queued item only · no batch or command created |
| Withdraw your offer | `W2@withdraw-confirm` | pre-acceptance only · no units committed, so none release |

## Screen registry

| Screen | Surface | States | State ids |
| --- | --- | ---: | --- |
| W1 | Client PWA | 27 | open, not-ready, ready, seeded, request-open, request-queued, reviewing, paused, closed, cancelled-cycle, paused-cancelled-cycle, empty-open, no-season, campaign-market, campaign-tools, queued, support-queued, sync-failed, waiting-membership, cycle-summary, claim-pending, claim-declined, claim-superseded, claim-accepted, loading, not-found, read-error |
| W2 | Client PWA | 64 | accepted, offered, requested, active, evidence-submitted, partially-approved, ready-confirmer, confirmation-pending, fulfilled, reward-released, support-queued, support-en-route, support-delayed, support-executed, support-confirming, support-arrived, support-failed, support-cancelled-queued, support-cancelled-failed, reconciled, cancelled, expired, disputed, captured, captured-evidence-queued, captured-evidence-submitted, captured-ready-pending, captured-ready-confirmer, captured-confirmation-pending, captured-fulfilled, captured-disputed, withdraw-confirm, withdrawn, garden-provider, garden-support-arrived, request-active, campaign-request-active, campaign-request-evidence-queued, campaign-request-evidence-submitted, campaign-request-ready-pending, campaign-request-ready-confirmer, campaign-request-confirmation-pending, campaign-request-fulfilled, campaign-request-disputed, request-evidence-queued, request-evidence-submitted, request-ready-pending, request-ready-confirmer, request-confirmation-pending, request-fulfilled, request-disputed, support-offered, support-active, support-evidence-queued, support-evidence-submitted, support-ready-pending, support-ready-confirmer, support-confirmation-pending, support-fulfilled, support-cancelled, support-disputed, loading, not-found, read-error |
| W2a | Client PWA | 7 | compose, compose-request, compose-campaign-request, compose-support, compose-captured, queued, failed |
| W2b | Client PWA | 3 | forming, frozen, recognition |
| W3 | Client PWA | 9 | step-what, step-howmuch, step-anchors, step-review, support-howmuch, support-review, request-variant, draft-resume, validation |
| W4 | Client PWA | 26 | confirm-domain, confirm-support, confirm-request, confirm-campaign-request, confirm-captured, not-yet, not-yet-support, not-yet-request, not-yet-campaign-request, not-yet-captured, provider-view, confirmed-pending, confirmed, confirmed-pending-support, confirmed-support, confirmed-pending-request, confirmed-request, confirmed-pending-campaign-request, confirmed-campaign-request, confirmed-pending-captured, confirmed-captured, not-yet-failed, not-yet-failed-support, not-yet-failed-request, not-yet-failed-campaign-request, not-yet-failed-captured |
| W5 | Client PWA | 7 | default, queued, waiting-membership, empty, loading, not-found, read-error |
| W23 | Client PWA | 6 | balance, contributor-receipt, send, send-pending, send-failed, delivery-blocked |
| W25 | Client PWA | 4 | card, context-chooser, pending, accepted |
| WFLOW | Client PWA | 1 | review |
| W7 | Admin console | 27 | open, open-no-cycle, not-ready, preflight-complete, ready, paused, paused-cycle-composted, reconciled, cycle-composted, pool-closed, compost-pool-confirm, pool-composted, reopen-confirm, manage, claims, claim-declined, claim-outcomes, expiry-queue, seed-cycle, pause-confirm, close-pool-confirm, paused-close-pool-confirm, cancel-cycle-confirm, paused-cancel-cycle-confirm, decline-claim-confirm, loading, empty |
| W8 | Admin console | 7 | step1, step2, step3, step4, step5, captured-for, discard |
| W9 | Admin console | 3 | pick-member, capture-kind, discard |
| W10 | Admin console | 15 | detail, fulfilled, contributor-allocation, record-payout, fallback-confirm, raise-dispute, resolve-dispute, attach-assessment, accepted, mark-ready-override, cancel, not-found, garden-ready, garden-fulfilled, queue-settlement-garden |
| W11 | Admin console | 8 | presets, invalid-sum, guard, recognition-policy, campaign-allocation, campaign-open, discard, campaign-discard |
| W12 | Admin console | 2 | protocol, current-garden |
| W13 | Admin console | 4 | queue, context-chip, assess, empty |
| W14 | Admin console | 3 | baseline, delta, discard |
| W21 | Admin console | 22 | queue, unregistered, payout-plan, payout-finalized, payout-prepared, payout-retained, payout-partial, payout-complete, register-account, registered, failed-recovery, gate-status, requeue-confirm, requeued, batch-create, batch-created, cancel-queued-confirm, cancelled-queued, batch-cancelled, close-delivery-confirm, cancelled-failed, protocol-queue |
| W22 | Admin console | 9 | ready, dispatched, delivery-delayed, executed, acknowledgment-pending, outcome, role-guard, cancel-batch-confirm, garden-command |
| W24 | Admin console | 3 | queue, ccip, flows |
| W26 | Admin console | 9 | review, recognition-blocked, shares, certificate, rest, paused-review, paused-shares, paused-certificate, paused-rest |
| HUBWORK | Admin console | 1 | approve |
| W15 | Editorial website | 3 | counts-only, above-threshold, pre-launch |
| W16 | Editorial website | 2 | band, pipeline-delta |
| C1 | Community PWA — September preview (lo-fi) | 1 | default |
| C3 | Community PWA — September preview (lo-fi) | 1 | default |
| C4 | Community PWA — September preview (lo-fi) | 1 | default |
| C5 | Community PWA — September preview (lo-fi) | 1 | default |
| C6 | Community PWA — September preview (lo-fi) | 1 | default |
| C9 | Community PWA — September preview (lo-fi) | 1 | default |
| C10 | Community PWA — September preview (lo-fi) | 1 | default |

## Compatibility aliases

Legacy deep links remain registered in `hifi/screens/index.ts`, including `W6` → `W5`, `W23G` → `W23@delivery-blocked`, and `MF8` → `W25@context-chooser`. Guided-flow hashes use `#sbN/ix`; Screen-library hashes use `#screens/SCREEN@state`, including the hidden Community source material.

## Placement closure

Register #51 locks the final four August placement decisions exactly where the artifact renders them:

- MF-2b — steward cancellation lives in `W10@cancel`, launched from the Accepted/evidence-in action row.
- MF-7 — the read-only “fulfills this promise” row lives in `WFLOW@review`.
- MF-8 — the personal/garden provider-context choice lives in `W25@context-chooser` before claim submission.
- MF-13 — the assessment picker lives in `W10@attach-assessment`.

The W10 Accepted/override states, W23 delivery-blocked state, and W26 reconciliation report are likewise realized, non-proposed states. No August screen or action remains amber-tagged or placement-blocked.

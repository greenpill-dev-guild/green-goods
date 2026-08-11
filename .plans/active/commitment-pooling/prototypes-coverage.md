# Commitment Pooling Prototype Coverage

Updated 2026-08-10. This is the human-readable screen-by-state audit for the self-contained hi-fi artifact. The executable registry in `hifi/screens/index.ts` remains authoritative; `hifi/validate.ts` fails the build for empty states, invalid journey references, orphaned hotspots, invalid navigation targets, echo scenes that carry an advancing control, missing chapter/role assignments, and contract calls that are illegal for a state's declared pool/cycle/commitment/settlement facts.

## Build snapshot

- 40 registered screens / 397 rendered states in the full source registry
- 33 presentation-visible hi-fi screens / 390 states: 18 Client PWA (255 states), 13 Admin console (130 states), 2 Editorial website (5 states)
- 544 registered hotspots
- 57 validated source flows / 388 scenes; 56 presentation-visible flows / 379 scenes: 29 Client PWA, 25 Admin console, 2 Editorial website
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

**Self-contained flows + chapters (2026-08-10, register #93–#94).** Every flow
is now one person's action to completion. Echoes are read-only consequences —
validate.ts rejects an echo carrying a hotspot or alt — and cross-role
continuations hand off through end-of-flow branch links. Split-outs: `sb42`
Confirm a promise kept (from `sb1`), `sb43` request-provider side (from `sb2`),
`sb44` captured-member side (from `sb8`), `sb45` team formation (from `sb33`),
`sb46` garden-claim acceptance (from `sb13`), `sb47` not-yet resolution (from
`sb5`), `sb48` protocol-wide impact (from `sb15`); `sb29`'s recipient scenes
became read-only beats (the acted service confirmation stays walkable in `sb30`
and the W4 service cast). Flow cards cluster under lifecycle-ordered `chapter`
headings per surface tab with acting-`roles` chips replacing the old surface
badge; both vocabularies are renameable data in `hifi/types.ts`, checked for
referential integrity only. The Green Goods operations chapter renders
collapsed. The W3 wizard's default path compressed to four steps (three for
service/requests) with the pilot-default fallback ON and an Advanced detour;
`W3@step-confirmers`, `W3@step-confirmers-opted-in`, and
`W3@support-confirmers` retired in favor of `W3@step-advanced`. Old mid-ribbon
scene hashes (e.g. `#sb1/14`) retire exactly as `#sb9` did.

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

**Tap-first inputs (2026-08-10, register #95).** Reason-taking dialogs lead with
common-reason chips that fill the still-required reason field; wizard unit,
amount, and due are chip/radio picks with typed escapes on every path; evidence
credits contributors from roster chips; `W11` opens with the standard split
applied; `W23` send offers recent recipients and amount presets. Screen-library
cards now cluster under their registry group headings, flow cards pin role tags
to the card foot with continues-in as prose, the theme toggle is icon+text, and
opening any flow or screen scrolls the page to the top.

**Coverage closure round (2026-08-10 evening, register #96).** The request path is
a real three-step wizard (`W3@request-what` → `request-howmuch` → `request-variant`)
walked by `sb2`; every W3 state now uses the fixed Submit Work chrome — close +
progress header and bottom action bar as fixed frame, only the form scrolls.
The old "Decide & review" admin chapter split into Decide on promises / Work
review / Assessments: `sb4b` split at its actor seam into Approve the work
(steward) and `sb50` Attest and attach the assessment (evaluator), and `sb22`
regrew into Record the pool's baseline, ending at the readiness checklist it
satisfies. `sb49` covers the protocol pool seeding its own asks and offers to
gardens (`W12@seed-protocol`), completing the rail seed → claim (`sb13`) →
accept (`sb46`) → pay (`sb19`). Mid-flow member echoes in `sb9a`/`sb9c`/`sb10`
became branch links per the echo-trim assessment; single consequence echoes
stay. The artifact's Implementation reference tab is now generated from this
registry on every build — flow and screen indexes with calls, cites, and
walked-by — retiring the drifted hand-written `prototypes.md` rendering. The
same-day contracts audit (all calls implemented on-chain under exact names —
58 once register #97 graduated `acceptExchange`)
corrected `DisbursementRoute` to mirror Solidity `FundingRoute { None,
ProtocolToGarden }` — the two dropped members were `DisbursementKind` values
misfiled as routes, and no call site ever used them. Requests gained their own
"Asks & requests" client chapter (`sb2` + `sb43`).

**Full-coverage round (2026-08-10 night, register #97).** The audit's approved
follow-ups all landed: the DomainImpact Request is drawable end to end
(`W3@request-anchors`/`request-work-review`, the `W2` request-work cast, and
`sb51`), the campaign-request cast has its guided walk (`sb52`), Ongoing Offers
gained their read-only admin context (`W7@series-view`, screen-library by
design), `MAX_CONFIRMERS` renders on both creation surfaces, `W26` names the
cycle-less certificate-ineligible row, and `W12` carries the register #34f
delivery-gate status row under its amended protocol-steward framing (uiux
§6.8). The exchange wave graduated into the registry — `W28`–`W31` with six
recovery-complete picker states, `acceptExchange` joined the ContractCall union
and CALL_RULES, and `sb35`/`sb36` walk pair creation → atomic acceptance →
counterpart-lapsed and template-first creation. Requests live under the
client's "Asks & requests" chapter; exchange screens under "Exchange &
templates" in the Screen library.

**Confirmation-path closure (2026-08-02; default superseded 2026-08-10).** `W3` and `W8` draw
the `protocolFallbackEnabled` choice — now ON by default for the pilot (register #94), with the
client control living in `W3@step-advanced` rather than a numbered step. `W2`, `W10`, and `W13`
distinguish ordinary, local `PoolFallback`, and Green Goods `ProtocolFallback` history with
actor/path/reason provenance. The validator treats both fallback confirmations as reason-taking
contract calls and requires the protocol-fallback fixture to preserve its Ready/Open/DomainImpact
facts; the unreachable-path guard is unchanged by the default flip.

## Presentation coverage classification

- `SB-35` and `SB-36` graduated into the executable hi-fi registry at register #97(f) as `sb35`/`sb36`. `sb35` walks W28–W30 from exchange-reference creation through atomic acceptance and independent post-acceptance lifecycles, including counterpart-lapsed derivation. `sb36` walks W31 template-first creation into the editable existing-primitives form. Both are build-validated and presentation-visible.
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
| Offline queue / exhausted retry | `W1@queued`, `W1@support-queued`, `W1@sync-failed`, `W1@waiting-membership`, `W2@evidence-queued`, `W2@support-evidence-queued`, `W2a@queued`, `W2a@failed` |
| Saved-Offer persistence truth | `W32@draft-unsaved`, `W32@saving`, `W32@saved`, `W32@save-failed`, `W32@offline-local`, `W32@version-conflict`; only Saved claims cross-device durability |
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
| Close pool | `W7@close-pool-confirm` | ends participation for 23 members · reachable only with zero live pool commitments and zero non-terminal cycles (`W7@cycle-composted`) · `W7@close-blocked-live` routes to wind-down instead · no stored reason |
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
| W1 | Client PWA | 28 | open, not-ready, ready, seeded, request-open, request-queued, reviewing, paused, closed, composted, cancelled-cycle, paused-cancelled-cycle, empty-open, no-season, campaign-market, campaign-tools, queued, support-queued, sync-failed, waiting-membership, cycle-summary, claim-pending, claim-declined, claim-superseded, claim-accepted, loading, not-found, read-error |
| W2 | Client PWA | 70 | accepted, offered, requested, active, evidence-queued, evidence-submitted, partially-approved, ready-confirmer, confirmation-pending, fulfilled, fulfilled-pool-fallback, fulfilled-protocol-fallback, reward-released, support-queued, support-en-route, support-delayed, support-executed, support-confirming, support-arrived, support-failed, support-cancelled-queued, support-cancelled-failed, reconciled, cancelled, expired, disputed, captured, captured-evidence-queued, captured-evidence-submitted, captured-ready-pending, captured-ready-confirmer, captured-confirmation-pending, captured-fulfilled, captured-disputed, withdraw-confirm, withdrawn, garden-provider, garden-support-arrived, request-active, campaign-request-active, campaign-request-evidence-queued, campaign-request-evidence-submitted, campaign-request-ready-pending, campaign-request-ready-confirmer, campaign-request-confirmation-pending, campaign-request-fulfilled, campaign-request-disputed, request-evidence-queued, request-evidence-submitted, request-ready-pending, request-ready-confirmer, request-confirmation-pending, request-fulfilled, request-disputed, support-offered, support-accepted, support-evidence-queued, support-evidence-submitted, support-ready-pending, support-ready-confirmer, support-confirmation-pending, support-fulfilled, support-cancelled, support-disputed, loading, not-found, read-error, request-work-active, request-work-partially-approved, request-work-ready-confirmer |
| W2a | Client PWA | 7 | compose, compose-request, compose-campaign-request, compose-support, compose-captured, queued, failed |
| W2b | Client PWA | 9 | forming, add-contributor, remove-contributor, assign-requirement, open-eligible, join-submitted, open-member, frozen, recognition |
| W3 | Client PWA | 17 | step-what, step-howmuch, step-anchors, step-review, step-advanced, support-howmuch, support-review, request-what, request-howmuch, request-anchors, request-work-review, request-variant, saved-offer-edit, saved-offer-review, saved-offer-queued, draft-resume, validation |
| W4 | Client PWA | 26 | confirm-domain, confirm-support, confirm-request, confirm-campaign-request, confirm-captured, not-yet, not-yet-support, not-yet-request, not-yet-campaign-request, not-yet-captured, provider-view, confirmed-pending, confirmed, confirmed-pending-support, confirmed-support, confirmed-pending-request, confirmed-request, confirmed-pending-campaign-request, confirmed-campaign-request, confirmed-pending-captured, confirmed-captured, not-yet-failed, not-yet-failed-support, not-yet-failed-request, not-yet-failed-campaign-request, not-yet-failed-captured |
| W5 | Client PWA | 7 | default, queued, waiting-membership, empty, loading, not-found, read-error |
| W23 | Client PWA | 6 | balance, contributor-receipt, send, send-pending, send-failed, delivery-blocked |
| W25 | Client PWA | 4 | card, context-chooser, pending, accepted |
| WFLOW | Client PWA | 1 | review |
| W32 | Client PWA | 16 | saved, saved-with-ongoing, saved-with-ongoing-ready, series-queued, series-queued-place-waiting, empty, compose, choose-path, draft-unsaved, saving, save-failed, offline-local, version-conflict, persistence, loading, read-error |
| W33 | Client PWA | 12 | garden, garden-ready, terms, terms-ready, review, review-ready, queued, queued-ready, place-waiting, waiting-membership, failed, discarded-dependency |
| W34 | Client PWA | 35 | active-two, active-none, active-one, places-queued, places-partial, places-partial-failed, story, participation, ask-again, claimant-view, pool-ready, pool-paused, pool-closed, pool-composted, edit-active, edit-active-none, edit-active-ready, edit-resting, edit-resting-none, edit-resting-ready, resting, resting-none, resting-ready, retire-confirm, retire-confirm-none, retire-confirm-resting, retire-confirm-resting-none, retire-confirm-ready, retire-confirm-resting-ready, retired, retired-none, retired-ready, succession, loading, read-error |
| W35 | Client PWA | 4 | compose, queued, mixed-queued, mixed-failed |
| W28 | Client PWA | 6 | picker, selected, selection-invalid, empty, loading, read-error |
| W29 | Client PWA | 3 | proposed, matched, counterpart-lapsed |
| W30 | Client PWA | 3 | confirm, submitting, contract-error |
| W31 | Client PWA | 1 | templates |
| W7 | Admin console | 30 | open, open-no-cycle, not-ready, preflight-complete, ready, paused, paused-cycle-composted, reconciled, cycle-composted, close-blocked-live, pool-closed, compost-pool-confirm, pool-composted, reopen-confirm, manage, claims, claim-declined, claim-outcomes, due-live, expiry-queue, seed-cycle, pause-confirm, close-pool-confirm, paused-close-pool-confirm, cancel-cycle-confirm, paused-cancel-cycle-confirm, decline-claim-confirm, loading, empty, series-view |
| W8 | Admin console | 7 | step1, step2, step3, step4, step5, captured-for, discard |
| W9 | Admin console | 3 | pick-member, capture-kind, discard |
| W10 | Admin console | 19 | detail, detail-fallback-eligible, external-fulfilled, fulfilled, contributor-allocation, edit-declared-value, record-payout, fallback-confirm, protocol-fallback-confirm, raise-dispute, resolve-dispute, attach-assessment, accepted, mark-ready-override, cancel, not-found, garden-ready, garden-fulfilled, queue-settlement-garden |
| W11 | Admin console | 8 | presets, invalid-sum, guard, recognition-policy, campaign-allocation, campaign-open, discard, campaign-discard |
| W12 | Admin console | 3 | protocol, current-garden, seed-protocol |
| W13 | Admin console | 4 | queue, context-chip, assess, empty |
| W14 | Admin console | 3 | baseline, delta, discard |
| W21 | Admin console | 27 | queue, unregistered, payout-plan, payout-plan-edit, payout-finalized, payout-prepared, payout-prepared-2, payout-prepared-all, payout-retained-draft, payout-retained, payout-partial, payout-complete, register-account, registered, failed-recovery, gate-status, requeue-confirm, requeued, batch-create, batch-created, cancel-queued-confirm, cancelled-queued, batch-cancelled, close-delivery-confirm, cancelled-failed, protocol-queue, protocol-funding-queued |
| W22 | Admin console | 10 | ready, dispatched, delivery-delayed, executed, acknowledgment-pending, outcome, role-guard, cancel-batch-confirm, garden-command, individual-dispatched |
| W24 | Admin console | 6 | queue, ccip, flows, flows-funding-unavailable, funding, funding-unauthorized |
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

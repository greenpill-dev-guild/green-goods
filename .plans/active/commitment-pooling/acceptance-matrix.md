# Commitment Pooling — Cross-Surface Acceptance Matrix

**Status**: canonical execution companion  
**Updated**: 2026-07-22
**Sources**: `contract-spec.md`, `settlement-spec.md`, `pilot-evidence-spec.md`, `uiux-spec.md`, `wireframes.md`
**Purpose**: one exact target for the handoffs' copy/state matrix, public claim/copy matrix, and final QA acceptance matrix. Specs win if this summary drifts.

## 1. State and copy matrix

| Condition | Client PWA | Admin | Editorial / docs | Required exit |
|---|---|---|---|---|
| `None` / `UNKNOWN` sentinel | Loading, not-found, or retry; never a state chip | Recovery row; never a selectable state | No claim | Creation event or explicit not-found |
| Pool NotReady | Pool absent | Checklist: charter, non-zero provider open-commitment cap, qualifying Baseline assessment | Planned/readiness only | App enables `markPoolReady` only after all three; the contract enforces charter + non-zero count cap, while current non-revoked Baseline remains an app/shared/admin preflight |
| Pool Paused | “New participation paused” + reason; browse/evidence/recovery stay available | Reason + resume; create/claim/Ready-submit/confirm disabled; safe wind-down enabled | Neutral quiet-period copy | Resume event clears reason |
| Claim Pending | Canonical claimant + “requested by” actor + provider context | Same stored row; accept/decline key canonical claimant | Counts only | Accept, decline, supersede, cancel, or expire |
| Claim Declined | Reason + fresh-request CTA | Selected row only | Not public | New request, never retry old row |
| Claim Superseded | Taken/no-longer-available copy; no retry | Indexed terminal row | Not public | Browse exit |
| Evidence-only Accepted | Evidence + declared assessment requirements | Attach assessment; submit Ready; override separate | Active counts only | Evidence, assessment when declared, submit Ready |
| DomainImpact Accepted | Per-action Work/approval progress; no manual Ready-submit | Positional requirement rows; override separate | Active counts only | Every `approvedWorkCounts[i] >= requiredApprovedWorkCounts[i]` + assessment when declared |
| Reported settlement | “Transfer reported” | Reporter/ref + request action | Reported, never received | Active Functions request or retry |
| Reported + active request | “Checking receipt” | Request/expiry state | Checking, never received | Callback, expiry, or retry |
| Verified settlement | “Support arrived” | Oracle evidence + Celo ref | Oracle-verified | Current Functions callback only |
| Receipt-invalid Failed | Calm failure/recovery | Failure code + per-member retry/cancel | Failed, not merely unverified | Per-member reconciliation |
| Infrastructure failure | Still Reported; retry copy | Retry request; never invalid receipt | Reported / verification unavailable | Fresh request |
| Member delivery disabled | No G$ balance/send/delivery CTA | Gate reason; the funding route remains | Explicit delivery-blocked copy | AA/paymaster exit evidence + enabled event |

## 2. Identity, permissions, and payout formulas

| Contract fact | Canonical formula | UI / test assertion |
|---|---|---|
| Claim type | runtime `kind == stored claimType` | Mismatch is a contract error, not eligibility copy |
| Individual claim | `claimant = requestedBy = msg.sender`; counterparty = caller | One identity row |
| Garden claim | `claimant = gardenContext`; `requestedBy = authenticated operator`; counterparty = GardenAccount | Show both GardenAccount and requester |
| Provider | Offer → creator; Request → accepted counterparty | Provider excluded from ordinary/named/fallback confirmation |
| Work linker | accepted canonical claimant/counterparty or steward | Creator is not an extra path |
| Pre-accept cancellation | creator or steward | Both paths tested |
| Accepted cancellation | steward only | Member control hidden |
| Individual G$ beneficiary | stored provider same-address Celo AA | AA gate required |
| Garden G$ beneficiary | registered `providerGarden` Celo Safe | Never send to Arbitrum GardenAccount |
| DomainImpact requirement shape | positional `domains[]`, `requiredActionUIDs[]`, `requiredApprovedWorkCounts[]`; equal lengths, 1–4 entries, each required count non-zero | Admin creation, shared types, contract tests, and indexed read model preserve array positions |
| Work approval credit | `requirementIndex` selects exactly one requirement; validated Work domain/action must match that indexed pair | One approval increments exactly `approvedWorkCounts[requirementIndex]`; no scalar or aggregate-only shortcut |
| DomainImpact progress | `approvedUnits = floor(targetUnits * Σ_i min(approvedWorkCounts[i], requiredApprovedWorkCounts[i]) / Σ_i requiredApprovedWorkCounts[i])` | Client/admin/indexer show per-action counts and this per-commitment approved-unit value; DomainImpact creation rejects a zero denominator; pool/cycle totals never mix labels |
| Provider concurrency cap | acceptance increments one slot regardless of `targetUnits`; fulfillment/cancellation/expiry release one; dispute preserves the pre-dispute slot state | `hours` × 100 and `meals` × 1 each consume one slot; no transition double-counts |
| Exact-label unit summaries | ID uses chain + POOL/CYCLE scope + scope ID + hash of exact stored UTF-8 label bytes | Two `hours` commitments share a row; `Hours` is a distinct row; event replay changes neither row |
| Cross-commitment rate | `promiseKeptRate = commitmentsFulfilled / commitmentsDue` | Sole aggregate percentage; active progress uses state counts and exact-label groups |

## 3. Public claim and copy matrix

| Claim | Allowed wording | Forbidden wording | Authority |
|---|---|---|---|
| Feature availability | Built / Planned / Evidence-gated | Planned behavior described as live | canonical [Commitment Pooling Google Doc](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit) |
| Settlement proof | Reported / checking / Oracle-verified | Reported = paid/received/verified | `settlement-spec.md` §3.3 |
| Verification actor | Chainlink Functions callback only | Human verification, operator approval as receipt proof | `settlement-spec.md` |
| Chain placement | Proof/control on Arbitrum; canonical G$ on Celo | Bridged G$, Arbitrum G$ custody | `settlement-spec.md` |
| Fourth garden | “a fourth slot for a mature MRV-adoption anchor — open; candidates under consideration, none selected” | Any named fourth garden in any artifact, or any claim that a fourth garden is selected or participating | `plan.todo.md` Decision Log #29 (supersedes Decision Log #25 and Decision Log #27) |
| Community comparison | Alphabetical/neutral aggregates with small-community suppression | Rankings, leaderboards, credit scores | `uiux-spec.md` §7.2 |
| Funding | Supports the garden; not per-Need escrow or steering | Funding buys priority/control | Community spec |
| Credit/vouchers | Design-only/evidence-gated follow-on | August capability or dispatchable work | `../../backlog/commitment-credit-follow-on/spec.md`, PRD-651/697 |
| Pilot outcome | Observed change, mixed result, or strengthened settlement capacity only at the approved claim class | Settlement/transaction volume, feature use, or fulfillment alone described as causal livelihood/community impact | `pilot-evidence-spec.md` |

## 4. Final role / route / state proof

| Surface | Role | Required journey | Proof owner | GREEN evidence |
|---|---|---|---|---|
| Client `/home/:garden/pool` | member/provider/recipient | create, claim, evidence/work, Ready-submit, confirm/dispute, offline retry | `ui_client` | targeted tests + authenticated Brave + real device |
| Admin `/garden/pool` | operator/evaluator | readiness, cycles, seeding, claims, assessment, override/dispute | `ui_admin` | targeted tests + authenticated Brave |
| Admin `/community/pools` | protocol steward | Protocol pool plus current-garden pool only; no other-garden rows | `ui_admin` | targeted tests + authenticated Brave |
| Admin Operations | deployer | alphabetical cross-garden oversight, batch/oracle controls, settlement configuration/status | `ui_admin` | targeted tests + authenticated Brave |
| WalletDrawer | member | delivery-disabled and enabled Celo send | `ui_client` + `settlement` | AA evidence + authenticated real device |
| Public Garden / impact | funder/collaborator | planned/live/reporting labels, privacy thresholds, no ranking | `editorial` | component tests + rendered public proof |
| Indexer replay | operator | full composite Garden-ID replay, cutover, rollback rehearsal | `indexer` + `release_ops` | dry run, snapshot, replay, shared-query check, rollback record |
| Release | protocol release owner | authorized broadcasts, post-checks, Functions health, one real exit proof | `release_ops` | signed checklist in `handoffs/human-release-ops.md` |

## 5. August versus September gate

August UI GREEN aggregates `ui_client`, `ui_admin`, `editorial`, `docs`, and `docs_guides` for the shipped August scope. The September `community` PWA records its own GREEN later and is not an August QA dependency. Membership persistence is conditional within Community and remains excluded until RESR-64; it does not block the non-membership Community core.

## 6. Pilot operational measurement definitions

These targets measure product and operating reliability. They do not by themselves establish that
pooling strengthened settlement capacity. `pilot-evidence-spec.md` owns the required cohort,
baseline, claim hierarchy, safeguard/repair review, circulation-integrity rules, privacy tiers, and
stop conditions for that outcome claim.

| Target by 2026-09-30 | Canonical calculation |
|---|---|
| At least 90% passkey onboarding completion | Gardeners who complete passkey setup divided by gardeners who start their first authenticated action. |
| At least 99% eligible offline-job sync success | Eligible queued jobs that reach confirmed submission divided by eligible jobs that begin a normal send attempt. Exclude user-cancelled jobs and all time spent in `waiting_for_hat`; a retry-recovery cut uses only jobs that entered retry as both numerator population and denominator. |
| At least 95% steward validation without data repair | Eligible triage, seeding, and confirmation tasks completed without a corrective edit divided by all eligible observed tasks. |
| Median field submission at or below two minutes | Median time from first input to saved or submitted state, compared with a separately measured pre-pilot baseline; no baseline value is assumed. |

Every report includes numerator, denominator, sample size, observation window, excluded states, and qualitative context. Public reporting excludes wallet addresses, join-request records, and participant identifiers. Unavailable, suppressed, mixed, and zero results remain distinct.

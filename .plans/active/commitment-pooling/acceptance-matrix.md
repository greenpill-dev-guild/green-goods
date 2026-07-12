# Commitment Pooling — Cross-Surface Acceptance Matrix

**Status**: canonical execution companion  
**Updated**: 2026-07-11  
**Sources**: `contract-spec.md`, `settlement-spec.md`, `uiux-spec.md`, `wireframes.md`  
**Purpose**: one exact target for the handoffs' copy/state matrix, public claim/copy matrix, and final QA acceptance matrix. Specs win if this summary drifts.

## 1. State and copy matrix

| Condition | Client PWA | Admin | Editorial / docs | Required exit |
|---|---|---|---|---|
| `None` / `UNKNOWN` sentinel | Loading, not-found, or retry; never a state chip | Recovery row; never a selectable state | No claim | Creation event or explicit not-found |
| Pool NotReady | Pool absent | Checklist: charter, non-zero exposure cap, qualifying Baseline assessment | Planned/readiness only | All three inputs, then mark Ready |
| Pool Paused | “New participation paused” + reason; browse/evidence/recovery stay available | Reason + resume; create/claim/Ready-submit/confirm disabled; safe wind-down enabled | Neutral quiet-period copy | Resume event clears reason |
| Claim Pending | Canonical claimant + “requested by” actor + provider context | Same stored row; accept/decline key canonical claimant | Counts only | Accept, decline, supersede, cancel, or expire |
| Claim Declined | Reason + fresh-request CTA | Selected row only | Not public | New request, never retry old row |
| Claim Superseded | Taken/no-longer-available copy; no retry | Indexed terminal row | Not public | Browse exit |
| Evidence-only Accepted | Evidence + declared assessment requirements | Attach assessment; submit Ready; override separate | Active aggregate only | Evidence, assessment when declared, submit Ready |
| DomainImpact Accepted | Work/approval progress; no manual Ready-submit | Work review; override separate | Active aggregate only | Non-zero approvals + assessment when declared |
| Reported settlement | “Transfer reported” | Reporter/ref + request action | Reported, never received | Active Functions request or retry |
| Reported + active request | “Checking receipt” | Request/expiry state | Checking, never received | Callback, expiry, or retry |
| Verified settlement | “Support arrived” | Oracle evidence + Celo ref | Oracle-verified | Current Functions callback only |
| Receipt-invalid Failed | Calm failure/recovery | Failure code + per-member retry/cancel | Failed, not merely unverified | Per-member reconciliation |
| Infrastructure failure | Still Reported; retry copy | Retry request; never invalid receipt | Reported / verification unavailable | Fresh request |
| Member delivery disabled | No G$ balance/send/delivery CTA | Gate reason; funding routes remain | Explicit delivery-blocked copy | AA/paymaster exit evidence + enabled event |

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

## 3. Public claim and copy matrix

| Claim | Allowed wording | Forbidden wording | Authority |
|---|---|---|---|
| Feature availability | Built / Planned / Evidence-gated | Planned behavior described as live | `external-communications.md` |
| Settlement proof | Reported / checking / Oracle-verified | Reported = paid/received/verified | `settlement-spec.md` §3.3 |
| Verification actor | Chainlink Functions callback only | Human verification, operator approval as receipt proof | `settlement-spec.md` |
| Chain placement | Proof/control on Arbitrum; canonical G$ on Celo | Bridged G$, Arbitrum G$ custody | `settlement-spec.md` |
| Fourth garden | “a fourth garden — in outreach, named only once participation is confirmed” | Outreach target name/location before first contact | `plan.todo.md` decision #26 |
| Community comparison | Alphabetical/neutral aggregates with small-community suppression | Rankings, leaderboards, credit scores | `uiux-spec.md` §7.2 |
| Funding | Supports the garden; not per-Need escrow or steering | Funding buys priority/control | Community spec |
| Credit/vouchers | Design-only/evidence-gated follow-on | August capability or dispatchable work | `credit-spec.md`, PRD-651/697 |

## 4. Final role / route / state proof

| Surface | Role | Required journey | Proof owner | GREEN evidence |
|---|---|---|---|---|
| Client `/home/:garden/pool` | member/provider/recipient | create, claim, evidence/work, Ready-submit, confirm/dispute, offline retry | `ui_client` | targeted tests + authenticated Brave + real device |
| Admin `/garden/pool` | operator/evaluator | readiness, cycles, seeding, claims, assessment, override/dispute | `ui_admin` | targeted tests + authenticated Brave |
| Admin `/community/pools` | protocol steward | protocol pool, cross-garden claims, settlement configuration/status | `ui_admin` | targeted tests + authenticated Brave |
| WalletDrawer | member | delivery-disabled and enabled Celo send | `ui_client` + `settlement` | AA evidence + authenticated real device |
| Public Garden / impact | funder/collaborator | planned/live/reporting labels, privacy thresholds, no ranking | `editorial` | component tests + rendered public proof |
| Indexer replay | operator | full composite Garden-ID replay, cutover, rollback rehearsal | `indexer` + `release_ops` | dry run, snapshot, replay, shared-query check, rollback record |
| Release | protocol release owner | authorized broadcasts, post-checks, Functions health, one real exit proof | `release_ops` | signed checklist in `human-release-ops.md` |

## 5. August versus September gate

August UI GREEN aggregates `ui_client`, `ui_admin`, `editorial`, `docs`, and `docs_guides` for the shipped August scope. The September `community` PWA records its own GREEN later and is not an August QA dependency. Membership persistence is conditional within Community and remains excluded until RESR-64; it does not block the non-membership Community core.

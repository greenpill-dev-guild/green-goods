# Commitment pooling functional QA — Wave 1

## Dispatch record

- Date: 2026-08-24 (America/Los_Angeles)
- Mode: A — fixture and regression only
- Target: `origin/develop@3bfc85432750faa7aad693fea7a85f59a00fa327`
- Checkout at dispatch: `develop@3bfc85432750faa7aad693fea7a85f59a00fa327`; clean working tree before this report was created
- Concurrent ref movement: at 20:39:28 PDT another session fast-forwarded the shared checkout and `origin/develop` to `a5fe2c78b5f8ac66ec80ad68aa376ce882500cad` (Operator→Steward rename, PR #762). The QA target remains the SHA pinned by the dispatch refresh. Client fixture captures through 20:38 belong to `3bfc8543`; Storybook captures and the final baseline cross-check belong to successor `a5fe2c78`. They are identified here rather than falsely presented as one atomic snapshot.
- Browser channel: AVAILABLE — Codex browser-extension control connected to the already-open authenticated Brave browser. Computer Use read-tier access to Brave was requested once and used only for permitted visible-desktop inspection; it was not used for credentials, passkeys, wallet prompts, or signatures.
- Dispatch wording: “Run commitment pooling functional QA, Wave 1, Mode A.” Test the refreshed current `origin/develop` head; perform no signatures, on-chain writes, Mode B flow, fixes, Linear work, branch changes, commits, or unsafe process replacement. Reuse a healthy existing repo-native environment, and leave report and evidence files uncommitted.
- Runtime clarification received during the run: local surfaces should normally use an indexer reading the actually deployed contracts; the local chain should be an explicit opt-in. This QA did not change configuration because its write boundary forbids product/config changes.

## What ran

The functional verdict is **not release certification**. Mode A found four product defects and three polish findings, with no confirmed release-blocker. Client fixture behavior was broadly functional, but the unowned local indexer listener prevented authenticated live admin and protocol-garden read-side completion.

### Target and environment

- Refreshed `origin/develop` with `git fetch --prune origin develop`; the fetched ref and checkout both resolved to `3bfc85432750faa7aad693fea7a85f59a00fa327`.
- Initial inherited stack: `prod-mirror`, owner `stack:67961:1bdb6cbb`. It was not stopped or restarted by this run. Its initial full smoke passed client, admin, docs, Storybook, local indexer GraphQL (`chain_id=42161`, 582 events, lag 0), indexer service, and Postgres; agent `:3005` and Anvil `:3009` failed. Those two services are outside the clarified deployed-contract Mode A posture.
- The inherited owner later stopped its own surfaces. A repo-native `dev:prod:mirror` attempt under owner `codex-qa-wave-1` stopped before startup because port `3008` was held by an external/unknown OrbStack listener. `lsof` resolved PID 1236 (`OrbStack`, user `afo`), but `curl http://127.0.0.1:3008/health` could not connect. No unknown process was stopped.
- `bun run dev:prod:mirror:health`: FAIL — Docker CLI unavailable in the shell. A final read-only audit found OrbStack's Docker binary at `/Users/afo/.orbstack/bin/docker`, but it could not reach `/Users/afo/.docker/run/docker.sock`; restarting OrbStack could affect another session and was not authorized. The profile otherwise selected Arbitrum One, production agent API, and local live-indexer mirror correctly. The repo start additionally remained blocked by the unknown `3008` listener.
- `bun run dev:prod:smoke`: PASS — local client/admin/docs/Storybook, Arbitrum chain 42161, deployed GardenToken bytecode, production agent, and hosted indexer health; hosted indexer lag was 71 blocks. This is reachability evidence only: the hosted indexer still lacks the pooling schema and cannot satisfy pooling read-back.
- Restored only the repo-native web group under owner `codex-qa-wave-1`; `bun run dev:doctor` passed for Frontend QA and `bun run dev:smoke:web` passed client/admin/docs/Storybook. After the concurrent fast-forward, that QA-owned group was stopped and the documented `dev:prod` profile was attempted so the current checkout could use hosted production reads without a local chain. It also refused the external `:3008` listener. No QA-owned web service remains running at handoff.
- Browser: authenticated Brave extension path used for every rendered/interacted UI claim. No isolated Browser, Playwright CLI, DevTools MCP, or fresh profile supplied evidence.

### Role and chain probes

- Local indexed role probe while the inherited mirror was healthy: for GG Community Garden, the deployer fixture `0x2aa64…` appeared in gardeners/operators/evaluators but not owner; mock operator `0x04D606…` appeared in none. TAS HUB and Aiyeloja Family showed neither fixture identity in those indexed roles.
- Live Arbitrum read-only role probe at block 498100576: GG Community Garden reported the deployer fixture as operator + gardener, not owner, so `isPoolSteward=true`; the mock operator was false. TAS HUB and Aiyeloja Family were false for both fixtures.
- Live Arbitrum pooling read at block 498100815: module `0x6BB5…470a` was unpaused and `protocolPoolId=1`; pool 1 (Protocol) and pool 2 (Garden) were READY, cycle-less, charter-empty, settlement-disabled, and had zero live commitments. No transaction was prepared or sent.
- Phase 2 selected branch: deployer is the viable fixture steward for GG Community. The route could not consume it after the local mirror disappeared, so authenticated route proof is BLOCKED and seeded Storybook/suites provide the lower-tier evidence.

### Commands and counts

| Command | Result |
| --- | --- |
| `bun run validation:plan -- --intent qa` | PASS; sensitive QA plan rendered. |
| `bun run --filter @green-goods/shared test` | At pinned `3bfc8543`: 382 files passed, 2 skipped; 4,222 tests passed, 18 skipped; one unrelated `useENSClaim.test.ts` timeout, whose targeted rerun passed 11/11. At successor `a5fe2c78`: fresh full PASS, 384 files passed, 2 skipped; 4,229 tests passed, 18 skipped. |
| `bun run --filter @green-goods/client test` | PASS at the pinned target and successor: 103 files, 867 tests. |
| `bun run --filter @green-goods/admin test` | PASS at the pinned target and successor: 101 files, 720 tests. |
| `bun run --filter @green-goods/indexer test` | PASS at the pinned target and successor outside the restricted loopback sandbox: 307 passing, 1 pending. The first sandboxed run had nine `listen EPERM` failures, classified as harness restrictions rather than reused failures. |
| `bun run lint:vocab` | PASS for en/es/pt at both snapshots. |
| `bun run --filter @green-goods/shared check:stories` | PASS: 254/254 required stories. |
| `bun run --filter @green-goods/shared check:story-quality` | PASS: 226 story files. |
| `bun run check:design-generated` | PASS at the tested SHA; the stale generated audit named in the dispatch no longer reproduces. |

### UI actions and regression probes

- Opened the GG Community demo pool from `/home`; exercised cycle/campaign rails and all reachable commitment fixtures 1001–1020 by actual clicks. The canonical text capture is `evidence/qa-wave-1/client-demo-garden-commitments-1001-1020.json`.
- Offer and Request composers were clicked and typed through every beat to Review. Each submit landed on “It is on its way,” reappeared in the pool as waiting to send, and never broadcast. Once the result beat rendered, the submit control was absent, so a second tap was no longer possible. `clientOperationId` double-dispatch was therefore not reproduced through the available UI.
- Proof flow 1007 reached Review and queued using text evidence. The extension file chooser did not complete, so real media attachment is BLOCKED; media state logic remains suite/Storybook tier. Fixture 1001 with `mockAuth=deployer` correctly rendered the NotYours guard.
- Confirmation, Not yet with an entered reason, withdrawal with a reason, and claim queueing were exercised without sending a chain action. Drawer Live/Over time grouping was coherent; To confirm was absent as expected for the unwrapped fixture reader.
- `mockPooling=0` removed the Pool tab while the rest of `/home` stayed healthy. Spanish and Portuguese renders were reached through the visible language selector, then restored to English.
- Admin Storybook walks on successor `a5fe2c78` covered setup FirstRun, partly-landed failure, all four seed steps, Hub Confirm queue, steward claim actions, withheld Kept resolution, validation error association, and rail/action measurements. The live admin route remained stuck at loading when the local mirror was unavailable.
- Editorial stories on successor `a5fe2c78` covered populated, paused, pre-launch, ready, empty-pool, live impact, and unavailable impact states. The live `/impact` route naturally rendered explicit unavailable/em-dash behavior. The live public garden route naturally rendered its read-failure state when the local mirror disappeared; real-mainnet screenshots stayed outside the repo under `/private/tmp/qa-wave-1/`.
- Current unresolved review-thread total was rechecked: PR #748 = 5, #749 = 10, #752 = 8 (23 total). Testable items folded into this run are listed under Wave 2 handoff notes.

## Coverage table

Each row names the matrix section, exact leftmost cell, and source line. Fixture IDs and generated state-reference IDs are included where applicable.

### Client fixture inventory

| Acceptance anchor | State / fixture | Proof tier | Evidence and result |
| --- | --- | --- | --- |
| §4 `Client /home/:garden/pool` (line 186) | fixture 1001; `browse-offered` | FIXTURE | Open Offer read correctly with “Take this up”; canonical text JSON. |
| §4 `Client /home/:garden/pool` (line 186) | fixture 1002; `offered` / `withdraw-confirm` | FIXTURE | Provider copy and reason-required withdrawal sheet rendered; `client-commitment-1002-withdraw-overlay.png`. |
| §4 `Client /home/:garden/pool` (line 186) | fixture 1003; `browse-requested` | FIXTURE | Open Request read correctly with bystander action; canonical text JSON. |
| §1 `Claim Pending` (line 23) | fixture 1004 | FIXTURE | Approval-gated request remained visibly waiting for steward review; canonical text JSON. |
| §1 `Claim Declined` (line 24) | fixture 1005 | FIXTURE | Decline reason and fresh-request affordance rendered; canonical text JSON. |
| §1 `Claim Superseded` (line 25) | fixture 1006 | FIXTURE | Taken-by-another copy, dates, and no retry rendered; canonical text JSON. |
| §1 `DomainImpact Accepted` (line 32) | fixture 1007; `partially-approved` | FIXTURE | Repeating requirement rows, linked Work, team credit, and Add proof rendered; proof queued in separate walk. |
| §1 `Evidence-only Accepted` (line 31) | fixture 1008; `send-confirm` | FIXTURE | Two-proof summary and Send for confirmation affordance rendered. |
| §4 `Client /home/:garden/pool` (line 186) | fixture 1009; `ready-confirmer` | FIXTURE | Direction-aware confirmer act rendered; Not yet reason was entered without submission. Evidence-summary contradiction is defect D-3. |
| §4 `Client /home/:garden/pool` (line 186) | fixture 1010; `request-work-ready-confirmer` | FIXTURE | Request-side ready sentence and confirmer act rendered; canonical text JSON. |
| §4 `Client /home/:garden/pool` (line 186) | fixture 1011; `request-fulfilled` | FIXTURE | Ordinary fulfilled/Kept terminal cast rendered with no action bar. |
| §1 `Confirmation provenance` (line 22) | fixture 1012; `fulfilled-pool-fallback` | FIXTURE | Fallback actor and reason were visible and distinct. Invalid DOM nesting is defect D-1. |
| §4 `Client /home/:garden/pool` (line 186) | fixture 1013; `expired` | FIXTURE | Calm lapsed copy and Offer it again exit rendered. |
| §4 `Client /home/:garden/pool` (line 186) | fixture 1014; `request-withdrawn` | FIXTURE | Withdrawn terminal copy rendered without an action bar. |
| §4 `Client /home/:garden/pool` (line 186) | fixture 1015; `disputed` | FIXTURE | Under-steward-review cast rendered without member decision controls. |
| §1 `Team forming` (line 29) | fixture 1016; `active-waiting` | FIXTURE | Open team, lead, contributor attribution, and bystander-safe state rendered. |
| §1 `Team forming` (line 29) | fixture 1017; `contributor` | FIXTURE | Contributor sentence and contributor-only Add proof action rendered. |
| §1 `Contributor roster and credit ledger frozen` (line 30) | fixture 1018; `captured-ready-confirmer` | FIXTURE | Recorded-for-person ready state named lead/team/confirmer without contributor confirmation. |
| §1 `Named confirmer bound` (line 20) | fixture 1019; `ready-confirmer` | FIXTURE | Named confirmer seat rendered with the correct confirmation act. |
| §2 `Garden claim` (line 53) | fixture 1020; garden counterparty | FIXTURE | GardenAccount counterparty and requester/provider context remained distinct; `client-demo-garden-commitment-1020-detail.png`. |
| §1 `Confirmation reachability` (line 21) | fixture 1021; protocol-pool fallback | BLOCKED (local deployed-contract mirror unavailable) | Protocol garden lookup fell to “Garden not found” after the unowned `:3008` proxy stopped responding; no lower-tier evidence is promoted to fixture proof. |

### State and copy matrix

| Acceptance anchor | State / fixture | Proof tier | Evidence and result |
| --- | --- | --- | --- |
| §1 `None / UNKNOWN sentinel` (line 12) | loading/not-found/retry | SUITE | `GardenPool.test.tsx`, `GardenCommitment.test.tsx`, and public surface-state tests passed. |
| §1 `Pool NotReady` (line 13) | setup FirstRun / PreLaunch | STORYBOOK | Readiness and public pre-launch casts rendered. FirstRun play-check defect D-2 remains. |
| §1 `Pool Paused` (line 14) | Paused public/garden stories | STORYBOOK | Pause/read-only copy rendered; blocked-selector rules passed in pooling suites. Authenticated paused deep-link route was not reachable without the mirror. |
| §1 `Ongoing Offer Active` (line 15) | series holder | NOT-RUN (deferred D2) | Ongoing Offer/series client work is outside the merged Wave 1 surface. |
| §1 `Ongoing Offer Resting` (line 16) | series holder | NOT-RUN (deferred D2) | Same D2 boundary. |
| §1 `Ongoing Offer Retired` (line 17) | series holder | NOT-RUN (deferred D2) | Same D2 boundary. |
| §1 `Standing Offer availability` (line 18) | exact offered-place count | NOT-RUN (deferred D2) | Same D2 boundary. |
| §1 `Pooling trust-root configuration` (line 19) | live module/pools read only | NOT-RUN (needs-Mode-B/contracts dispatch) | Direct read confirmed the deployed module and pools, but the contracts suite and release writes were not dispatched. |
| §1 `Named confirmer bound` (line 20) | named-group seed step | STORYBOOK | Named group rendered in seed Proof/Review stories; `SeedCommitment.test.tsx` passed. |
| §1 `Confirmation reachability` (line 21) | ordinary/local/protocol rules | STORYBOOK | Seed confirmer choice and Hub Confirm fallback provenance rendered; `commitment-pooling-confirm-queue.test.ts` passed. Fixture 1021 live route remained blocked. |
| §1 `Confirmation provenance` (line 22) | ordinary + local fallback | FIXTURE | Ordinary and fallback examples rendered; fixture 1012 showed actor/reason. DOM nesting defect D-1 does not change the visible content. |
| §1 `Claim Pending` (line 23) | pending approval request | FIXTURE | Fixture 1004 plus `storybook-admin-commitment-claims-steward.png`. |
| §1 `Claim Declined` (line 24) | declined request | FIXTURE | Fixture 1005 displayed the reason and fresh-request exit. |
| §1 `Claim Superseded` (line 25) | superseded request | FIXTURE | Fixture 1006 displayed no-retry taken-by-another copy. |
| §1 `Exchange proposed` (line 26) | exchange | NOT-RUN (deferred D2) | Exchange UI is outside the merged Wave 1 surface. |
| §1 `Exchange matched` (line 27) | exchange | NOT-RUN (deferred D2) | Same D2 boundary. |
| §1 `Exchange counterpart lapsed` (line 28) | exchange | NOT-RUN (deferred D2) | Same D2 boundary. |
| §1 `Team forming` (line 29) | active/open/lead-managed | FIXTURE | Fixtures 1007, 1016, and 1017 rendered lead/team/contribution relationships. |
| §1 `Contributor roster and credit ledger frozen` (line 30) | Ready | FIXTURE | Ready fixtures 1018/1019 rendered frozen team/confirmer roles; roster invariants passed in `commitment-pooling.test.ts`. |
| §1 `Evidence-only Accepted` (line 31) | proof/linkage | FIXTURE | Fixtures 1007/1008 and proof flow 1007 rendered progress and queued evidence. Real media selection is separately blocked. |
| §1 `DomainImpact Accepted` (line 32) | repeating requirement rows | FIXTURE | Fixture 1007 showed per-action progress and linked Work; `commitment-work-attributions.test.ts` passed. |
| §1 `Payout-plan draft` (line 33) | recognition/payment comparison | SUITE | `CommitmentDialog.test.tsx` and `settlement-selectors.test.ts` passed; no authenticated live payout exists in Mode A. |
| §1 `Settlement queued` (line 34) | support queued | SUITE | `settlement-selectors.test.ts` and `settlement-lifecycle.test.ts` passed; live authorization is blocked. |
| §1 `Command dispatched` (line 35) | dispatched | SUITE | Same named settlement suites; no “arrived” promotion. |
| §1 `Executed; acknowledgment pending` (line 36) | confirming | SUITE | Same named settlement suites; no “arrived” promotion. |
| §1 `Confirmed settlement` (line 37) | arrived | SUITE | Same named settlement suites only. |
| §1 `Payout partially complete` (line 38) | partial children | SUITE | `settlement.test.ts` and `settlement-lifecycle.test.ts` passed. |
| §1 `Payout complete` (line 39) | complete children | SUITE | Same named settlement suites. |
| §1 `Authenticated execution failure` (line 40) | failed/rearranged | SUITE | `settlementExecutor.test.ts` and `settlement-selectors.test.ts` passed. |
| §1 `Cancelled from Queued` (line 41) | cancelled-before-send | SUITE | `settlement-lifecycle.test.ts` and `commitment-queue-state.test.tsx` passed. |
| §1 `Cancelled from Failed` (line 42) | cancelled-after-failure | SUITE | Same named suites. |
| §1 `Queued batch cancelled` (line 43) | atomic batch cancel | SUITE | `settlement-lifecycle.test.ts` and `settlementReview.test.ts` passed. |
| §1 `Delivery/fee delay` (line 44) | delayed | SUITE | `settlement-selectors.test.ts` passed; live fee/route recovery is authorization-blocked. |
| §1 `Member delivery disabled` (line 45) | disabled | SUITE | `WalletDrawer.test.tsx` and `settlement-aa-profile.test.ts` passed; real-device/AA proof remains blocked. |

### Public claim and copy matrix

| Acceptance anchor | State / fixture | Proof tier | Evidence and result |
| --- | --- | --- | --- |
| §3 `Feature availability` (line 168) | pooling off / public gate | LIVE | `mockPooling=0` removed the Pool tab; live `/impact` showed explicit unavailable/em-dash copy, never fake zeros. |
| §3 `Ongoing Offer history` (line 169) | exact history wording | SUITE | `commitment-editorial.test.tsx` passed; series UI itself is deferred D2. |
| §3 `Availability` (line 170) | exact place count | NOT-RUN (deferred D2) | Ongoing Offer UI is outside the merged Wave 1 surface. |
| §3 `Settlement proof` (line 171) | queued/dispatched/confirming/confirmed | SUITE | Named settlement selector/lifecycle suites passed; no live authorization. |
| §3 `Confirmation actor` (line 172) | authenticated executor/failure | SUITE | `settlementExecutor.test.ts` and `settlementReview.test.ts` passed. |
| §3 `Chain placement` (line 173) | Arbitrum proof / Celo G$ | SUITE | `settlement-aa-profile.test.ts` and settlement suites passed. |
| §3 `CCIP availability` (line 174) | exact endpoint proof | NOT-RUN (out-of-scope external gate) | No live settlement lifecycle or endpoint authority was dispatched. |
| §3 `Arbitrum Sepolia protocol dependencies` (line 175) | dependency claims | NOT-RUN (out-of-scope release research) | Wave 1 did not re-audit testnet deployments. |
| §3 `Fourth garden` (line 176) | selection wording | NOT-RUN (out-of-scope planning copy) | No fourth-garden surface was in the walked routes. |
| §3 `Community comparison` (line 177) | neutral aggregates | SUITE | `commitment-editorial.test.tsx` passed; rendered public stories contained no ranking. |
| §3 `Funding` (line 178) | no priority/control claim | STORYBOOK | Public commitments/impact stories used neutral garden-support language. |
| §3 `Borrow-and-repay / vouchers` (line 179) | evidence-gated follow-on | NOT-RUN (out-of-scope companion lane) | No active UI control was expected or exercised. |
| §3 `Pilot outcome` (line 180) | non-causal reporting | STORYBOOK | Public record/impact stories reported counts and kept-rate only, without causal impact wording. |

### Final role, route, and state proof

| Acceptance anchor | State / fixture | Proof tier | Evidence and result |
| --- | --- | --- | --- |
| §4 `Client /home/:garden/pool` (line 186) | member/lead/contributor/recipient | FIXTURE | 1001–1020, composers, proof, confirmation, withdrawal, claim, drawer, locales, and pooling-off paths were driven in authenticated Brave. Real offline/restart/media remains Wave 2 or blocked. |
| §4 `Client /home/:garden/pool/standing/:seriesId` (line 187) | series holder/member | NOT-RUN (deferred D2) | Ongoing Offer/series client scope is not merged. |
| §4 `Personal Things I can offer` (line 188) | signed-in member | NOT-RUN (deferred D2) | Saved Offer/device-change scope is not merged. |
| §4 `Admin /garden/pool` (line 189) | deployer fixture steward | BLOCKED (local deployed-contract mirror unavailable) | Authenticated route could not resolve gardens after the mirror disappeared. Storybook and 720 passing admin tests remain lower-tier evidence. |
| §4 `Admin /community/pools` (line 190) | protocol steward | BLOCKED (local deployed-contract mirror unavailable) | Protocol card is chain/read-model dependent; no authenticated successful route claim. |
| §4 `Admin Hub Confirm queue` (line 191) | local/protocol steward | STORYBOOK | Seeded queue rendered ordinary and fallback rows with garden/scope/provenance; route live-empty state was indexer-blocked. |
| §4 `Admin Operations` (line 192) | settlement/release roles | NOT-RUN (needs-Mode-B / deferred D3) | Writes, batch/CCIP, fee, Safe, and funding controls are outside Mode A. |
| §4 `WalletDrawer` (line 193) | member | NOT-RUN (real device and settlement authorization required) | Suite coverage only; no real AA/Celo delivery act. |
| §4 `Public Garden / impact` (line 194) | funder/collaborator | LIVE | Live `/impact` unavailable gate was honest; public garden naturally hit read failure. Populated/privacy states rendered in Storybook, with real-record pixels kept under `/private/tmp/qa-wave-1/`. |
| §4 `Indexer replay` (line 195) | operator | NOT-RUN (out-of-scope release operation) | Indexer suite passed 307 tests, but snapshot/replay/rollback rehearsal was not part of this UI Mode A dispatch. |
| §4 `Release` (line 196) | release owner | NOT-RUN (out-of-scope) | No authorization, deployment, broadcast, activation, or release claim was attempted. |

## Defects

No release-blocker was confirmed.

| Severity | Surface / route / seat-state | Expected | Observed | Evidence | Suspected owning lane |
| --- | --- | --- | --- | --- | --- |
| defect | Client `/home/<garden>/commitments/1012`, fallback-fulfilled provider | §1 `Confirmation provenance` (line 22): actor/path/reason render as valid member-facing detail with a clean console. | `ConfirmProvenance` renders an address component containing a `<div>` inside a `<p>`, producing React invalid-nesting and hydration errors. Visible provenance still appeared. | `evidence/qa-wave-1/client-console-product-errors.json`; `client-demo-garden-commitments-1001-1020.json` | `ui_client` / shared address primitive seam |
| defect | Admin Storybook `Admin/Pool/PoolSetupFlow--FirstRun` | §1 `Pool NotReady` (line 13) and §4 Admin journey (line 189): the first-run step and its play assertion are visible/green. | The surface rendered, but the Storybook play check failed: expected `h2` was not visible at `SetupFlow.stories.tsx:56:78`. | `evidence/qa-wave-1/storybook-admin-pool-setup-first-run.png`; `storybook-admin-pool-setup-first-run-play-error.txt` | `ui_admin` |
| defect | Client ConfirmSheet, fixture 1009, confirmer/Ready | §4 Client journey (line 186): evidence summary must be internally coherent before Keep/Not yet. | The sheet simultaneously reported “Proof — 2 items” and “No proof has been attached yet.” | `evidence/qa-wave-1/client-confirm-1009-not-yet-reason.png` | `ui_client` |
| defect | Client local PWA, all visited routes | Prompt Phase 1 console requirement and §4 Client journey (line 186): no uncaught product errors. | Service Worker registration failed repeatedly in local Vite with the service-worker script served as `text/html`. Chrome-extension content-script errors were excluded as QA-tool noise. | `evidence/qa-wave-1/client-console-product-errors.json` | `ui_client` / dev-surface runtime |
| polish | Admin Storybook `CommitmentClaims--StewardCanAct` | §4 Admin journey (line 189): mechanical touch target is at least 44px. | Accept and Decline buttons measured 31.996px high. | `evidence/qa-wave-1/admin-measurements.json`; `storybook-admin-commitment-claims-steward.png` | `ui_admin` / design system |
| polish | Admin tab-rail stories at requested 465px | §4 Admin journeys (lines 189–191): active tab remains reachable/visible. | Effective iframe width was 422px. Labels rail measured 261px client width vs 386px scroll width (125px overflow), `scrollLeft=0`, and Community extended to x=466.98. Garden-tone story measured 229px vs 559px. The exact live-route 31px case could not be remeasured. | `evidence/qa-wave-1/admin-measurements.json`; `storybook-admin-tab-rail-labels-465px.png`; `storybook-admin-tab-rail-garden-465px.png` | `ui_admin` / design system |
| polish | Client fixture detail copy, several one-unit commitments | §4 Client journey (line 186): natural member-facing quantity grammar. | Singular quantities rendered as “1 sessions,” “1 repairs,” and “1 rides.” | `evidence/qa-wave-1/client-demo-garden-commitments-1001-1020.json` | `ui_client` / shared i18n formatting |

## External blockers

- **Concurrent target drift:** the dispatch refresh pinned `3bfc8543`, and the client fixture captures were complete on it. Another session then fast-forwarded the shared checkout to `a5fe2c78`. The successor package baselines and Storybook checks are green, but a fresh authenticated client fixture pass on the successor could not start because both documented production-backed profiles continued to reject the external `:3008` listener. This report therefore does not claim one atomic current-head rendered pass across both snapshots.
- **Hosted Envio pooling schema:** hosted production GraphQL was healthy and close to head, but the accepted readiness evidence says it has no `CommitmentPool` type. Hosted read-back and authenticated production-runtime pooling rows remain BLOCKED; health is not schema evidence.
- **Production-backed local stack:** the shell lacked a Docker CLI and `dev:prod:mirror` refused the external/unknown OrbStack listener on port 3008. The explicit OrbStack Docker binary existed but its daemon socket did not. The no-local-chain `dev:prod` profile also requires 3008 to be free and refused the same listener. The listener belonged to user `afo` but had no repo lease and no responding health endpoint. Ownership was unclear, so neither it nor OrbStack was restarted. This blocked successful authenticated `/garden/pool`, `/community/pools`, the live Hub empty state, protocol fixture 1021, and the public garden pre-launch read.
- **Staging passkey namespace:** staging identities remain throwaway until PRD-832; no staging identity claim was attempted.
- **Settlement authorization:** value caps are zero and executor/settlement authority is paused. Settlement lifecycle remains SUITE/STORYBOOK only; no Celo or Arbitrum write was attempted.
- **Media chooser:** the authenticated Brave extension did not complete the local file-chooser handoff. Text-evidence proof queueing passed, but an actual attachment through media → details → review is BLOCKED without that capability. Computer Use was not substituted as a driving path.
- **Real device:** installed-PWA camera, airplane mode, kill/relaunch, offline media persistence, queue drain, and enabled/disabled member delivery are reserved for Wave 2.

## Wave 2 handoff notes

- Start with the two measured admin hotspots: the rail overflow/active-tab discoverability and 31.996px row-action targets. The measurements are facts; whether the rail should auto-scroll, wrap, or change its compact behavior is a design judgment.
- Spanish and Portuguese pooling screens rendered without missing-key breakage. Fixture titles and unit nouns remain fixture data; judge translation tone and the singular/plural treatment during the human language pass.
- Dark mode, reduced-motion feel, motion continuity, focus feel, Escape behavior across every sheet, and physical-device reachability were not judged in Wave 1.
- The proof file chooser needs a human/device pass with real media. Verify preview/removal, offline survival, reload, and drain without treating the text-only queued proof as equivalent.
- Admin `aria-describedby` regression did **not** reproduce in the DatesOutOfOrder story: `aria-invalid=true` and `aria-describedby=_r_2_-supporting` were present. Treat that item as rechecked-fixed unless another field fails.
- PR-thread fold-in: the cycle-less seeding option rendered; Kept was withheld in the no-credit resolution story; protocol creation doors were absent from the ordinary client fixture; double-submit could not occur after the result beat. Still return for judgment/coverage: PR #748 aggregate permission/retry and public history details; PR #749 proof-key isolation, owner hats, WorkFulfills pool-garden routing, Not-yet reset, chain-scoped pending creation, roster revalidation/cap edge, paused claim actions, request-loading, retry serialization, and video preview; PR #752 Safe proposals/receipts, confirm-history loading/error, assessment read failure, local-calendar/due boundary behavior, named-confirmer membership, and role-confirmed garden lists.
- Decide whether to make `prod-mirror` the documented/default local stack and move the local fork behind an explicit flag/parameter, as requested during this run. This QA intentionally made no product/config changes. Also decide how the repo should detect or safely reuse an OrbStack port proxy that exists without a responding container.
- Keep the existing QA Pass 1 manual gate: this Wave 1 report does not settle the D2 finish-or-cut decision, settlement proof-limit note, hosted Envio deployment timing, or release authority.

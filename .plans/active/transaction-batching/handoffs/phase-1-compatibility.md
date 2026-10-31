# Phase 1 compatibility and limits follow-up

Shared budget enforcement is implemented locally for passkeys and wallets. Both Kernel profiles passed real execution on an isolated Arbitrum fork. Live submission/recovery and configured paymaster acceptance remain external dependencies; no feature bulk UI is enabled. The user clarified that live account/profile work belongs to another session, and standalone signing probes have been stopped.

This continues [the foundation handoff](phase-1.md). Earlier validation artifacts describe the previous source snapshot, not the current implementation. Worktree: `/Users/afo/.codex/worktrees/transaction-batching/green-goods`; detached source baseline: `73f05a9177125d6509105659f5a724472343cc31`. Changes are uncommitted, so no tested implementation SHA or clean-SHA receipt is available.

## Implemented boundary

`BatchBudget` supplies explicit call-count, calldata-byte, gas, fee-per-gas, total-fee, and payer ceilings. New submissions require a budget and an adapter quote. The budget is copied into the prepared intent and its fingerprint; changing a ceiling requires a new reviewed intent. Old records without budgets still reconcile without entering a new send path. No guessed production defaults were introduced.

Passkeys prepare the actual UserOperation before consent and check the actual request again immediately before and after WebAuthn signing. The gas ceiling includes call, verification/deployment estimate, pre-verification, and both paymaster gas components. Missing sponsorship, excessive fees, or excessive gas prevent signing. The checks do not silently charge the account when sponsorship fails.

Wallet multi-call groups use one ordered simulation with the scoped account and chain. Failed, incomplete, or unsupported simulation prevents submission; independently estimating dependent calls is not a fallback. Native single calls and explicit sequential steps retain ordinary transaction estimation. Quotes are persisted with each group. Call-count and raw-calldata limits also conservatively bound the prepared selection; gas and fee ceilings apply to each submitted group.

[EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) leaves final gas and fee choices to the wallet. Wallet quotes therefore enforce application simulation ceilings, not a guaranteed final transaction price. The wallet remains the authority for its confirmation. Existing legacy send and atomic-consumer eligibility remain intact; the mandatory new boundary is explicit batch submission.

The new helpers are transaction-owned `batch-budget.ts` and `wallet-batch-preflight.ts`. Test fixtures supply their own numbers; those numbers are not runtime policy. There are 33 task-owned Shared source/test paths in [the current fingerprint manifest](../artifacts/phase-1-compatibility-worktree.json). No dependencies, manifests, lockfile, production contracts, auth recipes, or validation baselines changed.

## Execution and availability evidence

The existing contracts isolated-fork helper pinned an Arbitrum fork at block 517696117. Fresh software P-256 assertions signed actual EntryPoint 0.7 operations through the installed SDK's unchanged recipes. Each profile deployed counterfactually, executed ordered approvals, and rolled back the first state change when the second call reverted. The outer transaction succeeded for the failure fixture while `UserOperationEvent.success` was false.

| Kernel | 2 calls, deployment included | 5 calls, deployed | 10 calls, deployed | Inner failure, rolled back |
|---|---:|---:|---:|---:|
| 0.3.1 | 918,160 | 702,558 | 724,582 | 677,215 |
| 0.3.3 | 904,786 | 699,486 | 714,975 | 690,510 |

Values are actual UserOperation gas used in this fixture, not universal safe limits. [The aggregate artifact](../artifacts/phase-1-kernel-fork.json) records the block hash, eight outcomes, measured gas/cost, runner hash, and exact command. The isolated chain used fixture funds and software assertions; it did not use the user's authenticator or submit to a live chain.

A read-only lookup identified a deployed 0.3.3 account on Gnosis. This was reconnaissance, not a new batching dependency or ownership of Gnosis/account migration work. The user clarified that this area belongs to another session; further live account probing has stopped. The supplied address and raw evidence stay outside Git.

A public Arbitrum wallet RPC simulated two ordered probe calls at 42,128 gas. Public Pimlico preparation did not establish sponsorship: an adaptive diagnostic reported a public-key rate limit. The authenticated configured service was not available to this task shell. A repository hook blocked direct secret-file access; no credential was read and no alternate secret extraction was attempted. [The sanitized quote artifact](../artifacts/phase-1-public-quotes.json) preserves the limitation. Do not infer policy rejection, bypass rate limits, or turn these simple probes into product action limits.

## Authenticated browser evidence

Engine/session: **authenticated Brave**, 2026-10-24 UTC. The existing passkey session was observed without signing out or switching identity. A separate loopback-only page found MetaMask. After an initial connection rejection (4001), the user completed connection and a plain-message signature at 01:21:35.679 UTC. Local viem recovery matched the connected address. A subsequent read-only `wallet_getCapabilities` request for Arbitrum, Gnosis, and Celo returned method-not-found (-32601); this session therefore has no usable atomic capability. No account upgrade was requested. [The aggregate signing artifact](../artifacts/phase-1-browser-signing.json) records the result without private identifiers. This proves a real wallet message signature and the unavailable-capability case; atomic wallet submission/recovery and Safe proposals remain unproved live.

The browser tool blocked internal extension pages; there was no attempt to bypass that restriction. Native computer control is unavailable. The modern-web guidance cache was also unavailable; repository guidance governed the temporary check. A separate non-transaction passkey probe was prepared but produced no verified device result. After the scope correction, both owned probe servers were stopped and only this session's three browser tabs were closed. No product UI, auth recipe, Gnosis configuration, or other session's checkout was changed. Private screenshots, account data, and raw browser/probe results remain outside Git.

## RED/GREEN and validation

- 2026-10-24 00:44:51 UTC: the new budget tests failed because their owning modules were absent. An initial BigInt test-title formatting error was corrected and is not behavioral RED evidence.
- 2026-10-24 approximately 00:47–00:48 UTC: three genuine wiring assertions failed because prepared budgets were missing, unbudgeted execution was allowed, and a missing adapter quote did not stop sending. The focused wiring loop then passed 52 tests at 00:50:06 UTC.
- A legacy wallet retry regression exposed an extra ownership check. The additional check now runs only after the optional budget preflight; the wallet/budget loop passed 46 tests at 01:00:34 UTC.
- 2026-10-24 01:04:40 UTC: the final nine-file focused loop passed **180 tests**, with six existing skips. It includes budget/preparation/journal/execution, real adapters, conformance, and work-checkpoint recovery. The budget helper file has 17 cases. Exact focused command is recorded in `status.json`.
- Both Shared source and test typechecks passed after the final fix. Runtime source has been frozen since approximately 01:00:30 UTC.
- The first critical checkpoint began at 01:05:26 UTC. Format/lint and both Shared typechecks passed; Shared finished with 7,736 passing, seven failing, and 16 skipped tests. Failures were in five unchanged files: credit-register, FileUploadField, AppProvider language, dashboard navigation, and work-approval lifecycle. The gate stopped before downstream packages. With `VITEST_MAX_WORKERS=2`, a focused rerun passed all 39 cases in those five files without changes. This does not waive the full-suite failure.
- The full critical rerun used two local workers with unchanged timeouts/assertions. Format/lint and both Shared typechecks passed again. The unchanged AppProvider language case “declares a stored language once its copy is on screen” failed again. The agent interrupted this known-failing rerun at approximately 01:40:34 UTC (exit 130); the Shared suite did not complete and no downstream package suites ran. [The first command](../artifacts/phase-1-compatibility-checkpoint-command.json), [rerun command](../artifacts/phase-1-compatibility-recheck-command.json), and [current validation artifact](../artifacts/phase-1-compatibility-validation.json) preserve the distinction. This was an agent decision after the reproduced failure, not a user cancellation of all validation.

The overall critical gate is **not passing**. The previous foundation's downstream package-suite results are historical and must not be reused for this runtime source. The independent source-structure check still reports only the two inherited auth violations; both files are unchanged from HEAD. Ontology passed independently: 73 guard tests and all guards, with seven baselined findings. Broader inherited test-quality drift remains out of scope. Do not refresh baselines, weaken assertions/timeouts, or edit unrelated features to manufacture a pass.

## Validation receipt

- Tested implementation SHA: unavailable; runtime source is uncommitted. The baseline is context only.
- Current paths and content hashes: [33-path manifest](../artifacts/phase-1-compatibility-worktree.json).
- Exact commands, outcomes, and stopped/unrun checks: [current validation artifact](../artifacts/phase-1-compatibility-validation.json). The overall gate failed; no clean-SHA, merge-ready, or full Phase 1 exit claim is made.
- Linear: existing PRD-1344 mirror retained. Connected read tools reported unavailable, so no external update or sync confirmation was performed in this follow-up.
- Final bounded proof, observed 2026-10-24 01:42:56 UTC and immediately after: repository formatting passed across 4,145 files; 33 hubs validated; all 64 local links resolved; all 33 source fingerprints matched; `git diff --check` passed; no unexpected changed paths or supplied account identifiers appeared in the hub.

## Remaining Phase 1 gates

1. MetaMask message signing and unavailable capability are proved. A separately authorized atomic-wallet execution/recovery exercise is still needed with a provider that reports support; `ready` must not trigger an account upgrade. Safe proposal/recovery remains covered locally and unproved live.
2. Coordinate authenticated account/profile proof with its owning session; do not resume standalone Gnosis or device probes from this batching lane without new scope. Software fork signatures do not certify the live auth flow.
3. Establish configured paymaster acceptance and representative action estimates, including undeployed/deployed cases. The runtime guards are in place; measured product action limits and sponsored acceptance are not certified by a public rate limit or an ERC-20 fixture.
4. Keep unproved account/chain/action combinations disabled. Reconciliation remains available for saved operations. Later settings/member/review UI remains unimplemented.

## Task/phase record

Task record: `transaction-batching` | Type: feature | Outcome: partial (guards and isolated execution proved; live gates open)
Agent/model: Codex / GPT-6 | Coverage: Phase 1 compatibility and limits follow-up

| Phase | Start → end (UTC) | Evidence / blocker |
|---|---|---|
| Investigate | 2026-10-24 00:35:02 → 00:44:49 | Existing source, guides, RPC/signing paths, live session and limits inspected |
| Implement | 2026-10-24 00:44:49 → approximately 01:00:30 | Budget contract, actual operation checks, ordered wallet estimates, focused RED/GREEN loops |
| Verify | 2026-10-24 01:00:30 → 01:40:34 | 180 focused cases; eight fork outcomes; first full Shared run failed seven cases; all 39 cases in affected files passed focused recheck; a full rerun reproduced the language failure and was interrupted |
| Verify | 2026-10-24 01:40:34 → approximately 01:43 UTC | Final formatting, hub schema, links, source fingerprints, privacy, and scope checks passed |
| Investigate | 2026-10-24 01:09:24 → 01:15:58 | Public deployed-code lookup confirmed pilot availability; MetaMask check reached manual popup boundary |
| Review | 2026-10-24 01:15:58 → 01:40:34 | Changed critical lines, compatibility guarantees, evidence limits, and handoff review; Linear read tools report unavailable, so no external mirror update was performed |

Human corrections: 1 observed, scope/ownership. The agent overextended batching verification into live account QA; the user identified the overlap with another session. The probes were stopped. Wallet-selection and public-address replies supplied information, not corrections. Attention: unknown.

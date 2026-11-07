# Garden jar claims and funding: separate follow-up scope

Status: proposed implementation scope, prepared 4 November 2026 Pacific time.
Tracking: [deferred Plan Hub follow-up](../plan.todo.md#deferred-follow-up-dl-145)
identified in PRD-1375 / DL-145. The six cockpit slices can be reviewed independently.
This document scopes the remaining data work; it authorizes no indexing deployment,
contract change, transaction, public issue write or expansion into campaign jars.

## Outcome

A steward opening a garden jar can see verified claims (recipient, time and amount),
the current per-claim cap, observed funding sources and the most recent yield deposit
attributed to that exact jar. Missing history stays distinguishable from a verified empty
history. Values remain separated by chain, jar and asset.

The current cockpit diff supplies an unavailable state for these facts. DL-145 stays locked
until the real data path and its rendered behavior are verified.

## What the source establishes

Evidence baseline: Green Goods `652825db9ebe88458dfbf7e6246147190e93fdac`.
These are source observations, not verification of the deployed contract versions or hosted index.

| Fact | Existing owner | Missing work |
| --- | --- | --- |
| Jar identity, balance, asset, per-claim limit and cooldown | [useGardenCookieJars](../../../../packages/shared/src/hooks/cookie-jar/useGardenCookieJars.ts) reads `getGardenJars` and each jar's views | Reuse the registry and underlying calls. Preserve each jar's field-level read outcomes before composing history; the hook currently substitutes zero or false for failed reads and 18 for unread ERC-20 decimals. |
| Jar creation and metadata | [factory handler](../../../../packages/indexer/src/handlers/cookieJarFactory.ts), `CampaignCookieJar` | Establish garden-jar membership through the module; campaign metadata alone does not identify a garden jar |
| Garden-wide yield allocations | [YieldAllocation](../../../../packages/indexer/schema.graphql), [yield handler](../../../../packages/indexer/src/handlers/yieldSplitter.ts) | Existing rows have no recipient jar and cannot establish a jar's last payout |
| Yield attributed to a recipient jar | [YieldSplitter](../../../../packages/contracts/src/resolvers/Yield.sol) emits `YieldToCookieJar(garden, asset, amount, jar)` after a positive jar deposit | Add an indexed projection and read; the current [config](../../../../packages/indexer/config.yaml) subscribes only to `YieldSplit` |
| Deposit credited to a jar | [Shared ABI](../../../../packages/shared/src/utils/blockchain/abis/cookie-jar.ts) includes `Deposit(depositor, amount, token)` | Register verified jar emitters and index deposits; retain the actual source account and net credited amount |
| Claims | No garden-jar history projection exists | Verify the deployed jar ABI/runtime and a recoverable receipt source before selecting a reconstruction |

The sibling Cookie Jar source at `f7e23db` (`contracts/src/CookieJar.sol`) declares a
`Withdrawal` event through `CookieJarLib`, but `withdraw` and `_executeWithdrawal` do not
emit it. That source is not evidence of which implementation any deployed jar uses. Do not
promise a `Withdrawal` subscription or a contract-free complete claims history before
checking the deployed versions. The sibling's current history-reader work is uncommitted
and is not an accepted dependency or a proven integration.

`YieldToCookieJar.amount` describes the amount pulled from the splitter. The jar's `Deposit`
event describes its ledger credit after any deposit fee. Preserve both meanings; do not
silently use one as the other. Current Green Goods jar creation sets a zero deposit fee,
but that default does not prove every historical jar has it.

## Proposed delivery units

1. **Verify the history source and freeze the read contract.** Resolve garden jars from the
   network's existing module/registry; verify creation provenance and contract version. Prove
   claims, emergency withdrawals, deposit fees and unrelated transfers can be distinguished
   through successful receipts and an inspected call path. Include nested Safe/account calls.
   If a deployed version lacks sufficient observable evidence, return a precise unsupported
   state and a separate decision about traces or future contract instrumentation. Do not
   silently label every outgoing ERC-20 transfer a claim. Native-asset history is outside the
   initial garden-jar scope unless the source verification establishes a supported case.
2. **Add the Indexer and Shared read.** Index verified jar deposits and
   `YieldToCookieJar`; add claims only for the proven source contract. Use the repository's
   chain-scoped identities and dynamic registration pattern. Keep event transaction, log
   index, block and timestamp provenance. Reads return coverage start/end, completeness,
   truncation and failure/staleness alongside rows. Reuse the existing data-module/query-key
   conventions; new hooks belong in Shared. Extend the existing read or expose a read model
   that retains each jar's field status and freshness before composing history. Keep verified
   zero values distinct from unread fields and use token decimals only after verification.
   Replaying the same event must not duplicate rows.
3. **Wire the existing jar page.** Replace unavailable facts only when the read supports them.
   Show each verified claim beside the current per-claim cap, explicitly labeled current;
   do not infer historical noncompliance from a later cap change. Identify observed yield
   funding separately from other deposits. An observed depositor is not proof of the ultimate
   donor or original source of its funds. Show the latest matching jar yield receipt and its
   time. Preserve partial/error/stale states and EN/ES/PT copy.

Use `(chainId, jarAddress)` for jar identity and an event identity including chain, emitting
address, transaction hash and log index. Sort equal-time rows deterministically. Keep raw
token units and verified decimals; never sum unlike assets or turn an unread value into zero.
The history read supplies evidence, not claim eligibility or permission to send a transaction.

## Done when

- Two jars in the same garden and jars with the same address on different chains do not share
  claims, funding history or last-payout facts. A garden-wide allocation is never substituted.
- A verified claim includes its actual recipient, amount, asset, time and provenance. Failed
  calls, fees, emergency withdrawals and ambiguous outflows are not presented as claims.
- Funding distinguishes a proved yield deposit from another observed deposit. Amounts pulled,
  fees and ledger credits retain their own meaning. A failed jar deposit and treasury fallback
  do not create a jar payout.
- When a multicall succeeds for one jar and fails for another, the successful values remain
  visible. A failed cap, cooldown or ERC-20 decimals read is shown as unavailable. A verified
  zero cap still renders as zero, and an amount with unread decimals is not formatted using 18.
- Known-empty, unsupported, incomplete, truncated, stale and failed history render differently
  where the distinction affects a steward's decision. Pagination does not imply a complete total.
- The jar page passes focused behavior and labeled phone/desktop rendered checks in EN/ES/PT;
  DL-145 graduates only after the accepted implementation and evidence are reviewed.

## Verification and boundaries

Start with source/receipt conformance, then focused indexer replay, duplicate, identity and
consumer tests. Schema/config changes require `bun run --cwd packages/indexer codegen` before
trusting regenerated types, then the package's boundary/test/build loop and selector-selected
cross-package proof. Include multiple deposits and claims in one transaction, cap changes,
provider failure, fee-bearing historical jars, nested account calls and pagination boundaries.
Use the existing indexer replay/reorg behavior; define how completeness is restored after replay.

Hosted backfill and rollout need their own approved plan, deployment/version pins and readback.
Do not restart a live/local indexing database destructively as a verification shortcut. No
contract upgrade is presumed necessary for deposits or jar-attributed yield; historical claim
coverage remains conditional on the source investigation. Campaign/stipend jars, claim-policy
changes, new funding actions and changes in the sibling repository are outside this follow-up.

The implementation remains unstarted. Next decision: accept these three units, including the
claim-source gate, before assigning a data implementation owner.

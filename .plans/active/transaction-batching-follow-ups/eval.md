# Acceptance evidence

Shared wallet capability reads, plain-wallet action edit recovery, and the Hub fixes shipped on Client and Admin beta at `da5e8889a231`. The critical push gate passed 17 checks, including 146 Shared and 27 Admin focused tests and all consumer typechecks. Required GitHub CI passed. Six Hub stories passed in Storybook Chromium, covering the loaded list after a refresh error, the confirmed decision while the list catches up, and the last row above the tablet send bar. On November 7 in authenticated Brave, the beta Hub loaded and the Approved filter displayed work. The deployed Admin stylesheet contains the tablet clearance rule. Wallet capability and interrupted action edit recovery have automated evidence. The maintainer skipped further connected-wallet tests. [PR #1528](https://github.com/greenpill-dev-guild/green-goods/pull/1528) · [Storybook CI](https://github.com/greenpill-dev-guild/green-goods/actions/runs/42441882855/job/128612655069)

Automated evidence: capability scope and shared reads; no probing unlisted routes; recovery after an interrupted sequential action edit; exact refusal meaning; loaded reviews retained on refresh failure; reachable final row; atomic Octant ordering, rollback/failure, identity, unsupported-wallet fallback, and durable recovery; Add and Send ordering, retained queue on decline, retry and reload.

Add and Send is complete for the regular Kernel 0.3.3 passkey on Arbitrum. In authenticated Brave on November 7, declining sent neither call. After reload, one approval attached the proof and then submitted the promise for confirmation in one atomic operation. Beta revision `d81a641141b4` ships the corrected review copy and removes the legacy batch entry. The legacy passkey and atomic wallet Add and Send tests were skipped by decision, and one-signature wallet Add and Send was deferred. [Live proof](https://github.com/greenpill-dev-guild/green-goods/pull/1524) · [Beta fix](https://github.com/greenpill-dev-guild/green-goods/pull/1526) · [PRD-1054](https://linear.app/green-goods/issue/PRD-1054/send-add-and-sends-proof-and-confirmation-with-one-signature)

Every enabled passkey route has a live beta result. The maintainer accepted route-level coverage for PRD-1399 and deferred first pool setup, opening a seeded season, and the five-decision review. The pool proof covers Edit Pool on an already open pool. Live review proofs cover two and three decisions. The deferred five-decision case still requires confirmation of the hosted bundler limit or acceptance of the actual estimate before a live run. [Batching roadmap](https://linear.app/green-goods/issue/PRD-1344/transaction-batching-and-recovery-roadmap) · [Pool proof](https://github.com/greenpill-dev-guild/green-goods/pull/1428)

Connected-wallet proofs are skipped for this closeout. Octant, WETH deposits, the Kernel 0.3.3 pilot, and the four unlisted routes are deferred as expansions of the current listings. The remaining copy refinements and the taken-promise reward assertion in ADM-199 are separate follow-ups. The reward edit itself already passed live on a passkey.

No local test or old receipt closes a live proof. New validation receipts describe the working tree until task changes are committed and validated paths are clean.

## Archived acceptance matrix reconciliation

The source is `a63929336:.plans/active/transaction-batching/eval.md`. Its introductory claim that settings, members, deposits and review UI were unimplemented was already stale at closeout; the dated continuation and owning code establish delivery. Its individual acceptance requirements remain useful.

| Original acceptance IDs | Current treatment |
|---|---|
| AC-01–07, AC-23: transport, limits, recovery | Shared capability reads and sequential action recovery shipped on beta with automated coverage. Connected-wallet replay is skipped. The hosted bundler check is deferred with the five-decision passkey case. |
| AC-08, AC-27: work queue / proof | Add and Send ordering, decline, reload, and one signature verified on the regular Kernel 0.3.3 passkey. Legacy and atomic wallet Add and Send tests were skipped by decision. One-signature wallet Add and Send was deferred. Octant has its own proof requirement. |
| AC-09–10: settings | Garden settings passed live on a legacy passkey. Plain-wallet keyboard proof is outside this closeout. |
| AC-11–12: members | Two member additions passed live in one legacy passkey request. Larger wallet groups and keyboard and timing checks are outside this closeout. |
| AC-13–16: reviews | Hub fixes shipped and passed automated, Storybook Chromium, and authenticated Brave smoke checks. Two and three decisions passed live on a legacy passkey. The five-decision case is deferred. |
| AC-17: accessible interaction | Storybook Chromium verified that the last Hub row is visible and clickable above the tablet send bar. Admin beta serves the updated layout rule. The additional wallet keyboard checks are outside this closeout. |
| AC-18–19: compatibility / rollout | Required CI and consumer typechecks passed, and Client and Admin beta served the verified merge. The Kernel 0.3.3 pilot has no enabled batching entries and is deferred. |
| AC-20–22: deposits | DAI vault and jar deposits passed live on legacy passkeys. WETH and Octant are future listing work. |
| AC-24: pool setup | Edit Pool passed live on a legacy passkey. First setup and seeded-season opening are deferred and still need a suitable garden for proof. |
| AC-25: creation / rewards | Promise creation and reward edits passed live on legacy passkeys. The taken-promise reward assertion in ADM-199 and the creation copy are separate follow-ups. |
| AC-26: other admin actions | Sequential action recovery is on beta with automated coverage. Connected-wallet replay is skipped. The atomic action edit, campaign jar sync, marketplace approvals, and Karma reconcile routes remain unlisted. |

PRD-1399 is complete under the accepted passkey scope. The historical walkthrough preserves the original prerequisites for any deferred proof that resumes. [PRD-1399](https://linear.app/green-goods/issue/PRD-1399/finish-the-remaining-transaction-batching-proofs-and-follow-ups) · [Historical walkthrough](handoffs/live-proof.md)

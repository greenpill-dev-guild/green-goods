# Original live proof preparation

The [acceptance matrix](../eval.md) records the current passkey-only closeout. Connected-wallet proofs are skipped, and the earlier Add and Send procedures below are historical.

Prepared on 2026-11-07 for PRD-1399 and PRD-1054. These are procedures, not passing evidence.
The user authorized code fixes and preparation in this session; live signing is a separate paired step.

## Add and Send first

Use beta in the user's authenticated browser, on Arbitrum with a legacy passkey. Confirm the deployed revision and account profile before starting. The lead needs a taken, unfinished promise that accepts evidence and confirmation. Use a harmless agreed proof; do not publish private media.

1. Record the promise's starting state and the device queue. Add evidence and choose Add and Send.
2. Decline the single passkey prompt. Confirm neither act landed, the proof and confirmation remain on the device, and a background flush does not prompt again.
3. Reload. Confirm both acts remain recoverable, with the same proof and ordering.
4. Explicitly send the waiting pair. Approve one prompt. Confirm one UserOperation contains `attachEvidence` before `submitForConfirmation`, both calls succeed, and both queue records settle.
5. Read the promise after chain confirmation and after indexer catch-up. It must contain the proof and be awaiting confirmation exactly once.

Repeat with a wallet that explicitly reports atomic EIP-5792 calls, after its rail is approved for beta proof. A plain wallet's two prompts are the approved fallback and do not satisfy the atomic-wallet proof. Do not infer atomic support from a wallet name or a successful single-call batch.

PRD-1054 remains open until both required live rails pass. Before a release, the legacy entry must either have this evidence or be removed through a reviewed enablement change. Preparation alone makes neither decision.

### Kernel 0.3.3 beta candidate

The authenticated Brave walkthrough reached Review Proof on a taken QA promise. The deployed build `7711a080e07e` showed two signatures for the directory-backed `kernel-0.3.3` profile. The proof remained at review. The local candidate adds `proof-and-send` for that profile on Arbitrum One, where the sender already supports Kernel 0.3.3 batch encoding. The distinct `kernel-0.3.3-pilot` profile requires its own proof.

[PR #1524](https://github.com/greenpill-dev-guild/green-goods/pull/1524) merged into `develop` after GitHub CI passed. The hosted beta and the authenticated Brave session both loaded merge revision `3e9011ae887b` on November 7. The submit toast said “Sign once.” The user canceled the first prompt and neither call landed. After reload, the app still offered to send the saved proof. The user approved one prompt on retry, and the promise showed the proof and “Waiting to be confirmed.”

The Arbitrum receipt and decoded calldata confirmed one successful atomic UserOperation with `attachEvidence` followed by `submitForConfirmation` on the same promise. Exactly one proof event and one confirmation-ready event appeared in the test window. This proves the regular Kernel 0.3.3 passkey path. The legacy passkey, pilot passkey, and atomic wallet still need their own evidence.

Review Proof still says “sign twice” for an enabled batch. The review text does not read the sender's capability, while the submit toast does. Keep that copy correction separate from the signing result.

Local verification on November 7 used the critical QA selector scoped to `batch-enablement.ts` and `prepared-batch.test.ts`, with `prepared-batch`, `batch-senders`, and `commitment-proof-and-send` as focused Shared suites. The new regression failed before the listing changed. All 54 focused tests and the Shared, Client, Admin, and Agent source and test typechecks passed afterward. The selector reported 11 fresh passes and pending advisory browser proof. Logs: `/tmp/gg-kernel033-add-send-red.log` and `/tmp/gg-kernel033-add-send-check.log`.

## Other live work

| Proof | Prerequisite | Observation needed |
|---|---|---|
| Octant checkout | Mainnet atomic wallet, approved beta listing, reviewed amount, ETH/WETH and fees | One request contains only needed wrap/reset/approval/deposit calls; decline changes nothing; an unknown result holds the next attempt; matching deposit event proves success |
| Action edit | Passkey that owns an editable action | Multiple changes land in one request; decline retains draft; recovery reads before retry |
| Campaign jar sync | Arbitrum campaign jar with a legitimate membership change | One group, expected membership only, no lost withdrawal rights |
| Marketplace approvals | Proving garden owns a hypercert that can be listed | Needed approvals in one request; resulting approvals match the reviewed intent |
| Karma reconcile | Project access can succeed and measured project-call budget fits | Group succeeds as a whole, including the project access call |
| Larger wallet groups | Contract-call wallet with at least two new members and at least three reviewable works | One request per supported group; each member/decision independently verified |
| First pool / seeded season | Fresh pool or finished prior season, approved setup values | First setup preserves receipt ordering; seeded season opens with the expected single request |
| WETH deposits | Supported target and reviewed WETH amount | Correct deposit event and amount, decline/recovery, then separately approve widening the DAI-only listing |
| Pilot passkeys | kernel-0.3.3-pilot account on its allowed chain | Repeat each listed action; do not carry legacy-profile evidence across |
| Five-decision review | Hosted bundler limit and sponsorship acceptance confirmed | Estimate, total operation gas, request count, all five independent outcomes; a 20M application ceiling is not provider acceptance |
| Keyboard settings | Plain wallet, editable garden | Complete editor by keyboard, focus recovery on decline and completion |
| Keyboard members | Manage rights, agreed member list | Review and submit by keyboard; record time to prompt and confirmed completion |
| ADM-199 | Two available promises plus a taken, unkept promise in the same group | Reward change affects available promises; read the taken promise before and after to substantiate retention |

## Evidence record

Record date, deployed revision, engine and session class, chain, account profile, action, selected count, application request count, observed authenticator prompt count, result, recovery check, time to prompt, time to confirmed completion, and a redacted receipt reference. Keep account addresses, session identifiers, private screenshots and media out of public Git and Linear.

For a blocker, record the exact missing prerequisite and keep the rail unproven. Do not mark a line done because a mock, fork, local test, or earlier profile passed. Copy decisions remain separate: decision 5 wording, quieter hints, review progress phases, the single-passkey confirmation line, and the transient creation count.

## Review gas limit evidence

On 2026-11-07, Alto commit `9d04136419019b727367404208b01dbdc64d86c2` sets both `max-gas-per-user-op` and `max-gas-per-bundle` to 16,000,000 by default in [bundler configuration](https://github.com/pimlicolabs/alto/blob/9d04136419019b727367404208b01dbdc64d86c2/src/cli/config/bundler.ts). Green Goods' `modules/work/review-chain.ts` allows five decisions and a 20,000,000 gas ceiling. The ceiling is a maximum, not a measured operation's gas use. This confirms the potential mismatch but does not reveal Pimlico's hosted Arbitrum configuration. A five-decision live proof still needs the actual operation estimate and provider acceptance or explicit provider limit evidence. No limit was guessed or changed in this session.

## Separate existing Octant limits

Read-only review identified two limits outside the listed atomic-checkout change. The existing sequential endow hook returns a transaction hash without inspecting `confirmation: "pending"`; its success screen therefore needs a separate confirmation-state fix. Its sends also remain outside the batch journal. The new hold check prevents retry of an already-recorded unknown atomic operation; it does not reserve the vault against simultaneous mixed atomic/sequential submissions during preflight. Neither property is claimed as solved by the new atomic path.

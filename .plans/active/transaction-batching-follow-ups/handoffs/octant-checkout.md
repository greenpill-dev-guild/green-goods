# Octant checkout: implementation and proof

PRD-1399's wallet checkout now prepares the reviewed WETH wrap, optional allowance reset, approval and vault deposit as one journaled atomic request. The mainnet rail remains unlisted. This is implementation evidence, not a claim that a live EIP-5792 wallet has passed.

The existing deposit module owns the frozen calls, journal, outcome verification and recovery. A wrap is allowed only for canonical mainnet WETH, a wallet, a vault target and an atomic request. Its value is the exact reviewed shortfall. Before signing, checkout rechecks the vault limit, WETH shortfall and share preview. A changed shortfall stops the request rather than spending a different amount. Capability loss stops the atomic request rather than splitting it. An unresolved old journal entry blocks a plain-wallet retry even after the rail is unlisted; the checkout uses the existing hold controls on chain 1.

The checkout waits when a listed wallet's capability is unknown, and shows no signature count before classification. Atomic busy and ready labels remain 1/1; recovery clears the amount to prevent a second press from sending it again. The existing local-fork unavailable state retains priority. Signature labels now share the checkout shell's existing message owner, and repeated surface props are shared; the dialog remains within its frozen 1,171-line ceiling (1,170 lines).

The provisional wallet ceilings are 4 calls, 1,024 calldata bytes, 1.5M gas, 30 gwei per gas and 0.01 ETH estimated fee. These are conservative stop conditions for development, not measured mainnet limits or wallet fee guarantees. Ordered fork simulation and a live wallet run must establish the actual budget before listing. No allowlist entry, broadcast, dependency, manifest, account or contract changed.

## Automated evidence

- RED: `bun run --cwd packages/shared test src/__tests__/modules/garden-deposit-batch.test.ts`: 8 failures / 31 passed, missing canonical atomic wrap preparation/rejection and provisional chain-1 budget. Initial test registration failed because `%j` could not serialize a bigint; fixed the test title before recording behavioral RED.
- GREEN: `bun run --cwd packages/shared test src/__tests__/modules/garden-deposit-batch.test.ts src/__tests__/hooks/vault/useOctantVaultWalletEndow.test.ts`: 52 passed in 2 files (2026-11-07, 168.78s). Covers exact wrap event verification, unknown-result hold and no resend; unsupported/unlisted capability; stale shortfall; legacy retry blocked by an unresolved group; existing sequential preflight and approval ordering.
- GREEN: `bun run --cwd packages/client test src/__tests__/views/PublicVaults.test.tsx src/__tests__/views/VaultManagePositions.test.tsx`: final 54 passed in 2 files, started 2026-11-07T21:00:38Z, 17.13s. Atomic checkout hands one reviewed shortfall to the endow hook, suppresses the separate wrap and disables a held or unread attempt; existing sequential checkout and local-fork blocking remain covered. Log: `/tmp/transaction-batching-checkout-client-tests.log`.
- Focused PublicVaults recovery check (`--testNamePattern 'uses one reviewed atomic checkout'`) passed 2 tests / 38 intentionally filtered at 20:44:45Z, 86.25s: recovery clears the amount so it cannot be sent twice.
- Path-scoped Biome format and Oxlint completed successfully. Root owns combined typechecks and repository checks.
- Rendered GREEN: **Storybook / headless Chromium**, coordinated by `/root/hub_review_fixes`: all three real checkout stories passed (atomic send and busy state; sequential wrap; held read-only recovery action). The combined runner passed 15/15 in 3 files, 73.56s, starting 20:55:55 UTC; EndowmentSheet ran, while DepositModal and PublicFundingDocumentation were skipped by the existing `storybook-ci` tag filter. The exact command and startup-only temporary configuration are in [Hub rendered evidence](hub-review-fixes.md#rendered-evidence). This is mocked rendered proof, not authenticated wallet signing. The first atomic run correctly reached its busy state but failed a native `disabled` matcher; the shared Button intentionally uses `aria-disabled` while busy, so the assertion now checks that contract.

These tests ran on an uncommitted working tree based on `7e2792d00`; this is not a clean-commit receipt. Three `sb.mock(..., { spy: true })` registrations were added in Shared's Storybook preview (wallet balances, wallet endow and ETH wrapping); story-local overrides are reset. Existing typed deposit stories in Admin DepositModal, Client PublicFundingDocumentation and EndowmentSheet gained `atomic: false` to retain their scenarios. No other harness behavior changed. The public Client import uses the existing declared `useVaultDeposit` export; no manifest change was needed.

## Live walkthrough, after a separate listing and signing decision

1. Use a supported EIP-5792 wallet on Ethereum mainnet, canonical WETH and a vault whose `maxDeposit` allows the reviewed amount. Record chain, rail and browser class without private account identifiers.
2. Choose a small agreed amount with partial WETH and enough ETH for the exact shortfall plus fees. Verify the checkout shows one confirmation. Decline: no wrap, approval or vault deposit may land; retry remains possible.
3. Repeat and approve once. One atomic wallet request must contain wrap, any required reset/approval, then deposit. Verify exact WETH Deposit and Approval events and the vault Deposit event for the connected receiver and amount.
4. Repeat with enough WETH (no wrap), then enough allowance (no approval). The request must contain only necessary calls.
5. Exercise a pending wallet response and reload. The journal must hold another deposit, Check Again must recover its receipt, and a confirmed recovery must clear the submitted amount. Move On requires the displayed chain read and a deliberate choice.
6. Remove/disable the listing while a request is held and verify recovery still works. Do not infer success from a wallet reference or an outer receipt alone.

## Task record

Task: PRD-1399 / Octant checkout | Type: feature | Outcome: partial (live proof and combined checks pending)
Agent: Codex subagent `/root/octant_checkout`; model unknown. Coverage: this implementation segment only.

| Phase | Start → end (UTC) | Evidence |
|---|---|---|
| Investigate | unknown → unknown | Existing checkout, deposit module, journal and wallet preflight inspected; plan approved by lead before mutation edits |
| Implement | unknown → 2026-11-07T21:00:38Z | Scoped files and regression tests stabilized; no publication |
| Verify | 2026-11-07T20:29:55Z → ongoing | Focused results above; first behavioral RED run began 20:30:49Z |

Human corrections: 0 observed; attention unknown. Lead review requested explicit busy-counter, recovery-clear and rendered checks; incorporated.

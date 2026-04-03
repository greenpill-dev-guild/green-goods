# ADR-007: TransactionSender Strategy Pattern

**Date**: 2026-04-02
**Status**: Accepted

## Context

Green Goods supports three authentication modes -- passkey (smart account via Pimlico), embedded wallet (AppKit email/social), and browser extension wallet (EOA). Each mode has a fundamentally different transaction submission path: passkeys use a `SmartAccountClient` (ERC-4337 user operations), embedded wallets use wagmi's `sendTransaction` with an ERC-7677 paymaster proxy, and EOA wallets use wagmi's `writeContractAsync`. Without abstraction, every mutation hook would need a three-way switch on auth mode.

## Decision

A `TransactionSender` interface abstracts transaction submission behind a single `sendContractCall(call: ContractCall): Promise<TxResult>` method. Three implementations exist:

- **PasskeySender**: Wraps `SmartAccountClient` from permissionless.js. Sends user operations through the Pimlico bundler.
- **EmbeddedSender**: Uses wagmi's `Config` with an optional ERC-7677 paymaster proxy URL for gas sponsorship.
- **WalletSender**: Uses wagmi's `writeContractAsync` for direct EOA transactions.

The factory function `createTransactionSender()` in `packages/shared/src/modules/transactions/factory.ts` selects the implementation based on `authMode` and available dependencies. It includes a fallback: if passkey mode is selected but `smartAccountClient` isn't ready yet, it falls back to `WalletSender` if wagmi deps are available.

The job queue receives a `TransactionSender` via its `ProcessJobContext`, so offline jobs are auth-mode agnostic -- they just call `sender.sendContractCall()`.

## Consequences

- **Enables**: Mutation hooks and the job queue are auth-mode agnostic. Adding a new auth mode (e.g., session keys) means implementing one class and updating the factory -- no changes to dozens of mutation call sites.
- **Constrains**: The `ContractCall` interface must be the lowest common denominator across all three submission paths. Features specific to one path (e.g., user operation gas estimation) must be handled inside the sender, not exposed to consumers.
- **Trade-off**: The passkey-to-wallet fallback in the factory adds a subtle behavior -- a user in passkey mode might temporarily use direct wallet transactions during initialization. This is intentional to avoid blocking the UI, but it means early transactions may not go through the smart account.

# ADR-012: Cross-Chain ENS via CCIP

**Date**: 2026-04-02
**Status**: Accepted

## Context

Green Goods operates on Arbitrum (L2) but ENS lives on Ethereum mainnet (L1). Gardens need human-readable names (e.g., `miyawaki-park.greengoods.eth`) for identity and discoverability, but registering ENS subdomains requires L1 transactions. Bridging through Arbitrum's native L1-L2 messaging is possible but has ~7-day finality for L2-to-L1 messages. The platform needs a faster, more reliable cross-chain messaging path.

## Decision

Two-contract bridge using Chainlink CCIP:

- **L2 Sender** (`packages/contracts/src/registries/ENS.sol`): Validates the slug format, caches the registration in local storage (so the L2 state reflects the registration immediately), calculates CCIP fees, and sends a cross-chain message to L1 with the subdomain label, resolver address, and garden metadata.
- **L1 Receiver** (`packages/contracts/src/registries/ENSReceiver.sol`): Receives the CCIP message via `_ccipReceive()`, registers the ENS subdomain under `greengoods.eth`, and sets resolver records (address, text records for garden metadata).

The L1 receiver uses the self-call pattern (see ADR-015) for try/catch isolation on ENS operations. If L1 registration fails (e.g., subdomain already taken by a non-Green-Goods registration, resolver misconfigured), it emits a `ENSRegistrationSkipped` event without reverting the CCIP message. This prevents permanently stuck CCIP messages that would block the lane.

Registration fees are paid by the garden minter in ETH via `msg.value` during `mintGarden()`. If the L1 registration fails, the `GardenToken` contract queues a refund via the `failedENSRefunds` mapping, claimable by the original minter through `claimENSRefund()`.

Slug validation on L2 enforces: lowercase alphanumeric + hyphens, minimum 3 characters, maximum 32 characters, no leading/trailing hyphens.

## Consequences

- **Enables**: L2 gardens get L1 ENS names transparently. Users pay once during mint and receive their subdomain within minutes (CCIP message delivery time), not days. The L2 cache means the garden's name is immediately visible in the UI even before L1 confirmation.
- **Constrains**: CCIP message delivery is asynchronous (typically 5-20 minutes, not instant). Slug validation must happen entirely on L2 before sending -- there is no round-trip to check L1 availability. Duplicate slugs within Green Goods are prevented by the L2 cache, but collisions with external registrations are only detected at L1 execution time.
- **Trade-off**: The refund path for failed registrations adds complexity (storage mapping, claim function, event monitoring). CCIP fees add to the mint cost (~0.1-0.3 LINK equivalent in ETH). The two-contract architecture means deployment and upgrades must be coordinated across two chains.

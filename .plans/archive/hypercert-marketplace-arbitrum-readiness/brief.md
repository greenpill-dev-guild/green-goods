# Hypercert Marketplace Arbitrum Readiness

**Slug**: `hypercert-marketplace-arbitrum-readiness`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-05-02`
**Linked follow-up**: `.plans/active/signal-pool-yield-wiring/`

## Problem

The Arbitrum signal-pool/yield wiring upgrade and migration are complete, but Hypercert marketplace readiness is still not proven. The deployed marketplace adapter is wired into `YieldSplitter` and authorized for `HypercertsModule`, yet both the adapter and module still have zero Hypercert minter/exchange configuration. `bun run contracts:verify:post-deploy:arbitrum` therefore remains red, and admin listing surfaces can imply marketplace capability before the live adapter is configured.

The same readiness pass also exposed indexer config drift. Several deployed module addresses are present in the deployment artifact but missing from `packages/indexer/config.yaml`, while the indexer does not yet define top-level contracts, schema, or handlers for every missing module. This needs an explicit policy instead of a blind sync.

## Desired Outcome

- Operators have package-scripted, dry-run-first steps to inspect and configure Arbitrum Hypercert marketplace readiness.
- Post-deploy verification proves adapter/module/exchange/minter/strategy wiring before the lane can close.
- Shared and admin marketplace flows use deployment artifacts as the app source of truth and fail closed when readiness is absent.
- Admin UX presents marketplace readiness, approval, listing, pending, success, and error states with restrained operator design.
- Indexer config drift is handled intentionally: this hub narrows verifier scope to contracts currently defined/indexed by Envio, and full deployed-module indexing requires a named follow-up hub with definitions, schema, handlers, and codegen proof.

## Scope Notes

In scope:

- Arbitrum deployment artifact marketplace fields.
- Contracts package status/configure scripts and post-deploy verifier hardening.
- Shared marketplace readiness helpers, contract mapping, approval/listing hooks, and query invalidation behavior.
- Admin Hypercert marketplace UX pass, including Hypercert detail, listing dialog, approval gate, and relevant Storybook/test states.
- Client-facing copy or claim cleanup if any public/client surface implies marketplace completion without live evidence.
- Indexer verification policy for deployed-but-not-indexed contracts.

Out of scope:

- Broadcasting transactions without fresh operator approval.
- Reopening or marking complete the completed `signal-pool-yield-wiring` contracts lane.
- Raw `forge` instructions or ad hoc shell command chains.
- Inventing Hypercert protocol addresses outside the repo-pinned Hypercert packages and operator confirmation.
- Full indexer expansion inside this hub; if expansion is required, create or link the named follow-up hub before contracts completion.

## Success Signal

This hub is successful when Arbitrum post-deploy verification passes after the approved marketplace configuration transaction, and the admin/shared marketplace surfaces have recorded RED/GREEN proof plus visual/UX evidence for unavailable, approval-required, ready, pending, success, and failure states.

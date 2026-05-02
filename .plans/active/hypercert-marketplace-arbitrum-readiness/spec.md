# Hypercert Marketplace Arbitrum Readiness Spec

## Summary

Make Arbitrum Hypercert marketplace readiness explicit from backend to frontend. The current deployment is post-migration but not marketplace-ready: the adapter and module are live, wired, unpaused, and owned by the deployer, but their external Hypercert minter/exchange fields are zero. This plan turns the readiness gap into a TDD-governed active hub that starts with contracts/operator verification, then moves through shared fail-closed state and full admin UX proof.

## Users

- Primary: Green Goods operators configuring Arbitrum marketplace readiness.
- Secondary: admins listing Hypercert fractions for yield and reviewing marketplace status.
- Tertiary: maintainers reviewing deployment artifacts, verifier output, and indexer boundaries.

## Functional Requirements

1. Operators can inspect live marketplace readiness on Arbitrum without broadcasting.
2. Operators can dry-run the exact owner calls needed to configure the adapter/module before any broadcast.
3. The broadcast path is package-scripted and gated by explicit human approval.
4. Post-deploy verification fails hard when Arbitrum marketplace readiness is declared but adapter/module/exchange/minter/strategy wiring is missing or mismatched.
5. Shared marketplace helpers resolve Arbitrum marketplace addresses from deployment artifacts and fail closed when required fields are absent.
6. Listing and approval hooks do not proceed when marketplace config is incomplete.
7. Admin UX shows clear operational states for unavailable, needs approval, ready, pending, success, and failure without decorative or marketing treatment.
8. Indexer config drift is not hidden by verifier false positives or blind insertion of undefined contracts.
9. If enable-now stalls, the contracts lane must choose and record one explicit fallback before completion: configure now, operator-approved pause/disable, or a named blocker that accepts the live unconfigured-adapter risk.

## Research Evidence

- Deploy path initializes the adapter with zero exchange/minter: `packages/contracts/test/helpers/DeploymentBase.sol:314-316`.
- `HypercertsModule` is also initialized with zero `hypercertMinter`, with post-deployment configuration implied: `packages/contracts/test/helpers/DeploymentBase.sol:319-323`.
- `Deploy.run()` inherits that path through `deployFullStack`: `packages/contracts/script/Deploy.s.sol:92-96`.
- Adapter owner setters exist for post-deploy configuration: `packages/contracts/src/markets/HypercertMarketplaceAdapter.sol:375-380`.
- Module owner setters exist for `hypercertMinter` and `marketplaceAdapter`: `packages/contracts/src/modules/Hypercerts.sol:249-257`.
- Current post-deploy verifier requires adapter `exchange` and `hypercertMinter` when the adapter exists, but does not yet verify module minter, module adapter, owner, authorized module, exchange transfer manager, or strategy: `packages/contracts/script/utils/post-deploy-verify.ts:1033-1043`.
- Arbitrum artifact has `hypercertsModule` and `marketplaceAdapter`, but no declared `hypercertMinter`, `hypercertExchange`, `transferManager`, or strategy field: `packages/contracts/deployments/42161-latest.json:31-33`.
- Shared already expects marketplace fields from deployment JSON: `packages/shared/src/utils/blockchain/contracts.ts:105-111`.
- Shared marketplace signing/approvals use Hypercert SDK marketplace addresses and deployment fields: `packages/shared/src/modules/marketplace/signing.ts`, `packages/shared/src/modules/marketplace/approvals.ts`.
- Admin exposes list-for-yield and marketplace detail surfaces: `packages/admin/src/views/Garden/HypercertDetail.tsx:409-482`.
- Indexer Arbitrum config currently omits several deployed module addresses and lacks top-level definitions/handlers for each missing name: `packages/indexer/config.yaml:67-90`.
- `envio-integration.ts update 42161` can upsert nonzero deployment addresses, but blind sync is unsafe unless the indexer has corresponding contract definitions, schema, handlers, and codegen proof: `packages/contracts/script/utils/envio-integration.ts:261-281`.

## Operator-Confirm Address Candidates

These are candidates from the repo-pinned Hypercert packages and must be confirmed by the operator against the intended Hypercert release before broadcast:

| Field | Candidate |
|---|---|
| `hypercertMinter` | `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07` |
| `hypercertExchange` | `0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83` |
| `transferManager` | `0x658c1695DCb298E57e6144F6dA3e83DdCF5e2BaB` |
| `strategyHypercertFractionOffer` | `0xECaB24CADe0261fc6513ca13bb3d10f760AF3da8` |

Do not treat this table as authorization to broadcast.

## Human Judgment Points

- Confirm marketplace purchases/listings are expected to be live on Arbitrum now.
- Confirm the canonical Hypercert Arbitrum addresses against the intended Hypercert release before broadcast.
- If address confirmation or broadcast approval stalls, choose the fallback path: configure now, pause/disable with operator approval, or accept and record the live risk as a blocker.
- Decide whether a future explicit marketplace-disabled mode is needed for non-Arbitrum or staged networks.
- Full indexer expansion is deferred from this hub unless explicitly promoted; this hub must narrow verifier scope to contracts currently defined/indexed by Envio, and create/link a named follow-up hub before contracts completion if expansion is needed.
- Choose and record the operator target date in both `status.json` and `plan.todo.md`.

## Non-Functional Constraints

- Use `bun` package scripts only; do not add raw `forge` instructions.
- Keep hooks and marketplace state helpers in `@green-goods/shared`.
- Use root `.env`/varlock patterns only; do not add package-level `.env` files.
- Use `Address` for Ethereum addresses.
- Add user-facing strings to `en`, `es`, and `pt`.
- Admin surfaces must stay a restrained operator command surface using existing `Admin*` wrappers and shared foundations.
- No source lane can be marked complete until RED/GREEN proof is recorded in its handoff and `status.json`.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Contracts/operator | `contracts` | Deployment JSON fields, status/configure scripts, verifier hardening, indexer-verifier policy |
| Shared/state | `state_api` | Contract mapping, readiness helpers, hooks, fail-closed behavior, query invalidation |
| UI/UX | `ui` | Admin marketplace states, listing/approval UX, Storybook/browser evidence, client claim cleanup |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential UX and regression review |

## Risks

- Leaving the adapter unset keeps marketplace readiness broken and post-deploy verification red. Because `YieldSplitter` already points at the unconfigured adapter, future marketplace-yield allocations can fall back to escrow, but the unconfigured unpaused adapter is avoidable risk. If enable-now stalls, contracts cannot complete until the hub records an explicit fallback: configure now, pause/disable with operator approval, or a blocker naming the accepted live risk and decision owner.
- Setting the wrong exchange/minter is high risk: orders can fail, approvals can target the wrong contracts, or funds can route through unintended marketplace contracts.
- Yield/vault funds from the completed migration are not directly affected by configuring exchange/minter; this work affects Hypercert marketplace routing and listing readiness.
- Indexer config changes are off-chain, but bad Envio config can break codegen/runtime or create false readiness.

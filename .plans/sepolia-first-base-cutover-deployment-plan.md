# Sepolia-First Contracts Deployment Migration (Base Cutover)

## Summary
Move the contracts deployment flow to a **Sepolia-first validation model** and replace `baseSepolia` with `base` for production targeting, while enforcing a hard script gate so `base`, `arbitrum`, and `celo` broadcast deploys/upgrades require a successful Sepolia checkpoint first. This phase is **contracts-only**.

## Locked Decisions
1. Production deploy targets are `base`, `arbitrum`, and `celo`; Sepolia is the canonical pre-production testnet.
2. Sepolia must run the **full L2 protocol deployment path** (not ENS-only).
3. `baseSepolia` is a hard replacement target (no compatibility alias in deployment flow).
4. Sepolia validation gate is hard-enforced in scripts with an explicit override flag.
5. Gate applies to all production targets (`base`, `arbitrum`, `celo`).
6. Generic `deploy:mainnet`/`upgrade:mainnet` aliases are removed.
7. Base Hats bootstrapping is manual-ID gated.
8. Base GAP remains disabled for now.
9. Base default `communityToken` is DAI: `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb`.

## Public Interface Changes
1. Update scripts in `/Users/afo/Code/greenpill/green-goods/packages/contracts/package.json` to explicit production commands: `deploy:base`, `deploy:arbitrum`, `deploy:celo`, `upgrade:base`, `upgrade:arbitrum`, `upgrade:celo`, plus dry-run variants; keep `deploy:testnet` and `upgrade:testnet` as Sepolia aliases.
2. Remove ambiguous `deploy:mainnet` and `upgrade:mainnet` script entries.
3. Add CLI flag `--override-sepolia-gate` to `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/deploy.ts` flow and `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/upgrade.ts`.
4. Add required Base Hats env vars: `BASE_HATS_COMMUNITY_HAT_ID`, `BASE_HATS_GARDENS_HAT_ID`, `BASE_HATS_PROTOCOL_GARDENERS_HAT_ID`.
5. Add release checkpoint artifact file: `/Users/afo/Code/greenpill/green-goods/packages/contracts/deployments/validation/sepolia-checkpoint.json`.

## Implementation Plan
1. Canonicalize network config in `/Users/afo/Code/greenpill/green-goods/packages/contracts/deployments/networks.json` by replacing `baseSepolia` with `base` (`chainId: 8453`, `rpcUrl: ${BASE_RPC_URL}`, BaseScan verifier config, Base DAI community token).
2. Update chain maps in `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/utils/network.ts`, `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/utils/deployment-addresses.ts`, `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/utils/docs-updater.ts`, and `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/DeployHelper.sol` to use `base`/`8453` and remove active `baseSepolia` routing.
3. Update Foundry config in `/Users/afo/Code/greenpill/green-goods/packages/contracts/foundry.toml` by replacing `baseSepolia` profile/etherscan entries with `base`.
4. Make Sepolia full-stack in `/Users/afo/Code/greenpill/green-goods/packages/contracts/test/helpers/DeploymentBase.sol` by changing `_isMainnetChain` to only Ethereum mainnet behavior and adding Sepolia+Base handling in `_getEASForChain` as L2 protocol chains.
5. Implement Base Hats manual gate in Solidity deployment path (same deploy transaction path used by core deploy): read Base hat IDs from env, call `setProtocolHatIds` on Hats module before seed minting, and hard-fail if missing IDs or Hats adminability checks fail.
6. Add Sepolia release gate utility in `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/utils/release-gate.ts` with checkpoint schema containing commit hash, timestamp, operation type (`deploy`/`upgrade`), deployment hash, and smoke results.
7. Wire gate enforcement into `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/deploy/core.ts` and `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/upgrade.ts`: broadcast to production networks requires valid Sepolia checkpoint unless `--override-sepolia-gate` is passed.
8. Implement Sepolia smoke checks used by checkpoint writer: deployment file required fields non-zero, schema UIDs non-zero, and RPC bytecode existence for required contracts.
9. Keep Base GAP unsupported in `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/lib/Karma.sol` for `8453` in this phase, and remove `84532` references so old testnet-specific GAP constants are not part of active flow.
10. Update Hats chain support references in `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/lib/Hats.sol` and associated tests to use `8453` semantics.
11. Update tests touching old chain IDs in `/Users/afo/Code/greenpill/green-goods/packages/contracts/test/unit/HatsLib.t.sol`, `/Users/afo/Code/greenpill/green-goods/packages/contracts/test/UpgradeSafety.t.sol`, and any deployment-helper tests coupled to `84532`.
12. Update contracts-facing docs and operational runbooks in `/Users/afo/Code/greenpill/green-goods/packages/contracts/README.md`, `/Users/afo/Code/greenpill/green-goods/packages/contracts/AGENTS.md`, `/Users/afo/Code/greenpill/green-goods/.claude/context/contracts.md`, `/Users/afo/Code/greenpill/green-goods/.claude/skills/contracts/SKILL.md`, and contract-related command references in `/Users/afo/Code/greenpill/green-goods/CLAUDE.md`.

## Test Cases and Acceptance Criteria
1. `bun script/deploy.ts core --network sepolia --broadcast` executes the full L2 deploy path and produces a valid Sepolia checkpoint artifact.
2. `bun script/deploy.ts core --network base --broadcast` fails before broadcast when checkpoint is missing/stale/commit-mismatched.
3. `bun script/deploy.ts core --network base --broadcast --override-sepolia-gate` bypasses only the checkpoint gate and keeps all other validations active.
4. Base deployment fails with clear actionable errors when any `BASE_HATS_*` ID is missing or Hats admin checks fail.
5. `bun script/deploy.ts status` and CLI help output list `base` and do not list `baseSepolia` as an active deployment target.
6. `forge test` passes with updated chain assumptions and no remaining `84532`-based production-path assertions.
7. Upgrade path gate behaves identically: production upgrade requires Sepolia checkpoint unless override flag is present.

## Assumptions and Defaults
1. Historical files like `/Users/afo/Code/greenpill/green-goods/packages/contracts/deployments/84532-latest.json` remain as archival artifacts but are no longer active in deploy routing.
2. Checkpoint freshness default is 7 days and must match current Git commit hash.
3. This phase does not migrate frontend/shared/admin default chain IDs or GitHub workflows; those remain a separate migration.
4. Base GAP activation is intentionally deferred until explicit Base resolver/schema constants are approved.

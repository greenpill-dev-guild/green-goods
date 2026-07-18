# Dependency Modernization 2026 - Contracts Handoff

## Lane

- Owner: Codex
- Branch signal: `codex/contracts/dependency-modernization-2026`
- Status: completed on the human-created integration branch

## Scope completed

- Upgraded EAS contracts to 1.9.0 and EAS SDK to 2.9.0.
- Preserved Green Goods Solidity, ABI, storage, schema, deployment, and broadcast surfaces.
- Kept OpenZeppelin 5, CCIP 2, Tokenbound/Kernel, and broadcasts outside this program.

## TDD proof

- RED: not applicable for the compatible manifest-only EAS upgrade.
- GREEN: 95 focused resolver tests and the final 1,533-contract suite/build pass through repo Bun
  wrappers.
- Proof limit: none for contract source behavior.

## Validation

Contract build/tests, format, Solhint, generated hash comparison, fork diagnosis, PostgreSQL 17.10
copied-volume rehearsal, and GraphQL fingerprint equivalence pass without deployment writes.
The repaired `verify:contracts:fast` front door also passes full compilation, Forge formatting,
Solhint, and all 1,533 contract tests. Its path-resolution regression is covered by
`bun run test:contracts-verifier`.

## Remaining

No contract work remains in this program. Dedicated contract-major plans remain separate.

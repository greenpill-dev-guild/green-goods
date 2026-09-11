# Celo GardenAccount evidence

Reviewed, dated evidence for the Celo GardenAccount and Garden Safe release: the recovered
CREATE2 inputs and dependency init code, the Arbitrum Garden initializers, the final Garden Safe
bindings, and live-state readings (Celo account absence, recovery Safes, the CCIP lane, release
readiness).

Read by `script/deploy/celo-garden-accounts.ts`, `script/deploy/garden-account-relay.ts`,
`script/utils/run-garden-roles-proof.ts`, `script/utils/release-gas-gate.test.ts`,
`script/deploy/celo-garden-accounts.test.ts`, and `test/fork/CeloGardenAccountRelease.t.sol`.

These files moved here on 2026-09-10 from the `celo-garden-account-safe-ownership` plan hub, which
is closed; its record is in `.plans/ARCHIVE.md`. They are dated snapshots: add a new dated file
rather than editing one.

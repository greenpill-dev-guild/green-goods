# Acceptance checks

The [research fork](reports/2026-11-08-arbitrum-fork.md) establishes feasibility. These gates apply to the implementation on its tested revision.

| Gate | Pass condition |
|---|---|
| R1 · Eligibility and enrollment | An existing eligible Arbitrum 0.3.3 account enrolls, changes, and removes a wallet using owner-authorized operations. Unsupported chains, account implementations, roots, and unproven guardian ownership fail closed. |
| R2 · Same-address rotation | With the original authenticator unavailable, the enrolled EOA rotates to the new passkey on a real Arbitrum fork. The old key is rejected and the account address, root and implementation remain the same. Wrong guardian, stale enrollment, duplicate call, wrong account, invalid key, and interrupted execution do not rotate the key. |
| R3 · Binding integrity | Directory completion requires the approved onchain receipt, current key and generation, plus a fresh replacement-passkey assertion. Wrong purpose, RP, chain, key, or account, stale and reorged proofs, and concurrent or replayed completion cannot claim or rebind a name. Existing directory data survives migration and restore. |
| R4 · Clean-browser sign-in | A new Chromium context with only the replacement passkey and empty app storage resolves the original address. A fresh ERC-1271 signature and a UserOperation succeed. The previous credential cannot open the recovered session. Unrecovered legacy, 0.3.3, and pilot sessions still follow their established paths. |
| R5 · Discover and remove grants | With two exercised grants already installed, the recovered owner discovers them from chain without old browser state or Agent availability. Remove one while the other remains usable, then remove the second. Verify each guard is retired, both delegates fail after removal, an unrelated permission survives, and owner message signing and transactions still work. Attempt reuse of an old signed enable approval. |
| R6 · Recover from interruption | A disconnect, timeout, duplicate submit, or partial batch outcome can be reconciled from receipts and current state. The user sees outstanding active grants and can retry. Pausing enrollment leaves existing recovery and owner revocation accessible. |
| R7 · Release evidence | Complete real-device guardian and passkey proof in the intended serving environment, including the supported RP and sponsorship failure path. Label the engine and session under the repo browser-evidence rules. Pin the reviewed executor and dependency artifacts and record the approved delay and finality policies. |

Capture the tested commit, UTC time, exact command, results, and clean validated paths in lane receipts. Use the [critical validation overrides](../../../.claude/context/validation-pipeline.md). The product release requires separate authorization.

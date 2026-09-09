# Implementation

- [x] Independent byte capture and compression fallback
- [ ] Atomic complete snapshots, shared identity, hydration and legacy recovery
- [ ] Durable encoder checkpoints, wallet retries and queue ownership
- [x] Video/photo/audio boundaries, approximate location and sheet integration
- [ ] Focused regression tests and limited authenticated Brave recovery proof
- [ ] Selected automated validation gates; see validation.md
- [ ] Full media/device matrix and physical Android production acceptance

## Review repairs

- [x] Reconcile direct, queued and batch broadcasts before sending; wait automatically and require explicit retry after revert
- [x] Centralize discard/retirement and serialize deletion with saves
- [x] Bound preview ownership and load draft thumbnails on demand
- [x] Recover readable legacy entries with durable reselection identities
- [ ] Re-run regression, critical readiness and authenticated browser proof

Automated repair evidence and remaining device acceptance: [repair-validation.md](repair-validation.md). Original acceptance rows remain reopened until live proof is complete.

---
audience: builder
owner: docs
status: prepared
source_of_truth:
  - packages/agent/src/services/db/core.ts
  - docs/releases/2.0.0/deployment-runbook.md
---

# Release database restoration receipt

Snapshot receipt: October 14, 2026, 05:41:28 UTC, which is October 13 in
America/Los_Angeles. Restoration and cleanup were subsequently observed in the same task.
Executed by Codex under Afo's instruction to finish the release gates.
Afo is the named rollback operator. This is an agent-observed operational receipt, not a
claim that Afo performed the commands or that a live failover was exercised.

| Check | Observed result |
|---|---|
| Serving database | Opened read-only; SQLite schema version 8 and integrity OK |
| Consistent backup | SQLite `VACUUM INTO` completed; the new backup was restricted to mode 600 |
| Backup recovery | A fresh volume snapshot was restored into a separate encrypted 1 GB volume |
| Test isolation | A temporary machine used the existing v426 Agent image, the restored volume and an idle command; its actual configuration had no services or checks |
| Restored backup | SHA-256 matched the source backup; SQLite integrity OK, schema version 8, 15 tables, per-kind pending-request uniqueness intact |
| Key pairing | Existing encryption configuration names were confirmed in Fly's secret metadata; no secret values were read or rotated |
| Cleanup | Only the temporary test machine and restored test volume were removed |
| Retained recovery inputs | The consistent backup and production-volume snapshot are retained in the existing private operational environment |
| Serving state after cleanup | Original Agent machine remained started at v426 with one passing health check |

The private operational record holds the exact image digest, snapshot and resource identifiers,
backup path, checksum and observed command results. They are deliberately excluded here.
No account rows, request contents, private keys or passkey identities were printed or published.
This rehearsal proves recovery of the database copy. It does not prove a live application
failover, decrypted-key use, or reconciliation of registrations/requests created after the backup.
Follow the runbook's quiesce, preserve and reconcile steps before an actual Agent rollback.

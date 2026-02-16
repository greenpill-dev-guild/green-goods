# Schema UID Deploy-Time Setup Checklist

When deploying new EAS schemas (e.g., WorkApproval v2 with confidence fields, Assessment v2), the indexer must be configured with the new schema UIDs so it can match incoming `Attested` events to the correct handler.

## Environment Variables

| Variable | Purpose | Scope |
|----------|---------|-------|
| `WORK_APPROVAL_SCHEMA_UID` | Overrides the hardcoded work approval schema UID for **all chains** | Indexer |
| `ASSESSMENT_SCHEMA_UID` | Overrides the hardcoded assessment schema UID for **all chains** | Indexer |

These are read in `packages/indexer/src/EventHandlers.ts` (lines 436-491). Each env var overrides per-chain defaults. If not set, the indexer falls back to hardcoded UIDs in the `WORK_APPROVAL_SCHEMA_UIDS` and `ASSESSMENT_SCHEMA_UIDS` records.

## Deploy Workflow

### 1. Deploy schemas on-chain

```bash
# Dry run first (no --broadcast)
bun script/deploy.ts core --network sepolia --update-schemas

# Deploy for real
bun script/deploy.ts core --network sepolia --broadcast --update-schemas
```

The `--update-schemas` flag tells `Deploy.s.sol` to:
- Register schemas on the EAS SchemaRegistry
- Write the new UIDs to the deployment file at `packages/contracts/deployments/<chainId>-latest.json`
- Update `.schemas.workApprovalSchemaUID`, `.schemas.assessmentSchemaUID`, `.schemas.workSchemaUID`

### 2. Read the new UIDs from deployment output

After deployment, the UIDs are saved in:

```
packages/contracts/deployments/<chainId>-latest.json
```

Under the `schemas` key:

```json
{
  "schemas": {
    "workApprovalSchemaUID": "0x...",
    "assessmentSchemaUID": "0x...",
    "workSchemaUID": "0x..."
  }
}
```

### 3. Configure the indexer

**Local development (Docker Compose):**

Set in your root `.env` file (or export in shell):

```bash
export WORK_APPROVAL_SCHEMA_UID="0x<new-uid-from-deployment>"
export ASSESSMENT_SCHEMA_UID="0x<new-uid-from-deployment>"
```

The Docker Compose file (`packages/indexer/docker-compose.indexer.yaml`, line 89) passes `WORK_APPROVAL_SCHEMA_UID` through. Note: `ASSESSMENT_SCHEMA_UID` is not yet in the compose file -- add it if using assessment schemas:

```yaml
environment:
  WORK_APPROVAL_SCHEMA_UID: ${WORK_APPROVAL_SCHEMA_UID:-}
  ASSESSMENT_SCHEMA_UID: ${ASSESSMENT_SCHEMA_UID:-}
```

**Production (Railway):**

Set the env vars in the Railway dashboard for the indexer service.

### 4. Restart the indexer

```bash
# Local Docker
bun run dev:docker:down && bun run dev:docker

# Or via PM2
bun exec pm2 restart indexer
```

### 5. Verify

Check that the indexer processes new attestations by watching logs:

```bash
bun run dev:docker:logs
# or
bun exec pm2 logs indexer
```

Look for log lines indicating schema match/mismatch. If the UID doesn't match, the indexer will skip those attestation events.

## Hardcoded UID Updates (Optional)

For a permanent fix (no env var needed), update the hardcoded UIDs directly:

- `packages/indexer/src/EventHandlers.ts` line 436: `WORK_APPROVAL_SCHEMA_UIDS`
- `packages/indexer/src/EventHandlers.ts` line 474: `ASSESSMENT_SCHEMA_UIDS`

Copy the UIDs from the deployment JSON into the per-chain entries.

## Schema Evolution Reference

| Schema | Old Fields | New Fields (v2) |
|--------|-----------|-----------------|
| WorkApproval | `actionUID, workUID, approved, feedback` | `actionUID, workUID, approved, feedback, confidence, verificationMethod, reviewNotesCID` |
| Assessment | (10+ field legacy) | `title, description, assessmentConfigCID, domain, startDate, endDate, location` |

Schema definitions live in `packages/contracts/config/schemas.json`.

## Known MVP Limitations — Hats Eligibility Modules

All eligibility module addresses in `packages/contracts/src/lib/Hats.sol` (lines 74-96) are **`address(0)` placeholders** across all chains (Arbitrum, Sepolia, Celo). This means:

- **Funder and Community roles have no on-chain eligibility gates.** These roles are purely admin-granted via Hats Protocol `mintHat()`. There is no AllowlistEligibility or ERC20Eligibility enforcement.
- **`HatsModuleFactory` is unset (`address(0)`)** on all deployments. The factory clone creation step in `HatsModule._configureEligibilityModules()` is skipped entirely during garden hat tree creation.
- **The code handles this gracefully.** Both `_configureEligibilityModules()` (lines 767-808) and the eligibility getter functions (lines 143-159) guard against zero addresses — no reverts, the eligibility config block is simply skipped.

### Post-MVP Action Items

1. Deploy `AllowlistEligibility` module instances per chain (Funder role gate — operator-managed allowlists)
2. Deploy `ERC20Eligibility` module instances per chain (Community role gate — token-balance requirement)
3. Set `HatsModuleFactory` address on `HatsModule` via `setHatsModuleFactory()` so garden hat tree creation clones eligibility modules automatically
4. Update the `address(0)` constants in `Hats.sol` with deployed module addresses and redeploy

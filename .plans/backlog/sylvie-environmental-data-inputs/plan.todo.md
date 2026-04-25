# Sylvie Environmental Data Inputs Plan

**Feature Slug**: `sylvie-environmental-data-inputs`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-25`
**Last Updated**: `2026-04-25`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Split from the deleted external-data umbrella | Sylvie and locale.network have different data models and partner conversations. |
| 2 | Focus on environmental/reforestation inputs | This matches the actual value of the Sylvie app and avoids generic partner abstraction work. |
| 3 | Keep approval advisory in Q2 | Operators should see evidence, not lose judgment authority to partner signals. |
| 4 | Query EAS directly | Preserves the repo indexer boundary. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Confirm Sylvie API shape, credentials, cadence, and data rights | `state_api` | Step 1 | ⏳ |
| Define normalized environmental claim shape | `state_api` | Step 2 | ⏳ |
| Map Sylvie evidence to EAS attestation fields | `state_api` | Step 3 | ⏳ |
| Render advisory admin badge once data is available | `ui` | Step 4 | ⏳ |
| Keep locale.network out of this scope | `qa_pass_1` | Step 5 | ⏳ |

## Steps

### Step 1: Partner discovery

- [ ] Request Sylvie API docs, sample payloads, credentials, and rate limits.
- [ ] Identify whether data maps to work submissions, gardens, or both.
- [ ] Confirm permission to store raw response snapshots or hashes.

### Step 2: Normalize environmental claims

- [ ] Define the first claim set, such as planting event, stewardship check, vegetation signal, or project status.
- [ ] Decide confidence score semantics.
- [ ] Decide required raw evidence fields.

### Step 3: Attestation path

- [ ] Define or reuse an `ExternalVerification` / `GardenVerification` schema based on current needs.
- [ ] Define dry-run proof before writing production attestations.
- [ ] Keep EAS reads direct from the admin/shared hook.

### Step 4: Admin display

- [ ] Add advisory badge metadata only after Step 2 shape is stable.
- [ ] Show source, claim, confidence, observed time, and raw evidence link.

### Step 5: QA

- [ ] Confirm no locale.network implementation leaked into this hub.
- [ ] Confirm no Envio partner-data indexing.

## Validation

- [ ] Partner discovery notes recorded in `status.json` history.
- [ ] Targeted agent/shared/admin tests once implementation starts.
- [ ] `node scripts/plan-hub.mjs validate`

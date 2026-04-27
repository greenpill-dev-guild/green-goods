# Locale Energy IoT Data Inputs Plan

**Feature Slug**: `locale-energy-iot-data-inputs`
**Stage**: `ideas`
**Status**: `IDEA`
**Created**: `2026-04-25`
**Last Updated**: `2026-04-27`

> Moved to ideas on 2026-04-27. This is discovery/proof-model work, not implementation-ready backlog.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Split from the deleted external-data umbrella | locale.network is an IoT/proof surface, not just another API adapter. |
| 2 | Focus on energy and environmental sensor inputs | This maps to Green Goods action categories and avoids generic partner scope. |
| 3 | Treat ZK/TEE as discovery-first | The plan must understand what is actually verifiable before promising proof strength. |
| 4 | Keep approval advisory in Q2 | Operators retain final judgment. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Confirm locale.network API/protocol and pilot device path | `state_api` | Step 1 | ⏳ |
| Define measurement and proof metadata shape | `state_api` | Step 2 | ⏳ |
| Map energy/environmental measurements to EAS attestation fields | `state_api` | Step 3 | ⏳ |
| Render advisory admin badge once data shape is stable | `ui` | Step 4 | ⏳ |
| Keep Sylvie out of this scope | `qa_pass_1` | Step 5 | ⏳ |

## Steps

### Step 1: Partner and device discovery

- [ ] Request locale.network API/protocol docs, auth model, sample payloads, and device constraints.
- [ ] Identify relevant Green Goods action types: energy generation, uptime, environmental monitoring, habitat, or similar.
- [ ] Confirm whether a pilot garden can receive device data in the target window.

### Step 2: Proof and measurement model

- [ ] Define measurement fields: device id, metric, unit, value, observed time, location or garden binding.
- [ ] Define proof metadata: ZK proof reference, TEE attestation reference, verification status, or unknown.
- [ ] Decide confidence semantics for unavailable or unverifiable proof material.

### Step 3: Attestation path

- [ ] Define or reuse an `ExternalVerification` / `GardenVerification` schema based on current needs.
- [ ] Include proof metadata without over-claiming ZK/TEE guarantees.
- [ ] Keep EAS reads direct from shared/admin.

### Step 4: Admin display

- [ ] Show source, measurement, confidence/proof status, observed time, and raw evidence link.
- [ ] Avoid treating proof labels as automatic approval.

### Step 5: QA

- [ ] Confirm no Sylvie implementation leaked into this hub.
- [ ] Confirm no Envio partner-data indexing.

## Validation

- [ ] Partner/device discovery notes recorded in `status.json` history.
- [ ] Targeted agent/shared/admin tests once implementation starts.
- [ ] `node scripts/plan-hub.mjs validate`

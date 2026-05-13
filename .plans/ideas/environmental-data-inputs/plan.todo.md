# Environmental Data Inputs Plan

**Feature Slug**: `environmental-data-inputs`
**Stage**: `ideas`
**Linear Issue**: `RESR-10`
**Linear Source**: `source:plans`
**Status**: `IDEA`
**Created**: `2026-05-03`
**Last Updated**: `2026-05-10`

## Linear Sync Update — 2026-05-10

`RESR-10` is the consolidated Research parent. `RESR-1` (Locale Energy IoT Data Inputs) and `RESR-2` (Sylvie Environmental Data Inputs) are provider-specific children/references, not separate top-level plan mirrors.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Merge locale.network and Sylvie into one environmental-data idea hub | Both are discovery-first partner evidence inputs and were creating duplicate board surfaces. |
| 2 | Preserve provider-specific details as artifacts | The old source plans still carry useful provider questions and constraints. |
| 3 | Keep approval advisory | Operators retain judgment until proof strength and data rights are settled. |

## Provider Tracks

- locale.network: IoT/device evidence, energy/environmental measurements, possible ZK/TEE proof references.
- Sylvie: environmental/reforestation claims, raw evidence rights, cadence, and stewardship/project status signals.

## Checklist

- [ ] Confirm provider API/protocol docs, auth model, sample payloads, cadence, and data rights.
- [ ] Define normalized environmental claim shape and proof/confidence metadata.
- [ ] Decide whether any evidence maps to EAS attestations in Q2.
- [ ] Define advisory admin display once the data shape is stable.
- [ ] Confirm no Envio partner-data indexing is needed for the first pass.

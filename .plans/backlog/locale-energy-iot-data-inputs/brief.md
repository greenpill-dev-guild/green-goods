# Locale Energy IoT Data Inputs

**Slug**: `locale-energy-iot-data-inputs`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-04-25`

## Problem

The old external-data umbrella treated locale.network like a generic partner API. The actual opportunity is more specific: low-cost environmental and energy IoT devices with zero-knowledge and trusted-execution claims that can strengthen operator review and future verification loops.

## Desired Outcome

- A locale.network-specific discovery and integration path for energy/environmental sensor data.
- A proof model that accounts for device identity, measurement cadence, zero-knowledge proof material, and trusted execution evidence where available.
- Advisory admin signals that help operators review energy or environmental actions without automatic approval.

## Scope Notes

- In scope: locale.network API/protocol discovery, IoT measurement normalization, proof metadata, EAS attestation mapping, and admin display metadata.
- Out of scope: Sylvie/reforestation app data, generic partner registries, approval-blocking logic, and Envio re-indexing of EAS attestations.

## Success Signal

A pilot garden or action type has a documented locale.network device-data path and a concrete dry-run record for energy or environmental measurement verification.

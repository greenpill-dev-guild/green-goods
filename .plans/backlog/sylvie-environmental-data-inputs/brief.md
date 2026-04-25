# Sylvie Environmental Data Inputs

**Slug**: `sylvie-environmental-data-inputs`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-04-25`

## Problem

The previous external-data umbrella mixed two very different partner surfaces. Sylvie should stand on its own as an environmental/reforestation input lane, with discovery focused on what the Sylvie app can prove about tree planting, stewardship, vegetation, or related reforestation outcomes.

## Desired Outcome

- A Sylvie-specific adapter scope that maps Sylvie environmental data to Green Goods work or garden verification.
- A clear attestation shape for environmental/reforestation signals, with raw partner evidence stored off-chain and referenced from EAS.
- Admin-facing advisory badges that help operators review submissions without automatically approving or rejecting work.

## Scope Notes

- In scope: Sylvie API/credential discovery, adapter shape, environmental claim normalization, EAS attestation writing, and admin display metadata.
- Out of scope: locale.network, generic partner registries, approval-blocking logic, or Envio re-indexing of EAS attestations.

## Success Signal

One pilot garden has a documented Sylvie data path and at least one test or dry-run evidence record that can become an `ExternalVerification` attestation.

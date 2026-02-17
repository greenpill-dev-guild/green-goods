---
id: ens-technical-spec
title: GG-TECH-008 ENS Integration
sidebar_label: Technical Spec
---

# GG-TECH-008 — ENS Integration

## Architecture
- On-chain registration + ownership checks in contracts package.
- Indexed ENS registration events persisted by indexer.
- Shared hooks expose status and claim flows.

## Testing
- Contract unit tests for registration constraints.
- Shared hook tests for loading/error states.

---
id: yield-splitting-technical-spec
title: GG-TECH-010 Yield Splitting
sidebar_label: Technical Spec
---

# GG-TECH-010 — Yield Splitting

## Architecture
- `YieldSplitter` calculates destination amounts.
- `resolvers/Yield.sol` records protocol-level yield attestations.
- Indexer entities capture allocations, transfers, and stranded yield states.

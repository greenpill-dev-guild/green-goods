---
id: octant-overview
title: Octant Vaults Integration
sidebar_label: Overview
sidebar_position: 1
description: Enable Garden treasuries to deposit into yield-generating vaults with yield routed to Hypercert fraction purchases via conviction voting
---

# Octant Vaults Integration

**Status:** In Development
**Feature ID:** GG-FEAT-006
**Tech Spec ID:** GG-TECH-006
**Priority:** High
**Estimated Effort:** 8 weeks

## Overview

Enable Garden treasuries (ERC-6551 GardenAccounts) to deposit capital into Yield Donating Strategy (YDS) vaults. Generated yield is allocated via conviction voting to **purchase Hypercert fractions** on behalf of the Garden, building a portfolio of verified environmental impact while preserving principal capital.

## Key Features

- **Arbitrum-Native Deployment (Phase 1)**: Deploy YDS vaults directly on Arbitrum using Aave V3 and Yearn V3
- **Cross-Chain Integration (Phase 2)**: Optional Ethereum integration via Chainlink CCIP for deeper liquidity pools
- **Conviction-Based Yield Allocation**: Yield purchases Hypercert fractions based on community voting
- **Hats Protocol Authorization**: Role-based access control for Operators and Guardians
- **Emergency Withdrawal**: Guardian-only immediate exit capability

## Documents

| Document | Description |
|----------|-------------|
| [Feature Specification](./octant-feature-spec) | Product requirements, user stories, acceptance criteria |
| [Technical Specification](./octant-tech-spec) | Engineering architecture, implementation details |

## Architecture Phases

### Phase 1: Arbitrum-Native (Recommended)

```mermaid
graph TB
    subgraph Arbitrum["ARBITRUM ONE"]
        Admin["Admin Dashboard<br/>(React)"]
        GardenTBA["GardenTBA<br/>(ERC-6551 Treasury)"]
        Hats["Hats Protocol"]

        Admin --> GardenTBA
        GardenTBA <--> Hats

        GardenTBA --> GVM["GardenVaultManager"]

        subgraph Strategies["YDS Strategies"]
            Aave["AaveV3YDSStrategy"]
            Yearn["YearnV3YDSStrategy"]
        end

        GVM --> Aave
        GVM --> Yearn

        Aave --> AavePool["Aave V3 Pool"]
        Yearn --> YearnVault["Yearn V3 Vault"]

        Aave --> Donation["HypercertYieldAllocator"]
        Yearn --> Donation
    end

    style Admin fill:#4CAF50,color:#fff
    style GVM fill:#2196F3,color:#fff
    style Donation fill:#FF9800,color:#fff
```

### Phase 2: Cross-Chain (Optional)

```mermaid
graph TB
    subgraph Arbitrum["ARBITRUM ONE"]
        Dashboard["Admin Dashboard"]
        GardenTBA["GardenTBA"]
        StateOracle["StateOracle"]
        CCC["CrossChainController"]
        CCIPArb["CCIP Router"]
    end

    subgraph CCIP["CHAINLINK CCIP DON"]
        DON["Message Relay"]
    end

    subgraph Ethereum["ETHEREUM MAINNET"]
        CCIPEth["CCIP Router"]
        VC["VaultController"]
        subgraph Octant["Octant YDS Vaults"]
            sDAI["sDAI YDS"]
            sUSDS["sUSDS YDS"]
        end
        HatsMirror["HatsMirror"]
    end

    Dashboard --> CCC
    GardenTBA --> CCC
    CCC --> CCIPArb
    CCIPArb --> DON
    DON --> CCIPEth
    CCIPEth --> VC
    VC --> sDAI
    VC --> sUSDS
    VC --> HatsMirror

    style Dashboard fill:#4CAF50,color:#fff
    style CCC fill:#2196F3,color:#fff
    style VC fill:#9C27B0,color:#fff
```

## Success Criteria

- First deposit executed within 48 hours of feature launch
- 90% of deposit/withdraw operations complete successfully
- Average cross-chain message latency under 20 minutes (Phase 2)
- Zero loss of user principal due to contract bugs
- $50k+ TVL in Green Goods vaults within first month

## Dependencies

- **GG-FEAT-002**: Passkey Auth (Operators need authenticated wallets)
- **GG-FEAT-004**: Admin Dashboard v2 (UI container for vault management)
- **GG-FEAT-005**: Hypercerts (Minted Hypercerts are purchase targets)
- **GG-FEAT-007**: Gardens Conviction Voting (Determines yield allocation)
- **Hats Protocol**: Operator role required for vault operations
- **GardenAccount (ERC-6551)**: Token-bound accounts must hold depositable assets

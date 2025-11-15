# Contracts Package (Solidity)

> **Audience:** Smart contract engineers and protocol contributors working in `packages/contracts`.
> **Related docs:** [Monorepo Structure](monorepo-structure.md), [packages/contracts/README.md](../../../packages/contracts/README.md)
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Deployment data: `packages/contracts/deployments/*.json`. Updated November 2024.
> **External references:** See [Ethereum Attestation Service docs](https://docs.attest.org/) for resolver expectations and [OpenZeppelin Upgrades guide](https://docs.openzeppelin.com/contracts/4.x/api/proxy#UUPSUpgradeable) for UUPS patterns.

Smart contracts powering Green Goods attestations and gardens.

---

## Quick Reference

**Path**: `packages/contracts/`
**Stack**: Solidity 0.8.20 + Foundry

**Commands**:
```bash
bun --filter contracts build          # Compile
bun --filter contracts test           # Run tests
bun --filter contracts deploy:testnet # Deploy to Base Sepolia
bun --filter contracts deploy:celo    # Deploy to Celo
```

---

## Core Contracts

### GardenToken (ERC-721)

Gardens as NFTs with tokenbound accounts.

```solidity
contract GardenToken is ERC721, UUPS {
  function mintGarden(
    address to,
    string memory name,
    string memory metadata,
    address[] memory gardeners,
    address[] memory operators
  ) external returns (uint256 tokenId);
}
```

**Deployment**:
- Arbitrum: `0x3DEc3c42C5872a86Fb0e60A4AaDD7aD51CaF076a`
- Celo: `0xDcA639287A392E17cad0deA4E72F5B3cfA429e6B`
- Base Sepolia: `0x0B0EA0FfB996B0b04335507Ef1523124480f7310`

### ActionRegistry

Register available tasks for gardens.

```solidity
contract ActionRegistry {
  function registerAction(
    uint256 gardenId,
    string memory title,
    string memory instructions,
    uint256 startTime,
    uint256 endTime,
    string[] memory capitals,
    string[] memory media
  ) external returns (uint256 actionUID);
}
```

### WorkResolver

Validates work submissions and creates attestations.

```solidity
contract WorkResolver is SchemaResolver {
  function onAttest(
    Attestation calldata attestation,
    uint256 /*value*/
  ) internal override returns (bool) {
    // Validate gardener membership
    // Emit WorkSubmitted event
    // Return true
  }
}
```

### WorkApprovalResolver

Validates approvals and triggers Karma GAP.

```solidity
contract WorkApprovalResolver is SchemaResolver {
  function onAttest(
    Attestation calldata attestation,
    uint256 /*value*/
  ) internal override returns (bool) {
    // Validate operator permission
    // Trigger Karma GAP attestation
    // Emit WorkApproved event
    // Return true
  }
}
```

---

## Deployment System

**Via `deploy.js` wrapper**:
```bash
bun deploy:testnet    # Base Sepolia
bun deploy:celo       # Celo mainnet
bun deploy:arbitrum   # Arbitrum mainnet
```

**What Gets Deployed**:
- Core contracts (deterministic CREATE2)
- EAS schemas (work, approval, assessment)
- Root community garden
- Core actions (3 default)

---

## UUPS Upgrades

All contracts are upgradeable:

```bash
bun upgrade:testnet
bun upgrade:celo
```

**Safety**:
- Storage gaps prevent collisions
- Upgrade tests required
- Multisig-gated (production)

[Upgrade Guide →](../contracts-handbook.md)

---

## Schema Management

**IMMUTABLE**: `config/schemas.json`

Never edit directly. Use `--update-schemas` flag for metadata changes only.

**Schemas**:
- Work Submission
- Work Approval
- Garden Assessment

---

## Karma GAP Integration

**GardenAccount** creates GAP attestations:
- Project attestation (garden creation)
- Impact attestation (work approval)

**Implementation**:
- `src/lib/Karma.sol`
- `src/interfaces/IKarmaGap.sol`

[Karma GAP Details →](../karma-gap.md)

---

## Testing

```bash
bun test                    # All tests
bun test:gap                # Karma GAP tests
forge test --gas-report     # With gas reporting
```

**Test Categories**:
- Unit tests (individual contracts)
- Integration tests (cross-contract)
- Fork tests (against live networks)
- Gas optimization tests

---

## Complete Documentation

**📖 Full details**: [packages/contracts/README.md](../../../packages/contracts/README.md)

**Handbooks**:
- [Contracts Handbook](../contracts-handbook.md)
- [Deployment Checklist](../../DEPLOYMENT_CHECKLIST.md)

**Key Files**:
- Deployment patterns: `.cursor/rules/deployment-patterns.mdc`
- Gas optimization: `.cursor/rules/gas-optimization.mdc`
- Testing conventions: `.cursor/rules/testing-conventions.mdc`
- UUPS upgrades: `.cursor/rules/uups-upgrades.mdc`
- Schema management: `.cursor/rules/schema-management.mdc`


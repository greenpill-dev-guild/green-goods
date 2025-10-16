# Green Goods Schema Migration Guide

This guide covers EAS schema deployment, updates, and migration strategies for Green Goods Protocol.

## Table of Contents

1. [Overview](#overview)
2. [Schema Architecture](#schema-architecture)
3. [Deployment Modes](#deployment-modes)
4. [Migration Strategies](#migration-strategies)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

## Overview

Green Goods uses [Ethereum Attestation Service (EAS)](https://attest.sh/) schemas to define data structures for work submissions, approvals, and assessments. Understanding how to manage schema evolution is critical for production deployments.

### Key Concepts

- **Schemas are immutable** - Once registered, field structure cannot change
- **Metadata is mutable** - Names and descriptions can be updated via attestations
- **UIDs are permanent** - Schema UIDs never change once created
- **Resolvers validate** - Resolver contracts enforce schema rules

## Schema Architecture

### Current Schemas

Green Goods uses three core schemas:

```
1. Assessment Schema (12 fields)
   - Garden impact assessments
   - Multi-capital tracking
   - IPFS metadata storage

2. Work Schema (5 fields)  
   - Work submission by gardeners
   - Media evidence
   - Action tracking

3. Work Approval Schema (4 fields)
   - Validator approvals
   - Feedback mechanism
   - Payment authorization
```

### Schema Definition

Schemas are defined in `config/schemas.json`:

```json
{
  "schemas": {
    "assessment": {
      "name": "Green Goods Assessment",
      "description": "Flexible assessment schema...",
      "revocable": true,
      "fields": [
        { "name": "title", "type": "string" },
        { "name": "description", "type": "string" }
        // ... more fields
      ]
    }
  }
}
```

### Metadata Attestations

Each schema has metadata stored as EAS attestations:

- **Name Attestation**: Links schema UID to human-readable name
- **Description Attestation**: Links schema UID to detailed description

These use standard EAS metadata schemas:
- Name: `0x44d562ac1d7cd77e232978687fea027ace48f719cf1d58c7888e509663bb87fc`
- Description: `0x21cbc60aac46ba22125ff85dd01882ebe6e87eb4fc46628589931ccbef9b8c94`

## Deployment Modes

### Mode 1: Full Deployment

Deploys all contracts and schemas (new addresses).

```bash
# First deployment to a network
bun deploy:testnet

# Force fresh deployment (caution!)
node script/deploy.js core --network baseSepolia --broadcast --force
```

**Use for:**
- ✅ New network setup
- ✅ Local development
- ✅ Fork testing
- ⚠️ Production: Only for initial deployment

### Mode 2: Schema-Only Update (Recommended)

Updates schemas without touching existing contracts.

```bash
# Update schemas, preserve contracts
node script/deploy.js core --network baseSepolia --broadcast --update-schemas
```

**Use for:**
- ✅ Updating schema metadata (name/description)
- ✅ Deploying new schemas alongside existing
- ✅ Fixing metadata attestations
- ✅ Production schema updates

**What happens:**
1. Loads existing contract addresses
2. Skips contract deployment
3. Registers/updates schemas
4. Creates metadata attestations
5. Preserves all contract addresses

### Mode 3: Contract Upgrade

Updates contract implementations (UUPS proxy upgrade).

```bash
# Upgrade contract logic, keep addresses
bun upgrade:testnet
```

**Use for:**
- ✅ Bug fixes
- ✅ New features
- ✅ Gas optimizations
- ✅ Security patches

**Note:** Does NOT redeploy schemas.

## Migration Strategies

### Strategy 1: Additive Migration (Recommended)

Add new fields by deploying a new schema version.

**Example: Adding a "photos" field**

```json
// Step 1: Update config/schemas.json
{
  "work": {
    "name": "Green Goods Work Submission v2",
    "fields": [
      {"name": "actionUID", "type": "uint256"},
      {"name": "title", "type": "string"},
      {"name": "feedback", "type": "string"},
      {"name": "metadata", "type": "string"},
      {"name": "media", "type": "string[]"},
      {"name": "photos", "type": "string[]"}  // NEW
    ]
  }
}
```

```bash
# Step 2: Deploy new schema
node script/deploy.js core --network baseSepolia --broadcast --update-schemas
```

```solidity
// Step 3: Update resolver to support both schemas
function onAttest(Attestation calldata attestation, uint256)
    internal view override returns (bool)
{
    if (attestation.schema == WORK_SCHEMA_V1) {
        // Handle v1 attestations
        WorkSchemaV1 memory v1 = abi.decode(attestation.data, (WorkSchemaV1));
        // ... validation
    } else if (attestation.schema == WORK_SCHEMA_V2) {
        // Handle v2 attestations  
        WorkSchemaV2 memory v2 = abi.decode(attestation.data, (WorkSchemaV2));
        // ... validation
    }
    return true;
}
```

```typescript
// Step 4: Update frontend to use new schema
const schemaUID = await getLatestWorkSchemaUID(); // Returns v2 UID
```

**Benefits:**
- ✅ No breaking changes
- ✅ Gradual migration
- ✅ Old attestations still valid
- ✅ New features available immediately

### Strategy 2: Metadata-Only Update

Update schema names/descriptions without changing fields.

```json
// Update config/schemas.json
{
  "work": {
    "name": "Green Goods Work Submission (Updated)",
    "description": "NEW DESCRIPTION HERE",
    "fields": [ /* unchanged */ ]
  }
}
```

```bash
# Deploy metadata updates
node script/deploy.js core --network baseSepolia --broadcast --update-schemas
```

**Note:** Schema UID remains the same, only metadata attestations change.

### Strategy 3: Parallel Schemas

Run multiple schema versions simultaneously.

```json
// config/schemas.json
{
  "schemas": {
    "work": { /* v1 schema */ },
    "workV2": { /* v2 schema with new fields */ }
  }
}
```

**Use for:**
- Testing new schema versions
- Gradual rollout
- A/B testing
- Feature flags

## Best Practices

### ✅ Do's

1. **Version Schema Names**
   ```json
   {
     "name": "Green Goods Work Submission v2"
   }
   ```

2. **Use Schema-Only Updates for Production**
   ```bash
   node script/deploy.js core --update-schemas
   ```

3. **Test Schema Changes on Testnet First**
   ```bash
   bun deploy:testnet
   # Verify, then:
   bun deploy:celo
   ```

4. **Document Schema Evolution**
   - Track schema UIDs in deployment files
   - Document breaking changes
   - Update indexer queries

5. **Support Multiple Schema Versions in Resolvers**
   ```solidity
   if (schema == V1_UID || schema == V2_UID) {
       // validation
   }
   ```

### ❌ Don'ts

1. **Don't Force Redeploy in Production**
   ```bash
   # AVOID IN PRODUCTION
   --force
   ```

2. **Don't Modify Schema Fields In-Place**
   - Deploy new schema instead
   - Maintain backward compatibility

3. **Don't Delete Old Schemas**
   - Old attestations reference them
   - Keep for historical data

4. **Don't Skip Metadata Attestations**
   - Deployment now requires them (as of this update)
   - Makes schemas discoverable in EAS explorers

## Troubleshooting

### "AlreadyExists()" Error

**Cause:** Trying to register a schema that already exists.

**Solution:**
```bash
# Verify existing schema
cast call $SCHEMA_REGISTRY "getSchema(bytes32)" $SCHEMA_UID

# If you need to redeploy, delete cached UID
rm deployments/{chainId}-latest.json
```

### Metadata Attestation Failed

**Cause:** Deployment now requires metadata attestations to succeed.

**Symptoms:**
```
ERROR: Failed to create name attestation
Schema name attestation failed - deployment cannot continue
```

**Solution:**
1. Check EAS contract address in `deployments/networks.json`
2. Verify deployer has sufficient ETH
3. Confirm metadata schemas exist on target network:
   - Name: `0x44d562ac...`
   - Description: `0x21cbc60a...`

### FFI Error

**Cause:** Foundry cannot execute Node.js script.

**Solution:**
```bash
# Verify Node.js is available
node --version

# Verify script is executable
node script/utils/generateSchemas.js assessment

# Check foundry.toml
grep "ffi = true" foundry.toml
```

### Schema Mismatch After Deployment

**Cause:** Cached deployment file doesn't match on-chain state.

**Solution:**
```bash
# Verify on-chain schema
cast call $SCHEMA_REGISTRY "getSchema(bytes32)" $SCHEMA_UID

# Compare with deployment file
cat deployments/84532-latest.json | jq .schemas
```

## Additional Resources

- [EAS Documentation](https://docs.attest.sh/)
- [Green Goods Deployment Guide](./DEPLOYMENT.md)
- [Contract Upgrade Guide](./UPGRADES.md)
- [Karma GAP Implementation](./KARMA_GAP_IMPLEMENTATION.md)
- [Schema Configuration](../packages/contracts/config/schemas.json)


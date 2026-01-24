# BUGBOT: Contracts Package

Automated warnings for Solidity smart contracts.

## Critical Warnings

### Schema File Edit (FORBIDDEN)
```
Pattern: config/schemas.json
Trigger: any edit
Message: "FORBIDDEN: schemas.json is read-only. Use --update-schemas via deploy.ts or create schemas.test.json"
```

### Direct Forge Script (FORBIDDEN)
```
Pattern: **/*.sh, terminal
Trigger: forge script.*--broadcast
Message: "FORBIDDEN: Use `bun deploy:testnet` or deploy.ts, not direct forge script"
```

### Missing Storage Gap
```
Pattern: src/**/*.sol
Trigger: UUPSUpgradeable|Initializable
Without: __gap
Message: "Upgradeable contracts MUST have storage gap: uint256[N] private __gap"
```

### Require with String
```
Pattern: src/**/*.sol
Trigger: require\(.*,\s*["']
Message: "Use custom errors instead of require with strings (saves gas)"
```

### Implicit Visibility
```
Pattern: src/**/*.sol
Trigger: function [a-z].*\(
Without: public|private|internal|external
Message: "Explicit visibility required on all functions"
```

### Unbounded Loop
```
Pattern: src/**/*.sol
Trigger: for.*\.length
Without: start.*count|batch
Message: "Unbounded loops risk gas limit. Use bounded iteration"
```

### Hardcoded Schema UID
```
Pattern: **/*.ts
Trigger: ['"]0x[a-fA-F0-9]{64}['"]
Message: "Load schema UIDs from deployment artifacts, not hardcoded"
```

## Reference

See `.claude/context/contracts.md` for full patterns.

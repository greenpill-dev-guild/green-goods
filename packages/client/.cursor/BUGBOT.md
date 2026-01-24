# BUGBOT: Client Package

Automated warnings for the offline-first PWA client.

## Critical Warnings

### Hooks Defined in Client (FORBIDDEN)
```
Pattern: src/hooks/**/*.ts
Trigger: export function use
Message: "FORBIDDEN: All hooks must be in @green-goods/shared. Move to packages/shared/src/hooks/"
```

### Polling Detected
```
Pattern: **/*.ts(x)
Trigger: setInterval.*queryClient|polling|refetchInterval
Message: "Avoid polling. Use useJobQueueEvents for event-driven updates"
```

### Orphan Blob URL
```
Pattern: **/*.ts(x)
Trigger: URL\.createObjectURL(?!.*mediaResourceManager)
Message: "Use mediaResourceManager.getOrCreateUrl() to prevent memory leaks"
```

### Wallet Chain ID Used
```
Pattern: **/*.ts(x)
Trigger: useAccount\(\).*chainId|const.*chainId.*=.*useAccount
Message: "Use DEFAULT_CHAIN_ID from @green-goods/shared, not wallet chainId"
```

### Missing isReady Check
```
Pattern: **/*.ts(x)
Trigger: smartAccountClient\.(send|write)(?!.*isReady)
Message: "Guard smartAccountClient calls with isReady check"
```

### Hardcoded Address
```
Pattern: src/**/*.ts(x)
Trigger: ['"]0x[a-fA-F0-9]{40}['"]
Message: "Use deployment artifacts, not hardcoded addresses"
```

## Reference

See `.claude/context/client.md` for full patterns.

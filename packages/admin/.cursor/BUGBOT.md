# BUGBOT: Admin Package

Automated warnings for the admin dashboard.

## Critical Warnings

### Hooks Defined in Admin (FORBIDDEN)
```
Pattern: src/hooks/**/*.ts
Trigger: export function use
Message: "FORBIDDEN: All hooks must be in @green-goods/shared. Move to packages/shared/src/hooks/"
```

### Missing Permission Check
```
Pattern: src/views/**/*.tsx
Trigger: function.*View|export default
Without: useRole|hasPermission|RequireRole
Message: "Admin views should check permissions with useRole or RequireRole"
```

### Hardcoded Permission
```
Pattern: **/*.ts(x)
Trigger: role\s*===?\s*['"]
Message: "Use hasPermission(role, Permission.X) instead of hardcoded role checks"
```

### Data Exposure Risk
```
Pattern: **/*.ts(x)
Trigger: console\.log.*user|console\.log.*garden|console\.log.*wallet
Message: "Remove sensitive data from console.log before commit"
```

### Hardcoded Address
```
Pattern: src/**/*.ts(x)
Trigger: ['"]0x[a-fA-F0-9]{40}['"]
Message: "Use deployment artifacts, not hardcoded addresses"
```

### Missing Error Boundary
```
Pattern: src/views/**/*.tsx
Trigger: throw new Error
Without: ErrorBoundary
Message: "Wrap throwing components in ErrorBoundary"
```

## Reference

See `.claude/context/admin.md` for full patterns.

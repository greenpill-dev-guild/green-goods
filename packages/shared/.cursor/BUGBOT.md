# BUGBOT: Shared Package

Automated warnings for the `@green-goods/shared` package.

## Critical Warnings

### Hook Naming Convention
```
Pattern: src/hooks/**/*.ts
Trigger: export function [^use]
Message: "Hook must start with 'use' prefix (e.g., useGarden, useAuth)"
```

### Provider Missing Display Name
```
Pattern: src/providers/**/*.tsx
Trigger: createContext without displayName
Message: "Add displayName to context for React DevTools debugging"
```

### Store Without Persist Check
```
Pattern: src/stores/**/*.ts
Trigger: create( without persist
Message: "Consider if this store needs persistence (see auth.store.ts for pattern)"
```

### Missing Query Key Export
```
Pattern: src/hooks/**/use*.ts
Trigger: queryKey: \[.*\] without export in query-keys.ts
Message: "Add query key to hooks/query-keys.ts for consistency"
```

### Deep Import Instead of Barrel
```
Pattern: **/*.ts(x)
Trigger: from ['"]@green-goods/shared/(?!index)
Message: "Use barrel import: from '@green-goods/shared'"
```

## Reference

See `.claude/context/shared.md` for full patterns.

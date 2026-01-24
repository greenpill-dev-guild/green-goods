# BUGBOT: Indexer Package

Automated warnings for the Envio blockchain indexer.

## Critical Warnings

### Missing chainId Field
```
Pattern: src/**/*.ts
Trigger: context\.(\w+)\.set\(
Without: chainId
Message: "Entity MUST include chainId field for multi-chain support"
```

### Non-Composite ID
```
Pattern: src/**/*.ts
Trigger: id:\s*event\.params
Without: \`\$\{.*chainId
Message: "Use composite ID: `${chainId}-${uid}` for cross-chain uniqueness"
```

### Missing Create-If-Not-Exists
```
Pattern: src/**/*.ts
Trigger: context\.(\w+)\.get\(
Without: if.*null|??
Message: "Handle null case - entity may not exist yet"
```

### Event Handler Without Loader
```
Pattern: src/**/*.ts
Trigger: handler:.*async
Without: loader:
Message: "Add loader function to pre-fetch required entities"
```

### Docker Not Running
```
Pattern: terminal
Trigger: bun dev|pnpm dev
Message: "Ensure Docker is running: `docker ps` should show envio containers"
```

### Schema Out of Sync
```
Pattern: schema.graphql
Trigger: any edit
Message: "Run `bun codegen` after schema changes to regenerate types"
```

## Reference

See `.claude/context/indexer.md` for full patterns.

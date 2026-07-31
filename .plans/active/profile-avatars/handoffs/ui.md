# UI Machine Lane Handoff

Aggregates the client and admin UI sub-lanes and their RED/GREEN evidence.

## Current validation

```text
bun run --filter @green-goods/client test -- src/__tests__/components/ProfileAvatarEditor.test.tsx
1 file passed; 18 tests passed

bun run --filter @green-goods/admin test -- src/__tests__/components/AccountProfileAvatarEditor.test.tsx
1 file passed; 17 tests passed

VITE_CHAIN_ID=11155111 bun run --filter @green-goods/client build
Exited with code 0

VITE_CHAIN_ID=11155111 bun run --filter @green-goods/admin build
Exited with code 0
```

Historical RED output was not retained.

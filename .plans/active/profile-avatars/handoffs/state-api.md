# State/API Machine Lane Handoff

Aggregates shared protocol, agent API, and shared browser-state RED/GREEN evidence.

## Current validation

```text
bun run --filter @green-goods/shared test -- src/__tests__/modules/profile-avatar.test.ts src/__tests__/modules/profile-avatar-transport.test.ts src/__tests__/hooks/app/useOnlineStatus.test.tsx
3 files passed; 23 tests passed

bun run --filter @green-goods/agent test -- src/__tests__/profile-avatars.test.ts
1 file passed; 13 tests passed

bun run --filter @green-goods/shared typecheck
Exited with code 0

bun run --filter @green-goods/agent typecheck
Exited with code 0

node scripts/dev/ci-local.js --quick
All CI checks passed
```

Historical RED output was not retained.

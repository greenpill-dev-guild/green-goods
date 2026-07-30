# Admin UI Handoff

Owns the account-panel editor, desktop AppBar avatar display, mobile route behavior, tests, and stories.

## Current validation

```text
bun run --filter @green-goods/admin test -- src/__tests__/components/AccountProfileAvatarEditor.test.tsx
1 file passed; 17 tests passed

VITE_CHAIN_ID=11155111 bun run --filter @green-goods/admin build
Exited with code 0

bun run --filter @green-goods/shared check:stories
201/201 required Storybook surfaces have stories

bun run --filter @green-goods/shared check:story-quality
173 story files checked; passed
```

Historical RED output was not retained.

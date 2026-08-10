---
paths:
  - "packages/contracts/**"
---

# Contract Rules

## Rule 14: Always Use Bun Scripts

Never use `forge build`, `forge test`, or `forge script` as a human or agent entrypoint. Use Bun wrappers. Repository-owned Bun wrappers may invoke Forge internally; that implementation detail is not a raw-Forge call site for review purposes.

```bash
# Bad
forge build
forge test --match-contract 'E2EWorkflowTest' -vvv
forge script script/Deploy.s.sol --broadcast --rpc-url $RPC

# Good
cd packages/contracts && bun run build           # Adaptive build (~2s cached)
cd packages/contracts && bun run test            # Unit tests (excludes E2E)
cd packages/contracts && bun run test:e2e:workflow  # E2E workflow
cd packages/contracts && bun run test:fork       # Fork tests
bun script/deploy.ts core --network sepolia --broadcast  # Deploy
```

Why: `bun run build` runs `build-adaptive.ts` which selects fast vs full mode. Raw `forge build` always does a slow full build (~180s). `bun run test` wraps `forge test` with correct exclusions and env loading.

> Full package context: [.claude/context/contracts.md](../context/contracts.md) (deploy CLI, Access Control, Upgrade Safety Checklist, storage gaps).

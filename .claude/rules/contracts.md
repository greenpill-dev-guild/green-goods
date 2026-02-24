---
paths:
  - "packages/contracts/**"
---

# Contract Rules

## Rule 14: Always Use Bun Scripts

Never use `forge build`, `forge test`, or `forge script` directly. Use bun wrappers.

```bash
# Bad
forge build
forge test --match-contract 'E2EWorkflowTest' -vvv
forge script script/Deploy.s.sol --broadcast --rpc-url $RPC

# Good
cd packages/contracts && bun build              # Adaptive build (~2s cached)
cd packages/contracts && bun run test            # Unit tests (excludes E2E)
cd packages/contracts && bun run test:e2e:workflow  # E2E workflow
cd packages/contracts && bun run test:fork       # Fork tests
bun script/deploy.ts core --network sepolia --broadcast  # Deploy
```

Why: `bun build` runs `build-adaptive.ts` which selects fast vs full mode. Raw `forge build` always does a slow full build (~180s). `bun run test` wraps `forge test` with correct exclusions and env loading.

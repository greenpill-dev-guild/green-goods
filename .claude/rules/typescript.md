---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript Rules

Rules for all TypeScript code in the monorepo.

## Rule 4: Error Handling Consistency

Never swallow errors. Log + track + display.

```typescript
// Bad
try { await riskyOp(); } catch (e) { }

// Good (in components)
import { logger } from "@green-goods/shared/modules/app/logger";
import { parseContractError } from "@green-goods/shared/utils/errors/contract-errors";
try {
  await contractCall();
} catch (error) {
  const parsed = parseContractError(error);
  logger.error("Contract call failed", { error, parsed });
  toast.error(parsed.message);
}

// Good (in shared mutation hooks — internal import)
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
onError: (error) => handleError(error, { authMode, gardenAddress });
```

## Rule 5: Address Type Enforcement

Use `Address` from the declared `@green-goods/shared/types/domain` leaf, not `string`, for Ethereum addresses.

```typescript
// Bad
interface Garden { tokenAddress: string; operators: string[]; }

// Good
import type { Address } from "@green-goods/shared/types/domain";
interface Garden { tokenAddress: Address; operators: Address[]; }
```

## Rule 11: Public Export Enforcement

Declared subpaths in `packages/shared/package.json#exports` are public API; deep `src/**` paths are not. Prefer the narrowest declared public subpath when it avoids unrelated runtime coupling. Internal code within `packages/shared/src/` uses relative imports.

```typescript
// Bad: undeclared source-internal path
import { useAuth } from "@green-goods/shared/src/hooks/auth/useAuth";

// Good: declared package exports
import { useAuth } from "@green-goods/shared/hooks/auth/useAuth";
import type { PublicGarden } from "@green-goods/shared/public-contracts";
```

## Rule 12: Console.log Cleanup

Use logger service, not `console.log/warn/error` in production code.

Exception: `console.error` in indexer event handlers (Envio runtime has no logger).

```typescript
// Bad
console.log("Garden loaded", garden);

// Good
import { logger } from "@green-goods/shared/modules/app/logger";
logger.info("Garden loaded", { garden });
```

> Error-utility surface: [.claude/context/shared.md](../context/shared.md) § Error Utilities; test conventions: [.claude/context/testing.md](../context/testing.md).

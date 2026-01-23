# Hook Generator Skill

Generate React hooks following Green Goods shared package patterns.

## Activation

Use when:
- Creating new React hooks
- User requests hook generation
- Implementing new data fetching logic
- Creating state management hooks

## Critical Rule

**ALL hooks MUST be created in `packages/shared/src/hooks/`**

Never create hooks in:
- `packages/client/`
- `packages/admin/`

## Process

### Phase 1: Understand Requirements

Gather:
- Hook purpose and functionality
- Data sources (API, contract, local)
- State management needs
- Error handling requirements

### Phase 2: Find Existing Patterns

Search for similar hooks:

```bash
# List existing hooks
ls packages/shared/src/hooks/

# Find pattern matches
grep -rn "export.*use[A-Z]" packages/shared/src/hooks/
```

### Phase 3: Determine Hook Type

| Type | Pattern | Example |
|------|---------|---------|
| Query | TanStack Query | `useGarden`, `useWorks` |
| Mutation | TanStack Mutation | `useSubmitWork` |
| Store | Zustand selector | `useUIStore` |
| Utility | Pure logic | `useMediaQuery` |
| Composite | Combines others | `useWorkFlow` |

### Phase 4: Generate Hook

#### Query Hook Template

```typescript
import { useQuery } from "@tanstack/react-query";
import { graphql } from "gql.tada";
import { useGraphQL } from "../providers/GraphQL";

const QUERY = graphql(`
  query GetThing($id: String!) {
    thing(id: $id) {
      id
      name
    }
  }
`);

export type UseThing = {
  thing: Thing | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

export function useThing(id: string): UseThing {
  const { client } = useGraphQL();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["thing", id],
    queryFn: () => client.request(QUERY, { id }),
    enabled: !!id,
  });

  return {
    thing: data?.thing,
    isLoading,
    error,
    refetch,
  };
}
```

#### Mutation Hook Template

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type UseCreateThing = {
  createThing: (data: CreateThingInput) => Promise<Thing>;
  isCreating: boolean;
  error: Error | null;
};

export function useCreateThing(): UseCreateThing {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: CreateThingInput) => {
      // API call
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["things"] });
    },
  });

  return {
    createThing: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
```

#### Utility Hook Template

```typescript
import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
```

### Phase 5: Add Type Exports

Export types for consumers:

```typescript
// In hook file
export type UseThing = { ... };

// In barrel export (hooks/index.ts)
export { useThing, type UseThing } from "./useThing";
```

### Phase 6: Update Barrel Export

Add to `packages/shared/src/hooks/index.ts`:

```typescript
export { useNewHook, type UseNewHook } from "./useNewHook";
```

### Phase 7: Create Test Skeleton

Create `packages/shared/src/__tests__/hooks/useNewHook.test.ts`:

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useNewHook } from "../../hooks/useNewHook";
import { TestWrapper } from "../utils/TestWrapper";

describe("useNewHook", () => {
  it("should return initial state", () => {
    const { result } = renderHook(() => useNewHook(), {
      wrapper: TestWrapper,
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("should fetch data", async () => {
    const { result } = renderHook(() => useNewHook("test-id"), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
  });
});
```

### Phase 8: Validate

```bash
# Check hook location
bash .claude/scripts/validate-hook-location.sh

# Type check
cd packages/shared && npx tsc --noEmit

# Run tests
cd packages/shared && bun test useNewHook
```

## Green Goods Conventions

### Naming

- Hook: `use[Entity][Action]` e.g., `useGardenMetrics`, `useSubmitWork`
- File: `use[Entity][Action].ts`
- Type: `Use[Entity][Action]`

### Return Types

Always export explicit return type:

```typescript
export type UseGarden = {
  garden: Garden | undefined;
  isLoading: boolean;
  error: Error | null;
};
```

### Error Handling

Use shared error types:

```typescript
import { AppError } from "../utils/errors";
```

### i18n for UI Strings

If hook returns user-facing strings:

```typescript
import { useTranslation } from "../hooks/useTranslation";

export function useErrorMessage() {
  const { t } = useTranslation();
  return t("error.generic");
}
```

## Output

After generating hook:
1. Show hook file path
2. Show test file path
3. Show barrel export update
4. Remind to run validation scripts

---
name: xstate
disable-model-invocation: true
description: XState state machines and workflows - actor model, state machine design, React integration, testing. Use for multi-step flows, workflow orchestration, and complex UI state.
---

# XState/Workflow Skill

State machine and workflow guide: designing machines, actor model, React integration, and testing.

---

## Activation

When invoked:
- Check `packages/shared/src/workflows/` for existing state machines.
- Use XState v5 patterns (actor model).
- State machines live in `@green-goods/shared` alongside hooks and modules.
- Load `.claude/context/shared.md` for full package patterns.

## Part 1: When to Use State Machines

### Decision Guide

| Scenario | Solution |
|----------|----------|
| Simple toggle (on/off) | `useState` |
| Form with validation | React Hook Form + Zod |
| Async data loading | TanStack Query |
| Multi-step wizard | **XState** |
| Complex UI flow with guards | **XState** |
| Background process lifecycle | **XState** |
| Transaction submission flow | **XState** |

### Green Goods Use Cases

```
packages/shared/src/workflows/
├── work-submission.ts     # Work submission lifecycle
├── garden-creation.ts     # Multi-step garden creation wizard
└── approval-flow.ts       # Work approval workflow
```

## Part 2: Machine Design

### Basic Machine

```typescript
import { setup, assign } from "xstate";

const workSubmissionMachine = setup({
  types: {
    context: {} as {
      gardenAddress: Address;
      actionUID: string;
      media: File[];
      txHash: string | null;
      error: string | null;
    },
    events: {} as
      | { type: "SUBMIT" }
      | { type: "UPLOAD_COMPLETE"; ipfsHash: string }
      | { type: "TX_CONFIRMED"; hash: string }
      | { type: "TX_FAILED"; error: string }
      | { type: "RETRY" }
      | { type: "CANCEL" },
  },
}).createMachine({
  id: "workSubmission",
  initial: "idle",
  context: {
    gardenAddress: "0x" as Address,
    actionUID: "",
    media: [],
    txHash: null,
    error: null,
  },
  states: {
    idle: {
      on: { SUBMIT: "validating" },
    },
    validating: {
      invoke: {
        src: "validateSubmission",
        onDone: "uploading",
        onError: {
          target: "error",
          actions: assign({ error: ({ event }) => event.error.message }),
        },
      },
    },
    uploading: {
      invoke: {
        src: "uploadMedia",
        onDone: {
          target: "confirming",
          actions: assign({ ipfsHash: ({ event }) => event.output }),
        },
        onError: {
          target: "error",
          actions: assign({ error: ({ event }) => event.error.message }),
        },
      },
    },
    confirming: {
      invoke: {
        src: "submitTransaction",
        onDone: {
          target: "syncing",
          actions: assign({ txHash: ({ event }) => event.output }),
        },
        onError: {
          target: "error",
          actions: assign({ error: ({ event }) => event.error.message }),
        },
      },
    },
    syncing: {
      invoke: {
        src: "waitForIndexer",
        onDone: "complete",
        onError: "complete", // Syncing failure is non-critical
      },
    },
    complete: {
      type: "final",
    },
    error: {
      on: {
        RETRY: "validating",
        CANCEL: "idle",
      },
    },
  },
});
```

### Guards (Conditional Transitions)

```typescript
const gardenCreationMachine = setup({
  guards: {
    isStepValid: ({ context }) => {
      switch (context.currentStep) {
        case 0: return context.name.length > 0;
        case 1: return context.operators.length > 0;
        case 2: return context.actions.length > 0;
        default: return true;
      }
    },
    hasEnoughFunds: ({ context }) => context.balance > context.estimatedGas,
  },
}).createMachine({
  // ...
  states: {
    editing: {
      on: {
        NEXT: {
          guard: "isStepValid",
          target: "nextStep",
        },
        SUBMIT: {
          guard: "hasEnoughFunds",
          target: "submitting",
        },
      },
    },
  },
});
```

### Actions (Side Effects)

```typescript
const machine = setup({
  actions: {
    logSubmission: ({ context }) => {
      logger.info("Work submitted", {
        garden: context.gardenAddress,
        action: context.actionUID,
      });
    },
    showToast: ({ context, event }) => {
      toastService.show(createWorkToasts(t).submitted);
    },
    resetForm: assign({
      media: [],
      txHash: null,
      error: null,
    }),
  },
}).createMachine({
  states: {
    complete: {
      type: "final",
      entry: ["logSubmission", "showToast", "resetForm"],
    },
  },
});
```

## Part 3: React Integration

### Using Machines in Components

```typescript
import { useMachine } from "@xstate/react";
import { workSubmissionMachine } from "@green-goods/shared";

function WorkSubmissionForm({ gardenAddress, actionUID }: Props) {
  const [state, send] = useMachine(workSubmissionMachine, {
    context: { gardenAddress, actionUID },
  });

  return (
    <div>
      {/* Stage indicator */}
      <ProgressBar stage={state.value} />

      {/* Conditional UI based on state */}
      {state.matches("idle") && (
        <button onClick={() => send({ type: "SUBMIT" })}>
          Submit Work
        </button>
      )}

      {state.matches("uploading") && <p>Uploading media...</p>}
      {state.matches("confirming") && <p>Confirming transaction...</p>}
      {state.matches("syncing") && <p>Syncing with indexer...</p>}

      {state.matches("error") && (
        <div>
          <p className="text-destructive">{state.context.error}</p>
          <button onClick={() => send({ type: "RETRY" })}>Retry</button>
          <button onClick={() => send({ type: "CANCEL" })}>Cancel</button>
        </div>
      )}

      {state.matches("complete") && <p>Work submitted successfully!</p>}
    </div>
  );
}
```

### Actor References

```typescript
import { useActorRef, useSelector } from "@xstate/react";

// useActorRef for when you don't need re-renders on every state change
function WorkSubmissionController({ gardenAddress }: Props) {
  const actorRef = useActorRef(workSubmissionMachine, {
    context: { gardenAddress },
  });

  // Select only specific state to minimize re-renders
  const isSubmitting = useSelector(actorRef, (state) =>
    state.matches("confirming")
  );
  const error = useSelector(actorRef, (state) => state.context.error);

  return (
    <div>
      <button
        onClick={() => actorRef.send({ type: "SUBMIT" })}
        disabled={isSubmitting}
      >
        Submit
      </button>
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
```

### Providing Machines via Context

```typescript
import { createActorContext } from "@xstate/react";

const WorkflowContext = createActorContext(workSubmissionMachine);

// Provider wraps the component tree
function WorkSubmissionProvider({ children, gardenAddress }: Props) {
  return (
    <WorkflowContext.Provider
      options={{ context: { gardenAddress } }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

// Consumers use the context hook
function SubmitButton() {
  const actorRef = WorkflowContext.useActorRef();
  const isIdle = WorkflowContext.useSelector((s) => s.matches("idle"));

  return (
    <button
      onClick={() => actorRef.send({ type: "SUBMIT" })}
      disabled={!isIdle}
    >
      Submit
    </button>
  );
}
```

## Part 4: Testing State Machines

### Unit Testing Machines

```typescript
import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { workSubmissionMachine } from "../workflows/work-submission";

describe("workSubmissionMachine", () => {
  it("transitions from idle to validating on SUBMIT", () => {
    const actor = createActor(workSubmissionMachine, {
      context: { gardenAddress: "0x123" as Address, actionUID: "abc" },
    });
    actor.start();

    actor.send({ type: "SUBMIT" });
    expect(actor.getSnapshot().value).toBe("validating");

    actor.stop();
  });

  it("transitions to error on validation failure", async () => {
    const actor = createActor(workSubmissionMachine, {
      context: { gardenAddress: "0x0" as Address }, // Invalid
    });
    actor.start();

    actor.send({ type: "SUBMIT" });

    // Wait for invoke to complete
    await new Promise((resolve) => {
      actor.subscribe((state) => {
        if (state.matches("error")) resolve(undefined);
      });
    });

    expect(actor.getSnapshot().context.error).toBeTruthy();
    actor.stop();
  });

  it("allows retry from error state", () => {
    const actor = createActor(workSubmissionMachine);
    actor.start();

    // Force into error state
    // ... setup error scenario

    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().value).toBe("validating");

    actor.stop();
  });
});
```

### Testing Guards

```typescript
it("blocks NEXT when step is invalid", () => {
  const actor = createActor(gardenCreationMachine, {
    context: { name: "", currentStep: 0 }, // Empty name = invalid
  });
  actor.start();

  actor.send({ type: "NEXT" });
  // Should stay in current state (guard rejected)
  expect(actor.getSnapshot().context.currentStep).toBe(0);

  actor.stop();
});
```

## Part 5: Design Patterns

### Parallel States

For tracking multiple independent concerns:

```typescript
states: {
  submission: {
    type: "parallel",
    states: {
      upload: {
        initial: "idle",
        states: {
          idle: {},
          uploading: {},
          complete: {},
        },
      },
      validation: {
        initial: "pending",
        states: {
          pending: {},
          valid: {},
          invalid: {},
        },
      },
    },
  },
}
```

### Delayed Transitions

```typescript
states: {
  syncing: {
    after: {
      30000: {
        target: "complete",
        // Timeout after 30s — indexer may catch up later
        actions: () => logger.warn("Indexer sync timed out"),
      },
    },
  },
}
```

### Machine Composition

Break complex flows into child machines:

```typescript
states: {
  mediaUpload: {
    invoke: {
      src: mediaUploadMachine, // Child machine handles upload details
      onDone: "confirming",
      onError: "error",
    },
  },
}
```

## Anti-Patterns

- **Never use XState for simple toggles** — `useState` is simpler
- **Never put machine definitions in components** — define in `shared/workflows/`
- **Never use `state.value === "string"` for nested states** — use `state.matches()`
- **Never forget to stop actors** — cleanup in useEffect or use `useMachine`
- **Never mix imperative state with machine state** — let the machine be source of truth
- **Never skip guards for conditional transitions** — explicit guards prevent invalid states

## Quick Reference Checklist

### Before Creating a State Machine

- [ ] Is this genuinely multi-step with complex transitions?
- [ ] Machine defined in `packages/shared/src/workflows/`
- [ ] Types defined for context and events
- [ ] Guards defined for conditional transitions
- [ ] Error state with retry/cancel transitions
- [ ] Tests cover all state transitions
- [ ] React integration uses `useMachine` or `useActorRef`

## Related Skills

- `react` — State management decision guide
- `web3` — Transaction lifecycle that maps to machine states
- `data-layer` — Job queue lifecycle as state machine
- `testing` — Testing XState machines with Vitest

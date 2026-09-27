import {
  type AnyMachineSnapshot,
  type AnyStateMachine,
  type EventObject,
  initialTransition,
  type StateValue,
  transition,
} from "xstate";

/**
 * Plain, versioned lifecycle snapshots for server persistence. Only the state value and context
 * are stored; the definition is the code. A snapshot written by a newer machine version is never
 * guessed at: the owner pauses that record until it is migrated.
 */
export interface PersistedLifecycle<TContext> {
  version: number;
  value: StateValue;
  context: TContext;
}

export class LifecycleVersionError extends Error {}

export function startLifecycle<TContext>(
  machine: AnyStateMachine,
  version: number
): PersistedLifecycle<TContext> {
  const [snapshot] = initialTransition(machine) as [AnyMachineSnapshot, unknown];
  return { version, value: snapshot.value, context: snapshot.context as TContext };
}

/**
 * Applies one event. `handled` is false when the lifecycle does not permit the event in its
 * current state, which callers treat as a refused command rather than a silent success.
 */
export function advanceLifecycle<TContext, TEvent extends EventObject>(
  machine: AnyStateMachine,
  version: number,
  persisted: PersistedLifecycle<TContext>,
  event: TEvent
): { next: PersistedLifecycle<TContext>; handled: boolean } {
  if (persisted.version !== version) {
    throw new LifecycleVersionError(
      `Lifecycle snapshot version ${persisted.version} does not match ${version}`
    );
  }
  const current = machine.resolveState({
    value: persisted.value,
    context: persisted.context,
  }) as AnyMachineSnapshot;
  if (!current.can(event)) return { next: persisted, handled: false };
  const [snapshot] = transition(machine, current, event) as [AnyMachineSnapshot, unknown];
  return {
    next: { version, value: snapshot.value, context: snapshot.context as TContext },
    handled: true,
  };
}

export function lifecycleMatches<TContext>(
  persisted: PersistedLifecycle<TContext>,
  state: string
): boolean {
  return typeof persisted.value === "string" ? persisted.value === state : state in persisted.value;
}

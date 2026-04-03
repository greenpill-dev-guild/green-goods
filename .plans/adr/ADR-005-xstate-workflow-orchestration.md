# ADR-005: XState Workflow Orchestration

**Date**: 2026-04-02
**Status**: Accepted

## Context

Authentication and minting involve multi-step async sequences with branching logic, retries, and error recovery. Implementing these as React state (useState/useReducer) leads to "state explosion" -- dozens of boolean flags, impossible-state bugs, and retry logic scattered across effect hooks. The auth flow alone has 8 states, 3 auth methods (passkey, wallet, embedded), external events from wagmi, and session restoration.

## Decision

Complex workflows use XState v5 state machines in `packages/shared/src/workflows/`. React components send events and read state -- they never drive transitions directly.

Current machines:

- **authMachine** (`authMachine.ts`): Manages passkey/wallet/embedded authentication with states: initializing, unauthenticated, registering, authenticating, wallet_connecting, authenticated.{passkey,wallet,embedded}, error. Handles external wallet events globally and enforces mutual exclusivity between auth methods.
- **mintHypercertMachine** (`mintHypercert.ts`): Orchestrates the multi-step minting pipeline: idle -> uploadingMetadata -> uploadingAllowlist -> signing -> pending -> registeringProposal -> confirmed. Implements smart retry that resumes from the last successful state (e.g., if signing fails, it retries from signing, not from metadata upload).
- **createGardenMachine** (`createGarden.ts`): Multi-step garden creation workflow.
- **createAssessmentMachine** (`createAssessment.ts`): Assessment creation workflow.

Design patterns:

- Machines use `setup()` with typed context, events, and actors (XState v5 pattern).
- Actor implementations are placeholder stubs in the machine definition -- actual implementations are provided via `authActor.ts` / `authServices.ts` at runtime.
- Guards enforce preconditions (`canRetry`, `hasExternalWallet`, `sessionRestored`).
- React integration via `@xstate/react` -- components use `useActor` or `useMachine`.

## Consequences

- **Enables**: Every possible state and transition is visible in the machine definition. Impossible states (e.g., authenticated + registering) are structurally prevented. Retry logic is declarative and resumable.
- **Constrains**: Developers must understand XState v5 concepts (setup, actors, guards, invoke). The learning curve is steeper than useState.
- **Trade-off**: The actor stub pattern (placeholder `fromPromise` that throws, replaced at runtime) adds indirection but keeps the machine definition testable in isolation without real network calls.

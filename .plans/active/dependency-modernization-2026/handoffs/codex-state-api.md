# Dependency Modernization 2026 - State/API Handoff

## Lane

- Owner: Codex
- Branch signal: `codex/state-api/dependency-modernization-2026`
- Status: completed on the human-created integration branch

## Scope completed

- Upgraded the approved application-state, Web3/observability, small-major, Vite, and Transformers
  families.
- Preserved shared hook exports, query keys, persisted cache/store formats, auth, forms, machines,
  transaction lifecycle, wallet/passkey boundaries, and telemetry redaction contracts.
- Held Wagmi 3 because official Reown evidence does not yet provide an explicit compatibility
  contract; Wagmi 2 and the multiformats shim remain intact.

## TDD proof

- RED: focused Wave 7 tests exposed React Window 2, Babel 8, js-yaml 5, and jsdom 29 behavior/API
  changes. Transformers 4 characterization covered PCM/WAV, retry, and fallback behavior.
- GREEN: the internal adaptations pass the focused regressions plus the final shared 3,357, client
  640, admin 539, and agent 232 test suites.
- Proof limit: the opt-in live model download cannot fetch externally in this sandbox.

## Validation

Frozen install, full tests/build, agent build, Node/Bun Transformers imports, built-agent startup,
production dependency layout, PWA output, and Storybook gates pass.

## Remaining

No State/API migration remains. Host audit/runtime proof is tracked in
`reports/wave-11-certification.md`.

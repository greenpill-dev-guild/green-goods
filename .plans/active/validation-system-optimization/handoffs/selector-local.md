# Selector and Local Runner Handoff

## Scope

- Versioned validation policy and intent/path/risk selector.
- Selector-driven local runner with fail-fast, cancellation, blocked-environment, dirty-input
  fingerprinting, and opt-in exact passing receipts.
- Durable `bun run validation:plan` caller through real pinned Node.

## TDD Evidence

- RED: `node --test scripts/quality/select-validation.test.mjs` failed because the durable Bun
  caller invoked the selector under Bun's Node-compatibility runtime instead of real Node 22.22.1.
- GREEN: selector and local-runner fixtures pass, including the caller boundary regression.

## Validation Receipt

Working-copy proof exists. Commit-attributed terminal receipt is pending Repo Quick and Ship Gate
completion on clean committed paths.

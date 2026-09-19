# Evaluation

## Passed

- Launcher, ownership and validation-system fixtures: 232 tests passed in the final run, including dependency readiness and owner-bound stop.
- Documentation generator/audit fixtures: 30 tests passed, including removed aliases, missing
  guide targets, invalid validation intents, wrong cwd, and mismatched development modes.
- Documentation audit and 19 generated projections pass; the docs build and search index pass.
- Contract build and ABI-artifact guard pass. The required `verify:contracts:fast` passed after
  granting local socket access for disposable Anvil tests. No live broadcast was performed.
- The retained contract regression file passes all 11 tests through `test:script` and remains
  discoverable in the ordinary suite. The removed admin shortcuts refer to tests included in
  the ordinary package test globs.
- Baseline fixture creation needs no secret; reruns preserve existing content. The isolated
  checkout's prod health reports only missing dependencies, not missing team credentials.
- Connected Brave renders the existing public website with navigation and public garden counts.
  This is existing-environment evidence, not fresh-install or hosted-mode acceptance.

## Blocked / not claimed

- Fresh setup with `--install skip` correctly refuses uninitialized contract submodules.
  A frozen-lockfile install and initialized submodules still require task-specific permission.
  No dependency installation or upgrade has been performed in this task.
- Port 3001 has a live listener with an old owner claim; indexer ports also have existing
  listeners. This session does not own them and did not stop or take them over. Fresh standard
  port startup and Ctrl-C proof were not performed against those services.
- Team connected readiness requires Docker/indexer readiness and credential resolution. Fixture
  health reports missing Docker, generated indexer declarations, and dependencies accurately.
- The global workbench check fails on absent sibling repositories and stale global guidance
  paths. Its Green Goods command manifest has valid targets; those global resources are outside
  this repository's change boundary. Native Envio port 8080 is intentional, not a stale root port.
- The selector overselects unrelated package suites for root-manifest-only QA and maps a TS
  contract test to Forge `test:match` (zero tests). The actual retained TS tests were run through
  the package `test:script` wrapper, and all critical checks were retained. No unrelated runtime
  suites are claimed from the overselected QA plan.

All proof refers to this uncommitted working copy, not a published or deployed revision.

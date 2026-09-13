# Development and onboarding contract

The user approved four separately validated stages: the development interface; package and
operational scripts; the developer journey; and checks that prevent stale instructions.

## Interfaces

Use the existing setup profiles and PM2 launcher. Root `dev` forwards modes or service names;
no argument means local client/admin/agent/indexer on live Arbitrum. Health checks prerequisites
and smoke checks running services. Both accept the launch modes and default to local.
Advanced health profiles remain available. Selected services retain local API overlays.

Public contributors use isolated setup and prod health/launch. Team members use host setup,
resolve shared credentials only if no environment exists, check local health, and launch dev.
Both paths state that confirmed transactions affect live Arbitrum before launch. Existing
`.env`, other sessions' services, and indexed database volumes must survive.

## Evidence and implementation choices

- `scripts/dev/stack.js`, its tests, and `ecosystem.config.cjs` own launch membership, environment
  overlays, and native PM2 commands. `scripts/lib/dev-modes.mjs` now supplies shared routing.
- `surface-leases.mjs` owns claim compatibility and owner-bound release. Its lifecycle behavior
  is preserved and regression-tested; no running third-party service was stopped.
- Setup's baseline creation remains the supported non-secret path. Exclusive file creation
  protects an environment created concurrently. Health reuses setup's dependency markers.
- The manifests initially contained 588 script entries, including 245 at root. Useful package
  commands and operational safeguards are retained; similar names alone are not equivalence.
- The completed steward relabel operation has execution evidence in the Commitment Pooling hub.
  Only its four command entries and operation-specific tests are retired. Independent package
  regression assertions remain in the ordinary contract script suite.
- The ENS forwarding alias directly invoked the same package script, cwd, arguments and network
  as its package replacement. Two proposed dry-wrapper removals were rejected on final review:
  their `sh -lc` wrappers do not forward appended arguments, while a direct package invocation
  would. They remain unchanged to avoid silently changing operational behavior.
- Existing docs tooling generates the full inventory and audits curated guides. No additional
  CLI framework or external-availability test dependency was introduced.

## Boundaries and proof limits

Manifest, Docs workflow, validation policy, CLAUDE and directly affected `.claude` guidance
changes are authorized workflow changes. No application source or Solidity source changed.
The first-run checkout is disposable and contains no copied team environment. Installing its
locked dependencies requires the task-specific permission requested from the user. Another
session's client listener prevents an independent standard-port launch; it was not stopped.

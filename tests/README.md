# Green Goods E2E Tests

The root Playwright suite covers the client PWA and admin cockpit. The source of truth is
[`playwright.config.ts`](../playwright.config.ts); the root scripts in [`package.json`](../package.json)
are the supported entrypoints. `scripts/dev/test-e2e.js` owns E2E preset dispatch and qualification.

## Quick start

```bash
# Starts owned test servers, runs the selected desktop projects, then cleans up
bun run browser e2e --preset all

# Client and admin smoke projects only
bun run browser e2e --preset smoke

# Playwright UI against services you have already started
bun run browser e2e --preset ui
```

`bun run browser e2e --preset all` and `--preset smoke` use Playwright-owned Client/Admin
servers with the CI test profile (`APP_ENV=test`, `NODE_ENV=test`, Sepolia). Playwright refuses
occupied app ports and cleans up only its own server process groups, including after failure or
cancellation. These presets do not start the live PM2 stack or local indexer. Use `--preset ui`
when you deliberately want interactive checks against services you already started.

## Test structure

```text
tests/
  fixtures/                 # Anvil, contract, and Playwright service helpers
  helpers/                  # Shared browser helpers and test configuration
  mocks/                    # Pimlico bundler/paymaster handlers
  specs/                    # Client, admin, fork, passkey, and diagnostic specs
  global-setup.ts           # Optional health checks and environment setup
  global-teardown.ts        # Test cleanup
```

Useful references:

- `tests/fixtures/playwright-services.ts` controls which app servers and indexer are required.
- `tests/fixtures/anvil-fork.ts` owns the local fork lifecycle.
- `tests/fixtures/contract-helpers.ts` loads deployment artifacts for browser tests.
- `tests/helpers/test-utils.ts` exports `ClientTestHelper` and `AdminTestHelper`.
- `tests/helpers/test-config.ts` centralizes test URLs and chain defaults.
- `tests/mocks/pimlico-handlers.ts` keeps the legacy bundler/paymaster response fixture, tested directly without network calls. The qualified passkey rejection spec owns its strict server substitute.

## Projects and focused runs

The config keeps CI lanes and optional manual projects separate:

- `client-ci` and `admin-ci` run deterministic smoke and CI specs.
- `client-full`, `chromium`, and `performance` are the default desktop wrapper projects.
- `mobile-chrome`, `mobile-safari`, and `iphone-16-pro` are explicit device/diagnostic projects.
- `anvil-fork`, `passkey-mock`, and `testnet` are explicit integration projects.

Use Bun to launch the checked-in Playwright CLI:

```bash
bun x playwright test --project=client-ci
bun x playwright test --project=admin-ci
bun x playwright test tests/specs/client.navigation.spec.ts

bun run browser e2e --preset fork
bun run browser e2e --preset passkey
bun run browser e2e --preset testnet
```

Fork and testnet projects have 120-second test timeouts. The default config uses one local retry,
two CI retries, four local workers, two CI workers, traces on the first retry, screenshots on
failure, and local failure video.

## Qualified verification

```bash
bun run browser e2e --preset passkey
bun run browser e2e --preset explore --seed 42
bun run browser e2e --preset pwa-preview
```

These presets own their local server and Chromium contexts, pin CI mode and the Chromium binary checked by the capability probe, allow no retries, and
stop at the first failure within a five-minute run budget. Only complete fresh JSON reports count
as passing: one passkey case, two work-inspection cases, or one production PWA case. Skips,
missing cases, retries and old reports fail qualification. `--list` is discovery only. Filters,
shards and timeout overrides are rejected; diagnostic output and worker options remain available.
The default report lives in `.cache/validation/browser-<preset>/results.json`; set
`PLAYWRIGHT_JSON_OUTPUT_FILE` to preserve a run elsewhere. Playwright attachments include screenshots
and, for exploration, the seed, role, viewport, data and attempted action sequence.

The passkey case uses a real Chromium virtual authenticator and requires the server rejection to
leave the user signed out after reload. It does not prove real-device biometrics, a working remote
passkey server, or successful wallet registration. The seeded work pilot reads synthetic work and
recovers an injected EAS outage, then reloads the same record. Each case has a fresh context and
an allowlist of route actions and network substitutes; it never signs or submits a decision.
External font and telemetry requests receive local substitutes, so this is not font-fidelity proof.

The PWA preset builds production assets before previewing them. It verifies an anonymous login
shell, blocks page and worker network requests offline, and then removes the navigation cache to
prove the reload depends on it. Production auth restrictions remain active. This does not certify
an installed or authenticated Brave session, queued uploads, or the worker-update lifecycle.

The named browser checks in `scripts/data/validation-policy.json` select these proofs for relevant
changes. Missing pinned Chromium is reported as blocked. Existing critical gates and authenticated
browser-proof requirements still apply. Source, fixtures, profile, environment, toolchain and seed
changes invalidate existing runner receipts. CI runs qualified checks in the existing required
Client browser job and retains their reports with its test artifacts.

The `fork` preset preserves a caller-managed Client surface and starts no app or indexer
servers. The fork fixture owns Anvil on chain 31337. Run that project separately from
owned Sepolia test-server projects; mixed profiles are rejected. Its legacy Client smoke
cases do not prove browser-to-fork-to-indexer integration or authenticated-session behavior.

## Authentication

- Client specs use the helpers appropriate to the project: wallet/session injection for smoke
  coverage and virtual WebAuthn for the `passkey-mock` project.
- Admin cockpit specs use deterministic `sessionStorage` mock auth plus GraphQL route interception.
  Mock both `**/api/graphql` and `**/v1/graphql` when the test can traverse the Vite proxy.
- Browser automation here is clean-room test evidence. Label it as such; root
  `AGENTS.md § Browser Evidence` names the wallet, passkey, session, and installed-PWA surfaces that
  still need the authenticated Brave path.

## Servers and environment

When Playwright owns server startup, `PLAYWRIGHT_APP=client` selects the client, `admin` selects the
admin, and an unset value selects both. The indexer starts on port 3006 only when the selected specs
need it; `SKIP_INDEXER=true` disables it. `SKIP_WEBSERVER=true` tells Playwright to reuse externally
managed services.

The deterministic browser-test chain is Sepolia (`VITE_CHAIN_ID=11155111`). Local URLs are HTTPS
outside CI and HTTP in CI.

The shared `mockClientBackend` fixture parses named GraphQL queries and validates the scenario's
chain, garden, schema and pagination inputs. Unsupported operations and RPC calls throw from the
route handler. Empty results are declared responses, not a catch-all success. A scenario can list
required requests, inject a read outage with `setUnavailable`, and call `assertSatisfied()` after
its UI outcome. Exact `rpcReads` permit preparation simulations; transaction sends remain
unsupported. The approval and Admin production-flow specs use this fixture. Older standalone
Admin smoke mocks are separate and are not covered by this contract.

Client startup warms the PWA login graph before the first test's interaction budget, matching
the existing Admin boot warm-up. A failed warm-up does not waive a spec's readiness assertions.

## Further reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`E2E_TEST_GUIDE.md`](./E2E_TEST_GUIDE.md)
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md)
- [Builder guide: Testing](../docs/docs/builders/testing/index.mdx)

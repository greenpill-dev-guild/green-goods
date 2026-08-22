# Green Goods E2E Tests

The root Playwright suite covers the client PWA and admin cockpit. The source of truth is
[`playwright.config.ts`](../playwright.config.ts); the root scripts in [`package.json`](../package.json)
are the supported entrypoints.

## Quick start

```bash
# Starts the web stack, runs the selected desktop projects, then cleans up
bun run test:e2e

# Client and admin smoke projects only
bun run test:e2e:smoke

# Playwright UI against services you have already started
bun run test:e2e:ui
```

`bun run test:e2e` delegates to `scripts/dev/test-e2e.js`. It starts `bun run dev:web`, waits for
the client on port 3001 and admin on port 3002, sets `SKIP_WEBSERVER=true` for Playwright, and stops
the stack on exit. The default wrapper does not start the local indexer.

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
- `tests/mocks/pimlico-handlers.ts` provides passkey bundler/paymaster mocks.

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

bun run test:e2e:fork
bun run test:e2e:passkey
bun run test:e2e:testnet
```

Fork and testnet projects have 120-second test timeouts. The default config uses one local retry,
two CI retries, four local workers, two CI workers, traces on the first retry, screenshots on
failure, and local failure video.

## Authentication

- Client specs use the helpers appropriate to the project: wallet/session injection for smoke
  coverage and virtual WebAuthn for the `passkey-mock` project.
- Admin cockpit specs use deterministic `sessionStorage` mock auth plus GraphQL route interception.
  Mock both `**/api/graphql` and `**/v1/graphql` when the test can traverse the Vite proxy.
- Browser automation here is clean-room test evidence. It does not replace the authenticated Brave
  path required by root `AGENTS.md` for local profile-, wallet-, passkey-, or session-dependent QA.

## Servers and environment

When Playwright owns server startup, `PLAYWRIGHT_APP=client` selects the client, `admin` selects the
admin, and an unset value selects both. The indexer starts on port 3006 only when the selected specs
need it; `SKIP_INDEXER=true` disables it. `SKIP_WEBSERVER=true` tells Playwright to reuse externally
managed services.

The deterministic browser-test chain is Sepolia (`VITE_CHAIN_ID=11155111`). Local URLs are HTTPS
outside CI and HTTP in CI.

## Further reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`E2E_TEST_GUIDE.md`](./E2E_TEST_GUIDE.md)
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md)
- [Builder guide: Playwright](../docs/docs/builders/testing/playwright.mdx)

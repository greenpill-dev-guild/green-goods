# Agent reporting loopback driver

A development-only way to drive the real reporting core over HTTP: the production runtime
composition (SQLite, keyring, coordinator, worker, browser ceremony API and operator routes) with
fixture ports in place of providers.

| Part | In the driver | What it proves |
| --- | --- | --- |
| Chat transport | Synthetic ingress for `whatsapp-fixture:`, `telegram-fixture:` and `synthetic:` realms; recorded outbox | Coordinator behavior, not WhatsApp delivery |
| Chain | In-memory chain that decodes real EAS `attest` calldata and applies resolver role rules | Envelope construction and reconciliation, not Arbitrum inclusion |
| Wallets | Two well-known development keys that sign real EIP-191 proofs | Proof binding, not wallet UX |
| Actions | Fixture catalog (Tree planting, Weeding) | Field contracts, not the live indexer |
| Models | Off (deterministic questions) | Fallback behavior only |

It binds to `127.0.0.1`, refuses to start when `NODE_ENV` or `APP_ENV` is `production`, and its
synthetic ingress and signing helpers are never mounted by `createServer`.

## Run it

```bash
bun run --cwd packages/agent reporting:walkthrough
```

This starts the driver on a free port, walks a report from story and photo through correction,
account linking, owner signing and publication, then a steward review, and prints every chat
reply. The same walkthrough runs in the SQLite test lane (`driver.sqlite.test.ts`).

For manual exploration, start the driver and use `walkthrough.http`:

```bash
bun run --cwd packages/agent reporting:driver
```

To drive the client ceremony pages locally, set `REPORTING_DRIVER_ORIGIN` to the client dev
origin and proxy `/api/messaging` from the client dev server to the driver.

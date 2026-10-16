# Clean-room passkey rig

This rig proves the cross-site passkey paths in [the plan](../../plan.todo.md) without a device:
headless Chromium, a CDP virtual authenticator, and the real Green Goods hostnames on the default
https port. The browser side runs the app's own modules: directory sign-in, the local assertion
check, the signing owner and Kernel's signature encoding. Results carry the label **clean-room
Chromium, virtual authenticator**. They are not authenticated-device proof.

## What runs

- `rig-server.ts` starts three local servers:
  - A CONNECT proxy on `127.0.0.1:47080` that tunnels https for `greengoods.app` and its
    subdomains, and refuses everything else.
  - A TLS server on `127.0.0.1:47443` that serves the page bundle and a switchable
    `/.well-known/webauthn`, plus a prototype directory with `challenge`, `adopt` and `lookup`.
  - A control server on `127.0.0.1:47081`.

  The proxy is needed because a browser always fetches `https://<passkey domain>/.well-known/webauthn`
  on port 443, which this machine's sandbox cannot bind.
- `page.ts` is bundled for the browser and drives every ceremony through the app's modules.
- `run.ts` drives the scenarios, then makes two kinds of read-only call to Arbitrum One. It
  derives Kernel 0.3.1 addresses, and it checks each signature with an `eth_call` to the deployed
  WebAuthn validator. A state override gives that call the test key, so nothing is sent on chain.

## Scenarios

| ID | What it shows |
|---|---|
| A | A passkey made for `beta.greengoods.app` signs in and signs a user operation on beta, and with the file in place on www and admin as well. An entry stored with a hex ID fails on beta and www (step 1's bug). Adoption from www is refused as off-site. |
| A′ | Controls: with no file, and with a file that omits www, Chrome refuses the www ceremony. |
| C | A passkey made by the app's local path under `greengoods.app` is adopted on www. An identical retry returns the stored result. Refused: a replay under another name, a wrong key, mismatched IDs in base64url and hex, the same passkey under a second name with its ID in hex, the held name sent again with its ID in hex, and a different passkey asking for the held name. Admin remembers nothing, yet signs in by name; so does beta. |
| F | A passkey whose stored ID is valid hex and valid base64url (added through `WebAuthn.addCredential` with a known key) is adopted on www through its base64url reading, then signs in by name on admin. |
| D | The Kernel address from the stored credential equals the one from the adopted entry. |
| E | The deployed validator returns `0x1626ba7e` for each signature and `0xffffffff` for a tampered hash. |

## Run it

Make a throwaway certificate outside the repository and never commit it:

```bash
export RIG_CERT_DIR="$(mktemp -d)"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout "$RIG_CERT_DIR/key.pem" -out "$RIG_CERT_DIR/cert.pem" -days 2 -subj "/CN=greengoods.app" -addext "subjectAltName=DNS:greengoods.app,DNS:*.greengoods.app"
```

```bash
node -e "const {X509Certificate,createHash}=require('crypto');const c=new X509Certificate(require('fs').readFileSync(process.env.RIG_CERT_DIR+'/cert.pem'));console.log(createHash('sha256').update(c.publicKey.export({type:'spki',format:'der'})).digest('base64'))" > "$RIG_CERT_DIR/spki.txt"
```

Start the servers in one terminal, then run the scenarios in another with the same
`RIG_CERT_DIR`:

```bash
bun run .plans/backlog/passkey-account-continuity/artifacts/rig/rig-server.ts
```

```bash
RIG_RESULTS="$RIG_CERT_DIR/results.json" bun run .plans/backlog/passkey-account-continuity/artifacts/rig/run.ts
```

Stop the server by its process ID, then delete `$RIG_CERT_DIR`.

## Requirements and limits

- Playwright's Chromium from the repository (`@playwright/test`), plus Bun.
- `page.ts` imports permissionless from `packages/shared/node_modules`. That path follows Bun's
  isolated install layout, so update it if the layout changes.
- `run.ts` calls `RIG_RPC_URLS` (comma-separated; it defaults to public Arbitrum endpoints) for
  reads only.
- The adoption endpoint here is a prototype of plan step 5, not the agent's code. It runs the
  checks in step 5's order:
  1. Spend the challenge.
  2. Match either reading of the submitted ID (hex, when it is shaped like hex, and base64url) to
     the assertion.
  3. Prove possession.
  4. Apply the challenge verdict, the name rule, and uniqueness on the assertion's own bytes.

  The real rules live in the agent with tests.
- The control server accepts only the modes `off`, `on` and `admin-only`, and answers anything
  else with 400.
- `results-2026-10-16-third-review.json` is the run behind
  [the current report](../../reports/2026-10-16-clean-room-proof-third-review.md). The `-second-review`,
  `-after-review` and plain `results-2026-10-16.json` files are earlier runs, each linked from its
  own superseded report. All keys and IDs come from throwaway virtual authenticators.

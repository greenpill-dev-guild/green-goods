# QA app

A deployed checklist where **two people record the same test case at the same time**, each keeping
their own verdict and their own notes.

It exists because the artifact-based checklist could only ever have one writer: the artifact
"editor" role is a Team/Enterprise feature, so a teammate on a shared link is a read-only viewer and
their taps never save. This is the same interface with a store behind it.

## How it stays correct with two writers

Each tester owns exactly one blob — `qa/entries/<lowercase-address>.json` — and only ever writes that one.
Two people recording the same case touch **different objects**, so there is nothing to resolve
between them and no way for one tester's work to overwrite another's. `GET /api/state` reads every
shard and merges.

Within one tester there *is* a conflict to handle, because the workflow expects a phone on the PWA
and a laptop on admin at once. Three things make that safe:

- Saves send **field-level deltas**, not whole entries or shards. A status click sends only the
  status, and a note edit sends only the note, so either device can preserve the other's field.
- Each write is conditional on the ETag that was read (`ifMatch`); a losing write re-reads,
  re-merges and retries rather than overwriting blind. The first write is create-only, so two
  clients that both saw an absent shard cannot both replace it and report success.
- The poll adopts your own entries too, but rejects an own-entry snapshot that began before a local
  edit was confirmed. That lets the phone and laptop converge without allowing a slow GET to roll
  the UI back after `saved ✓`.

Ordering is by **arrival at the server**, which restamps every entry it stores. Client clocks are
never trusted: a device an hour fast would otherwise win every comparison forever, silently dropping
every later correction from the other device.

Two more details that look like bugs if you get them wrong:

- Private blob reads are CDN-cached for up to 60s, so every read passes `useCache: false` and goes
  to origin. Writes deliberately set no `cacheControlMaxAge` — the store's documented floor is 60s,
  and a rejected write is a lost verdict.
- Every keystroke lands in `localStorage` before any network call, so a reload, a crash, a closed
  tab, or a failed save never costs anyone their notes — a pending delta outlives the page session
  and goes out on the next open, and is dropped only once the server confirms the write. The page
  says "not saved — kept locally, retrying" rather than claiming success.

### The trust boundary

The signing address is the identity. `QA_ALLOWLIST` contains addresses only, and the server accepts
state reads and writes only from a valid session for an address that is still on that allowlist. A
tester sets a display name after their first sign-in; the name is a label inside their address-owned
shard and never decides which shard a request may write. If two testers choose the same name, the app
adds shortened addresses to keep their entries distinct.

Sign-in uses an ERC-4361 Sign-In With Ethereum message. The server creates the exact message, binds it
to the request origin and URI, verifies the wallet signature, and stores a 12-hour HMAC-authenticated
session in an `HttpOnly; Secure; SameSite=Lax` cookie. The endpoint rechecks the allowlist on every
request, so removing an address revokes its existing session. Every state-changing request must also
carry the app's exact `Origin`; `SameSite` alone would still admit a compromised sibling subdomain.
Nonces carry an HMAC-authenticated five-minute expiry. After the signature and allowlist checks pass,
the server hashes the nonce and creates a private Blob marker with overwrite disabled. Only the first
request can create that marker, so the same signed challenge cannot mint a second session. If the
marker write fails and the server cannot prove another request already created it, sign-in returns
`503` and does not set a cookie. Markers contain only `used`; wallet addresses, messages, and
signatures are not written there.

This proves control of an allowlisted externally owned account at sign-in. It does not verify a
person's real-world name, support ERC-1271 contract-wallet signatures, protect a compromised wallet or
browser origin, or hide one tester's notes from another allowlisted tester. An allowlisted tester can
read the shared run and change only their own address-owned shard.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole UI — static, inline CSS/JS, no bundler |
| `auth.ts` | SIWE message, nonce, allowlist, cookie, and session verification |
| `api/auth.ts` | `GET` issues a challenge, `POST` consumes it once and creates a session, `DELETE` signs out |
| `api/state.ts` | Authenticated `GET` merges shards; authenticated `POST` merges the caller's delta |
| `build.mjs` | Copies the page and projects the active catalog into `dist/catalog.json` |
| `dev.mjs` | Loopback-only rehearsal server with a local identity bypass and state in `tmp/qa/` |

Case **definitions** come from `scripts/data/qa-test-catalog.json` at build time, so a deployment is
pinned to the catalog revision it shipped with and a case cannot change shape mid-session. Only
active cases ship; retired rows stay in the catalog as an audit trail.

## Run it locally

```bash
node packages/qa/build.mjs && node packages/qa/dev.mjs
```

Serves <http://127.0.0.1:4610> with state in gitignored `tmp/qa/`. It binds only to `127.0.0.1` and
does not use a wallet or the production allowlist. Open `?as=Afo`, `?as=Nansel`, or `?as=Gui` to pin
that browser to a local test identity. The bypass is implemented only by `dev.mjs`; it is not imported
by either deployed function and `dist/` contains only the static page and catalog.

Loopback is a network boundary, not user authentication. Other processes or users on the same
machine can reach the rehearsal server. Keep only disposable local QA state there.

It is not a mid-session fallback. Its state is a separate store — it neither reads the deployed
shards nor pushes back to them — so a session split across both leaves results in two places and
`qa:pull` sees only one of them.

## Required environment

Set these in the Vercel QA project. The CLI reads `BLOB_READ_WRITE_TOKEN` from the process environment
or the repository root `.env`; do not add a package-level `.env`.

| Variable | Requirement |
|---|---|
| `QA_SESSION_SECRET` | A private random value of at least 32 characters. A missing or shorter value makes every auth and state request fail closed with `503`; there is no fallback secret. |
| `QA_ALLOWLIST` | A JSON array of unique Ethereum addresses, for example `["0x1111111111111111111111111111111111111111","0x2222222222222222222222222222222222222222"]`. Names do not belong here. Missing, empty, duplicate, or malformed values admit nobody. |
| `BLOB_READ_WRITE_TOKEN` | Token for the private QA Blob store. State reads/writes and one-shot nonce markers require it; if unavailable, no session is minted. Vercel injects it when the store is connected; `qa:pull` and `qa:status` need it locally. |

## Deploy (one-time setup)

1. **Create a private Blob store** — Vercel → Storage → Create → Blob → access **Private**. Private
   is required: results are internal QA notes and must never be reachable by URL.
2. **Create the project** — import this repo, set **Root Directory** to `packages/qa`, and
   connect the Blob store to it (that injects `BLOB_READ_WRITE_TOKEN` automatically — never set it
   by hand).
3. **Enable "Include source files outside of the Root Directory in the Build Step"** — required, not
   optional. `build.mjs` reads `scripts/data/qa-test-catalog.json` from the repository root, which
   the build sandbox excludes without this, and the deploy fails on a missing catalog. The
   Storybook project needs the same setting for the same reason
   (`docs/docs/builders/testing/storybook.mdx`).
4. **Set wallet authentication environment** — add `QA_SESSION_SECRET` and `QA_ALLOWLIST` as described
   above. Confirm the connected Blob store supplied `BLOB_READ_WRITE_TOKEN`.
5. **Verify** before relying on it: use two allowlisted wallets in two browser profiles, sign in, and
   record a verdict **and** a note on the same case in both. Both marks and both notes must appear. A
   human performs the wallet signatures; automated QA must not sign on their behalf.

## Getting results back into the repo

```bash
bun run qa:pull
```

Reads the shards straight from the Blob store (needs `BLOB_READ_WRITE_TOKEN` in the process environment
or root `.env`) and
writes `tmp/qa-session/<slug>/results.csv` plus `qa-state.json`, the artifacts the `qa-session`
skill closes out with. It reads the store rather than the app, so it needs no browser session and
still works if the deployment is down. Results stay in gitignored `tmp/` —
definitions live in git, results never do. It lists address-keyed shards from the store rather than
copying the deployment allowlist into the repository.

A pull that would land on an existing session **refuses**, because severity, redactions and rows
added by hand live only in the pulled files and never in the store. Pull the refresh somewhere new
with `--out`, or pass `--force` to say the local copy is expendable.

## Deliberately not here yet

Dev-stack/PM2 registration, named per-release runs (storage is keyed so adding them is additive),
ERC-1271 contract-wallet authentication, severity capture in the UI, nonce-marker cleanup, and
screenshot upload.

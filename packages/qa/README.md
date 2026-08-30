# QA app

A deployed checklist where **two people record the same test case at the same time**, each keeping
their own verdict and their own notes.

It exists because the artifact-based checklist could only ever have one writer: the artifact
"editor" role is a Team/Enterprise feature, so a teammate on a shared link is a read-only viewer and
their taps never save. This is the same interface with a store behind it.

## How it stays correct with two writers

Each tester owns exactly one blob — `qa/entries/<person>.json` — and only ever writes that one.
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

Access control is the deployment password, and that is the whole of it. The API takes `person` from
the request body and does not — cannot — prove the caller is that person: Gui is not on the Vercel
team, which is exactly why the deployment is password-protected rather than SSO-gated. Anyone with
the password can write to anyone's shard.

That is acceptable because the password is shared with three teammates recording their own QA
findings, and the failure mode is a misattributed note rather than a leak or a loss. It would not be
acceptable if this app ever held anything that mattered to anyone outside the team, or if the roster
grew past people who trust each other. Treat per-person auth as the prerequisite for either.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole UI — static, inline CSS/JS, no bundler |
| `api/state.ts` | The only function: `GET` merges shards, `POST` merges one tester's delta |
| `build.mjs` | Copies the page and projects the active catalog into `dist/catalog.json` |
| `dev.mjs` | Local server with the same `/api/state` contract, backed by `tmp/qa/` |

Case **definitions** come from `scripts/data/qa-test-catalog.json` at build time, so a deployment is
pinned to the catalog revision it shipped with and a case cannot change shape mid-session. Only
active cases ship; retired rows stay in the catalog as an audit trail.

## Run it locally

```bash
node packages/qa/build.mjs && node packages/qa/dev.mjs
```

Serves <http://127.0.0.1:4610> with state in gitignored `tmp/qa/`. Use it to rehearse a session and
to prove the two-writer behaviour before deploying.

It is not a mid-session fallback. Its state is a separate store — it neither reads the deployed
shards nor pushes back to them — so a session split across both leaves results in two places and
`qa:pull` sees only one of them.

## Deploy (one-time setup)

1. **Create a private Blob store** — Vercel → Storage → Create → Blob → access **Private**. Private
   is required: results are internal QA notes and must never be reachable by URL.
2. **Create the project** — import this repo, set **Root Directory** to `packages/qa`, and
   connect the Blob store to it (that injects `BLOB_READ_WRITE_TOKEN` automatically — never set it
   by hand).
3. **Turn on Password Protection** — Settings → Deployment Protection. It covers `/api/*` too, which
   is what protects the write endpoint. Share the password with whoever is testing.
4. **Verify** before relying on it: open the deployment in two browsers, pick a different name in
   each under *testing as*, and record a verdict **and** a note on the same case in both. Both marks
   and both notes must appear. If they don't, stop and fix it rather than starting a session.

## Getting results back into the repo

```bash
bun run qa:pull
```

Reads the shards straight from the Blob store (needs `BLOB_READ_WRITE_TOKEN` in the root `.env`) and
writes `tmp/qa-session/<slug>/results.csv` plus `qa-state.json`, the artifacts the `qa-session`
skill closes out with. It reads the store rather than the app, so it works while the app is
password-protected and still works if the deployment is down. Results stay in gitignored `tmp/` —
definitions live in git, results never do.

A pull that would land on an existing session **refuses**, because severity, redactions and rows
added by hand live only in the pulled files and never in the store. Pull the refresh somewhere new
with `--out`, or pass `--force` to say the local copy is expendable.

## Deliberately not here yet

Dev-stack/PM2 registration, named per-release runs (storage is keyed so adding them is additive),
per-person authentication (the password authenticates *someone on the team*, and the name you pick
is claimed rather than proven — fine for a small trusted team, worth knowing), severity capture in
the UI, and screenshot upload.

# QA app

A deployed checklist where **two people record the same test case at the same time**, each keeping
their own verdict and their own notes.

It exists because the artifact-based checklist could only ever have one writer: the artifact
"editor" role is a Team/Enterprise feature, so a teammate on a shared link is a read-only viewer and
their taps never save. This is the same interface with a store behind it.

## How it stays correct with two writers

Each tester owns exactly one blob — `qa/entries/<person>.json` — and only ever writes that one.
Two people recording the same case touch **different objects**, so there is no conflict to resolve:
no locking, no compare-and-set, no merge policy, and no way for one tester's work to overwrite
another's. `GET /api/state` reads every shard and merges; the page polls it every four seconds and
adopts only *other* people's entries, so a poll can never roll back what you just typed.

Saves send a **delta**, not the whole shard. That matters when one person has two clients open — a
phone walking the PWA and a laptop on admin — where a whole-shard write would let the stale client
erase the other's work.

Two details that look like bugs if you get them wrong, and are handled here:

- Private blob reads are CDN-cached for up to 60s. Every read passes `useCache: false`, and writes
  set `cacheControlMaxAge: 0` — otherwise your partner's entries appear to never arrive.
- Every keystroke lands in `sessionStorage` before any network call, so a reload, a crash, or a
  failed save never costs anyone their notes. The page says "not saved — kept locally, retrying"
  rather than claiming success.

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

Serves <http://127.0.0.1:4610> with state in gitignored `tmp/qa/`. This is also the fallback if
the deployment is unavailable mid-session.

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

## Deliberately not here yet

Dev-stack/PM2 registration, named per-release runs (storage is keyed so adding them is additive),
per-person authentication (the password authenticates *someone on the team*, and the name you pick
is claimed rather than proven — fine for a small trusted team, worth knowing), severity capture in
the UI, and screenshot upload.

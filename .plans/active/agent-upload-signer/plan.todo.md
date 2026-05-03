# Agent Upload Signer Plan

**Feature Slug**: `agent-upload-signer`
**Stage**: `active`
**Status**: `DONE`
**Created**: `2026-04-25T18:43:29.436Z`
**Last Updated**: `2026-05-03`

> Promoted to active on 2026-04-27 as non-product security/ops hardening: remove browser upload dependence on long-lived Pinata authority while keeping direct browser-to-Pinata uploads.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep `packages/agent` named as-is | It already owns the Hono health, webhook, and `/api/*` routes; a rename would be broad churn. |
| 2 | Use Pinata signed upload URLs | Keeps the JWT server-side while letting browsers upload directly to Pinata. |
| 3 | Use limited-public v1 protections | Fastest simple path: CORS, short TTL, MIME/size limits, and IP rate limiting. |
| 4 | Skip Vercel and Envio work | This hub is only about upload authority and browser upload wiring. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Add signer endpoint in the agent Hono API | `state_api` | Implement `POST /api/uploads/sign` with Pinata signing and request validation | Done |
| Remove browser dependence on `VITE_PINATA_JWT` | `state_api` | Rewire shared IPFS upload helpers to use `${VITE_API_BASE_URL}/api/uploads/sign` | Done |
| Preserve server/script uploads | `state_api` | Keep `PINATA_JWT` support for scripts and non-browser runtime paths | Done |
| Record no UI or contract work | `ui`, `contracts` | Mark lanes `n/a` in `status.json` | Done |

## Lane Checklists

### State / API (`codex/state-api/agent-upload-signer`)

- [x] Add agent config for `PINATA_JWT`, `AGENT_ALLOWED_ORIGINS`, signer TTL, max size, MIME allowlist, and rate limit defaults.
- [x] Add Pinata signer helper that calls `https://uploads.pinata.cloud/v3/files/sign`.
- [x] Add `POST /api/uploads/sign` with validation, CORS enforcement, IP rate limiting, and generic errors.
- [x] Update shared IPFS upload flow to request a signed URL, upload direct to Pinata, and return `{ cid }`.
- [x] Remove browser upload reliance on `VITE_PINATA_JWT` while keeping `VITE_PINATA_GATEWAY_URL`.
- [x] Update `.env.schema`, Vite env typings, doctor/docs, and package docs for the new upload authority boundary.
- [x] Add targeted tests for signer success/failure, validation, rate limiting, direct upload parsing, and missing config.
- [x] Write `handoffs/codex-state-api.md`.

### QA Pass 1 (`claude/qa-pass-1/agent-upload-signer`)

- [x] Verified upload-capable flow routing from client/admin surfaces through shared work submission and IPFS helpers.
- [x] Confirmed no new user-facing copy was introduced by this QA pass; no UI lane was planned or implemented.
- [x] Recorded QA result and proof limit in `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/agent-upload-signer`)

- [x] Ran after QA pass 1 in this user-directed session; original branch trigger was absent locally and recorded as a process deviation.
- [x] Re-ran targeted agent/shared validation.
- [x] Confirmed `VITE_PINATA_JWT` is not required for browser uploads and stale-secret warning is emitted by the upload doctor.
- [x] Wrote `handoffs/codex-qa-pass-2.md`.

## Closeout

- Closed on 2026-05-03 after state/API was marked completed with proof-limit validation.
- `ui` and `contracts` remain `n/a`.
- `qa_pass_1` and `qa_pass_2` were run on 2026-05-03 after explicit user request.
- Live upload proof was run on 2026-05-03 after allowing Varlock to resolve `PINATA_JWT` from 1Password outside the sandbox.
- The live in-process Hono signer route returned 200, the signed Pinata upload returned 200, and the gateway returned 200 for CID `bafkreiga3mw4kc4vljuxurbno4nn5dc652dglkjigfdcp3knzoao5wlefi`.
- `status.json` is terminal with `workflow.overall_status = "done"`.

## Validation

- [x] `cd packages/agent && bun run test src/__tests__/upload-signer.test.ts`
- [x] `cd packages/agent && bun run lint`
- [x] `cd packages/agent && bun run typecheck`
- [x] `cd packages/shared && bun run test -- src/__tests__/modules/ipfs.module.test.ts`
- [x] `cd packages/shared && bun run test -- src/__tests__/modules/wallet-submission.test.ts`
- [x] `VITE_PINATA_JWT=stale-token node scripts/dev/doctor.js --profile upload --json` — expected nonzero; proves stale public Pinata secret warning.
- [x] `node scripts/harness/plan-hub.mjs validate`
- [x] `node scripts/dev/ci-local.js --quick` — passed with network permission after the sandboxed run hit Bun managed Node DNS failures.

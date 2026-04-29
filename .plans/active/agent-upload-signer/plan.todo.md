# Agent Upload Signer Plan

**Feature Slug**: `agent-upload-signer`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-04-25T18:43:29.436Z`
**Last Updated**: `2026-04-29`

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

- [ ] Verify upload-capable user flows from client/admin surfaces.
- [ ] Confirm no new user-facing copy bypasses i18n.
- [ ] Record any UX, documentation, or release-readiness gaps in `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/agent-upload-signer`)

- [ ] Confirm `qa_pass_1` is passed and branch trigger exists.
- [ ] Re-run targeted agent/shared validation.
- [ ] Confirm `VITE_PINATA_JWT` is not required for browser uploads.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- [x] `cd packages/agent && bun run test src/__tests__/upload-signer.test.ts`
- [x] `cd packages/agent && bun run lint`
- [x] `cd packages/agent && bun run typecheck`
- [x] `cd packages/shared && bun run test -- src/__tests__/modules/ipfs.module.test.ts`
- [x] `cd packages/shared && bun run test -- src/__tests__/modules/wallet-submission.test.ts`
- [x] `VITE_PINATA_JWT=stale-token node scripts/dev/doctor.js --profile upload --json` — expected nonzero; proves stale public Pinata secret warning.
- [x] `node scripts/harness/plan-hub.mjs validate`
- [x] `node scripts/dev/ci-local.js --quick` — passed with network permission after the sandboxed run hit Bun managed Node DNS failures.

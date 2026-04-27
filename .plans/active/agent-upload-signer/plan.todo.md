# Agent Upload Signer Plan

**Feature Slug**: `agent-upload-signer`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-04-25T18:43:29.436Z`
**Last Updated**: `2026-04-27`

> Promoted to active on 2026-04-27 as non-product security/ops hardening: remove browser upload dependence on long-lived Pinata authority while keeping direct browser-to-Pinata uploads.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep `packages/agent` named as-is | It already owns Fastify health, webhook, and `/api/*` routes; a rename would be broad churn. |
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
| Add signer endpoint in the agent Fastify API | `state_api` | Implement `POST /api/uploads/sign` with Pinata signing and request validation | Not started |
| Remove browser dependence on `VITE_PINATA_JWT` | `state_api` | Rewire shared IPFS upload helpers to use `${VITE_API_BASE_URL}/api/uploads/sign` | Not started |
| Preserve server/script uploads | `state_api` | Keep `PINATA_JWT` support for scripts and non-browser runtime paths | Not started |
| Record no UI or contract work | `ui`, `contracts` | Mark lanes `n/a` in `status.json` | Done |

## Lane Checklists

### State / API (`codex/state-api/agent-upload-signer`)

- [ ] Add agent config for `PINATA_JWT`, `AGENT_ALLOWED_ORIGINS`, signer TTL, max size, MIME allowlist, and rate limit defaults.
- [ ] Add Pinata signer helper that calls `https://uploads.pinata.cloud/v3/files/sign`.
- [ ] Add `POST /api/uploads/sign` with validation, CORS enforcement, IP rate limiting, and generic errors.
- [ ] Update shared IPFS upload flow to request a signed URL, upload direct to Pinata, and return `{ cid }`.
- [ ] Remove browser upload reliance on `VITE_PINATA_JWT` while keeping `VITE_PINATA_GATEWAY_URL`.
- [ ] Update `.env.schema`, Vite env typings, doctor/docs, and package docs for the new upload authority boundary.
- [ ] Add targeted tests for signer success/failure, validation, rate limiting, direct upload parsing, and missing config.
- [ ] Write `handoffs/codex-state-api.md`.

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

- [ ] `cd packages/agent && bun run test && bun run typecheck`
- [ ] `cd packages/shared && bun run test -- src/__tests__/modules/ipfs.module.test.ts`
- [ ] `node scripts/dev/ci-local.js --quick` if env/docs/shared API changes ripple beyond targeted tests

# Agent Upload Signer Evaluation Plan

## Release Gates

1. Correctness: browser upload helpers still return `{ cid }` for file and JSON uploads.
2. Security: `VITE_PINATA_JWT` is not required or consumed by browser upload paths.
3. Regression safety: existing server/script Pinata upload paths still work with server-only `PINATA_JWT`.
4. Evidence quality: tests cover signer validation, missing config, rate limiting, and Pinata response parsing.
5. Human judgment: any move beyond limited-public signing is recorded before implementation expands scope.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `POST /api/uploads/sign` returns a constrained signed URL when agent config is valid | `state_api` | Agent API unit test |
| AC-2 | Signer rejects missing JWT, invalid MIME, oversized files, invalid filenames, and rate-limit overflow | `state_api` | Agent API unit tests |
| AC-3 | Browser upload helpers request a signed URL, upload directly to Pinata, parse `data.cid`, and preserve `{ cid }` | `state_api` | Shared IPFS tests |
| AC-4 | Browser env/docs no longer require `VITE_PINATA_JWT`; `VITE_PINATA_GATEWAY_URL` remains public read config | `state_api` | Env/doc diff plus plan-hub validation |
| AC-5 | Existing script/server Pinata upload flows remain documented as `PINATA_JWT` consumers | `qa_pass_2` | Targeted grep and docs review |

## Test Strategy

- Unit: agent signer helper, Fastify route injection tests, shared IPFS upload helpers.
- Integration: mocked Pinata signed URL creation and mocked direct upload response.
- E2E / Playwright: optional after implementation if a live upload-capable surface needs manual proof.
- Manual checks: verify deployed agent has `PINATA_JWT`, `AGENT_ALLOWED_ORIGINS`, and production app origins configured before release.

## QA Sequence

### Claude QA Pass 1

- Focus on upload-capable user flows, missing requirements, and user-facing failure behavior.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/agent-upload-signer`.
- Re-run targeted validation and confirm no browser-facing Pinata JWT remains in the upload path.

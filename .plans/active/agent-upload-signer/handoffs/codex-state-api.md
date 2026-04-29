# Codex state_api handoff

Date: 2026-04-29T05:33:38Z
Branch observed: develop
Lane: state_api

## Summary

Implemented the server-side browser upload signing lane against the current Hono-based agent API. Browser/shared upload code now requests a short-lived Pinata signed upload URL from the agent and uploads directly to Pinata without reading `VITE_PINATA_JWT`. Server and script upload paths still support `PINATA_JWT` for non-browser callers.

## Changed files

- Agent API and config:
  - `packages/agent/src/api/server.ts`
  - `packages/agent/src/api/public-protection.ts`
  - `packages/agent/src/services/pinata-upload-signer.ts`
  - `packages/agent/src/config.ts`
  - `packages/agent/src/env.d.ts`
  - `packages/agent/src/index.ts`
  - `packages/agent/src/__tests__/upload-signer.test.ts`
- Shared upload contract and implementation:
  - `packages/shared/src/public-contracts/index.ts`
  - `packages/shared/src/modules/data/ipfs/client.ts`
  - `packages/shared/src/modules/data/ipfs/pinata.ts`
  - `packages/shared/src/modules/data/ipfs/upload.ts`
  - `packages/shared/src/__tests__/modules/ipfs.module.test.ts`
- Browser env typing/config:
  - `packages/client/src/config.ts`
  - `packages/client/src/vite-env.d.ts`
  - `packages/admin/src/vite-env.d.ts`
  - `packages/shared/src/vite-env.d.ts`
  - `.env.schema`
  - `env.d.ts`
- Docs and ops helpers:
  - `.plans/active/agent-upload-signer/plan.todo.md`
  - `.plans/active/agent-upload-signer/status.json`
  - `.plans/active/agent-upload-signer/handoffs/codex-state-api.md`
  - `packages/agent/README.md`
  - `packages/client/README.md`
  - `docs/docs/builders/deployments/agent-deploy.mdx`
  - `docs/docs/builders/packages/agent.mdx`
  - `docs/docs/builders/getting-started.mdx`
  - `scripts/dev/doctor.js`
  - `scripts/lib/ipfs-hybrid.ts`
  - `scripts/ops/ipfs-repin.ts`
  - `scripts/ops/upload-action-images.ts`

## Implementation notes

- Added `POST /api/uploads/sign` and matching `OPTIONS` handling through the existing Hono server.
- The route is a limited public endpoint: it requires an allowed request origin, emits CORS headers only for allowed origins, applies the existing in-memory public route rate limiter, validates JSON body size, validates filename/category/garden address shape, enforces a MIME allowlist, clamps TTL, and enforces a max file size.
- The Pinata signer uses `PINATA_JWT` server-side and calls the v3 signed upload URL flow with filename, expiry, max file size, allowed MIME types, and upload metadata.
- Shared IPFS upload now prefers the agent signed-url flow when `VITE_API_BASE_URL` is present. If no signer URL exists, server/script callers can still use direct `PINATA_JWT`.
- Browser env surfaces no longer include `VITE_PINATA_JWT` or `VITE_PINATA_API_URL`; `VITE_PINATA_GATEWAY_URL` remains public for reads.
- Follow-up review fixes make the upload signer fail closed when no allowed origins are configured, require allowed origins in production config validation, flag stale `VITE_PINATA_JWT` through the upload doctor, remove legacy script/doc references to public Pinata JWTs, and clean stale router wording from this plan.

## Validation

- Passed: `cd packages/agent && bun run test src/__tests__/upload-signer.test.ts`
- Passed: `cd packages/agent && bun run test`
- Passed: `cd packages/agent && bun run lint`
- Passed: `cd packages/agent && bun run typecheck`
- Passed: `cd packages/shared && bun run test -- src/__tests__/modules/ipfs.module.test.ts`
  - Sandbox note: the first sandboxed attempts failed with `ENOTFOUND registry.npmjs.org` while Bun tried to fetch its managed `node` package. The escalated rerun completed and passed.
- Passed: `cd packages/shared && bun run test -- src/__tests__/modules/wallet-submission.test.ts`
  - Sandbox note: the first sandboxed attempt hit the same managed Node DNS failure. The escalated rerun completed and passed.
- Passed: `cd packages/shared && bun run typecheck`
- Passed: `bunx @biomejs/biome format packages/client/src/__tests__/views/ENSSection.test.tsx packages/shared/src/hooks/admin-ui/navigation/sheetRegistry.ts packages/shared/src/utils/blockchain/contracts.ts packages/shared/src/__tests__/modules/wallet-submission.test.ts`
- Passed with expected failure summary: `VITE_PINATA_JWT=stale-token node scripts/dev/doctor.js --profile upload --json`
  - The command exited nonzero because upload QA is not fully configured locally, and it included the intended `env:pinata-browser-secret` failure for stale public Pinata JWTs.
- Passed: `node scripts/harness/plan-hub.mjs validate`
- Passed: `node scripts/dev/ci-local.js --quick`
  - The first sandboxed run failed shared/client/admin test steps on `ENOTFOUND registry.npmjs.org` while Bun tried to resolve its managed Node runtime.
  - The escalated rerun passed format, lint, shared and agent typecheck, shared tests, client tests, admin hub tests, and agent tests.

## Remaining blockers and proof limits

- No live Pinata upload was executed in this lane; Pinata signing and upload response parsing are covered by focused mocked tests.
- Production deploys must provide root `.env` values for `PINATA_JWT`, `AGENT_ALLOWED_ORIGINS` or `AGENT_PUBLIC_ALLOWED_ORIGINS`, and browser `VITE_API_BASE_URL`.
- The repo still has unrelated dirty files and archived-plan deletions that predate this lane; they were not touched or normalized here.
- `node scripts/dev/ci-local.js --quick` passed only after network permission because sandbox DNS blocked Bun's managed Node resolution.

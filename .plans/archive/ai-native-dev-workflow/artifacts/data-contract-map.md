# Data Contract Map

Use this when a feature touches schemas, public contracts, persistent stores, generated artifacts, shared domain types, or API request/response shapes.

## Template

| Field | Entry |
|---|---|
| Feature |  |
| Contract boundary | contracts / indexer / EAS / shared public contract / agent store / IndexedDB / API |
| Source of truth |  |
| Runtime validator |  |
| Type export |  |
| Writers |  |
| Readers |  |
| Generated artifacts |  |
| Migration/backfill needed | yes / no + reason |
| Privacy/security notes |  |
| Proof commands |  |

If no map is needed, record `N/A` in the checklist with a reason.

## Current Pilot: Upload Signing

| Field | Entry |
|---|---|
| Feature | `agent-max-readiness` upload-signing validation pilot |
| Contract boundary | Shared public contract consumed by the agent API |
| Source of truth | `packages/shared/src/public-contracts/index.ts`; `packages/shared/src/public-contracts/upload-signing.ts` |
| Runtime validator | `validatePublicUploadSignRequest(body, config)` |
| Type export | `PublicUploadSignRequest`, `PublicUploadSignResponse`, `PublicUploadSignValidationConfig`, `PublicUploadSignValidationResult` |
| Writers | Browser clients posting to `PUBLIC_AGENT_ROUTES.uploadSign` |
| Readers | `packages/agent/src/api/server.ts`; `packages/agent/src/services/pinata-upload-signer.ts` |
| Generated artifacts | none |
| Migration/backfill needed | no: this is request validation only and does not persist data |
| Privacy/security notes | Keeps origin checks, MIME/size limits, short TTLs, rate limits, generic provider errors, and injected address validation in the agent boundary. |
| Proof commands | `bun run test:shared`; `bun run test:agent`; `bun run build:agent` |

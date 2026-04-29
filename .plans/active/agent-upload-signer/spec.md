# Agent Upload Signer Spec

## Summary

Move browser uploads from direct Pinata JWT usage to agent-signed Pinata upload URLs. The existing `packages/agent` Hono service becomes the minimal API surface for signing upload URLs, while client/admin/shared upload callers keep the current CID-oriented behavior.

## Users

- Primary: Green Goods client and admin users uploading work media, assessment evidence, action media, review notes, and metadata JSON.
- Secondary: maintainers operating Pinata credentials, agent deploys, and upload-capable QA.

## Functional Requirements

1. Add `POST /api/uploads/sign` to `packages/agent` using server-only `PINATA_JWT`.
2. Sign Pinata URLs through `POST https://uploads.pinata.cloud/v3/files/sign`, not by proxying browser file bytes.
3. Accept request body:

   ```ts
   {
     filename: string;
     mimeType: string;
     size: number;
     source?: string;
     category?: "file_upload" | "json_upload";
     gardenAddress?: string;
   }
   ```

4. Return response body:

   ```ts
   {
     url: string;
     expiresAt: number;
     maxFileSize: number;
     allowedMimeTypes: string[];
   }
   ```

5. Protect v1 as a limited-public signer:
   - CORS allowlist from `AGENT_ALLOWED_ORIGINS`
   - IP-based rate limit, default `20` sign requests per minute
   - signed URL TTL default `60s`
   - max file size default `10MB`
   - allowed MIME defaults: `image/*`, `audio/*`, `video/mp4`, `video/webm`, `video/quicktime`, `application/json`, `application/pdf`
6. Update shared upload helpers so browser callers request a signed URL from `${VITE_API_BASE_URL}/api/uploads/sign`, upload directly to Pinata, parse `data.cid`, and keep returning `{ cid }`.
7. Preserve existing server/script upload flows that use `PINATA_JWT` without requiring browser env.

## Research Evidence

- Existing pattern references:
  - `packages/agent/src/api/server.ts` already hosts Hono health, webhook, and `/api/*` routes.
  - `packages/agent/src/config.ts` centralizes agent environment configuration.
  - `packages/shared/src/modules/data/ipfs/upload.ts` owns public `uploadFileToIPFS` and `uploadJSONToIPFS`.
  - `packages/shared/src/modules/data/ipfs/pinata.ts` handles Pinata upload responses and CID parsing.
  - `.env.schema` now documents the server-only `PINATA_JWT` boundary and the public `VITE_PINATA_GATEWAY_URL`/`VITE_API_BASE_URL` browser boundary.
- External API reference:
  - Pinata signed upload URLs: `https://docs.pinata.cloud/api-reference/endpoint/create-signed-upload-url`
  - Pinata client-side uploads: `https://docs.pinata.cloud/files/uploading-files`
- Evidence confirmed:
  - Agent package already has Hono and an API namespace.
  - Client/admin already use `VITE_API_BASE_URL` as a browser API base.
  - Upload callers depend on the shared `{ cid }` result shape.
- Open assumptions:
  - Production deploy can set `PINATA_JWT` and `AGENT_ALLOWED_ORIGINS` on the existing agent host.
  - Limited-public v1 is acceptable before wallet or passkey proof is added.

## Human Judgment Points

- If public upload abuse appears, upgrade to wallet/passkey-aware signing instead of broadening direct backend file proxying.
- If `packages/agent` grows beyond bot/webhook/API duties, revisit package naming later as a separate repo-wide refactor.
- Maintainers should choose production origin values before release.

## Non-Functional Constraints

- Package boundaries: endpoint lives in `packages/agent`; browser upload helpers remain in `@green-goods/shared`; no new package.
- Performance: browser uploads go directly to Pinata; the agent signs only metadata.
- Security: no Pinata JWT in browser; signed URLs are short-lived and constrained by size and MIME type.
- Offline / sync: do not redesign job queue behavior in this hub; failed uploads should continue through existing upload error paths.
- Localization: no new user-facing copy is expected beyond existing upload error surfaces; add `en`, `es`, and `pt` strings only if implementation introduces new UI copy.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | `n/a`; no UI work planned |
| State / API | `state_api` | Agent endpoint, shared upload wiring, env/docs/tests |
| Contracts | `contracts` | `n/a`; no contract changes |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential after state/API implementation |

## Risks

- Risk: limited-public signing can still be scripted by arbitrary callers.
- Mitigation: short TTL, size/MIME limits, origin allowlist, IP rate limits, and future wallet/passkey proof if abuse appears.
- Risk: browser upload flow may drift from existing direct Pinata response parsing.
- Mitigation: keep the existing `{ cid }` contract and add targeted unit tests around response parsing and failures.

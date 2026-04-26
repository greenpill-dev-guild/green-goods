# Agent Upload Signer

**Slug**: `agent-upload-signer`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-04-25T18:43:29.436Z`

## Problem

Browser-facing Green Goods upload code currently depends on `VITE_PINATA_JWT`, which exposes Pinata upload authority anywhere the client or admin app runs. A scoped Pinata key reduces blast radius, but it is still not safe to ship in browser bundles.

## Desired Outcome

- Browser uploads request a short-lived Pinata signed upload URL from the existing agent service.
- Files upload directly from the browser to Pinata, so the agent does not proxy file bytes.
- Public IPFS reads keep using the configured Pinata gateway.
- Server-side scripts and deployment tooling keep using server-only `PINATA_JWT`.

## Scope Notes

- In scope: `packages/agent` Fastify signer endpoint, shared IPFS upload wiring, env/docs cleanup, targeted tests, and rate/CORS guardrails.
- Out of scope: Vercel migration, Envio hosting changes, renaming `packages/agent`, wallet-signature auth, direct backend file proxying, and new packages.

## Success Signal

`VITE_PINATA_JWT` is no longer required or consumed by browser upload paths, while uploads still return the same `{ cid }` shape through `uploadFileToIPFS` and `uploadJSONToIPFS`.

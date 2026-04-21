# External Data Partnerships Evaluation Plan

## Release Gates

1. **Correctness:** Sylvie and locale.network adapters each produce ≥1 normalized partner response per configured pilot-garden submission; `attestationWriter.ts` creates an `ExternalVerification` EAS attestation with confidence bps + IPFS CID + observedAt; admin renders partner badges in `WorkReview` pulled directly from EAS.
2. **Observability:** On-submission trigger latency < 30s p95; periodic poller cron log entry per run; partner API failure flips badge to red (not silent) and logs `logger.error` from `@green-goods/shared`.
3. **Regression safety:** No indexer schema change (EAS attestations stay un-indexed per `CLAUDE.md` indexer boundary); existing admin `WorkReview` flow continues to render when EAS returns zero attestations.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `PartnerAdapter` interface is adhered to by `sylvie.ts` + `locale.ts`; normalized response shape matches `ExternalVerification` EAS schema fields | `state_api` | `packages/agent/src/partners/__tests__/{sylvie,locale}.test.ts` green; shape enforced at compile time |
| AC-2 | `attestationWriter.ts` creates EAS attestations signed by the Green Goods trusted attester address only (never partner-signed) | `state_api` | Attester address match in EAS block-explorer read; unit tests asserting signer identity |
| AC-3 | `api/verification.ts` on-submission trigger resolves within 30s p95 or queues to poller fallback | `state_api` | Integration test with fake partner latency; `artifacts/` log snippet |
| AC-4 | `services/partnerPoller.ts` runs per configured garden on schedule and is idempotent (no duplicate attestation for same submission) | `state_api` | Poller unit test; EAS attestation count per submission ≤ 1 per partner |
| AC-5 | `useWorkAttestations(submissionId)` in `@green-goods/shared` returns partner badges via direct EAS query (no Envio touch) | `state_api` | Hook unit test; `grep` confirms no indexer module touched |
| AC-6 | `VerificationBadges.tsx` renders green (≥ 8000 bps) / yellow (5000–7999) / red (< 5000 or partner error) per spec thresholds | `ui` | Admin Storybook story + Chrome MCP spot-check in WorkReview context |
| AC-7 | ≥1 `ExternalVerification` attestation per partner per week in one Season One pilot garden for a 2-week rolling window | `qa_pass_1` | `gh api` / Arbiscan read of attester's EAS write volume; `history[]` entry citing tx hashes |
| AC-8 | Outcome milestone #15 reached 2026-06-30 | `qa_pass_2` | Milestone closed with evidence link to dashboard + pilot garden operator confirmation |

## Test Strategy

- Unit: `PartnerAdapter` conformance, Sylvie + locale.network normalizers, `attestationWriter.ts` signer identity, `partnerPoller.ts` idempotency.
- Integration: Fastify on-submission endpoint against faked partner APIs (latency, error, empty-response); EAS write against Sepolia fork.
- E2E / Playwright: admin `WorkReview` surface renders correct badge color for each attestation tier; fallback to red on missing attestation within timeout.
- Manual checks:
  - Sylvie API credentials live in `.env.schema` with `SYLVIE_API_KEY` + rate-limit budget confirmed.
  - locale.network API credentials live in `.env.schema` with `LOCALE_API_KEY` + per-garden region coverage confirmed.
  - Trusted attester address funded on Arbitrum for attestation gas.

## QA Sequence

### Claude QA Pass 1

- Run admin Storybook + Chrome MCP to visually verify `VerificationBadges` across 3 tiers + error state.
- Validate i18n keys for badge tooltips (no raw strings).
- Record per-partner attestation cadence from pilot garden over 1-week window.
- If blocked by partner API outages, record in `handoffs/claude-qa-pass-1.md` and downgrade to red-only state.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed and `claude/qa-pass-1/external-data-partnerships` exists.
- Re-run poller idempotency tests under simulated duplicate submission volley.
- Verify indexer boundary: grep proves no Envio schema touches partner data.
- Confirm outcome milestone evidence links before closing #15.

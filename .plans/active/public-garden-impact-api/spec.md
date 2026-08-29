# Public Garden Impact API Spec

## Summary

Add `GET /public/gardens/:chainId/:gardenAddress/impact` as a read-only public aggregation boundary.
The shared package owns the versioned response contract and source semantics. The Agent owns HTTP
validation, wildcard route CORS, rate limiting, caching, and safe error mapping.

## Users

- Primary: public Green Goods web surfaces and partner integrations.
- Secondary: maintainers and funders who need a stable, privacy-preserving garden impact summary.

## Functional Requirements

1. Return garden identity, nullable source-aware counts, domain/action breakdowns, approved recent
   work, latest known activity, and provenance in `PublicGardenImpactResponseV1`.
2. Treat any positive nonrevoked Work Approval as protocol approval; deduplicate Work and Approval
   UIDs and use the newest positive approval timestamp.
3. Count deduplicated Hypercerts only in active, claimed, or sold states.
4. Support only Arbitrum and Sepolia through a no-fallback chain predicate. Keep Celo rejected until
   the public indexer covers its Garden, Action, and Hypercert sources.
5. Keep missing schemas and individual source failures explicit through nullable dependent fields
   and partial provenance; return 503 only when Garden resolution is unsafe or all primary impact
   sources are unusable.
6. Expose GET/OPTIONS with route-only wildcard CORS, 120 requests per 10 minutes, and a bounded
   five-minute per-server LRU cache.
7. Never return gardener, steward, evaluator, assessor, or other wallet-role identities.

## Research Evidence

- Existing patterns: dependency-light contracts under `public-contracts`, injected Hono route
  dependencies, `checkRateLimit`, `jsonNoStore`, `GQLClient`, and Plan Hub RED/GREEN receipts.
- Reviewed: blockchain deployments/config, EAS parsing/readers, Envio Garden/Action/Hypercert
  schemas and handlers, public garden visibility, current public API routes, and builder docs.
- Confirmed against the official EAS GraphQL documentation and checked-in schema types: supported
  chains expose chain-specific endpoints, and Attestation queries support bounded ordering and
  pagination without a client-side fallback.
- Confirmed: indexer Garden IDs are bare normalized addresses and can collide across chains, so
  Garden identity resolves from the chain-qualified token-bound account instead. Action IDs are
  `${chainId}-${actionUID}`; current Approval records cannot be joined reliably by recipient or
  `refUID`; Celo lacks Approval and Assessment schema UIDs plus public Garden, Action, and Hypercert
  indexer coverage.
- Assumption: page each source in stable order with 100-record pages and fail the source closed when
  more than 1,000 records are detected.

## Human Judgment Points

- Locked decisions: approval is the protocol flag only; missing schemas are partial/null; unknown
  Hypercert states do not count.
- Sensitive surfaces: Agent route behavior, public response types, provider failure handling,
  source caps, rate limiting, and cache isolation.
- Review tradeoff: approval counts describe protocol state; they do not assess submission quality
  or independently validate supporting material.

## Non-Functional Constraints

- Package boundaries: aggregation and readers in Shared; HTTP behavior in Agent; no deep imports.
- Performance: maximum 1,000 rows per source, five-minute cache, 100-garden LRU, in-flight load
  coalescing, and a cached canonical 12-item recent-work list.
- Security/privacy: validate chain/address/query inputs, apply rate limits to cache hits, return
  generic provider errors, and omit actor identities.
- Offline/sync: not applicable; this is a public network API.
- Localization: not applicable; no UI copy or localized response content.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Not applicable; no rendered behavior |
| State / API | `state_api` | Shared contract/readers/aggregation and Agent endpoint |
| Contracts | `contracts` | Not applicable; no Solidity, ABI, or deployment work |
| QA | `qa_pass_1`, `qa_pass_2` | Targeted Shared/Agent proof, then repository checkpoint |

## Risks

- Silent source truncation could undercount impact. Mitigation: detect the 1,001st row and mark the
  source unavailable.
- Historical Approval recipients vary. Mitigation: page the schema, then join by exact Work UID.
- Celo's absent indexer sources could look like zero impact. Mitigation: reject Celo until those
  sources exist instead of advertising an incomplete chain.
- Cache or CORS changes could weaken protected routes. Mitigation: route-local wildcard headers and
  regression coverage proving protected CORS is unchanged.

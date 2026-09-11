# Community Needs & Signals Evaluation

## Readiness gate

The plan is ready for a lane only when that lane’s named dependencies and research or operations gates in [status.json](status.json) are satisfied. A parent Linear tracker does not override those gates.

## Completion evidence

- Contract, indexer, shared/state, UI, docs, and QA handoffs contain their named RED/GREEN or proof-limit evidence.
- Cross-package identifiers, moderation rules, and funding attribution agree with [spec.md](spec.md).
- Deployment proof shows four exact schema records routed to exactly two resolver proxies, with unknown schema branches failing closed and all configured UIDs non-zero and pairwise distinct within each resolver.
- Resolver proof covers root zero `refUID`, child exact-Need `refUID`, same-recipient checks, revoked/expired/wrong-schema parents, per-attestation revocability, and v1 non-expiration.
- Reader proof normalizes garden from `recipient` and child Need UID from `refUID`; no custom-data duplicate becomes an independent source of truth.
- Directional-signal proof covers support, non-support, both switch directions, same-timestamp unsigned UID ties, revoked/expired winner without fallback, clear, and separate counts without a net score.
- Queue proof shows pending signal intents coalesce by chain/garden/Need/attester and that an older direction cannot flush after a newer one.
- Parent-Need revocation proof shows active descendants disappear from active state without deleting immutable provenance or exposing withdrawn Need content.
- Community and admin flows pass their focused tests and package builds.
- Authenticated Brave or real-device proof covers profile-dependent UI paths.
- Pilot and operator-readiness evidence closes the research gates without assuming membership persistence policy.

## Non-goals

This evaluation does not treat implementation as started or complete. Current lane state remains authoritative in [status.json](status.json).

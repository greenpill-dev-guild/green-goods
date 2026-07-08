# Monolith Decomposition Spec

## Summary

Track structure-only decomposition of oversized Green Goods agent/admin files without behavior changes. This backlog hub is the repo-side mirror for PRD-563 and its child decomposition issues.

## Users

- Primary: maintainers reviewing agent/admin changes.
- Secondary: contributors picking up future decomposition slices.

## Functional Requirements

1. Preserve public APIs, exported facades, and route paths.
2. Split only one accepted slice at a time when activated.
3. Keep parked CampaignCookieJar work out of active execution until the Seasons reframe is settled.

## Research Evidence

- Existing pattern reference: Hub view component extraction noted in `brief.md`.
- Linear mirrors: PRD-563 parent, PRD-566 agent DB slice, PRD-574 agent server slice, PRD-565 parked admin cookie-jar slice.
- Evidence confirmed: this cleanup formalizes backlog tracking only; no decomposition code is included.
- Open inferences or assumptions: exact file sizes should be rechecked before each slice starts.

## Human Judgment Points

- Decide when to activate PRD-566 or PRD-574.
- Keep PRD-565 parked until the Seasons/campaign-cookie-jar roadmap call resolves.
- Treat `packages/agent/src/api/server.ts` as higher risk because it is a live public API surface.

## Non-Functional Constraints

- Package boundaries: agent slices stay under `packages/agent`; parked admin slice stays under `packages/admin`.
- Performance: no runtime behavior change is expected from structure-only extraction.
- Security: preserve auth, rate-limit, body-limit, CORS, and funding validation behavior byte-for-byte where possible.
- Offline / sync: not applicable.
- Localization: not applicable unless future admin UI copy changes.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Parked admin Cookie Jar extraction only |
| State / API | `state_api` | Agent DB and server decomposition |
| Contracts | `contracts` | `n/a` |
| QA | `qa_pass_1`, `qa_pass_2` | Run after a slice is implemented |

## Risks

- Risk: moving API helpers changes middleware or route behavior.
- Mitigation: keep facade exports and route composition stable, then run `bun run build:agent` and `bun run test:agent`.

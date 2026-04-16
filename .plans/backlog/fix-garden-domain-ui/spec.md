# Fix Garden Domain UI & Data Issues Spec

## Summary

This backlog item repairs a small but high-friction admin flow around garden domains. It fixes shared data normalization for domain masks, ensures the domain section remains visible when empty, gives operators a direct path back to domain configuration from Submit Work, and surfaces the empty-domain condition in the garden overview alerts.

## Users

- Primary: garden operators trying to configure or repair domains
- Secondary: reviewers or managers who need to understand why no work actions are available

## Functional Requirements

1. Normalize the domain lookup in `getGardens()` by lowercasing the garden ID at lookup time only.
2. Always render the domain section in garden detail; when no domains exist, managers see an edit CTA and read-only users see an explicit empty label.
3. Make the Submit Work empty state actionable by linking back to the garden detail surface used for domain configuration.
4. Add a derived overview alert when a garden has no configured domains.
5. Add any new strings to `en`, `es`, and `pt`.

## Non-Functional Constraints

- Package boundaries: changes stay in `packages/shared` and `packages/admin`
- Data model: do not normalize IDs in the indexer or alter the on-chain schema
- Routing: reuse the existing garden detail and domain editor flow; no deep-linked modal route
- Contracts: none
- Localization: all new strings must be translated in the three active locales

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Garden detail empty state and submit-work CTA | `ui` | Admin-facing UI work |
| Domain lookup normalization and overview alert | `state_api` | Shared data + derived state |
| Contracts | `contracts` | `n/a` |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential regression checks |

## Risks

- A broader indexer mismatch may exist beyond case sensitivity; keep this fix scoped to lookup normalization in shared.
- Empty-domain copy can drift across screens; use shared i18n keys and spot-check the garden detail and submit-work surfaces together.

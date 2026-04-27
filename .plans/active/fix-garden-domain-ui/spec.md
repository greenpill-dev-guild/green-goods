# Fix Garden Domain UI & Data Issues Spec

## Summary

This active item verifies that the garden-domain repair behavior already fixed on `main` exists in the current new admin UI. The current admin surface is different enough that the work should not cherry-pick legacy commits; it should confirm or adapt the behavior in place.

## Users

- Primary: garden operators trying to configure or repair domains
- Secondary: reviewers or managers who need to understand why no work actions are available

## Functional Requirements

1. Confirm the current branch preserves the `main` behavior for domain lookup normalization; if missing, normalize the domain lookup in `getGardens()` by lowercasing the garden ID at lookup time only.
2. Always render the domain section or equivalent in the new admin garden detail; when no domains exist, managers see an edit CTA and read-only users see an explicit empty label.
3. Make the new admin Submit Work empty state actionable by linking back to the garden detail surface used for domain configuration.
4. Confirm or add a derived overview alert when a garden has no configured domains.
5. Add any new strings to `en`, `es`, and `pt`.

## Non-Functional Constraints

- Package boundaries: changes stay in `packages/shared` and `packages/admin`
- Data model: do not normalize IDs in the indexer or alter the on-chain schema
- Routing: reuse the existing garden detail and domain editor flow; no deep-linked modal route
- Source control: do not cherry-pick the legacy admin commits from `main`; use them only as behavioral reference
- Contracts: none
- Localization: all new strings must be translated in the three active locales

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Garden detail empty state and submit-work CTA | `ui` | New admin UI parity work |
| Domain lookup normalization and overview alert | `state_api` | Verify current branch first; adapt only if missing |
| Contracts | `contracts` | `n/a` |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential regression checks |

## Risks

- A broader indexer mismatch may exist beyond case sensitivity; keep this fix scoped to lookup normalization in shared.
- Empty-domain copy can drift across screens; use shared i18n keys and spot-check the garden detail and submit-work surfaces together.

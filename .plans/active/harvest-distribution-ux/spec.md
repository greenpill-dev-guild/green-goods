# Harvest Distribution Completion Spec

## Summary

Preserve the protocol's two-transaction design while presenting it as one safe operator workflow.
The shared state boundary reads registered shares, their current asset value, pending yield,
threshold, escrow, split ratios, and the active Cookie Jar/fallback destination. The shared
mutation boundary harvests only when needed, stops on non-canonical Safe submission, distributes
only after confirmed harvest and a fresh threshold read, and preserves a retryable partial state
when distribution fails. Admin explains those stages before confirmation and reports the result
without exposing raw addresses in analytics.

## Users

- Primary: garden owners and operators managing endowment vaults in admin.
- Secondary: Cookie Jar recipients and gardeners affected by the resulting distribution.

## Functional Requirements

1. Replace the standalone Harvest action with state-aware Harvest & distribute / Distribute yield.
2. Show waiting, submitted, partial-failure, retry, and confirmed distribution states.
3. Show the current split and resolved Cookie Jar or fallback destination before confirmation.
4. Never send `splitYield()` after a non-canonical Safe harvest submission.
5. Refresh direct contract reads plus vault, yield, and Cookie Jar query state after each stage.
6. Add safe workflow telemetry without addresses, transaction hashes, or session identifiers.

## Research Evidence

- Existing pattern references: `useHarvest`, `useAllocateYield`, `useVaultPreview`,
  `useGardenCookieJars`, `AdminConfirmDialog`, and the explicit transaction sender abstraction.
- Source files reviewed: `packages/contracts/src/resolvers/Yield.sol`, the shared yield/vault hooks,
  transaction senders, `PositionCard`, its tests/stories, query invalidation, and admin guidance.
- Evidence confirmed: `harvest()` registers shares only; `splitYield()` redeems registered shares,
  enforces the effective asset threshold, and routes fixed configured portions permissionlessly.
- Evidence confirmed: wallet Safe-style non-canonical identifiers deliberately skip receipt wait,
  while current batch methods are sequential and advertise `supportsBatching = false`.
- Assumption: a canonical sender result represents confirmed execution under the sender contract;
  exact distributed amounts are read from the confirmed `YieldSplit` event when available.

## Human Judgment Points

- Locked by Afo: incident-first PRD-763 slice; the broader PRD-351 preset/governance plan stays backlog.
- Protected surface: shared vault/blockchain mutation hooks are critical and need direct RED/GREEN tests.
- Tradeoff: two wallet prompts remain explicit; no false atomic batching or background execution.
- Branch: stay on `polish/harvest-funds`; branch rename/publication requires separate approval.

## Non-Functional Constraints

- Package boundaries: hooks and domain orchestration live in `packages/shared`; admin owns presentation.
- Performance: use bounded multicalls and fresh direct reads only around the transaction boundary.
- Security: UI stays operator-only even though distribution is permissionless; destinations are read-only.
- Offline / sync: onchain financial mutations require a connected sender; Safe pending state is explicit.
- Localization: every new user-facing string is present in English, Spanish, and Portuguese.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Admin PositionCard, confirmation, outcome states, i18n, Storybook |
| State / API | `state_api` | Yield status, orchestration, telemetry, invalidation |
| Contracts | `contracts` | No contract behavior change; lane is not applicable |
| QA | `qa_pass_1`, `qa_pass_2` | Targeted tests, gates, authenticated Brave proof |

## Risks

- Safe submission is mistaken for confirmation: detect non-canonical identifiers and stop after submit.
- Distribution failure hides successful harvest: return a first-class partial state with split-only retry.
- Stale direct reads mislabel funds: refetch after writes and invalidate wagmi/vault/yield/Cookie Jar state.
- Estimated and actual amounts diverge: label preflight values as estimates and use the event for success.

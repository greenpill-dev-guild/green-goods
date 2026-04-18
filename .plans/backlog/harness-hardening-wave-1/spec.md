# Harness Hardening Wave 1 Spec

## Summary

Wave 1 hardens the harness in five places only: deterministic blocking guardrails, split advisory reviewer workflows, a structural source check, an explicit criticality matrix, and a weekly harness-GC automation. It intentionally does not absorb `Telegram trace capture`, `Chromatic wiring`, or the design-lane rollout. The active autonomy rollout remains the live hub for current control-surface work, while this backlog hub captures the next bounded hardening wave.

## Users

- Primary: repo maintainers and agent operators working inside the Green Goods harness
- Secondary: reviewers who need clearer blocking checks, narrower advisory review scopes, and better weekly feedback harvests

## Functional Requirements

1. Create `.plans/backlog/harness-hardening-wave-1/` as the canonical hub for this wave and keep `.plans/active/autonomy-harness-rollout/` unchanged in scope.
2. Add blocking deterministic workflows for design guardrails and `bun run check:source-structure`.
3. Add advisory diff-scoped reviewer workflows for `contracts-security` and `mutation-reliability`.
4. Document explicit criticality classes in repo guidance and add edit-time warnings for critical surfaces.
5. Add a weekly report-only harness-GC automation prompt that writes `.plans/reviews/harness/<YYYY-MM-DD>-codex-harness-gc.md`.

## Non-Functional Constraints

- Package boundaries: no product-facing API, schema, or runtime type changes; Wave 1 is harness-only
- Performance: deterministic checks should stay lightweight enough to run as required status checks on PRs
- Security: Claude review workflows remain advisory until repo-local promotion criteria are met
- Offline / sync: no change to product runtime behavior
- Localization: no product copy changes in this wave

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | `n/a` in Wave 1; no product UI rollout work lands here |
| State / API | `state_api` | Owns scripts, workflows, hub docs, automation prompt, and guidance changes |
| Contracts | `contracts` | `n/a` in Wave 1; contracts are only a review scope, not an implementation lane |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential verification once the hardening changes are implemented |

## Reviewer Promotion Criteria

Claude review workflows stay advisory in Wave 1. Promotion to blocking is only considered after:

1. 2 weeks of stable runs
2. low false-positive rate
3. findings anchored to file and line, limited to severe issues
4. no repeated outages or token/auth flakiness

## Sequencing Notes

- Wave 1 is the bounded hardening step immediately after the active control-surface work.
- `Telegram trace capture` is the next follow-on hub after Wave 1 lands and stabilizes.
- `Chromatic wiring` and the design-lane rollout remain separate work, not part of this hub.

## Risks

- Risk: reviewer prompts drift into broad style review and become noisy
- Mitigation: keep reviewer workflows advisory, severe-only, and diff-scoped until promotion criteria are met
- Risk: source-structure ratchet causes churn on pre-existing large files
- Mitigation: freeze current oversized files at exact ceilings and only fail if they grow
- Risk: the active autonomy rollout gets muddied by follow-on hardening work
- Mitigation: keep this hub in backlog and reference the active rollout without editing its scope

# Workflow Scorecard

Use this to measure whether AI-native workflow changes reduce cognitive debt instead of adding ceremony.

## Baseline Template

| Metric | Value |
|---|---|
| Date | YYYY-MM-DD |
| Repo | Green Goods |
| Feature or lane |  |
| Cycle time |  |
| Agent runs |  |
| Human review findings |  |
| Tests added or updated |  |
| Validation commands |  |
| Regressions caught before merge |  |
| Rework caused by unclear intent |  |
| Rework caused by tool/model failure |  |
| Rule updates created |  |
| Net judgment | unknown |

## Scoring Guide

- Green: less review confusion, fewer repeated failures, validation evidence is easy to find.
- Yellow: useful evidence exists but process added noticeable overhead.
- Red: process obscured the work, duplicated truth, or failed to catch regressions.

## Baseline Entries

### 2026-05-24 - Scaffold Hardening

| Metric | Value |
|---|---|
| Date | 2026-05-24 |
| Repo | Green Goods |
| Feature or lane | `ai-native-dev-workflow` / state_api lane |
| Cycle time | One focused hardening pass after the initial scaffold review. |
| Agent runs | 1 Codex implementation pass plus 1 Codex review pass. |
| Human review findings | Template-only evidence, premature ready lanes, prose-form commands, and Green Goods Linear visibility warnings. |
| Tests added or updated | No runtime tests; plan evidence and TDD proof-limit metadata updated. |
| Validation commands | `node scripts/harness/plan-hub.mjs validate` |
| Regressions caught before merge | Queue-visible ready state for a lane whose handoff still said not started. |
| Rework caused by unclear intent | Medium: the first scaffold did not distinguish scaffold completion from six-week adoption completion. |
| Rework caused by tool/model failure | None observed. |
| Rule updates created | `None` for repeated agent failures; local eval command format tightened. |
| Net judgment | Green: the hub is now measurable without creating a second truth surface. |

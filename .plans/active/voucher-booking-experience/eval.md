# Voucher booking experience Evaluation Plan

## Release Gates

1. Correctness: every booking stage maps to one tracker state and one status; no act the
   contracts refuse is offered.
2. Usability: a hub day takes the member three acts and the steward two, from one queue.
3. Regression safety: every recovery state (declined prompt, pending transfer, stuck
   confirmation, paused escrow, failed return) keeps its act.
4. Evidence quality: research evidence and open assumptions are recorded in `spec.md`.
5. Human judgment: the three open assumptions on PRD-1574 were ruled on 19 November 2026 (kept as built).

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Booking page | Storybook hub day at 375 and 390 shows one status, the tracker and one act at each stage | `ui` | PR C |
| AC-2 | Hub tab | Queue holds Approve, Accept, Report Visit; list folds copies; reserve three numbers; queue first at 375 | `ui` | PR D |
| AC-3 | Accept and Start | Tests cover accepted-and-started, accepted-not-started, and the fallback | `state_api` | PR E |
| AC-4 | Closing | One sheet closes a full visit; a cut-short visit shows the split first | `state_api` | PR E |
| AC-5 | Words | Vocabulary check rejects the retired labels | `ui` | PR F |

## Test Strategy

- Unit: booking stage mapping, queue row selection, group counts.
- Integration: the existing booking, pool and console view tests, updated.
- Manual checks: Storybook walkthroughs on both apps at 375 and 1280.
- TDD proof: RED/GREEN commands and evidence in lane handoffs, summarized in `status.json`.

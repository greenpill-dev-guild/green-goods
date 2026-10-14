# Task and phase records

Use this compact record in coding and investigation handoffs so daily and weekly retrospectives
can connect work, verification, waits, and corrections. It supplements the outcome and evidence
already in the handoff; the [validation pipeline](validation-pipeline.md) still owns proof.

Keep one task reference across continuations: use its existing issue, PR, Plan Hub, or a stable
short title when there is no external record. Record the agent and model only when the runtime
identifies them. Use a short task type, such as fix, feature, guidance, investigation, or review.

Record only phases actually entered: investigate, implement, verify, review, publish, or wait.
Capture UTC start/end timestamps at observed boundaries; repeated phases can have separate rows.
Link the existing command/result or CI receipt rather than duplicating its validation detail.
For a wait, name the observed blocker and whether it was resolved. Mark unfinished intervals as
`ongoing`, unused phases as omitted, and unavailable times or evidence as `unknown`.

These intervals measure elapsed time, including tools and waits, not active effort. Never infer
human attention from chat gaps or approval waits, or sum overlapping agent intervals as task
duration. Count only observed human corrections to the agent's work or approach; the initial
request and ordinary scope additions are not corrections. Report the covered task segment so
a continuation does not silently count earlier work again. Use `unknown` when coverage is absent.

```markdown
Task record: <existing reference or stable title> | Type: <type> | Outcome: <complete/partial/blocked/cancelled>
Agent/model: <observed agent/model or unknown> | Coverage: <this task segment>

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| <entered phase> | <timestamps, ongoing, or unknown> | <existing proof reference or observed result> |

Human corrections: <count observed in this segment + short category, or unknown>; attention: <user-reported minutes or unknown>.
```

Put the record in the existing chat handoff, or the owning Plan Hub handoff when one exists.
This does not require a new file, issue, registry, timer service, or Plan Hub for an ordinary task.
Start with new work; preserve historical reports rather than estimating their missing timings.
Keep private session identifiers, transcript excerpts, and private QA evidence out of public Git
and PRs, following the [QA privacy boundary](qa.md#public-repository-boundary).

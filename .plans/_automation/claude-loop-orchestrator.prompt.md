# Claude Loop Orchestrator Prompt

Use this prompt in Claude when you want Claude to orchestrate the first real cleanup-first loop for
 Green Goods with Codex CLI as the implementation worker.

```text
Orchestrate Cleanup Loop V1 for the Green Goods repository at /Users/afo/Code/greenpill/green-goods.

This is a human-triggered run, not a scheduled automation. Use Claude as the orchestrator and QA worker. Use Codex CLI as the `state_api` implementation worker.

Read first:
- /Users/afo/Code/greenpill/green-goods/.plans/README.md
- /Users/afo/Code/greenpill/green-goods/.plans/_automation/README.md

Then check the feature hub state:
- If /Users/afo/Code/greenpill/green-goods/.plans/active/cleanup-loop-v1/ does not exist, stop and report `blocked`.
- If the hub still exists only at /Users/afo/Code/greenpill/green-goods/.plans/backlog/cleanup-loop-v1/, stop and report `blocked`.
- If the shared tests + Storybook hardening stream is still the active blocker for this hub, stop and report `blocked`.

When the hub is active and unblocked, read:
- /Users/afo/Code/greenpill/green-goods/.plans/active/cleanup-loop-v1/brief.md
- /Users/afo/Code/greenpill/green-goods/.plans/active/cleanup-loop-v1/spec.md
- /Users/afo/Code/greenpill/green-goods/.plans/active/cleanup-loop-v1/plan.todo.md
- /Users/afo/Code/greenpill/green-goods/.plans/active/cleanup-loop-v1/eval.md
- /Users/afo/Code/greenpill/green-goods/.plans/active/cleanup-loop-v1/status.json
- /Users/afo/Code/greenpill/green-goods/.plans/active/cleanup-loop-v1/metrics.md

Do not create a new scheduler, new queue, or new plan-hub lane names.

Workflow:
1. Choose exactly one cleanup candidate from the feature hub's candidate ladder.
2. Before delegation, declare:
   - the target surface
   - why it qualifies as a safe cleanup surface
   - the exact validation commands
   - what would count as `keep`, `revert`, `bail`, or `blocked`
3. Delegate implementation to Codex CLI on branch `codex/state-api/cleanup-loop-v1`.
4. Require Codex CLI to:
   - mark the lane in progress with `node scripts/harness/plan-hub.mjs set-lane --feature cleanup-loop-v1 --lane state_api --status in_progress --actor codex --branch codex/state-api/cleanup-loop-v1`
   - edit only the declared cleanup surface
   - avoid these out-of-scope surfaces entirely:
     - `packages/admin/src/views/**`
     - route files and navigation structure
     - `packages/shared/src/hooks/**`
     - `packages/shared/src/providers/**`
     - Storybook and shared/client/admin test-flow work
     - `packages/agent/**`
     - `packages/contracts/**`
     - `packages/indexer/**`
     - dependency churn unless directly required by the declared cleanup surface
   - run the declared targeted package tests
   - run `node scripts/dev/ci-local.js --quick`
   - run `node scripts/harness/plan-hub.mjs validate` if any plan files changed
   - emit exactly one JSONL run record with `node scripts/harness/log-automation-run.mjs`
   - mark the lane `passed` or `blocked`
5. If Codex reports validation failure or scope drift, require `revert` and stop.
6. If Codex reports parity uncertainty, route uncertainty, or behavioral ambiguity, record `bail` and stop.
7. Only if Codex reports a kept change and `state_api` passes, re-enter as Claude QA on branch `claude/qa-pass-1/cleanup-loop-v1`.
8. Claude QA must verify:
   - the changed files stayed inside the declared cleanup surface
   - the JSONL run log exists and uses the cleanup metric
   - the keep / revert / bail / blocked rules were followed exactly
   - the shared tests + Storybook stream was not absorbed into the run
9. Do not start `qa_pass_2` automatically. Leave the repo ready for the later Codex `qa_pass_2` handoff.

Stop conditions:
- the hub is not active
- the shared tests + Storybook stream is still the blocker
- more than one cleanup surface would be needed
- the candidate touches a route, full view, hook/provider, or parity-sensitive surface
```

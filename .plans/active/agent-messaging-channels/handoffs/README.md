# Handoffs

Keep lane handoffs short and factual. Use one file per lane:

- `claude-state-api.md` — Opus 5.5: Shared reporting rules and Agent API harness, persistence, processing and execution
- `claude-ui.md` — Opus 5.5: platform-neutral browser ceremonies and Shared account/signing controls
- `contracts.md` — `n/a` for the prototype; no contract change
- `claude-qa-pass-1.md` — Opus 5.5: checkpoint evidence, demo rehearsal and adversarial proof
- `codex-qa-pass-2.md` — Astra: independent review of each checkpoint and the integrated prototype

The [current build sequence](../plan.todo.md#current-build-sequence) and
[technical brief](../technical-brief.md#12-implementation-order-and-acceptance) own scope.
Historical step numbers do not dispatch work. Tracker reconciliation precedes implementation;
provider, privacy and live account gates apply to their corresponding stages.

Each handoff should capture:

1. What changed
2. What remains
3. TDD proof
4. Validation run
5. Known risks or blockers
6. Repo-truth references from the active hub or reports, not tool-local memory claims

Before a handoff claims `green`, `passed`, `completed`, or `merge-ready`, it must include:

```markdown
## Validation Receipt

- Tested implementation commit SHA: `<full SHA>`
- Run at (UTC): `YYYY-MM-DDTHH:MM:SSZ`
- Exact command(s): `<commands>`
- Result: `<counts or concise output summary>`
- Validated paths: `<implementation, dependency, configuration, and validation paths>`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <validated paths>` → `<empty result>`
- Evidence-only diff command and result (if applicable): `git diff --exit-code <tested>..HEAD -- <validated paths>` → `<result>`
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- <validated paths>` → `<empty result>`
```

`status.json` and `record-tdd` do not replace this receipt; they track orchestration and TDD state.

Use this short proof block for implementation lanes:

```markdown
## TDD Proof

- RED: command + expected failing result
- GREEN: command + passing result
- Proof limit: `none`, `not_applicable`, or the exact reason TDD could not honestly apply
```

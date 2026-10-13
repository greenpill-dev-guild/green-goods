# Handoffs

Start a continuation with `final-merge-preparation.md`, then `qa-revision.md` and the current decisions and pending phases in
`../plan.todo.md`. Content and ontology receipts are in the current lane handoffs. The new visual
pass is Phase 8; use `qa-revision.md` § Visual review queue for the next owner review.
Passing implementation checks are not visual approval.

Current implementation handoffs:

- `final-merge-preparation.md` (latest L32 results, publication blocker and review packet)
- `codex-ui.md` (earlier QA revision and visual batches)
- `codex-state-api.md` (formal-reference migration and drift proof)

First-foundation evidence remains in `claude-ui.md` and `claude-state-api.md`. It is historical
and does not certify the new scope. Other lane handoffs:

- `codex-contracts.md` (not applicable: no contract work)
- `claude-qa-pass-1.md`
- `codex-qa-pass-2.md`

`pooling-insertion-points.md` is not a lane. It records where the later Commitment Pooling
documentation (PRD-1156, PRD-727) connects to this foundation.

The scripts behind the screenshots and the rendered check are in `../artifacts/`.

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

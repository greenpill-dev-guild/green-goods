# Clean — Authorized-Worktree Protocol

Load this file only when the human has explicitly approved isolated worktrees for a `/clean` implementation pass. The default execution mode is sequential on the current branch and never needs it.

## Base invariant

Every implementation worktree bases on the checkpoint SHA recorded in pre-flight — never `main`, `origin/main`, or the tool's default branch. Record the worktree's `implementation_base_sha` before dispatch. Before accepting any lane result, first verify that recorded base exactly matches the checkpoint:

```bash
test "$IMPLEMENTATION_BASE_SHA" = "$CHECKPOINT_SHA"
```

Then independently verify after the run that the implementation head still descends from the checkpoint:

```bash
test "$(git -C "$WORKTREE" merge-base "$CHECKPOINT_SHA" HEAD)" = "$CHECKPOINT_SHA"
```

If either check fails, stop and re-dispatch that agent from the checkpoint. Never continue a stale-base run by default.

## Stale-base salvage (explicit approval only)

Salvage is allowed only when the human explicitly approves after seeing:

- checkpoint SHA and stale worktree SHA
- commit gap (`git rev-list --count "$STALE_BASE..$CHECKPOINT_SHA"`)
- affected file list
- planned validation and conflict audit steps

When salvage is approved, record every conflict and every dropped/ported agent insight in the conversation or, for plan-backed work, in the existing feature hub's `reports/merge-audit.md`.

## Provenance block

Every implementation report includes:

```md
## Provenance
- execution_mode: current-branch | authorized-worktree
- checkpoint_sha:
- implementation_base_sha:
- implementation_head_sha:
- merge_base_with_checkpoint: (authorized worktree only)
- stale_base: yes/no/not-applicable
```

Current-branch runs fill the first four fields; worktree runs must show `stale_base: no` or a recorded salvage approval.

## Merging

Merge authorized worktrees only, never with blanket "take ours" / "take theirs" resolution. For each conflict, inspect the agent diff before resolving — "ours" is valid only when the checkpoint/develop side already contains the same improvement or the agent hunk is obsolete. If a resolution drops a real cleanup, port it immediately or record it as a follow-up in the merge audit.

## Merge audit format

Required whenever a merge is not a clean fast-forward/cherry-pick with no conflicts. Write it in the conversation or, for plan-backed work, in the existing feature hub's `reports/merge-audit.md`:

```md
# Clean Merge Audit

## Base Provenance
- checkpoint_sha:
- expected_base:
- stale_agent_worktrees:

## Conflict Resolutions
| Agent | File | Agent intent | Resolution | Develop already covered it? | Follow-up needed |
|-------|------|--------------|------------|-----------------------------|------------------|

## Auto-Merge / Stash Events
| Event | Files | Action | Residual risk |
|-------|-------|--------|---------------|

## Validation
- command:
- result:
```

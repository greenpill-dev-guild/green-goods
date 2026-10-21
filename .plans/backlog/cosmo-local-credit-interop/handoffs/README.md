# Handoffs

[Claude Fable: research and pitch](claude-fable-research-pitch.md) is the authorized continuation
prompt for research and draft marketing materials. It does not dispatch runtime implementation.

Implementation handoffs are intentionally absent while the lanes remain blocked. Their reserved
paths in the status record are not runnable instructions. Write a bounded handoff only after its
current slice is accepted and explicitly dispatched; use the reconciled [plan](../plan.todo.md),
not the superseded August sequence. RESR-74's completed research remains dated evidence.

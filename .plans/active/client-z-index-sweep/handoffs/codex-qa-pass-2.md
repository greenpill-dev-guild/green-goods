# QA Pass 2 Handoff

- Gate: wait for `qa_pass_1` to pass on `claude/qa-pass-1/client-z-index-sweep`
- Scope: regression confirmation only; no new surface changes
- Keep/revert rule: revert only if named-scale migration regresses stacking order

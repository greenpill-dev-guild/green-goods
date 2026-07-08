# Commitment Pooling Handoffs

These files are the lane-level dispatch surfaces for `.plans/active/commitment-pooling/`.

`status.json` remains machine truth. `plan.todo.md`, `contract-spec.md`, `settlement-spec.md`, `uiux-spec.md`, `credit-spec.md`, `diagrams.md`, and `corrections-log.md` remain source specs. Each implementation lane records RED/GREEN proof here first, then records machine proof through `record-tdd` when the lane is ready to turn GREEN.

Linear stays low-noise for this hub: `linear.laneSyncMode = parent_only`, PRD-650 is the single active parent mirror, and lane issue IDs in the plan are historical labels unless Afo explicitly expands the Linear footprint.

# Yield Split UI Handoffs

Use this directory for lane-specific implementation prompts, proof notes, and QA findings when the `yield-split-ui` backlog hub is promoted.

Keep execution truth in these handoffs and in `status.json`:

- record RED/GREEN proof for behavior-changing lanes before marking them passed;
- keep UI work on the current `/community` admin architecture and `ConvictionDrawer`;
- do not expose treasury destination controls, raw `setGardenTreasury`, or raw three-way `setSplitRatio` editing;
- keep preset editing blocked until the contracts lane hardens `setGardenTreasury`.

Current handoffs:

- `claude-ui.md` - Claude UI lane for admin/client visibility, operator-only `splitYield`, and gated preset controls.
- `codex-state-api.md` - Codex shared hook/state lane for live split config support, yield status, and guarded preset mutation.
- `codex-contracts.md` - Codex contracts lane for `setGardenTreasury` hardening.
- `claude-qa-pass-1.md` - first QA pass after implementation lanes complete.
- `codex-qa-pass-2.md` - final validation and plan/Linear closeout pass.

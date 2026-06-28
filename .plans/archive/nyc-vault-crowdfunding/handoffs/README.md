# Handoffs

Keep lane handoffs short and factual. Use one file per lane:

- `claude-ui.md`
- `codex-state-api.md`
- `codex-contracts.md`
- `claude-qa-pass-1.md`
- `codex-qa-pass-2.md`

Each handoff should capture:

1. What changed
2. What remains
3. TDD proof
4. Validation run
5. Known risks or blockers
6. Repo-truth references from the active hub or reports, not tool-local memory claims

Use this short proof block for implementation lanes:

```markdown
## TDD Proof

- RED: command + expected failing result
- GREEN: command + passing result
- Proof limit: `none`, `not_applicable`, or the exact reason TDD could not honestly apply
```

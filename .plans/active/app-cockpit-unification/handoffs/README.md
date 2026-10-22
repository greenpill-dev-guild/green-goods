# Handoffs

Keep lane handoffs short and factual. One file per lane:

- `claude-ui.md`: every delivery step runs in the `ui` lane, one pull request per step.
- `claude-qa-pass-1.md` and `codex-qa-pass-2.md`: acceptance (step 22), sequential.
- `codex-state-api.md` and `codex-contracts.md`: not applicable to this hub.

Each handoff captures what changed, what remains, the TDD proof or proof limit, the validation
run, known risks or blockers, and repo-truth references from this hub. Before a handoff claims
`green`, `passed`, `completed` or `merge-ready`, it carries a Validation Receipt:

```markdown
## Validation Receipt

- Tested implementation commit SHA: `<full SHA>`
- Run at (UTC): `YYYY-MM-DDTHH:MM:SSZ`
- Exact command(s): `<commands>`
- Result: `<counts or concise output summary>`
- Validated paths: `<implementation, dependency, configuration, and validation paths>`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <validated paths>` → `<empty result>`
```

`status.json` records orchestration and TDD state; it does not replace the receipt.

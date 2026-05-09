# QA pass 2 — animation-polish-editorial-browser

**Owner**: codex (qa_pass_2)
**Closing turn**: 2026-05-09
**Working branch**: `main` (no worktree, direct-to-main QA handoff)
**Verdict**: `blocked`

## Scope

Independent QA pass for the closed UI lane, intended to refresh the root install, rerun the full
validation ladder, and capture real browser evidence for the editorial browser animation polish.

This pass stopped at the repo-health gate before browser work, per the dispatch instruction:
if `bun install` did not repair the documented broken root `node_modules` symlinks, capture the
diagnostic and stop without hand-editing symlinks.

## Start-state checks

| Command | Result |
| --- | --- |
| `git branch --show-current` | `main` |
| `git status --short --untracked-files=all` | clean |
| `git log --oneline -3` | `d2e983b0 chore(routines): align prompts with actual Linear taxonomy`; `cc7a649d chore(plans): record qa_pass_1 verdict for animation-polish-editorial-browser`; `0c9a525f chore(routines): adopt Linear-as-truth model` |
| `node scripts/harness/plan-hub.mjs validate` | `Validated 23 feature hubs.` |

`cc7a649d` was not HEAD as expected in the prompt; `d2e983b0` was one commit newer. The newer
commit appears routine-scoped and the worktree was clean, so this was recorded as branch drift, not
the blocking condition.

## Repo-health gate

Initial confirmation matched the qa_pass_1 diagnosis:

| Command | Result |
| --- | --- |
| `readlink node_modules/@tailwindcss/vite` | `../../../../node_modules/.bun/@tailwindcss+vite@4.1.18+fea22ae6449b71dc/node_modules/@tailwindcss/vite` |
| `test -e node_modules/@tailwindcss/vite/package.json` | exit 1 |

I ran `bun install` from the repo root. The sandboxed run failed before install work with
`bun is unable to write files to tempdir: PermissionDenied`, so I reran the same command with
approval. The approved run completed:

```text
Checked 3081 installs across 3198 packages (no changes) [1155.00ms]
```

Post-install recheck showed the symlink target was computed identically and still broken:

| Command | Result |
| --- | --- |
| `readlink node_modules/@tailwindcss/vite` | `../../../../node_modules/.bun/@tailwindcss+vite@4.1.18+fea22ae6449b71dc/node_modules/@tailwindcss/vite` |
| `test -e node_modules/@tailwindcss/vite/package.json` | exit 1 |
| `readlink node_modules/react-router-dom` | `../../../node_modules/.bun/react-router-dom@7.12.0+bf16f8eded5e12ee/node_modules/react-router-dom` |
| `test -e node_modules/react-router-dom/package.json` | exit 1 |
| `test -e node_modules/.bun/@tailwindcss+vite@4.1.18+fea22ae6449b71dc/node_modules/@tailwindcss/vite/package.json` | exit 0 |
| `test -e ../node_modules/.bun/@tailwindcss+vite@4.1.18+fea22ae6449b71dc/node_modules/@tailwindcss/vite/package.json` | exit 1 |

The packages exist under this repo's `node_modules/.bun` store, but the top-level package symlinks
still point one level too far up. I did not hand-edit symlinks.

## Validation and browser evidence

Not run. The dispatch explicitly required stopping if `bun install` did not fix the broken symlink
targets. Because `@tailwindcss/vite` and `react-router-dom` still do not resolve from the root
install, Vite, Vitest, the client build, PM2 restart verification, and browser visual QA remain
blocked by the same environment gate.

No code defects were found in the lane during this pass because the pass stopped before source-level
or browser-level verification beyond the required plan reads.

## Followups

1. Repair the root dependency layout without hand-editing individual symlinks. `bun install` on this
   machine currently recreates the same off-by-one links, so this likely needs a broader Bun
   workspace/install-layout diagnosis or a clean reinstall path outside this lane.
2. Re-confirm:
   - `test -e node_modules/@tailwindcss/vite/package.json` exits 0.
   - `test -e node_modules/react-router-dom/package.json` exits 0.
3. Restart and inspect the client dev stack only after dependency resolution is healthy:
   - `npx pm2 logs client --nostream | tail -30`
   - `npx pm2 restart client` if still failing.
4. Rerun the full requested validation ladder.
5. Capture the browser evidence inherited from qa_pass_1: desktop `/`, `/gardens`, card-to-dialog
   morph, reverse close paths, keyboard/focus flow, mobile 375x812 behavior, and reduced-motion
   snap behavior.
6. Reconcile Phase C2/C3 only with live visual evidence. Do not ship the `::view-transition-group(*)`
   wildcard without explicit approval.

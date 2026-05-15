# QA Sheet webhook — pointer

The canonical Apps Script source + setup steps + both secrets live at `~/.config/qa-triage/setup.md` (chmod 600, never in git). Mirrors the `~/.config/meet-filer/routine.md` pattern: one local document carries the .gs source with `SECRET` and `ADMIN_SECRET` inlined, the matching `*.txt` files in the same directory are the runtime-reference values, and nothing secret crosses the repo boundary.

If `~/.config/qa-triage/setup.md` is missing on a fresh machine, recreate it by:

1. `mkdir -p ~/.config/qa-triage && chmod 700 ~/.config/qa-triage`
2. `openssl rand -hex 32 > ~/.config/qa-triage/webhook-secret.txt && chmod 600 ~/.config/qa-triage/webhook-secret.txt`
3. `openssl rand -hex 32 > ~/.config/qa-triage/webhook-admin-secret.txt && chmod 600 ~/.config/qa-triage/webhook-admin-secret.txt`
4. Open the QA Sheet → Extensions → Apps Script → paste the contents of `~/.config/qa-triage/setup.md` § A.4 (with the two secrets inlined from the `.txt` files) → Deploy as Web App → paste the deployment URL into `~/.config/qa-triage/webhook.txt` (chmod 600).
5. `bun scripts/agents/qa-sheet-append.ts --health` → expect `{"ok":true}`.

The webhook contract for the CLI ([`qa-sheet-append.ts`](qa-sheet-append.ts)):
- `secret` (required): from `webhook-secret.txt`. Gates the three constrained ops: `bootstrap` (append header columns to Defects), `defectRows` (append rows to Defects, append-only), `testBackfills` (write `Defect Link` column on Test tabs only).
- `adminSecret` (local-Claude only, never CLI/routine): from `webhook-admin-secret.txt`. Bypasses the op allowlist and accepts `rawWrites: [{tab, range, values}]` for ad-hoc edits.

See `~/.config/qa-triage/setup.md` for the full source, deployment steps, failure modes, and admin-write recipe.

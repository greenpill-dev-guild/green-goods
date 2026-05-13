---
name: drift
user-invocable: true
description: Read-only drift classifier for Green Goods repo truth. Use when the user asks to check drift, stale guidance, stale plans, docs/design drift, cleanup readiness, or whether to run clean. Routes findings to existing skills such as audit-then-ship, clean, debug, plan, design, and review without fixing by default.
argument-hint: "[check|clean] [scope]"
version: "1.0.1"
status: active
packages: ["all"]
dependencies: ["audit", "audit-then-ship", "clean", "debug", "design", "plan", "review"]
last_updated: "2026-05-13"
last_verified: "2026-05-13"
---

# Drift Skill

Read-only repo-truth classifier. Detect drift, classify it, and route it to the right existing
skill. Do not duplicate `/clean`, `/debug`, `/plan`, `/review`, or `/audit-then-ship`.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/drift` or `/drift check` | Run a read-only drift check across all categories |
| `/drift check guidance` | Limit checks to guidance, registry, and skill mirrors |
| `/drift check plans` | Limit checks to `.plans` truth |
| `/drift check design` | Limit checks to design-system guardrails |
| `/drift check docs` | Limit checks to docs audit |
| `/drift check cleanup` | Limit checks to cleanup-readiness guardrails |
| `/drift check quality` | Limit checks to test-quality guardrails |
| `/drift clean [scope]` | Check cleanup readiness and recommend `/clean --scope <scope> --dry-run`; do not run full clean automatically |
| "repo drift", "stale guidance", "should we clean?", "drift check" | Treat as `/drift check` unless the user explicitly asks for a clean handoff |

---

## Core Contract

Default mode is read-only.

1. Run `bun run drift:check -- --scope <scope>`.
2. Report numbered findings with category, severity, evidence, and recommended route.
3. Include working-tree context if the checker reports a dirty tree.
4. Treat warn-only command output as a finding when the checker reports `WARN`.
5. Stop for human scope lock before fixing anything.
6. If the user approves findings by number, route through `/audit-then-ship` semantics.
7. If findings are cleanup candidates, recommend `/clean --dry-run` first; never launch full `/clean` without explicit approval.

For machine-readable output, run:

```bash
bun run drift:check -- --scope all --json
```

Supported scopes: `all`, `guidance`, `plans`, `design`, `docs`, `cleanup`, `quality`.

---

## Routing Map

| Category | Route |
|----------|-------|
| Guidance drift | `audit-then-ship`; approved fixes may run `skills:sync` |
| Plan truth drift | `plan` or `audit-then-ship` |
| Design-system drift | `design` review or `audit-then-ship` |
| Docs drift | docs-scoped `audit-then-ship` |
| Cleanup candidates | `/clean --dry-run` first |
| Runtime/product risk | `debug` or `review`; not `clean` |

When a failed check looks like a production bug, broken user flow, failing contract behavior, or
data/API/indexer failure, switch to `debug` instead of treating it as cleanup drift.

---

## Output Shape

Use this shape after a drift check:

```markdown
## Drift Findings — <scope>

1. [MEDIUM] Guidance drift: Skill mirror is stale
   Evidence: `bun run check:skills`
   Route: `audit-then-ship`

Next: Which findings should I route? Reply with numbers, `clean dry-run <scope>`, or `none`.
```

If there are no findings, say the checked scope is aligned and list the commands that passed.

---

## Clean Handoff

`/drift clean <scope>` is a gate, not a cleanup runner.

1. Run the relevant drift checks first.
2. If the findings are cleanup-shaped, recommend exactly:
   `clean --scope <scope> --dry-run`
3. If the user approves the dry run, hand off to `clean`.
4. If the dry run produces accepted findings, the user chooses whether to run full `clean`.

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Run mutating commands during `/drift check` | Drift detection must be safe on dirty trees |
| Run `skills:sync`, codegen, formatters, or full clean automatically | Those are fixes, not classification |
| Treat runtime bugs as cleanup drift | User-facing failures belong in `debug` or `review` |
| Turn every warning into an urgent finding | Accepted warning debt should be reported separately or ignored |
| Open Linear records without explicit approval | Linear writes are human-approved only |

---

## Related Skills

- `audit-then-ship` — fixes approved drift findings through a scope lock
- `clean` — broad cleanup after drift has proven cleanup is appropriate
- `audit` — deeper read-only repo-health review
- `debug` — runtime, product, API, indexer, and contract failures
- `plan` — stale or inconsistent `.plans` truth
- `design` — design-system and token drift
- `review` — diff-scoped correctness and cross-package impact

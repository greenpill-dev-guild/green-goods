# Community Docs Revamp Evaluation Plan

## Release Gates

1. Correctness: every guide step matches the released product's screens and on-screen labels,
   replayed step by step.
2. Usability: someone new to Green Goods can finish a first task (join, submit, track) from the
   docs alone.
3. Regression safety: the docs gate chain is green, every moved slug redirects, and no consumer
   points at a moved path.
4. Evidence quality: screenshots note the release they came from, and every availability claim
   matches the claims ledger.
5. Human judgment: Q1 to Q10 are locked before Phase 1 starts.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Structure | The community sidebar matches `spec.md` § Target information architecture: FAQ at `/faq`, a separate Evaluator guide, and Formal Ontology on Builders | `ui` | Sidebar diff plus a docs build |
| AC-2 | Voice | No em dashes in hand-written community or Reference prose, and every protocol-name hit is inside a "using your own wallet" box | `ui` | The two searches below, each remaining hit reviewed |
| AC-3 | Page contract | Every task page has a purpose, before you start, steps, a success signal, what happens next, recovery, and one next step | `ui` | Checklist in the `ui` handoff |
| AC-4 | Truth | Every item in `spec.md` § Truth fixes is resolved | `ui` | Search results plus a read-through |
| AC-5 | Docs audit rules | Steward pages are checked as guides and `operator-guide/` is gone | `state_api` | RED/GREEN in `docs/scripts/docs-audit.test.mjs` |
| AC-6 | Glossary generator | Community terms render plain definitions; technical definitions stay on the Builders ontology page | `state_api` | RED/GREEN in `scripts/docs/generate.test.mjs`; `node scripts/docs/generate.mjs --check` clean |
| AC-7 | Replay | Every guide is walked on the released product | `qa_pass_1` | Handoff with engine and session labeled per `AGENTS.md` § Browser Evidence |
| AC-8 | Consumers and gates | Each moved path returns only redirects and history under `git grep`, and the full gate chain passes | `qa_pass_2` | Command output in the handoff |

Voice searches for AC-2:

```bash
grep -rn "—" docs/docs/community docs/docs/reference --include=*.mdx --include=*.md | grep -v "\.generated\."
grep -rnE "\bEAS\b|Hats Protocol|Octant|Gardens V2|IPFS|CIDS|ERC-[0-9]+" docs/docs/community --include=*.mdx | grep -v "\.generated\."
```

## Gate Chain

Run from the repository root:

```bash
node docs/scripts/docs-audit.mjs --ci
bun run check --only docs-authority    # generator and audit tests, the audit, and the drift check
bun run check --only docs-generated
bun run check --only vocabulary
bun run check --only ontology          # when the ontology sidecar or its generated pages change
bun run check --only guidance-links    # when .claude pointers change
bun run check --only skill-behavior    # when skill files change
bun run --cwd docs test
bun run --cwd docs build               # also checks that the search index covers every route
```

## Test Strategy

- Unit: `state_api` changes (docs audit rules, glossary and claims renderers) get RED then GREEN
  tests in the files named above.
- Integration: `node scripts/docs/generate.mjs --check` and the docs build.
- E2E / Playwright: none. Docs content has no runtime behavior.
- Manual checks: the replayed read-through (`qa_pass_1`) is the main proof for the `ui` lane.
- TDD proof: `ui` records `not_applicable` with this note; `state_api` records RED/GREEN in its
  handoff and in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Walk every guide on the released product and fix wording, labels, and screenshots that drift.
- Record the engine and session behind each observation. Authenticated surfaces use the
  authenticated Brave profile; everything else may use labeled demo mode.

### Codex QA Pass 2

- Start only after `qa_pass_1` passes.
- Search for every old path, check redirects and links, and run the full gate chain.

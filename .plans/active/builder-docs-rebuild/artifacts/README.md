# Builder Docs Rebuild Artifacts

`builder-docs-blueprint-rev3.html` is a byte-for-byte copy of the review artifact that locked this
effort's blueprint (rev 3, 2026-09-02). The original lives at
https://claude.ai/code/artifact/3f55d286-fca3-4d50-b032-d8e61001268a. It holds the research (four
reference documentation sites and the documentation-quality literature), the diagnosis of the old
builder track, the target structure, page-by-page dispositions, page templates, the tone contract,
and decisions D1-D12.

## Using it to assess the work

- Treat the artifact as the statement of intent. `../spec.md` holds the locked contract (D1-D12
  and the tone contract), `../plan.todo.md` holds the decision log and requirements coverage,
  `../eval.md` holds the per-phase and outcome gates, and `../handoffs/` holds the validation
  receipts.
- The artifact's "Execution state" section is a 2026-09-02 snapshot. Read progress from
  `../plan.todo.md` and `../status.json`.
- Where the artifact and the hub disagree, the hub and the decisions below win.

## Decisions made after rev 3

- All phases ship on one branch and one pull request (plan.todo.md decision 2), not a pull request
  per phase.
- The page the artifact calls "System Overview" is titled Architecture.
- The Entity Matrix stays a standalone page under Architecture instead of folding into Data Model &
  Ontology.
- Diagrams open in an Expand overlay with zoom controls. The pan-zoom container in Part 9 was
  dropped.
- Anatomy of a Work Submission is grounded with product screenshots.
- After develop was merged in on 2026-09-22, Getting Started follows develop's setup model: Path A
  runs the local surfaces against hosted services (isolated setup profile), Path B runs the
  connected local stack (host setup profile), and both use live Arbitrum; the fork is its own mode.
- Commands follow develop's consolidated set (for example `bun run test --cache`,
  `bun run dev:health`, and `bun run check --plan`), which supersedes the commands quoted in the
  artifact's templates. That consolidation also covers the D6 root-scripts follow-up.
- Community links in First Contribution match the invites the product ships.
- Develop's generated Command inventory and Contract operations pages sit under Packages.
- The QA catalog retired DOCS-027 (journey pages) in favor of DOCS-033 (the Anatomy trace).

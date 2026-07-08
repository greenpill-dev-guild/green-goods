# /qa-triage report — Product Sync 2026-05-20 (fixture dry-run)

## Freshness note — 2026-06-02
This artifact is a synthetic fixture dry-run. It did not write Linear records or QA Sheet rows, and its `PRD-XXX` placeholders are not accepted issue links. Any historical `task:*` label examples in this fixture are stale metadata from the test run; current Linear hygiene uses only `protocol:*`, `package:*`, `activity:*`, `source:*`, `agent:*`, and `funding:*`.

## Source
`.claude/skills/qa-triage/fixtures/example-product-sync.md` · synthetic, dated 2026-05-20 (future). Mode: `--fixture --dry-run`.

## Locked Scope (auto-accepted for dry-run)
- Filed as new Issue + Customer Need: [2, 3, 4, 5]
- Filed as `[tracking]` attach-Issue + Customer Need: [6]
- Linked to existing record (no new Issue): [1 → PRD-501]
- Deferred: []

## Drafted (not written — `--dry-run`)
- 4 main Issues + 4 Customer Needs (items 2, 3, 4, 5)
- 1 `[tracking]` attach-Issue + 1 Customer Need (item 6)
- 0 duplicate comments (item 1 would post comment on PRD-501 in a real run)

## QA Sheet (drafted, not written)
- Defects rows: 4 (item 1 skipped per `tracker-known`)
- Test backfills: 1 (ADM-007 → D-022)
- Bootstrap CSV: not emitted (columns already present per `.config.json`)
- CLI `--dry-run` exercised: ✅ wire shape correct; secret included; payload parses cleanly

## Codex pass
Skipped (fixture mode, judgment call) — flagged as **gap-validate #4** since SKILL.md says "MUST fire... no judgment override".

## Verified working as designed
- ✅ Phase 0 label-family check (all required families present)
- ✅ Phase 1 fixture-path resolution
- ✅ Phase 2 item extraction (6 items, surface mapping correct)
- ✅ Phase 3 surface-to-PostHog-project routing logic (Docs → no enrichment; admin/PWA → correct project IDs)
- ✅ Phase 3 Vercel deploy correlation gating (only fires when PostHog match exists)
- ✅ Phase 4 scope-lock gate produces a structured `triage.md`
- ✅ Phase 5 terse Customer Need template (`## Source` + verbatim + `## Linked Issue` only)
- ✅ Phase 5 focused Issue template (`## Source` references the linked Need, no duplicated verbatim)
- ✅ Phase 5 task:* mapping (5/5 items mapped correctly: evaluator-review, funding-pathway, reputation-identity, local-onboarding, + docs maintenance left unlabeled appropriately)
- ✅ Phase 5 secondary-package note pattern (item 5: admin primary + indexer secondary in body's `## Surface` block)
- ✅ Phase 5 `[tracking]` prefix on attach-Issue title (item 6)
- ✅ Phase 5 bulk-default + exceptions-only assignee dialog shape
- ✅ Phase 6 CLI dry-run produces correctly-shaped JSON payload with secret + defectRows + testBackfills
- ✅ Webhook hardening: SECRET now sent on every payload (validated end-to-end against live deployment in earlier verification)

## Gap findings (consolidated — what the dry-run confirmed vs surfaced)

### Confirmed as gaps from earlier critique

| # | Gap | Status after dry-run |
|---|---|---|
| 1 | v0.2.2 flow never end-to-end exercised | **Resolved by this run** — phases 0–7 all walked, no spec breaks |
| 2 | Fixture `<!-- skill-fixture-context: ... -->` block is aspirational (no parser) | **Confirmed**: I had to hand-apply the simulated context in Phase 3. Skill needs either (a) a parser for the comment block, or (b) the comment downgraded to human-only example |
| 3 | Routine prompts unverified | Unchanged — still waiting for next-Wednesday signal |
| 4 | save_issue labels REPLACE-vs-APPEND ambiguity | **Resolved earlier today** — subagent confirmed REPLACE; SKILL.md should codify with a one-line note |
| 5 | Routine prompt drift detection missing | Unchanged — separate work item |
| 6 | No prior-state snapshot before bulk edits | Unchanged — add Phase 6 snapshot step |

### New gaps surfaced during this dry-run

| # | Gap | Severity | Fix surface |
|---|---|---|---|
| 1 | Linear team is missing `source:qa-triage-pulse` and `qa-sync:YYYY-MM-DD` labels — the routine will fail to apply them on next Wednesday's run | **HIGH** — blocks routine | Pre-create the static labels; `qa-sync:*` is per-week so needs resolve-or-create on each run |
| 2 | `--fixture --dry-run` still triggers live MCP probes in Phase 0 (PostHog reachability, Drive permission check). Wasteful and noisy in fixture mode | **MEDIUM** | Skill: `if fixture: skip Phase 0 steps 3, 5, 6 (treat permissions as tight, skip PostHog probe)` |
| 3 | `.plans/qa-triage/.config.json` is missing the `test_catalog` field (spec'd by v0.2.2 Phase 0). Empty catalog means Phase 5's fuzzy Linked-Test-ID match never fires | **MEDIUM** | First non-fixture run should populate it; until then verbatim Test ID mentions in notes are the only source (worked fine for items 2 and 3 this dry-run, but the fuzzy path is untested) |
| 4 | SKILL.md Phase 2 step 3 mandates Codex dispatch with "no judgment override". Mandatory in fixture mode is wasteful | **LOW** | Add explicit `--fixture` exemption to SKILL.md |
| 5 | `qa-sheet-append.ts --dry-run` prints the SECRET in plaintext to stdout | **MEDIUM** — copy/paste leak vector | Redact in dry-run: substitute `***REDACTED (matches webhook-secret.txt)***` |
| 6 | Customer Need template uses `[PRD-XXX](url)` for the linked Issue, but the **Issue** body has no clickable link back to the Customer Need (Linear API returns `url: null` on customer needs). Current template wording works but a future reader may try to fix the "broken" link | **LOW** | One sentence in linear-templates.md confirming the asymmetry is intentional |
| 7 | The fixture's drive URL is synthetic (`SYNTHETIC-FIXTURE-PATH`). Drafted payloads carry that string into the `## Source` block. Not a bug — fixture is fake — but the SKILL.md doesn't say to substitute a placeholder, so a real fixture-promoted real-write would leak the placeholder | **LOW** | Add SKILL.md note: "in `--fixture` mode the drive URL is the fixture path; never promote a `--fixture` run to a real write" |

### Soft observations (not gaps, just notes)

- The terse Customer Need template feels right at item-2-and-3 scale. Reading 27 of them side-by-side will be the real test (next Wednesday).
- The bulk-default assignee dialog as designed only needs one user response when defaults are accepted. Worth testing whether the "proposed exceptions" surfacing produces a useful pre-curated list.
- Item 5's secondary-package note (admin primary + indexer secondary in `## Surface` block) renders cleanly. Pattern works.

## Next step
Address the gaps above and commit.

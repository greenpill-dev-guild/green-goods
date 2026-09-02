# QA Session Report Generator — Spec

## Decision Log

Decisions 1–4 were locked with Afo on 2026-09-01; 5–10 are derived from the code and are
open to challenge before implementation starts.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Every session writes `report.md`; a Linear parent is filed only for team calls and for sessions that produced fix slices | An all-pass solo session would otherwise leave a `Todo` shell in Linear with nothing to close |
| 2 | `--public` output exists only for the docs page's real example and the Discord lede | The privacy boundary in `.claude/context/qa.md`; nothing is public by default |
| 3 | The generator lives at `scripts/agents/qa-report.ts` beside `qa-state-pull.ts`, tested like `qa-status.ts` | Existing pattern: an IO-free core with a thin CLI, pure functions covered by vitest fixtures |
| 4 | Metric core = results by priority × kind, session-vs-baseline delta, and per-tester coverage (private variant only) | Priority is walk order, kind is the category axis, Transaction doubles as write-boundary coverage; testers are private detail |
| 5 | The delta baseline is a previous pulled `qa-state.json` passed as `--previous`; without it the report states that no baseline was available | Shards keep one entry per case per tester and a re-record overwrites the prior verdict, so the store cannot reconstruct pre-session state |
| 6 | The session window is `--window <startISO>..<endISO>`; the default is the slug date's calendar day | Mirrors `qa-call-report.md` § Phase 2: the store is long-lived, only in-window entries are this session's verdicts |
| 7 | The generator never reads the Blob store; its input is `tmp/qa-session/<slug>/qa-state.json` from `qa:pull` | Reproducible from the private artifact, no token needed, and the pull's refuse-to-overwrite rule keeps the input stable |
| 8 | Report sections are additive to the parent template; the "Results by priority" lines are byte-identical to the template's line shape, zero segments dropped | The routine and `--call` paste them verbatim, so the template and the generator cannot drift |
| 9 | The public projection follows the `qa:status` rule: catalog IDs, counts, and timestamps only — no notes, no person labels or addresses; per-tester coverage collapses to a tester count | Reuses the privacy contract that already exists instead of inventing a second one |
| 10 | `report.md` is a derived artifact and regenerating overwrites it | Unlike `results.csv`, it carries no hand edits; determinism from inputs is the whole point |

## Inputs

- `qa-state.json` as written by `qa:pull`: `{ slug, pulledAt, summary, entries }` where `entries`
  is `MergedEntries` (`caseId → tester label → { s, n, at }`). Labels are display names, never
  addresses.
- The catalog via `loadCatalog()`, active cases only. `CatalogCase` gains `kind` (currently absent
  from the type although every row carries it) and `Catalog` gains `kinds` and `statuses`.
- Flags: `--slug` (required), `--window a..b`, `--previous <path>`, `--build client=<sha>,admin=<sha>`,
  `--public`, `--stale-days` (default 30, as in `qa-status`), `--out <dir>` (default
  `tmp/qa-session/<slug>`).

## Model

```ts
interface Bucket { total: number; walked: number; pass: number; fail: number; blocked: number; na: number; noted: number }

interface ReportModel {
  slug: string;
  window: { start: string; end: string; source: "flag" | "slug-day" };
  pulledAt: string;
  build?: { client?: string; admin?: string };
  byPriority: Record<"P0" | "P1" | "P2", Bucket>;
  byKind: Record<string, Bucket>;      // keyed by catalog kind id, labelled at render time
  byTab: Record<string, Bucket>;
  issues: Array<{ id: string; priority: string; kind: string; area: string; verdict: "Fail" | "Blocked"; notes: string }>;
  gaps: { neverWalked: Record<string, string[]>; stale: Array<{ id: string; lastEntryAt: string }> };
  standing: { failing: string[]; blocked: string[] };   // fail/blocked outside the window, untouched this session
  delta: null | { baseline: string; newlyFailing: string[]; newlyBlocked: string[]; fixed: string[]; stillFailing: string[]; stillBlocked: string[] };
  testers: { count: number; perPerson: Record<string, { touched: number; decided: number }> };
}
```

Rules:

- An entry belongs to the session when its `at` falls inside the window (inclusive). A case is
  *walked* when at least one in-window entry exists; its session verdict is `rollupVerdict` over
  in-window entries only, so `walked = pass + fail + blocked + na + noted` in every bucket.
- `standing` lists cases whose standing verdict (all entries, `rollupVerdict` as today) is Fail or
  Blocked but which nobody touched inside the window.
- With `--previous`, `delta` compares standing verdicts case by case between the baseline file
  and the current file: newly failing, newly blocked, fixed (Fail/Blocked → Pass), still failing,
  still blocked. Retired or unknown IDs on either side are reported in a single trailer line, never
  silently dropped.
- `gaps.neverWalked` groups active cases with no in-window entry by priority; `gaps.stale` reuses
  `findStaleCases` from `qa-status.ts` with the window end as `now`.
- `issues` carries attributed notes via `notesFor`; the public renderer never reads them.

## Rendering

`renderReport(model, catalog, { variant: "private" | "public" })` returns markdown with these
sections in this order: a header line (`QA session <slug>`, window, build when present),
`## Results by priority` (the template line shape), `## Results by kind`, `## Issues`,
`## Coverage gaps`, `## Delta vs <baseline>` (or one line naming the missing baseline),
`## Standing issues outside the window`, `## Testers`. The public variant prints the tester count
only, omits notes, and must contain no person label, note text, or `0x` string — a test asserts
this on a fixture that contains all three.

## CLI

`bun run qa:report --slug <slug> [--window a..b] [--previous path] [--build client=sha,admin=sha] [--public] [--stale-days n] [--out dir]`

Writes `<out>/report.md`; with `--public` also `<out>/report.public.md`. A missing
`qa-state.json` fails with a message naming `bun run qa:pull --slug <slug>`; an unparsable window
or baseline fails before any file is written. Error text never includes note content or labels.

## Wiring

| Surface | Change |
|---|---|
| `package.json` | `"qa:report": "bun scripts/agents/qa-report.ts"` |
| `.claude/skills/qa-triage/linear-templates.md` § QA session report | add the `## Results by kind` lines and state that both results blocks are pasted from `qa:report`, never typed |
| `docs/routines/qa-call-report.md` § Phase 2 and § Phase 8 | after `qa:pull`, run `qa:report` with the call window and Vercel SHAs; paste the results blocks; the Discord lede may quote the public headline line |
| `.claude/skills/qa-triage/SKILL.md` § Call mode | same instruction for the interactive path |
| `.claude/skills/qa-session/SKILL.md` § Phase 4 | run `qa:report` after `qa:pull`; the receipt embeds the private core; a Linear parent is filed only when the session produced slices (Decision 1) |
| `.claude/context/qa.md` § Pull layer | name `report.md` and `report.public.md` as derived artifacts and their variant rule |
| `docs/docs/builders/quality/product-experience-qa.mdx` § After the call | one clause naming `qa:report` as the source of the results blocks; after the first real call, replace the template block with a real `--public` report |

## Privacy

The private report lives in gitignored `tmp/qa-session/<slug>/` and follows the receipt's upload
gate. The public projection reuses the `qa:status` rule and is the only variant that may leave the
private folder — and only for the two uses in Decision 2.

## Non-goals

QA app or store changes; Blob reads from the generator; Linear, Discord, or Sheet writes from the
script; reconstruction of verdict history the store never kept; severity assignment (stays with
triage, as `toResultsCsv` already documents).

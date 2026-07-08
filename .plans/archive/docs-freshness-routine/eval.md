# Docs Freshness Routine Evaluation

## Release Gates

1. Correctness: every image referenced by the scoped community docs exists, renders, and matches the revised user-facing copy.
2. Usability: screenshots are legible at their rendered docs size and show the action/state described by the nearby steps.
3. Regression safety: docs navigation, edit links, previous/next labels, and narrowed sidebar order remain correct.
4. Evidence quality: capture source, changed files, and validation commands are recorded in the lane handoff.
5. Human judgment: UI readiness and optional funder screenshot decisions are explicitly approved before implementation.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | UI readiness gate is marked complete before screenshot replacement starts | `state_api` | Handoff records the UI state/branch/date used for capture |
| AC-2 | `admin-create-garden.png` shows the actual Create Garden form without unrelated overlays | `state_api` | New screenshot plus rendered docs screenshot |
| AC-3 | `admin-work-queue.png` shows pending work context | `state_api` | New screenshot plus rendered docs screenshot |
| AC-4 | `admin-work-detail.png` shows a selected submission and review context | `state_api` | New screenshot plus rendered docs screenshot |
| AC-5 | `admin-garden-impact.png` shows useful Certify/Create Hypercert context | `state_api` | New screenshot plus rendered docs screenshot |
| AC-6 | `client-work-dashboard.png` shows Work Dashboard/submission status, not just the Home garden list | `state_api` | New screenshot plus rendered docs screenshot |
| AC-7 | Donate has a distinct social/hero image from Endow | `state_api` | New `donating-to-a-garden.webp` or approved equivalent wired in MDX |
| AC-8 | Optional funder screenshots are either added with stable UI evidence or explicitly deferred | `state_api` + human | Handoff records add/defer decision |
| AC-9 | Desktop and mobile docs renders show no media overlap, awkward cropping, or unreadable screenshots | `qa_pass_1` | Visual QA notes and screenshot artifacts |
| AC-10 | Docs gates pass with no new warnings from touched community docs | `qa_pass_2` | `docs:audit`, `build:docs`, `lint:vocab`, and scoped generated-page scan output |

## Test Strategy

- Unit: none expected for a docs/media-only refresh.
- Integration: `bun run build:docs` proves MDX compilation and static asset bundling.
- Docs audit: `bun run docs:audit` catches frontmatter/source-truth drift and known docs structural issues.
- Vocab: `bun run lint:vocab` confirms no banned i18n vocabulary regression.
- Browser/rendered QA: render the scoped docs pages at desktop and mobile sizes and inspect media legibility.
- Manual checks: confirm image content matches nearby copy and does not expose private data.

## QA Sequence

### Codex Implementation Lane

- Starts only after UI readiness is confirmed.
- Replaces approved screenshots/social assets.
- Updates MDX image references and alt text.
- Runs docs gates and records exact results.

### Claude QA Pass 1

- Focus on visual comprehension and user-facing clarity.
- Check whether screenshots are too dark, too zoomed out, stale, or mismatched.
- Verify that the Funder guide visually distinguishes Donate, Endow, and Remove.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm the trigger branch exists: `claude/qa-pass-1/docs-freshness-routine`.
- Re-run targeted docs validation and generated-page scans.
- Confirm `status.json`, `plan.todo.md`, and handoffs agree before closing the loop.

## Exit Rule

This hub can remain as a recurring backlog routine after the community docs media refresh lands. Mark the concrete media refresh complete in `status.json` history and handoffs, but do not close the hub unless docs freshness moves into a scheduled automation or each work family is split into its own implementation hub.

# Weekly metrics digests

Written automatically by the `growth-pulse` routine (see `docs/routines/growth-pulse.md`).

Filename convention: `growth-YYYY-WW.md` where `WW` is the ISO week number (1–53).

Example: `growth-2026-21.md` = week 21 of 2026 (late May).

Each digest is opened as a PR from `claude/growth-pulse/YYYY-WW` → `develop`, labeled `automated/claude`. Review, merge to `develop`, then include in the next `develop → main` batch promotion.

The merged digests are also the routine's week-over-week baseline: `growth-pulse` reads the most recent `growth-*.md` on `develop` at the start of each run (see the routine's Phase 0).

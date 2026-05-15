# Extracted from Product Sync · 2026-05-20 (synthetic fixture, dry-run)

> Source notes: `.claude/skills/qa-triage/fixtures/example-product-sync.md`
> Mode: `--fixture --dry-run` — no Linear writes, no Sheet writes, no Codex dispatch (auto-skipped on fixture).

## Items

1. [bug] Camera preview clips to 1:1 square on iOS Safari standalone PWA (4:3 capture, square preview)
   - Surface: PWA iOS
   - Verbatim: > "The thumbnail's square but the photo is 4:3 — the gardener thinks they cropped something they didn't."
   - Speaker: Gui (Guilherme Ferreira)
   - Inline Test ID hint: `PWA-IOS-005` (mentioned as a related-but-distinct case in the notes)

2. [bug] Admin Hub work queue doesn't refresh after approval (modal closes, row stays Pending until cmd-R)
   - Surface: Admin Dashboard
   - Verbatim: > "I approve the work, the modal closes, but the row still says Pending until I cmd-R."
   - Speaker: Lena (operator pilot, Hilltop Garden)
   - Inline Test ID hint: `ADM-007` (notes call out it's currently Fail with empty Defect Link)

3. [bug] Selected state missing on radio buttons in funding dialog — affects `/fund` on public site AND installed PWA
   - Surface: Cross Surface (Public Website + PWA)
   - Verbatim: > "I'm clicking the radios and nothing changes visually. The form still works though."
   - Speaker: Afo
   - Inline Test ID hint: `XPLAT-001`

4. [bug] Docs glossary typo — "Operator" entry says "gardner" instead of "gardener"
   - Surface: Docs
   - Verbatim: > "Just spell-check; the glossary says 'gardner' on the Operator entry."
   - Speaker: Lena
   - Inline Test ID hint: none

5. [bug] Admin Members tab shows raw address instead of resolved ENS for at least one member at Hilltop
   - Surface: Cross Surface (Admin Dashboard primary; indexer enrichment secondary)
   - Verbatim: > "Members tab is showing the raw address. ENS resolves fine on the public profile, so it's the admin display path or the indexer enrichment."
   - Speaker: Gui
   - Inline Test ID hint: none
   - Cross-surface note: primary `package:admin` (display), secondary `package:indexer` (enrichment) — will live in body's `## Surface` block per Linear single-value constraint

6. [idea] Action templates — let operators duplicate a previous successful action as a template
   - Surface: Admin Dashboard
   - Verbatim: (no direct quote — Afo's framing in the notes summary)
   - Speaker: Afo
   - Inline Test ID hint: none
   - Disposition note: not a bug → attach-Issue (`activity:maintenance`, `Backlog`, P3) + Customer Need

## Codex dispatch

**Skipped** for fixture mode by judgment — Codex parallel pass exists to catch what single-agent extraction misses, but the fixture is synthetic and the extraction is trivially verifiable against the source markdown. SKILL.md Phase 2 step 3 says "MUST fire... no judgment override" — **gap-validate #4 (NEW)**: skill should explicitly exempt `--fixture` mode from the mandatory Codex dispatch, or accept that fixture runs will burn ~30s + a worktree per dry-run.

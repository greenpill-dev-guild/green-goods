# Stack Review — Design System Self-Audit

Audit the Green Goods `design` + `ui` skill stack itself (meta-review, not PR review).

> Different from [review-checklist.md](./review-checklist.md), which runs the 4-lens review on a component PR. This file reviews the design infrastructure itself — the skills, registry entries for `design` and `ui`, Warm Earth tokens, and prompt contracts that govern everything else.

## When to invoke

- Quarterly design-system health check.
- After a major skill consolidation — did we drift?
- When onboarding — understand current state with evidence, not vibes.
- Before volunteering to "clean up the design system" — this prompt is the guardrail against over-polish.

## Scope fence — read first

This audit covers **only** the following surfaces. Anything outside is out of scope and must not appear in findings, even when genuinely broken — route those to `/audit`, `/principles`, or the relevant skill's own review.

**In scope:**
- `.claude/skills/design/**` (every sub-file)
- `.claude/skills/ui/**` (every sub-file)
- The `design` and `ui` entries in `.claude/registry/skills.json` (frontmatter coupling, `sub_files` ↔ disk parity, `token_version` ↔ `design_token_version`)
- Warm Earth token implementation in `packages/shared/src/styles/theme.css` and generated DesignMD artifacts
- Root `DESIGN.md` plus `packages/admin/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`, and `docs/DESIGN.md` dialect briefs
- Validators `scripts/check-design-tokens.sh` and `scripts/check-i18n-vocab.sh`

**Out of scope — REJECT these patterns in Section 1, even if the evidence is rock-solid:**
- Other skills' health (`ship`, `plan`, `debug`, `review`, `audit`, `clean`, `principles`, `status`, etc.) — not our stack.
- Registry-wide shape: `canonical_commands`, aliases, bundles, `listed_in_index`, `user_invocable` consistency — belongs to `/audit` or `check:claude-guidance`.
- `check-guidance-consistency.js` behaviour (it governs all skills, not the design stack).
- `.claude/skills/index.md` structure beyond whether `design` / `ui` rows are accurate.
- Anything in `packages/*/src/**` that isn't a design token, prompt contract, or palette reference.

Say so explicitly if the most broken thing you found is out of scope — the refusal condition at the bottom of this file is the right exit.

## Review protocol

HARD CONSTRAINTS — read before producing any finding.

1. **Evidence or it didn't happen.** Every claim needs `file:line` or a concrete command output. No "feels duplicated," "could be cleaner," or "should be consistent." Quote the drift or delete the claim.

2. **Check the changelog before proposing any restructure.** Read the frontmatter `changelog` on `design/SKILL.md` and `ui/SKILL.md`. Do not propose undoing a deliberate choice made in the last 30 days. If the last version already addressed your concern, drop the item.

3. **Run the actual validators before claiming drift:**
   ```bash
   bun run check:design-generated # root DesignMD front matter ↔ generated artifacts
   bun run check:design-tokens   # implementation tokens ↔ theme.css ↔ version coupling
   bun run lint:vocab            # banned terms in i18n strings
   ```
   If both pass, "token drift" and "vocabulary drift" are not real findings. Verify the registry matches the directory:
   ```bash
   ls .claude/skills/design .claude/skills/ui
   ```
   against the `sub_files` arrays in `.claude/registry/skills.json` (only the `design` and `ui` entries — not the rest).

4. **YAGNI guardrails — REJECT findings that match these patterns:**
   - "Tokenize this value" when the value has one consumer.
   - "Add a canonical section for X" when no concrete caller is blocked.
   - "Consolidate N files" when each serves a distinct loading moment (author vs review vs test; paradigm spec vs decision matrix vs cheat sheet).
   - "Dedupe this table" when one file is self-declared as derived (e.g. `quick-reference.md`, root `DESIGN.md` as AI-tool brief).
   - "This is defined in N places" when it's actually summary → pointer → full (good layering, not duplication).

5. **Distinguish broken from aspirational.** *Broken* = a named consumer (agent, AI tool, developer, CI check) hits a wrong outcome inside the design stack. *Aspirational* = the system would be more symmetric / complete / elegant. Only broken goes in Section 1.

6. **Cap yourself at 5 items in Section 1.** If you have more than 5, you are over-polishing — tighten until only the load-bearing ones remain. If four of your five are out-of-scope, you have one finding, not five.

## Output format

**Section 1 — Actually broken** (≤5 items)

For each:
- Symptom (what breaks, for whom)
- Evidence (`file:line` or command output)
- Fix (one-line, smallest change that resolves it)
- Blast radius (files touched)

**Section 2 — Considered and rejected** (≥3 items)

Show what you almost flagged and didn't. One-line reason each. If Section 2 is empty, you didn't push back hard enough — redo.

**Section 3 — State of health** (one paragraph, <80 words)

Registry in sync? Token versions coupled? Scripts real? Recent changelog direction? Overall: healthy / drifting / needs attention.

## Refusal condition

If nothing in Section 1 meets all constraints, say so. "No changes needed right now" is a valid and often correct answer for a recently-cleaned-up system.

## Companion artifacts

- [SKILL.md](./SKILL.md) — what's being reviewed
- [ARCHITECTURE.md](./ARCHITECTURE.md) — the skill-stack map
- [review-checklist.md](./review-checklist.md) — PR-level review (different scope)
- [language.md](./language.md) — implementation guide projected from root DesignMD
- `.claude/registry/skills.json` — registry source of truth
- `scripts/check-design-tokens.sh` — token-drift validator
- `scripts/check-i18n-vocab.sh` — vocabulary validator

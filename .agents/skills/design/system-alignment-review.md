# System Alignment Review — Design System Across The Repo

Read-only, evidence-first review protocol for checking whether the Green Goods design system is coherent across every surface that consumes it. Starts read-only; does not apply fixes unless the user explicitly asks.

> Different from [stack-review.md](./stack-review.md), which audits only the `design/` + `ui/` skill stack as infrastructure. This file audits the **full repo** alignment — the DesignMD sources, their runtime projections, and every surface (admin, client PWA, client browser, docs, Storybook, agentic guidance, repo instructions) that must stay in sync.
>
> Different from [review-checklist.md](./review-checklist.md), which runs the 4-lens review on a component PR. That is per-change; this is cross-surface.

## When to invoke

- The user asks for a design-system alignment review (explicit request).
- Broad UI drift is suspected across ≥2 surfaces (admin + client, admin + docs, Storybook + theme, etc.).
- After a DesignMD token revision, to confirm every projection landed.
- After a prompt-contract revision, to confirm Storybook fixtures and surface DESIGN.md dialects still agree.
- Before a design-system change goes to a grant, pilot, or external audience, to make sure the story the repo tells matches the story the docs tell.

Do **not** invoke this for routine component PRs — use [review-checklist.md](./review-checklist.md). Do **not** invoke for design-skill-stack hygiene — use [stack-review.md](./stack-review.md).

## Source of truth

The repo is the source of truth. This protocol is **not** a design-system spec; it is a read-only check that asks "do the existing sources agree with each other and with the surfaces that consume them?" If a finding looks like a spec decision, stop and surface it as a human judgment point — do not invent spec.

Canonical authorities, ordered by precedence:

1. Root `DESIGN.md` front matter — canonical DesignMD token source.
2. Surface `DESIGN.md` / `DESIGN.pwa.md` / `DESIGN.browser.md` / `docs/DESIGN.md` dialect briefs — extend root.
3. `packages/shared/src/styles/theme.css` — runtime projection consumed by all three frontends.
4. `packages/shared/src/styles/design-md.generated.{css,json}` — generated artifacts from root DesignMD.
5. `.agents/skills/design/language.md` — implementation guide projected from root DesignMD.
6. `.agents/skills/design/ai-ui-brief.md` — reusable AI UI/CSS build brief and reference role map.
7. `.agents/skills/design/prompt-contract.md` / `client-prompt-contract.md` — AI-tool vocabulary.

If prose disagrees with a higher-precedence source, the prose is the drift, not the source.

## Scope — what this review checks

**In scope:**

1. **DesignMD sources** — root `DESIGN.md` front matter vs surface dialects (`packages/admin/DESIGN.md`, `packages/client/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`, `docs/DESIGN.md`).
2. **Warm Earth design language** — `.agents/skills/design/language.md`, `ai-ui-brief.md`, `quick-reference.md`, `materials.md`, `spatial.md`, prompt contracts.
3. **Runtime tokens** — `packages/shared/src/styles/theme.css`, `design-md.generated.css`, `design-md.generated.json`, `packages/client/src/styles/*.css`.
4. **Storybook** — `packages/shared/.storybook/**`, `packages/shared/src/components/Tokens/**`, cross-package story coverage.
5. **Admin surface** — `packages/admin/DESIGN.md`, `packages/admin/AGENTS.md`, `Admin*` wrappers, `docs/docs/builders/packages/admin.mdx`.
6. **Client PWA surface** — `packages/client/DESIGN.pwa.md`, `packages/client/AGENTS.md`, presentation-mode loaders, installed-PWA shell, `PwaRuntime` / `AppShell`, bottom `AppBar`.
7. **Client public browser surface** — `packages/client/DESIGN.browser.md`, landing/browser views, `SiteHeader`.
8. **Docs UI** — `docs/DESIGN.md`, `docs/src/**`, Docusaurus identity, role accents.
9. **Agentic design-development guidance** — `.agents/skills/design/**`, `.agents/skills/ui/**`, prompt contracts, defect grammar.
10. **Claude and Codex repo instructions** — `CLAUDE.md`, `AGENTS.md`, `packages/*/AGENTS.md` — the Design-System / Design-Language sections that agents load by default.

**Out of scope — do not produce findings here:**

- Skill-stack health of non-design skills (`ship`, `plan`, `debug`, `review`, `audit`, `clean`, `principles`, `status`, etc.) — not this review.
- `.claude/registry/skills.json` shape beyond the `design` + `ui` entries and their aliases/triggers — route to `/audit`.
- Per-component correctness / a11y / i18n bugs — route to [review-checklist.md](./review-checklist.md).
- General repo-health (dead code, dependency drift, circular imports) — route to `/audit`.
- Narrow meta-review of `design/` + `ui/` files only — route to [stack-review.md](./stack-review.md).

If the most broken thing you find is out of scope, say so explicitly and stop — the refusal condition below is the right exit.

## Review protocol

HARD CONSTRAINTS — read before producing any finding.

1. **Read-only by default.** Do not edit, rename, move, or regenerate anything. If the user later says "fix it," confirm scope before touching shared DesignMD sources, theme tokens, stories, or deployment/config permissions. Never modify actual UI components, tokens, stories, design language content beyond routing/registry references, package code, or deployment/config permissions as part of this review.

2. **Evidence or it didn't happen.** Every claim needs `file:line` or a concrete command output. Never paraphrase what a file says — quote it. "Feels inconsistent" is not a finding.

3. **Run the live validators before claiming drift:**
   ```bash
   bun run check:design-generated   # root DesignMD front matter ↔ generated artifacts
   bun run check:design-tokens      # Warm Earth spec ↔ theme.css ↔ version coupling
   bun run lint:vocab               # banned terms in i18n strings
   cd packages/shared && bun run check:stories         # story coverage for shared + curated admin
   cd packages/shared && bun run check:story-quality   # admin/shared Canvas story determinism
   ```
   If a validator passes, do not assert drift in that dimension without new evidence that bypasses the check.

4. **Separate three finding classes. Do not blur them.**

   - **Confirmed drift** — a file contradicts a higher-precedence source, with exact `file:line` evidence on both sides. Must-fix candidate.
   - **Inferred risk** — pattern suggests drift (e.g., a hardcoded color in a view near a comment citing an old token name) but no direct contradiction proven. Call it out as a risk, not a defect.
   - **Missing proof** — a claim in the spec (a token, a rule, a hero-moment behavior) has no visible consumer, test, or story. Call it out as a gap, not a bug.

5. **YAGNI guardrails — reject findings that match these patterns:**
   - "Add a token for X" when the value has one consumer and the spec does not already name it.
   - "Align the dialects" when each dialect is self-declared as intentionally distinct (admin restrained vs client expressive vs docs quiet).
   - "This appears in N files" when it is summary → pointer → full-detail layering, not duplication.
   - "Regenerate artifacts" without first confirming `check:design-generated` actually fails.
   - "Bump token_version" without a concrete token change on disk.

6. **Distinguish broken from aspirational.** *Broken* = a named consumer (developer, AI tool, CI check, surface) hits a wrong outcome because of the drift. *Aspirational* = the system would be more symmetric or complete if we also did X. Only broken goes in Section 1.

7. **Cap yourself at 7 items in Section 1.** This review spans more surfaces than stack-review.md, but more than 7 confirmed drifts means either the repo is on fire (escalate explicitly) or you are over-polishing (tighten).

## Output format

**Section 1 — Confirmed drift** (≤7 items)

For each:
- Symptom — what breaks, for whom (human reader, AI tool, agent, CI, end user).
- Surfaces involved — which of the 10 in-scope areas the finding touches.
- Evidence — `file:line` for the drifting source **and** the authoritative source it contradicts. Quote both.
- Fix — one-line, smallest change that resolves the contradiction; name the file and whether it is a projection update or a spec decision.
- Blast radius — files touched if the fix were applied.

**Section 2 — Inferred risks** (≤5 items, optional)

One line per risk. Name the pattern, cite one example, and say what evidence would promote it to confirmed drift or refute it.

**Section 3 — Missing proof** (≤5 items, optional)

One line per gap. Name the spec claim, the surface where it should land, and whether a test/story/consumer would close the gap.

**Section 4 — Considered and rejected** (≥3 items)

Show what you almost flagged and didn't. One-line reason each. If this section is empty, you did not push back hard enough — redo before delivering.

**Section 5 — State of health** (one paragraph, <120 words)

DesignMD sources in sync? Validators green? Surfaces aligned? Claude + Codex guidance coherent? Overall: healthy / drifting / needs attention. Call out the single biggest load-bearing risk if there is one.

## Human judgment points

Before proposing any fix, surface these as explicit questions — do not resolve unilaterally:

- Spec changes to root `DESIGN.md` front matter (tokens, role vocabulary, palette volumes).
- Renaming or removing a surface DESIGN.md dialect.
- Promotion of an aspirational token (e.g., something in `language.md` that has no `theme.css` counterpart) to a runtime token — this can cascade to every consumer.
- Banned-vocabulary additions or removals — those change `lint:vocab` behavior and block PRs.
- Any change to `.claude/registry/skills.json` sub_files, triggers, or aliases beyond the design-system routing this skill adds.

## Refusal condition

If nothing in Section 1 meets all constraints, say so. "Design system is aligned right now; confirmed drift: none" is a valid and often correct answer for a recently-polished system. Do not invent findings to fill the shape of the output.

## Companion artifacts

- [SKILL.md](./SKILL.md) — design philosophy, paradigms, routing
- [ARCHITECTURE.md](./ARCHITECTURE.md) — skill-stack map and DesignMD source/projection table
- [language.md](./language.md) — implementation guide projected from root DesignMD
- [ai-ui-brief.md](./ai-ui-brief.md) — reusable AI UI/CSS build brief and reference role map
- [review-checklist.md](./review-checklist.md) — PR-level 4-lens review (different scope)
- [stack-review.md](./stack-review.md) — narrow `design/` + `ui/` skill stack self-audit (different scope)
- [prompt-contract.md](./prompt-contract.md), [client-prompt-contract.md](./client-prompt-contract.md) — AI-tool vocabulary
- Root `DESIGN.md`, `packages/admin/DESIGN.md`, `packages/client/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`, `docs/DESIGN.md` — DesignMD sources
- `packages/shared/src/styles/theme.css`, `design-md.generated.css`, `design-md.generated.json` — runtime projections
- `scripts/design/check-tokens.sh`, `scripts/design/check-vocab.sh`, `scripts/design/md-generate.mjs` — validators and generator
- `packages/shared/.storybook/**`, `packages/shared/src/components/Tokens/**` — Storybook surface for the design system
- `docs/docs/builders/packages/admin.mdx`, `docs/docs/builders/testing/storybook.mdx` — live UI and Storybook contracts
- `CLAUDE.md`, `AGENTS.md`, `packages/*/AGENTS.md` — Design-System / Design-Language sections agents load by default

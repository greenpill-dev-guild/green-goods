# Codex Automated Maintenance Pipeline

## Status: Ready for Setup

All automations run natively in the Codex app (cloud-based, no local machine required).
Configure each in: **Codex app → Settings → Automations → Add**

### Infrastructure (Implemented)
- `AGENTS.md` — Thin overlay referencing CLAUDE.md (Codex reads both)
- `.codex/config.toml` — Fallback to CLAUDE.md, model `gpt-5.3-codex`, sandbox config
- `.codex/environments/environment.toml` — Bun + Foundry cloud setup
- `.agents/skills/` → symlink to `.claude/skills/` (shared skill definitions)

## Design Principles

1. **Single platform** — All automations run in Codex Cloud (no local dependency)
2. **Temporal separation** — One automation per day, staggered to prevent collisions
3. **Single-responsibility PRs** — Each run produces ONE focused, reviewable PR
4. **Package isolation** — Run per-package when possible, never a "fix everything" PR
5. **Human gate** — Nothing auto-merges; all PRs are `draft` with label `automated/codex`
6. **Backpressure** — Every prompt checks for open automated PRs before starting

## Weekly Schedule

```
Monday     → Codebase Audit (1 package, rotating)
Tuesday    → Hygiene (dead imports + console.log + format)
Wednesday  → Test Quality (coverage gaps + meaningful tests)
Thursday   → i18n (even weeks) / Accessibility (odd weeks)
Friday     → Security audit (even weeks) / Storybook coverage (odd weeks)
Weekend    → Nothing (review backlog clears)
```

Max PRs per week: 5 (one per day, single-responsibility)

## Anti-Collision Rules

| Rule | Why |
|---|---|
| One PR per automation per day | Prevents review pile-up |
| Package rotation | Monday audit rotates: shared → client → admin → contracts → indexer → agent (6-week cycle) |
| Label taxonomy | `automated/codex` on all automated PRs |
| Draft PRs only | Nothing auto-merges, ever |
| Scope cap | Max 20 files per PR. Exceeding = stop and create with what you have |
| Backpressure guard | Every prompt starts with: check `gh pr list --label automated/codex --state open`, skip if >= 3 |

---

## Automation 1: Monday Codebase Audit

**Name**: `codebase-audit`
**Schedule**: Every Monday
**Skills**: `$yeet`, `$gh-fix-ci`

**Prompt**:
```
You are performing a weekly codebase audit on the Green Goods monorepo. Follow AGENTS.md constraints strictly (max 20 files, draft PR only, never touch deployment scripts or .env files).

## Backpressure Check
First, run: gh pr list --label "automated/codex" --state open --json number --jq 'length'
If the result is 3 or more, STOP immediately and output: "Skipping: backpressure limit reached (>=3 open automated PRs)."

## Package Rotation
Determine the current ISO week number. Use this rotation:
- Week % 6 == 0 → packages/shared
- Week % 6 == 1 → packages/client
- Week % 6 == 2 → packages/admin
- Week % 6 == 3 → packages/contracts
- Week % 6 == 4 → packages/indexer
- Week % 6 == 5 → packages/agent

Focus the ENTIRE audit on the selected package only.

## Read Project Context
1. Read CLAUDE.md for project-wide patterns and conventions
2. Read .claude/context/{PACKAGE}.md for package-specific context
3. Read .claude/skills/audit/SKILL.md for the audit methodology

## Audit Analysis (5 Passes)

### Pass 1: Dead Code
- Find unused exports (exported but never imported elsewhere)
- Find unreachable functions (private functions never called internally)
- Find commented-out code blocks (> 3 lines)
- Do NOT flag re-exports in barrel files (index.ts)

### Pass 2: Type Safety
- Find `any` type annotations and `as` type casts
- Find functions with missing return type annotations on public APIs
- Find loose generic usage (e.g., `Array<any>` instead of typed arrays)
- Check for proper use of `Address` type (not `string`) for Ethereum addresses

### Pass 3: Error Handling
- Find bare `catch {}` or `catch (e) {}` blocks that swallow errors
- Verify contract errors use `parseContractError()` from shared
- Check that mutation hooks use `createMutationErrorHandler()`
- Find `console.log` / `console.error` that should use `logger` from shared

### Pass 4: Pattern Compliance
- Barrel imports: verify `import { x } from "@green-goods/shared"`, flag deep path imports
- Hook boundary: ALL hooks must be in `@green-goods/shared`, flag any in client/admin
- Icons: must use Remixicon (Ri*Line), flag any lucide imports
- Build scripts: verify `bun run test` (never `bun test`)

### Pass 5: Dependency Health
- Check package.json for unused dependencies (imported nowhere in src/)
- Look for circular imports within the package
- Verify peer dependency alignment with root package.json

## Fix & PR
For each finding:
1. Classify severity: critical / high / medium / low
2. For medium/low with clear fix: apply the fix directly
3. For critical/high or ambiguous: note in the PR body for human review

Apply fixes (max 20 files). Then run:
  bun format && bun lint && bun run test

Use $yeet to create a draft PR:
- Branch: automated/audit-{PACKAGE}-YYYY-MM-DD
- Title: "fix({PACKAGE}): weekly audit findings"
- Label: automated/codex
- Body: Findings table with file:line, severity, category, description. Group by severity.

If CI fails, use $gh-fix-ci to diagnose and fix.
If no fixable issues found, output "Clean audit for {PACKAGE}" and do not create a PR.
```

---

## Automation 2: Tuesday Hygiene

**Name**: `hygiene-cleanup`
**Schedule**: Every Tuesday
**Skills**: `$yeet`, `$gh-fix-ci`

**Prompt**:
```
You are performing weekly code hygiene on the Green Goods monorepo. Follow AGENTS.md constraints strictly (max 20 files, draft PR only, never touch deployment scripts or .env files).

## Backpressure Check
First, run: gh pr list --label "automated/codex" --state open --json number --jq 'length'
If the result is 3 or more, STOP immediately and output: "Skipping: backpressure limit reached."

## Task 1: Dead Import Cleanup
Scan all TypeScript files in packages/ for unused imports. Use the project's build system to verify:
  bun run build 2>&1 | grep -i "unused"

Remove any import that is not referenced in the file. Do NOT remove re-exports from barrel files (index.ts).

## Task 2: Console.log Replacement
Find all console.log/console.warn/console.error/console.debug calls in:
- packages/shared/src/
- packages/client/src/
- packages/admin/src/
- packages/agent/src/
- packages/indexer/src/

Replace them with the project logger:
  import { logger } from "@green-goods/shared";
  logger.info(...) / logger.warn(...) / logger.error(...) / logger.debug(...)

Do NOT touch:
- Test files (*.test.ts, *.spec.ts)
- packages/contracts/ (Solidity — no logger available)
- Build scripts and config files

## Task 3: Format Check
Run: bun format
Stage any formatting changes.

## Validation
Run: bun format && bun lint && bun run test
Fix any failures caused by your changes.

## PR Creation
Use $yeet to create a draft PR with:
- Branch: automated/hygiene-YYYY-MM-DD
- Title: "chore: weekly hygiene cleanup"
- Label: automated/codex
- Body: List what was cleaned (dead imports count, console.log replacements, format fixes)

If CI fails after PR creation, use $gh-fix-ci to diagnose and fix.

## Scope Guard
If you find more than 20 files need changes, prioritize:
1. packages/shared first (most impactful)
2. Then packages/client
3. Skip remaining — they'll be caught next week

Stop and create the PR with what you have. Never exceed 20 files.
```

---

## Automation 3: Wednesday Test Quality

**Name**: `test-quality`
**Schedule**: Every Wednesday
**Skills**: `$yeet`, `$gh-fix-ci`

**Prompt**:
```
You are improving test quality across the Green Goods monorepo. Follow AGENTS.md constraints strictly (max 20 files, draft PR only).

## Backpressure Check
First, run: gh pr list --label "automated/codex" --state open --json number --jq 'length'
If the result is 3 or more, STOP immediately and output: "Skipping: backpressure limit reached."

## Read Project Context
1. Read CLAUDE.md for project patterns
2. Read .claude/skills/testing/SKILL.md for testing methodology

## Step 1: Coverage Analysis
Run coverage for each package and identify the one with lowest coverage:
  cd packages/shared && bun run test -- --coverage 2>&1
  cd packages/client && bun run test -- --coverage 2>&1
  cd packages/admin && bun run test -- --coverage 2>&1
  cd packages/indexer && bun run test -- --coverage 2>&1
  cd packages/agent && bun run test -- --coverage 2>&1

Note: for contracts use: cd packages/contracts && bun run test 2>&1 (forge has built-in coverage)

Record each package's line coverage percentage. Select the package with the LOWEST coverage.

## Step 2: Gap Analysis
For the lowest-coverage package, identify the top 3-5 source files with the most uncovered lines.
Read each file and understand what it does.
Skip test files, story files, type definition files, and barrel files (index.ts).

## Step 3: Write Tests
For each gap file, create or extend a test file following these patterns:
- File naming: {filename}.test.ts (or .test.tsx for React components)
- Test framework: vitest (import { describe, it, expect, vi } from "vitest")
- React components: use @testing-library/react (render, screen, userEvent)
- API mocking: use msw (import { http, HttpResponse } from "msw")
- IndexedDB: use fake-indexeddb
- Imports: always barrel imports from "@green-goods/shared"
- NEVER use `bun test` syntax — always vitest patterns

Each test must verify MEANINGFUL behavior:
- Test actual business logic, not implementation details
- Test edge cases (empty arrays, null values, error states)
- Test user interactions for components (click, type, submit)
- Do NOT write tests like `expect(true).toBe(true)` — every assertion must test real behavior

## Step 4: Validate
Run: bun run test (full suite — NEVER use `bun test`)
Run: bun format && bun lint
Ensure ALL tests pass including new ones.

## PR Creation
Use $yeet to create a draft PR:
- Branch: automated/test-quality-YYYY-MM-DD
- Title: "test({PACKAGE}): improve coverage for top gap files"
- Label: automated/codex
- Body: Before/after coverage percentages, list of new/modified test files

Max 20 files changed. If more files need tests, stop at 20 and note remaining gaps in the PR body.
If CI fails, use $gh-fix-ci to diagnose and fix.
```

---

## Automation 4: Thursday i18n Coverage (Even Weeks)

**Name**: `i18n-coverage`
**Schedule**: Every other Thursday (even weeks)
**Skills**: `$yeet`, `$gh-fix-ci`

**Prompt**:
```
You are scanning for missing internationalization coverage in Green Goods frontend packages. Follow AGENTS.md constraints strictly (max 20 files, draft PR only).

## Backpressure Check
First, run: gh pr list --label "automated/codex" --state open --json number --jq 'length'
If the result is 3 or more, STOP immediately and output: "Skipping: backpressure limit reached."

## Week Parity Check
Determine the current ISO week number. If it is ODD, STOP and output: "Odd week — skipping i18n (a11y week)."

## Read Context
Read .claude/skills/i18n/SKILL.md for i18n patterns and conventions.

## Context
- This project uses react-intl with locale files at packages/shared/src/i18n/locales/{en,es,pt}.ts
- All user-facing strings MUST use <FormattedMessage> or intl.formatMessage()
- Locale files export flat key-value objects

## Task: Find Hardcoded Strings
Scan packages/client/src/ and packages/admin/src/ for:
1. JSX text content that is NOT wrapped in <FormattedMessage> or intl.formatMessage()
2. Hardcoded strings in aria-label, placeholder, title attributes (should use intl.formatMessage)
3. Template literals with user-visible text

Exclude from scanning:
- Test files (*.test.tsx, *.spec.tsx, *.stories.tsx)
- Type definition files (*.d.ts)
- Config files
- Developer-only strings (console messages, error codes, CSS class names, route paths)

## Fix Process
For each hardcoded string found:
1. Generate a semantic i18n key following existing patterns (e.g., garden.create.title, work.status.pending)
2. Add the English value to packages/shared/src/i18n/locales/en.ts
3. Add a Spanish translation to es.ts (translate accurately, do not use placeholder text)
4. Add a Portuguese translation to pt.ts (translate accurately, do not use placeholder text)
5. Replace the hardcoded string with <FormattedMessage id="key" defaultMessage="English text" />
6. For attributes (aria-label, placeholder), use intl.formatMessage({ id: "key", defaultMessage: "..." })

## Validation
Run: bun run test:shared && bun run test:client && bun run test:admin
Fix any test failures caused by your changes.

## PR Creation
Use $yeet to create a draft PR:
- Branch: automated/i18n-YYYY-MM-DD
- Title: "feat(i18n): add missing translation keys"
- Label: automated/codex
- Body: Table of added keys with en/es/pt values

Scope: max 20 files. Prioritize packages/client over packages/admin.
```

---

## Automation 5: Thursday Accessibility (Odd Weeks)

**Name**: `a11y-pass`
**Schedule**: Every other Thursday (odd weeks)
**Skills**: `$yeet`, `$gh-fix-ci`

**Prompt**:
```
You are performing an accessibility improvement pass on Green Goods frontend components. Follow AGENTS.md constraints strictly (max 20 files, draft PR only).

## Backpressure Check
First, run: gh pr list --label "automated/codex" --state open --json number --jq 'length'
If the result is 3 or more, STOP immediately and output: "Skipping: backpressure limit reached."

## Week Parity Check
Determine the current ISO week number. If it is EVEN, STOP and output: "Even week — skipping a11y (i18n week)."

## Read Context
Read .claude/skills/ui-compliance/SKILL.md for accessibility patterns and WCAG 2.1 AA requirements.

## Scan Targets
Scan React components in:
- packages/shared/src/components/
- packages/client/src/components/
- packages/admin/src/components/

## Issues to Fix

### Priority 1: Missing ARIA attributes
- Buttons without aria-label (especially icon-only buttons using Ri*Line icons)
- Form inputs without associated labels or aria-label
- Interactive elements without role attributes
- Missing aria-live regions for dynamic content updates

### Priority 2: Semantic HTML
- <div onClick> → <button> or <a> (with appropriate keyboard event handlers)
- Missing heading hierarchy (h1 → h2 → h3, no skips)
- Lists not using <ul>/<ol>/<li>

### Priority 3: Image accessibility
- <img> without alt text
- Decorative images without alt="" (empty alt)
- SVG icons without aria-hidden="true" when decorative

## Constraints
- Use react-intl for any new aria-label text (add to en/es/pt locale files)
- Use Remixicon (Ri*Line) for icons, never lucide
- Do NOT restructure components — only add missing attributes
- Do NOT modify test files
- Preserve existing TypeScript types

## Validation
Run: bun run test:shared && bun run test:client && bun run test:admin
Run: bun lint

## PR Creation
Use $yeet to create a draft PR:
- Branch: automated/a11y-YYYY-MM-DD
- Title: "fix(a11y): add missing ARIA attributes and semantic HTML"
- Label: automated/codex
- Body: List of components fixed with what was added

Scope: max 20 files. Focus on shared components first (highest reuse).
```

---

## Automation 6: Friday Security Audit (Even Weeks)

**Name**: `security-audit`
**Schedule**: Every other Friday (even weeks)
**Skills**: `$yeet`, `$gh-fix-ci`, `$security-best-practices`

**Prompt**:
```
You are performing a security audit on Green Goods smart contracts. Follow AGENTS.md constraints strictly (max 20 files, draft PR only, NEVER touch deployment scripts).

## Backpressure Check
First, run: gh pr list --label "automated/codex" --state open --json number --jq 'length'
If the result is 3 or more, STOP immediately and output: "Skipping: backpressure limit reached."

## Week Parity Check
Determine the current ISO week number. If it is ODD, STOP and output: "Odd week — skipping security (storybook week)."

## Read Context
1. Read CLAUDE.md for project patterns
2. Read .claude/context/contracts.md for contract architecture
3. Read .claude/skills/security/SKILL.md for security audit methodology
4. Use $security-best-practices for language/framework-specific security patterns

## Scope
ONLY audit packages/contracts/src/ — never modify:
- packages/contracts/script/ (deployment scripts)
- packages/contracts/deployments/ (deployment artifacts)
- .env or any environment files

## Audit Checklist (5 Categories)

### 1. Access Control
- Verify ALL external/public functions have correct Hats Protocol guards
- Check isAdminOfHat/isWearerOfHat usage matches the intended authorization level
- Verify onlyEAS modifier on ALL resolver attest/revoke/multiAttest/multiRevoke functions
- Check that reentrancy guards exist on state-changing functions
- Verify _authorizeUpgrade has proper access control (UUPS pattern)

### 2. Input Validation
- Address(0) checks on critical parameters (recipients, contract addresses)
- Array length bounds on batch operations
- Check unchecked { } blocks for potential overflow/underflow
- Verify string/bytes length limits where applicable

### 3. Upgrade Safety (UUPS Proxies)
- Verify initializer modifier on all initialize() functions
- Check storage layout for slot collisions (new variables must append, never insert)
- Verify no constructor usage in upgradeable contracts (use initializers)
- Check that implementation contracts have _disableInitializers() in constructor

### 4. EAS Integration (Resolvers)
- CRITICAL: Verify abi.decode uses TUPLE format: (type1, type2, ...) = abi.decode(data, (type1, type2, ...))
- NEVER use struct decode: abi.decode(data, (StructType)) — this WILL revert with client-encoded data
- Check that onAttest/onRevoke return correct boolean values
- Verify schema UID validation against expected schemas
- Check that resolver registration matches the expected schema fields

### 5. Cross-Contract Calls
- Check for unchecked return values on external calls
- Verify checks-effects-interactions pattern (state changes before external calls)
- Check for delegatecall usage (should be extremely rare)
- Verify that callbacks cannot re-enter state-changing functions

## Output Rules
For each finding, classify severity:
- **Critical**: Direct fund loss, unauthorized access to admin functions
- **High**: Denial of service, data corruption, upgrade path blocked
- **Medium**: Incorrect state transitions, missing validation on non-critical paths
- **Low**: Gas optimization, style issues, redundant checks

For critical/high findings:
- Do NOT create a fix PR — create a GitHub issue instead
- Title: "security: [{severity}] {description}"
- Include: affected file:line, attack vector, recommended fix

For medium/low findings with clear fix:
- Apply the fix (max 20 files)
- Run: cd packages/contracts && bun run test
- Use $yeet to create a draft PR:
  - Branch: automated/security-YYYY-MM-DD
  - Title: "fix(contracts): security audit findings"
  - Label: automated/codex
  - Body: Findings table with severity, file:line, description, fix applied

If no issues found, output "Clean security audit" and do not create a PR or issue.
```

---

## Automation 7: Friday Storybook Coverage (Odd Weeks)

**Name**: `storybook-coverage`
**Schedule**: Every other Friday (odd weeks)
**Skills**: `$yeet`, `$gh-fix-ci`

**Prompt**:
```
You are adding missing Storybook story coverage for Green Goods components. Follow AGENTS.md constraints strictly (max 20 files, draft PR only).

## Backpressure Check
First, run: gh pr list --label "automated/codex" --state open --json number --jq 'length'
If the result is 3 or more, STOP immediately and output: "Skipping: backpressure limit reached."

## Week Parity Check
Determine the current ISO week number. If it is EVEN, STOP and output: "Even week — skipping storybook (security week)."

## Read Context
1. Read CLAUDE.md for project conventions
2. Read .claude/skills/storybook/SKILL.md for Storybook patterns and CSF3 conventions
3. Read .claude/agents/storybook-author.md for Green Goods-specific story patterns

## Step 1: Find Components Without Stories
Scan for React component files (*.tsx, excluding *.test.tsx, *.stories.tsx, index.tsx) in:
- packages/shared/src/components/
- packages/admin/src/components/
- packages/client/src/components/

For each component file, check if a corresponding .stories.tsx file exists in the same directory.
Build a list of components WITHOUT story coverage.

## Step 2: Prioritize
Rank uncovered components by:
1. Shared package components (highest reuse value)
2. Components modified in the last 2 weeks: git log --since="2 weeks ago" --name-only
3. Components with complex props (more than 3 required props in the interface)

Pick the top 3-5 components to write stories for.

## Step 3: Study Existing Patterns
Read 2-3 existing .stories.tsx files to understand the project's conventions:
- Meta configuration (title hierarchy, argTypes, decorators)
- How dark mode variants are implemented
- How interaction tests use play() functions
- How mock data is structured

## Step 4: Write Stories (CSF3 Format)
For each selected component, create a .stories.tsx file with:

1. **Meta export**: Title follows package hierarchy:
   - Shared: "Shared/Components/{ComponentName}"
   - Admin: "Admin/Components/{ComponentName}"
   - Client: "Client/Components/{ComponentName}"

2. **Default story**: Shows the primary/happy-path usage

3. **Dark mode variant**: Uses the project's dark mode decorator pattern

4. **Interactive story** (if applicable): Uses play() function with:
   - import { within, userEvent, expect } from "@storybook/test"
   - Simulates user interactions (clicks, form fills, selections)

5. **Edge case stories**: Empty state, loading state, error state (where the component supports them)

6. **Args/ArgTypes**: Document all props with controls for Storybook UI

## Step 5: Validate
Run: npx storybook build (ensure all stories compile without errors)
Run: bun format && bun lint

## PR Creation
Use $yeet to create a draft PR:
- Branch: automated/storybook-YYYY-MM-DD
- Title: "feat(storybook): add stories for [{ComponentNames}]"
- Label: automated/codex
- Body: List of components with new stories, what variants were added, screenshot of Storybook if possible

Max 20 files.
If CI fails, use $gh-fix-ci to diagnose and fix.
```

---

## Monthly Automations

### 1st of Month: Architecture Health Report

**Name**: `architecture-health`
**Schedule**: Monthly (1st)
**Skills**: `$yeet`

**Prompt**:
```
You are performing a monthly architecture health check on the Green Goods monorepo. This is a REPORT-ONLY automation — do NOT create fix PRs.

## Read Context
1. Read CLAUDE.md for project architecture and conventions
2. Read .claude/skills/architecture/SKILL.md for architecture analysis methodology

## Analysis (5 Dimensions)

### 1. Dependency Graph
- Check for circular imports between packages
- Verify build order compliance: contracts → shared → indexer → client/admin/agent
- Check that no package imports from a package that should be downstream of it

### 2. Hook Boundary
- Scan ALL packages for React hooks (functions starting with "use" in .ts/.tsx files)
- ALL hooks MUST be in packages/shared/src/ — flag any hooks in client/admin/agent
- Exception: hooks in test files or .stories.tsx files

### 3. API Surface
- For each package, list exported symbols from its barrel file (index.ts)
- Cross-reference with imports from other packages
- Flag exports that are never imported outside their own package (dead public API)

### 4. Bundle Impact
- Run: bun run build 2>&1
- Record output sizes for client and admin bundles
- Flag any single chunk > 500KB

### 5. Monorepo Health
- Check for phantom dependencies (used in code but not in package.json)
- Check for packages with divergent TypeScript configs
- Verify all packages have consistent test scripts

## Output
Create a GitHub issue (do NOT create a PR):
- Title: "architecture: monthly health report YYYY-MM"
- Label: automated/codex
- Body: Findings organized by dimension, with severity ratings (healthy/warning/critical)
- Include actionable recommendations for any warnings or critical findings
```

### 15th of Month: Dependency Upgrades

**Name**: `dependency-upgrade`
**Schedule**: Monthly (15th)
**Skills**: `$yeet`, `$gh-fix-ci`

**Prompt**:
```
Perform monthly dependency upgrades for Green Goods. Follow AGENTS.md constraints (max 20 files, draft PR only).

## Backpressure Check
First, run: gh pr list --label "automated/codex" --state open --json number --jq 'length'
If the result is 3 or more, STOP immediately and output: "Skipping: backpressure limit reached."

## Step 1: Check for outdated packages
Run: bun outdated
Record which packages have newer minor/patch versions available.

## Step 2: Update minor/patch versions only
Run: bun update
NEVER upgrade major versions. If bun update bumps a major version, revert it:
  git checkout -- package.json bun.lockb

## Step 3: Rebuild and test
Run in order:
  bun install
  bun run build
  bun run test
  bun format && bun lint

## Step 4: Handle failures
If build/tests fail after upgrade:
- Read error messages carefully
- Fix type errors or minor API changes from version bumps
- If a specific package upgrade causes persistent failures, revert THAT package only
- Use $gh-fix-ci approach for CI-specific issues

## PR Creation
Use $yeet to create a draft PR:
- Branch: automated/deps-YYYY-MM
- Title: "chore(deps): monthly minor/patch updates"
- Label: automated/codex
- Body: Table of updated packages (name, old version → new version)

Flag any available MAJOR version upgrades in the PR body for human review (do not apply them).
Max 5 files (usually just lockfile + package.json changes).
```

---

## Codex Curated Skills Reference

| Skill | Used By | Purpose |
|---|---|---|
| `$yeet` | All automations | Stage, commit, push, open PR in one flow |
| `$gh-fix-ci` | All automations | Debug and fix failing CI after PR creation |
| `$gh-address-comments` | PR follow-up (manual) | Address review comments on automated PRs |
| `$security-best-practices` | Security audit | Language/framework-specific security patterns |
| `$security-threat-model` | Monthly deep dive (manual) | Repo-grounded threat modeling |
| `$playwright` | E2E follow-up (manual) | Browser automation for UI validation |

## Phase-In Schedule

| Phase | Timeline | Automations to Enable |
|---|---|---|
| Phase 1 | Week 1-2 | Monday audit (shared only) + Tuesday hygiene |
| Phase 2 | Week 3-4 | Add Wednesday test quality |
| Phase 3 | Week 5-6 | Add Thursday i18n/a11y + Friday security/storybook |
| Phase 4 | Week 7+ | Add monthly deep dives, tune cadence based on review bandwidth |

## Review Workflow

- Review window: Tuesday + Thursday afternoons (batch-review all open automated PRs)
- Green CI + <10 files → quick merge
- Failing CI → close PR, fix lands next week
- >10 files → request scope reduction
- Backpressure: If >= 3 automated PRs are open, ALL automations skip until backlog clears

## Setup Checklist

1. Open Codex app → Settings → Automations
2. Add each of the 7 weekly automations with prompts from this document
3. Add the 2 monthly automations
4. Set schedules per the weekly schedule above
5. Verify `.codex/config.toml` and `.codex/environments/environment.toml` are committed and pushed
6. Ensure the `.agents/skills` symlink is committed (for project skill discovery)
7. **Test each automation manually** in a regular Codex thread before enabling the schedule
8. Start with Phase 1 only — add more automations after confirming the first two work well
9. Create the `automated/codex` label in GitHub if it doesn't exist:
   `gh label create "automated/codex" --color "0075ca" --description "PR created by Codex automation"`

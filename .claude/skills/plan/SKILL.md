# Plan Skill

Complete planning lifecycle for Green Goods development: create plans, check progress, execute in batches, with built-in patterns for hooks, offline sync, and i18n.

---

## The 4 Entry Points

All work enters through one of these 4 flows:

| Entry Point | Command/Agent | TDD | Specs Created |
|-------------|---------------|-----|---------------|
| **PRD** | `/plan` + oracle | No | GG-FEAT-XXX.md, GG-TECH-XXX.md |
| **Feature** | cracked-coder | **Yes** | Link to existing specs |
| **Bug** | `/debug` → cracked-coder | If complex | No |
| **Polish** | Direct Claude | No | No |

### Flow Summary

```
PRD → /plan → docs/specs/ → GitHub Stories → Feature Tasks
                                                   ↓
Feature ─────────────────────────► cracked-coder (TDD mandatory)
                                                   ↓
Bug → /debug → root cause found → cracked-coder (if complex)
                                                   ↓
Polish → Direct Claude (no agent)    /review → code-reviewer
                                                   ↓
                                          Deploy via MCP
```

---

## Activation

Use when:
- Starting a new feature (`/plan`)
- Processing a PRD (`/plan` with PRD context)
- Checking implementation progress (`/plan check`)
- Executing a plan (`/plan execute`)

## Agent Routing

| Scenario | Agent | Why |
|----------|-------|-----|
| Feature implementation | `cracked-coder` | TDD mandatory, full MCP access |
| Complex implementation (>50 lines, multi-file) | `cracked-coder` | Maintains focus, tracks progress, handles failures |
| Need research before planning | `oracle` | Multi-source investigation with evidence |
| PR review after implementation | `code-reviewer` | 6-pass protocol, posts to GitHub |
| Deployment (apps, contracts, indexer) | `cracked-coder` | Has vercel, foundry, railway MCP |
| Simple changes (<50 lines, single file) | Direct (no agent) | Faster, less overhead |
| Polish (UI tweaks, copy, styles) | Direct Claude | No TDD overhead needed |

**Invocation**: Say "use cracked-coder for this" or spawn via Task tool.

---

## Progress Tracking (REQUIRED)

**Every planning workflow MUST use TodoWrite for visibility and session continuity.**

### Before Starting
```
1. Create todo list with all planned steps
2. Mark first step as `in_progress`
```

### During Execution
```
3. After each step: mark `completed`, start next as `in_progress`
4. If blocked: add new todo describing the blocker
5. Keep exactly ONE todo as `in_progress` at any time
```

### On Interruption
```
6. Todos show exactly where you stopped
7. Next session (or team member) can resume from todo state
```

### Why This Matters
- **Team handoffs**: Next person sees progress instantly
- **Session resume**: Claude picks up where it left off
- **Visibility**: User sees what's happening in real-time
- **Context preservation**: Prevents "where were we?" moments

---

## Part 0: Greenpill Dev Guild Documentation Flow

### The Flow: PRD → Specs → User Story → Tasks

```
Workspace (External)          GitHub Repo
┌─────────────────────┐       ┌─────────────────────────────────────────┐
│                     │       │                                         │
│  📄 PRD             │───────│───► docs/specs/GG-FEAT-XXX.md           │
│  (Product Vision)   │       │     (Feature Spec)                      │
│                     │       │                                         │
│                     │       │───► docs/specs/GG-TECH-XXX.md           │
│                     │       │     (Tech Spec)                         │
│                     │       │                                         │
└─────────────────────┘       │                    │                    │
                              │                    ▼                    │
                              │  ┌─────────────────────────────────┐    │
                              │  │ GitHub Issue: User Story        │    │
                              │  │ "As a gardener, I want..."      │    │
                              │  │ Links to: PRD, Feature Spec     │    │
                              │  └─────────────────────────────────┘    │
                              │                    │                    │
                              │         ┌──────────┼──────────┐         │
                              │         ▼          ▼          ▼         │
                              │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
                              │  │ Task #1  │ │ Task #2  │ │ Task #3  │ │
                              │  │ Links to:│ │ Links to:│ │ Links to:│ │
                              │  │ Tech Spec│ │ Tech Spec│ │ Tech Spec│ │
                              │  └──────────┘ └──────────┘ └──────────┘ │
                              │         │          │          │         │
                              │         ▼          ▼          ▼         │
                              │     Branch → PR → Merge → Done          │
                              └─────────────────────────────────────────┘
```

### Issue Types

| Type | Purpose | Links To |
|------|---------|----------|
| **User Story** | High-level "As a user..." with done state | PRD (external), Feature Spec |
| **Task** | Detailed implementation guidance | Tech Spec, specific code files |
| **Bug** | Something broken | Reproduction steps, environment |
| **Docs** | Documentation changes | Target location |
| **Polish** | UI/UX improvements | Figma designs |

### Creating a User Story

User stories capture **what** and **why** - not implementation details.

```bash
gh issue create \
  --title "As a gardener, I want to submit work offline" \
  --label "enhancement" \
  --assignee "@me" \
  --project "Green Goods" \
  --body "$(cat <<'EOF'
## Context

Gardeners often work in areas with poor connectivity. Currently,
they lose work if the app can't reach the server. This story enables
them to continue working regardless of network status.

## Done State

- [ ] User can submit work actions while offline
- [ ] Work syncs automatically when connectivity returns
- [ ] User sees clear sync status indicator
- [ ] No data is lost during offline/online transitions

## PRD & Documentation Links

**PRD Section**: [Offline-First Architecture](link-to-workspace-prd)
**Feature Spec**: [docs/specs/GG-FEAT-008_Offline_Sync.md](docs/specs/GG-FEAT-008_Offline_Sync.md)

## Relevant Details

- Must work on low-end Android devices
- Target: 95% of work sessions should complete successfully
EOF
)"
```

### Creating a Task

Tasks are **detailed implementation work** - link specs directly, don't duplicate info.

```bash
gh issue create \
  --title "Implement IndexedDB storage for offline queue" \
  --label "task" \
  --assignee "@me" \
  --project "Green Goods" \
  --body "$(cat <<'EOF'
## Parent Story

#123 - As a gardener, I want to submit work offline

## What to Build

Implement the IndexedDB storage layer for offline work queue.
This task creates the foundation for offline work submission by
building the local storage mechanism that persists work actions.

## Specifications

**Feature Spec**: [docs/specs/GG-FEAT-008_Offline_Sync.md](docs/specs/GG-FEAT-008_Offline_Sync.md)
**Tech Spec**: [docs/specs/GG-TECH-008_Offline_Sync_Technical.md](docs/specs/GG-TECH-008_Offline_Sync_Technical.md)

Key sections:
- Feature Spec §3.2: Queue data model
- Tech Spec §4.1: IndexedDB schema design
- Tech Spec §4.3: Conflict resolution strategy

## Implementation Guidance

### Files to Create/Modify

\`\`\`
packages/shared/src/stores/offlineQueue.ts  (new)
packages/shared/src/hooks/useOfflineQueue.ts (new)
packages/client/src/providers/OfflineProvider.tsx (modify)
\`\`\`

### Patterns to Follow

- Follow existing Zustand store pattern in \`packages/shared/src/stores/\`
- Use persist middleware like \`gardenStore.ts\` does
- Reference \`useJobQueue\` hook for similar queue patterns

### Technical Considerations

- IndexedDB has async API - use idb wrapper (already installed)
- Max storage ~50MB on mobile - implement cleanup for old entries
- Must handle upgrade migrations for schema changes

### Gotchas

- Don't use localStorage (5MB limit, sync API blocks main thread)
- Test on Safari/iOS - IndexedDB behavior differs

## Acceptance Criteria

- [ ] \`useOfflineQueue\` hook exports \`addToQueue\`, \`getQueue\`, \`removeFromQueue\`
- [ ] Queue persists across page refreshes
- [ ] Queue entries include timestamp, retry count, payload
- [ ] Unit tests cover all queue operations

## Resources

- [gardenStore.ts:45-78](packages/shared/src/stores/gardenStore.ts) - Zustand persist pattern
- [idb library docs](https://github.com/jakearchibald/idb)
EOF
)"
```

### Other Issue Types

#### Bug Issue
```bash
gh issue create \
  --title "fix: [description]" \
  --label "bug" \
  --assignee "@me" \
  --body "$(cat <<'EOF'
## Bug Description
[What's broken]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]

## Expected vs Actual
**Expected**: [What should happen]
**Actual**: [What happens instead]

## Environment
- Chain: [chainId]
- Browser: [if applicable]
- Commit: [hash]
EOF
)"
```

#### Documentation Issue
```bash
gh issue create \
  --title "docs: [title]" \
  --label "documentation" \
  --body "$(cat <<'EOF'
## Documentation Type
[New/Update/Fix]

## Description
[What documentation change is needed]

## Location
[README.md, docs/, CLAUDE.md]
EOF
)"
```

#### Polish Issue
```bash
gh issue create \
  --title "polish: [title]" \
  --label "polish" \
  --body "$(cat <<'EOF'
## Current State
[What it looks like now]

## Desired State
[What it should look like]

## Figma Reference
[Link if applicable]
EOF
)"
```

### Story → Task Breakdown

When a story is large, break it into task sub-issues:

1. **Read specs and story**:
   ```bash
   gh issue view [STORY_NUMBER] --json title,body
   cat docs/specs/GG-TECH-XXX.md
   ```

2. **Identify natural task boundaries** from the tech spec

3. **Create task issues** (use template above, link to specific spec sections)

4. **Update parent story with task list**:
   ```bash
   gh issue comment [STORY_NUMBER] --body "$(cat <<'EOF'
   ## Task Breakdown

   - [ ] #[TASK_1] - [Description]
   - [ ] #[TASK_2] - [Description]
   - [ ] #[TASK_3] - [Description]

   Parent closes when all tasks complete.
   EOF
   )"
   ```

### When to Break Down Stories

| Story Size | Action |
|------------|--------|
| Single scope, clear implementation | No breakdown needed |
| Multi-scope, 1-3 sessions | Consider breakdown |
| Cross-package, >3 sessions | Always breakdown |

### Linking Issues to Plans

When creating a plan from an issue:

1. **Accept issue**: `/plan #123` or `/plan [github-url]`

2. **Extract context**:
   ```bash
   gh issue view 123 --json title,body,labels
   ```

3. **Read linked specs** referenced in the issue

4. **Add to plan header**:
   ```markdown
   # [Feature Name]

   **GitHub Issue**: #123
   **Closes**: #123
   **Feature Spec**: docs/specs/GG-FEAT-XXX.md
   **Tech Spec**: docs/specs/GG-TECH-XXX.md
   ```

5. **Map spec sections to plan steps**

### Parsing Issue Body

When starting from a GitHub issue, extract and validate spec links:

```bash
# Get full issue content
ISSUE_BODY=$(gh issue view [NUMBER] --json body --jq '.body')

# Extract spec links from issue body
FEATURE_SPEC=$(echo "$ISSUE_BODY" | grep -oE 'docs/specs/GG-FEAT-[0-9]+[^)]+\.md' | head -1)
TECH_SPEC=$(echo "$ISSUE_BODY" | grep -oE 'docs/specs/GG-TECH-[0-9]+[^)]+\.md' | head -1)

# Verify specs exist in repo
if [ -n "$FEATURE_SPEC" ] && [ ! -f "$FEATURE_SPEC" ]; then
  echo "⚠️ Feature spec not found: $FEATURE_SPEC"
fi

if [ -n "$TECH_SPEC" ] && [ ! -f "$TECH_SPEC" ]; then
  echo "⚠️ Tech spec not found: $TECH_SPEC"
fi

# Read specs to extract requirements
if [ -f "$FEATURE_SPEC" ]; then
  echo "📋 Feature Spec sections:"
  grep "^##" "$FEATURE_SPEC"
fi
```

**Key sections to extract from specs:**

| Spec Type | Key Sections | Maps To |
|-----------|--------------|---------|
| Feature Spec | User Journey, Success Metrics | Acceptance Criteria |
| Feature Spec | Integration Points | Dependencies |
| Tech Spec | Data Flow, Sequence Diagrams | Implementation Steps |
| Tech Spec | Contract Interactions | Contract Changes |
| Tech Spec | Testing Strategy | Test Requirements |

### Branch Naming

Auto-generate branch from issue:

```bash
# Pattern: type/issue-number-short-description
# Examples:
feat/123-offline-work-queue
fix/456-login-validation-error
docs/789-update-api-reference
polish/101-button-hover-states

# Create branch from issue
./scripts/create-branch.sh 123
```

---

## Part 1: Create Plan

### Phase 1: Understanding & Validation

1. **Extract ALL requirements** from issue/task
2. **Map each requirement** to planned steps
3. **Audit codebase** before planning:
   - Search for existing patterns
   - Find related code
   - Identify dependencies
4. **Review CLAUDE.md** for compliance rules

### Phase 2: Green Goods Compliance Checklist

Before writing plan, verify:

- [ ] All new hooks will be in `packages/shared/src/hooks/`
- [ ] No package-specific .env files
- [ ] Contract addresses from deployment artifacts
- [ ] i18n keys for all UI strings
- [ ] Conventional commit format planned
- [ ] Single chain assumption (no runtime switching)

### Phase 3: Plan Structure

Use kebab-case: `[descriptive-name].todo.md` in `.plans/` directory.

**Required Sections**:

```markdown
# [Feature/Fix Name]

**GitHub Issue**: #[number] (if applicable)
**Closes**: #[number]
**Project Board**: Green Goods
**Status**: Planning → In Progress → Done

## Overview
Brief description and motivation.

## Requirements Coverage

| Requirement | Planned Step | Issue AC | Notes |
|-------------|--------------|----------|-------|
| User can X  | Step 3       | AC #1    |       |

## CLAUDE.md Compliance
- [ ] Hooks in shared package
- [ ] i18n for UI strings
- [ ] Deployment artifacts for addresses
- [ ] Conventional commits

## Existing Code Analysis
- Related files: [list]
- Existing patterns to follow: [describe]
- Types to reuse: [list]

## Impact Analysis

### Files to Modify
- `packages/shared/src/hooks/useFoo.ts` - Add new hook

### Files to Create
- `packages/shared/src/hooks/useBaz.ts`

### Files to Delete
- None

## Implementation Steps

### Step 1: [Action]
**Files**: `path/to/file.ts`
**Details**: Specific changes to make

## Validation Criteria
- [ ] All requirements implemented
- [ ] TypeScript passes (`bun run tsc --noEmit`)
- [ ] Linting passes (`bun lint`)
- [ ] Tests pass (`bun test`)
- [ ] Build succeeds (`bun build`)
```

---

## Part 2: Check Plan Progress

### Systematic Audit Process

1. **Identify the plan** from `.plans/` directory
2. **Gather git context**:
   ```bash
   git status
   git diff --stat
   git log --oneline -10
   ```

3. **File-by-File Status Check**

For each file in plan:
- `DONE` - Fully implemented
- `PARTIAL` - Some requirements met
- `NOT DONE` - Not yet implemented
- `NEEDS REVIEW` - Quality concerns

4. **Requirements Coverage Table**

| Requirement | Plan Step | Implementation | Status |
|-------------|-----------|----------------|--------|
| User can X  | Step 3    | src/foo.ts:42  | DONE   |

5. **Green Goods Compliance**
   ```bash
   bash .claude/scripts/validate-hook-location.sh
   node .claude/scripts/check-i18n-completeness.js
   ```

6. **Validation**
   ```bash
   bun format && bun lint && bun test && bun build
   ```

---

## Part 3: Execute Plan

### Batch Execution Process

**Default batch size**: 3 tasks

```
LOAD → EXECUTE BATCH → REPORT → PAUSE → CONTINUE/FINISH
```

### For Each Batch

1. **Mark tasks in progress**
2. **Implement following plan exactly**
3. **Run verifications**
4. **Report results and pause**

### Batch Report Format

```markdown
## Batch [N] Complete

### Tasks Completed
1. ✅ Step 1: [Description]
   - Files: `path/to/file.ts`
   - Verification: Tests pass

### Issues Encountered
- [Any blockers]

### Next Batch Preview
- Step 4, 5, 6

**Awaiting feedback before continuing...**
```

### Safety Rules

- **Stop when blocked** - Don't guess
- **No forcing through** - Never skip failing tests
- **Communication first** - Pause between batches

---

## Part 4: Green Goods Patterns

### Hook Generation (hooks in shared/ only)

```typescript
// packages/shared/src/hooks/useNewHook.ts
import { useQuery } from "@tanstack/react-query";

export type UseNewHook = {
  data: DataType | undefined;
  isLoading: boolean;
  error: Error | null;
};

export function useNewHook(id: string): UseNewHook {
  const { data, isLoading, error } = useQuery({
    queryKey: ["entity", id],
    queryFn: () => fetchEntity(id),
    enabled: !!id,
  });

  return { data, isLoading, error };
}
```

**Naming**: `use[Entity][Action]` (e.g., `useGardenMetrics`)

**Always**:
1. Create in `packages/shared/src/hooks/`
2. Export from `hooks/index.ts`
3. Create test in `__tests__/hooks/`

### Offline Sync Debugging

When planning offline features:

```
Client PWA
├── Job Queue (Zustand) ← Queue work for sync
├── IndexedDB (Storage) ← Persist offline data
├── Service Worker      ← Cache and background sync
└── Sync Manager        ← Coordinate everything
```

**Debug Checklist**:
- Check `useJobQueue` for stuck jobs
- Verify IndexedDB data integrity
- Check Service Worker registration
- Test online/offline transitions

### i18n Completeness

All UI strings must have translations:

```typescript
// Use translation hook
import { useTranslation } from "@green-goods/shared";
const { t } = useTranslation();

// In JSX
<Button>{t("common.buttons.submit")}</Button>
```

**Key format**: `[namespace].[section].[item]`
- `common.buttons.submit`
- `garden.details.title`
- `error.network.offline`

**Supported languages**: en.json, es.json, pt.json

---

## Part 5: GitHub Projects Sync (Full Integration)

### Sync Plan Progress to GitHub Issue

When completing plan steps, update the linked issue:

```bash
# Add progress comment to issue
gh issue comment [ISSUE_NUMBER] --body "$(cat <<'EOF'
## Plan Progress Update

### Completed This Session
- ✅ Step 1: [description]
- ✅ Step 2: [description]

### In Progress
- 🔄 Step 3: [description]

### Remaining
- ⏳ Step 4, 5, 6

**Plan File**: `.plans/[name].todo.md`
EOF
)"
```

### Update GitHub Projects Card

Move card through project board columns:

```bash
# Get project item ID
ITEM_ID=$(gh project item-list [PROJECT_NUMBER] --owner [ORG] --format json \
  | jq -r '.items[] | select(.content.number == [ISSUE_NUMBER]) | .id')

# Move to "In Progress" column
gh project item-edit --project-id [PROJECT_ID] --id $ITEM_ID \
  --field-id [STATUS_FIELD_ID] --single-select-option-id [IN_PROGRESS_OPTION_ID]

# Move to "Done" when complete
gh project item-edit --project-id [PROJECT_ID] --id $ITEM_ID \
  --field-id [STATUS_FIELD_ID] --single-select-option-id [DONE_OPTION_ID]
```

### Project Field Discovery

```bash
# List project fields (get field IDs)
gh project field-list [PROJECT_NUMBER] --owner [ORG] --format json

# Get status field options (get option IDs)
gh api graphql -f query='
  query {
    organization(login: "[ORG]") {
      projectV2(number: [PROJECT_NUMBER]) {
        field(name: "Status") {
          ... on ProjectV2SingleSelectField {
            options { id name }
          }
        }
      }
    }
  }
'
```

### When to Sync

| Event | Action |
|-------|--------|
| Plan created | Add issue comment with plan link |
| Batch completed | Update issue with progress |
| Plan 100% done | Move card to "Done", close issue |
| Blocked | Add comment explaining blocker |

---

## Validation Commands

```bash
# Full validation
bun format && bun lint && bun test && bun build

# Hook location
bash .claude/scripts/validate-hook-location.sh

# i18n completeness
node .claude/scripts/check-i18n-completeness.js

# Contract tests (if applicable)
cd packages/contracts && bun test
```

## Key Principles

- **100% requirement coverage** - Every requirement mapped
- **Evidence before claims** - Verify before marking done
- **Green Goods conventions** - Follow CLAUDE.md rules
- **Batch execution** - Pause for feedback between batches
- **No shortcuts** - Don't skip validation steps

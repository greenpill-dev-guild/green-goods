# Claude Config v2.0 Handoff Document

> **Created**: 2026-01-23
> **Status**: Ready for commit on `develop` branch
> **Score**: 8.5/10 (improved from 7.2)

---

## Context

This session modernized the Claude Code configuration for Green Goods:
- Consolidated to **3 agents + 4 skills** pattern
- Added **GitHub issue templates** matching the Greenpill Dev Guild workflow
- Fixed **hooks latency** (SubagentStop: prompt → command)
- Enabled **MCP servers** (miro, railway) with proper agent access
- Created **spec templates** based on PR #270 format

---

## Completed Work

### Critical ✅
- [x] Validation scripts exist (`.claude/scripts/validate-hook-location.sh`, `check-i18n-completeness.js`)
- [x] Oracle escalation paths fixed (removed references to deleted agents)
- [x] SubagentStop hook converted from prompt to command (~500ms → ~5ms)

### High ✅
- [x] Skill→Agent routing tables added to all 4 skills
- [x] Issue parsing section added to plan skill
- [x] GitHub issue templates created (feature, task, bug, docs, polish)

### Medium ✅
- [x] Spec templates created (`docs/specs/TEMPLATE-FEATURE.md`, `TEMPLATE-TECH.md`)
- [x] AskUserQuestion examples added to audit and debug skills
- [x] Dead reminders config removed from hooks.json

---

## Remaining Improvements

### Priority 1: Pre-Commit (Do Before Merge)

#### 1.1 Fix GitHub Labels
**Issue**: `gh` CLI is pointing to wrong repo (camp-green instead of green-goods)

```bash
# Fix repo default
gh repo set-default greenpill-dev-guild/green-goods

# Then fix labels
gh label edit "infrastrcuture" --name "infrastructure"  # Fix typo
gh label create "polish" --color "E99695" --description "UI polish and UX improvements"
gh label create "task" --color "BFDADC" --description "Implementation task linked to story"
```

**Effort**: 5 minutes
**Blocker**: Manual step, requires repo access

---

### Priority 2: Near-Term Improvements

#### 2.1 Add GitHub Projects Integration
**Current State**: Plan skill documents GitHub Projects API but doesn't have helper scripts

**Improvement**: Create `.claude/scripts/gh-projects-sync.sh` that:
- Gets project field IDs
- Moves cards between columns
- Updates priority fields

```bash
# Example of what's needed
#!/bin/bash
# Get project item ID for an issue
gh project item-list [PROJECT_NUMBER] --owner greenpill-dev-guild --format json \
  | jq -r '.items[] | select(.content.number == '$ISSUE_NUMBER') | .id'
```

**Effort**: 30 minutes
**Impact**: Enables automated board updates from plan skill

---

#### 2.2 Add Spec Validation Script
**Current State**: Spec templates exist but no validation

**Improvement**: Create `.claude/scripts/validate-spec.js` that:
- Checks all required sections are present
- Validates links to other documents
- Ensures acceptance criteria are checkboxes

**Effort**: 45 minutes
**Impact**: Catches incomplete specs before issue creation

---

#### 2.3 Enhance create-branch.sh
**Current State**: Script creates branches from issues but doesn't handle all edge cases

**Improvement**: Add:
- Validation that issue exists
- Check for existing branch with same name
- Option to include spec number in branch name

```bash
# Current: feat/123-add-dark-mode
# Enhanced: feat/123-GG-FEAT-005-add-dark-mode
```

**Effort**: 20 minutes
**Impact**: Better traceability from branch to spec

---

### Priority 3: Future Enhancements

#### 3.1 MCP Server Usage Tracking
**Current State**: MCP servers enabled but no usage analytics

**Improvement**: Add hook to track which MCP servers are used:
```json
{
  "type": "command",
  "command": "echo \"MCP:$MCP_SERVER\" >> .claude/logs/mcp-usage.log"
}
```

**Effort**: 15 minutes
**Impact**: Understand which integrations are valuable

---

#### 3.2 Automated Issue→Plan→Branch Flow
**Current State**: Each step is manual with templates

**Improvement**: Create `/plan #123` flow that:
1. Fetches issue automatically
2. Extracts spec links
3. Validates specs exist
4. Creates plan file with proper structure
5. Creates branch
6. Updates issue with plan link

**Effort**: 2-3 hours
**Impact**: Reduces friction for starting new work

---

#### 3.3 Review Skill GitHub Integration
**Current State**: Code-reviewer posts to GitHub but doesn't update issue status

**Improvement**: After posting review:
- Add label based on recommendation (needs-changes, approved)
- Update linked issue with review status
- Move project card if applicable

**Effort**: 1 hour
**Impact**: Better visibility of review state

---

#### 3.4 Audit Report → Issues Automation
**Current State**: Audit skill asks before creating issues, but creation is manual

**Improvement**: After user confirms:
- Batch create issues from findings
- Add to project board
- Link back to audit report
- Create tracking issue for audit session

**Effort**: 1 hour
**Impact**: Faster action on audit findings

---

## Architecture Reference

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLAUDE CONFIG v2.0 ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────────┘

   EXTERNAL                    GITHUB REPO                         CLAUDE CODE
┌──────────────┐         ┌─────────────────────┐            ┌─────────────────────┐
│  Workspace   │         │                     │            │                     │
│     PRD      │────────►│  docs/specs/        │            │    SKILLS (4)       │
│              │         │  GG-FEAT-XXX.md     │◄──────────►│  - plan             │
└──────────────┘         │  GG-TECH-XXX.md     │            │  - review           │
                         │                     │            │  - debug            │
                         │  .github/ISSUE_     │            │  - audit            │
                         │  TEMPLATE/          │            │                     │
                         │  - feature.yml      │            │    AGENTS (3)       │
                         │  - task.yml         │◄──────────►│  - cracked-coder    │
                         │  - bug.yml          │            │  - code-reviewer    │
                         │  - docs.yml         │            │  - oracle           │
                         │  - polish.yml       │            │                     │
                         │                     │            │    MCP SERVERS (6)  │
                         │  .plans/            │◄──────────►│  - figma            │
                         │  [name].todo.md     │            │  - vercel           │
                         │                     │            │  - foundry          │
                         └─────────────────────┘            │  - storacha         │
                                                            │  - miro             │
                                                            │  - railway          │
                                                            └─────────────────────┘

   FLOW: PRD → Spec → User Story Issue → Task Issues → Plan → Branch → PR → Merge
```

---

## Key Files

| File | Purpose | State |
|------|---------|-------|
| `.claude/hooks.json` | Validation hooks | ✅ Clean |
| `.claude/settings.json` | Plugin config | ✅ Unchanged |
| `.mcp.json` | MCP server config | ✅ Updated |
| `.claude/skills/*/SKILL.md` | Skill definitions | ✅ Updated |
| `.claude/agents/*.md` | Agent definitions | ✅ Updated |
| `.github/ISSUE_TEMPLATE/*.yml` | Issue templates | ✅ New |
| `docs/specs/TEMPLATE-*.md` | Spec templates | ✅ New |
| `scripts/create-branch.sh` | Branch automation | ✅ New |

---

## Stashed Work

Contract changes from `feature/hats-protocol` are stashed:

```bash
git stash list
# stash@{0}: On feature/hats-protocol: WIP: feature/hats-protocol contract changes
```

To restore after this PR:
```bash
git checkout feature/hats-protocol
git stash pop
```

---

## Commit Ready

All changes are on `develop` branch, ready to commit:

```bash
git add -A
git commit -m "feat(claude): modernize config with 3+4 pattern and GitHub flow

- Consolidate to 3 agents + 4 skills architecture
- Add GitHub issue templates (feature, task, bug, docs, polish)
- Fix hooks latency (SubagentStop: prompt→command)
- Enable miro + railway MCP servers
- Add prompt-first issue creation in audit/debug skills
- Add spec templates based on PR #270 format
- Add Skill→Agent routing tables
- Add issue parsing to plan skill
- Remove dead reminders config

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Testing Checklist

Before merge, verify:

- [ ] JSON files valid: `cat .claude/hooks.json .mcp.json | jq .`
- [ ] GitHub templates appear in issue creation UI
- [ ] Branch script works: `./scripts/create-branch.sh [existing-issue]`
- [ ] Spec templates render correctly in GitHub
- [ ] MCP servers connect (if configured)

---

## Questions for Product

1. **GitHub Projects**: Which project board should issues auto-add to?
2. **Milestones**: Are milestones used for sprints? If so, what's the naming convention?
3. **Priority**: Is priority a label or a project field? (Currently assumed: project field)
4. **Assignees**: Should issues auto-assign to `@me` or leave unassigned?

---

## Resume Instructions

To continue this work in a new session:

1. Read this handoff: `.plans/claude-config-v2-handoff.md`
2. Check git status for any uncommitted changes
3. Verify on `develop` branch
4. Pick up from "Remaining Improvements" section
5. Use TodoWrite to track progress

---

*Generated by Claude Code session on 2026-01-23*

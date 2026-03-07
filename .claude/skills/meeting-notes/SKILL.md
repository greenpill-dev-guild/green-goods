---
name: meeting-notes
description: Use when the user pastes a meeting transcript or notes and wants actionable items extracted as GitHub issues
argument-hint: "[paste transcript or provide file path]"
---

# Meeting Notes Extraction

Extract actionable items from meeting transcripts and create GitHub issues.

## Activation

User pastes or references a meeting transcript (product sync, standup, retro, design review, etc.) and wants issues created.

## Process

### 1. Read Context

Before extraction, read these for grounding:

```
.github/ISSUE_TEMPLATE/bug.yml
.github/ISSUE_TEMPLATE/feature.yml
.github/ISSUE_TEMPLATE/polish.yml
.github/ISSUE_TEMPLATE/task.yml
```

### 2. Extract Items

Scan the transcript for actionable items. For each item determine:

| Field | Options |
|-------|---------|
| **Type** | `bug`, `enhancement` (user story), `polish`, `task` |
| **Severity** | P0 (critical) - P4 (nice-to-have), based on discussion urgency |
| **Package** | contracts, shared, client, admin, agent, indexer, cross-package |
| **Title** | Concise, follows template conventions |
| **Body** | Matches the corresponding issue template structure |

**Extraction rules:**
- Categorize by type using the issue template fields as guide
- Bugs need: description, steps to reproduce, expected vs actual
- Features need: user story format ("As a [user], I want..."), context, done state
- Polish needs: current state vs desired state, component/area
- Tasks need: parent story reference, what to build, specs, acceptance criteria
- Flag uncertain items with `[ASSUMPTION]` in the body
- Note the transcript timestamp or speaker when available for traceability

### 3. Present Summary for Review

Before creating any issues, present a summary table:

```markdown
## Extracted Items

| # | Title | Type | Severity | Package |
|---|-------|------|----------|---------|
| 1 | ... | bug | P1 | client |
| 2 | ... | enhancement | P2 | shared |
| 3 | ... | polish | P3 | admin |

### Details

**1. [Title]**
[Brief description of what was discussed and why it's this type/severity]

**2. [Title]**
...
```

Ask the user to confirm, edit, or remove items before creating issues.

### 4. Create Issues

After user approval, create each issue using `gh issue create`:

```bash
gh issue create \
  --title "Title here" \
  --label "bug" \
  --body "$(cat <<'EOF'
## Bug Description
...

## Steps to Reproduce
...

## Expected Behavior
...

## Actual Behavior
...
EOF
)"
```

Use the correct labels: `bug`, `enhancement`, `polish`, `task`.

### 5. Output Summary

After all issues are created, output a final summary:

```markdown
## Created Issues

| Issue | Title | Type | Severity |
|-------|-------|------|----------|
| #201 | ... | bug | P1 |
| #202 | ... | enhancement | P2 |
```

## Anti-Patterns

- **Don't create issues without user review** - always present the summary first
- **Don't create duplicates** - ask user if unsure whether an issue already exists
- **Don't over-extract** - casual mentions and tangents are not action items
- **Don't invent details** - if the transcript is vague, flag with `[ASSUMPTION]`
- **Don't skip the template structure** - match the issue template fields

## Related Skills

- `plan` - for turning extracted issues into implementation plans
- `triage` agent - for classifying and routing extracted issues

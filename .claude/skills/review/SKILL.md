# Review Skill

Code review workflow: request reviews, perform 6-pass analysis, process feedback.

**References**: See `CLAUDE.md` for codebase patterns and conventions. Use `code-reviewer` agent for PRs.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/review` | Perform 6-pass code review |
| After implementation | Request review |
| PR feedback received | Process and respond |

## Progress Tracking (REQUIRED)

Every review MUST use **TodoWrite**. See `CLAUDE.md` → Session Continuity.

---

## Part 1: Perform Code Review (6-Pass Protocol)

> YOU DO NOT LET THINGS SLIP. YOU DESIRE ONLY PERFECTION.

### Pass 0: Change Explanation
- Document what changed and why
- Create Mermaid diagram showing impact

### Pass 0.5: Issue Coverage (MANDATORY)
- Map every requirement to implementation
- **If coverage < 100%: STOP. Request changes.**

### Pass 1: Technical Issues
- Type errors, null handling, missing error handling
- API contract violations, race conditions

### Pass 2: Code Consistency
- Follows codebase style
- Dead code, duplicate logic, naming

### Pass 3: Architecture
- Hooks in shared package only (see CLAUDE.md)
- No hardcoded addresses
- Proper abstractions

### Pass 4: Environment Compatibility
- No package-specific .env files
- Platform compatibility, offline behavior

### Pass 5: Verification Strategy
```bash
bun format && bun lint && bun test && bun build
```

### Pass 6: Synthesis
- **APPROVE** or **REQUEST CHANGES**

---

## Part 2: Review Output

```markdown
## Code Review: [PR Title]

### Change Explanation
[Summary with diagram]

### Issue Coverage
| Requirement | Status |
|-------------|--------|
Coverage: X/Y (Z%)

### Critical (Blocking)
- [Issue] - `file.ts:123`

### High Priority
- [Issue] - `file.ts:456`

### Recommendation
**[APPROVE / REQUEST CHANGES]**
```

### Post to GitHub

```bash
gh pr comment [PR_NUMBER] --body "[review content]"
```

---

## Part 3: Request Review

```bash
# Prepare
git log main..HEAD --oneline
bun build && bun test && bun lint

# Create PR
gh pr create --title "feat(scope): description" --body "..."
```

---

## Part 4: Process Feedback

### Evaluation

1. Read completely — don't react to individual points
2. Verify against codebase
3. Respond appropriately

### Response Types

| Situation | Response |
|-----------|----------|
| Valid | "Implementing as suggested" |
| Unclear | "Which specific line should be addressed?" |
| Incorrect | "This conflicts with X because..." |

### When to Push Back

- Breaks existing functionality
- Lacks codebase context
- Violates YAGNI
- Violates Green Goods conventions (see CLAUDE.md)

---

## Final Gates

- **ANY COVERAGE < 100%** → DO NOT APPROVE
- **ANY UNRESOLVED CRITICAL/HIGH** → DO NOT APPROVE
- **ALWAYS POST TO GITHUB**

# /scope - Check and Prevent Scope Creep

Verify work stays within defined boundaries.

## Trigger

User says `/scope` or "check scope"

## Process

1. Identify the original task/issue
2. List what was actually done
3. Flag any scope creep
4. Recommend corrections

## Scope Creep Indicators

| Indicator | Example |
|-----------|---------|
| Unplanned features | "While I was here, I also..." |
| Premature optimization | "Made it more efficient..." |
| Refactoring beyond need | "Cleaned up surrounding code..." |
| Extra error handling | "Added handling for edge cases..." |
| Documentation beyond scope | "Also documented the whole module..." |

## Questions to Ask

1. Was this in the original requirement?
2. Does this solve the stated problem?
3. Would removing this break the solution?
4. Did the user ask for this?

## Scope Check Template

```markdown
## Scope Check

### Original Task
[What was requested]

### Work Completed
- [Item 1] - In scope ✅
- [Item 2] - In scope ✅
- [Item 3] - OUT OF SCOPE ❌

### Scope Creep Detected
- [Out of scope item]: [Why it's out of scope]

### Recommendation
- Revert: [Items to revert]
- Keep: [Items that are justified]
```

## Output

Report showing:
1. Original requirements
2. Work completed
3. In-scope vs out-of-scope
4. Recommendations

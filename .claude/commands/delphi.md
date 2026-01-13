# /delphi - Parallel Oracle Consultation

Launch multiple agents to analyze codebase from different angles.

## Trigger

User says `/delphi`, `delphi x[N]`, or requests parallel analysis

## Process

1. Load the `delphi` skill from `.claude/skills/delphi/SKILL.md`
2. Determine oracle count (default: 3, max: 6)
3. Create `.oracle/[topic]/` directory
4. Launch N agents in parallel with identical prompts
5. Synthesize findings
6. Present consolidated report

## Examples

```bash
# Default (3 oracles)
/delphi analyze authentication flow

# Specify count
delphi x6 full code quality sweep

# Specific focus
delphi x4 security review
```

## Common Use Cases

- Code quality sweep
- Security analysis
- Architecture review
- Performance investigation
- Dead code detection

## Output

Synthesis report at `.oracle/[topic]/SYNTHESIS.md` with:
- Convergent findings (high confidence)
- Divergent findings (needs review)
- Unique discoveries
- Consolidated recommendations

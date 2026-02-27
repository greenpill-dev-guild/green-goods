# Agent Evaluation Framework

## When to Run

- After model updates (Anthropic ships frequently)
- After modifying agent definitions
- After modifying skills referenced by agents
- Quarterly review for regression detection

## How to Run

Each eval directory contains test cases and expected outcomes.

1. Spawn the target agent with the test case as input
2. Compare output against `expected.json`
3. Score: exact match for classification (triage), rubric-based for research (oracle), pass/fail for implementation (cracked-coder)

## Scoring

| Agent | Metric | Target |
|-------|--------|--------|
| triage | Classification accuracy (P0-P4) | >= 90% |
| code-reviewer | True positive rate | >= 85% |
| code-reviewer | False positive rate | <= 10% |
| oracle | Correct root cause identification | >= 80% |
| cracked-coder | Tests pass + build succeeds | 100% |

## Historical Results

Track results here after each eval run:

| Date | Model | Agent | Score | Notes |
|------|-------|-------|-------|-------|
| _template_ | opus-4.6 | code-reviewer | _/5_ | _notes_ |

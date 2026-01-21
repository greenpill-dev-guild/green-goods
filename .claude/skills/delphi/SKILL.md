# Delphi Skill - Parallel Oracle Consultation

Launch multiple oracle agents simultaneously with identical prompts to surface diverse insights through parallel investigation.

## Activation

Use when:
- User requests "delphi x[N]" or `/delphi`
- Deep code quality analysis needed
- Multiple perspectives on architecture wanted
- Comprehensive codebase sweep required

Example prompts:
- "Have delphi x6 do a full sweep of this repo's code quality"
- "delphi x3 analyze the authentication flow"
- "/delphi identify security concerns"

## Process

### Step 1: Determine Oracle Count

- Default: 3 oracles
- Complex questions: 4-5 oracles
- Full codebase sweep: 6 oracles
- User can specify: "delphi x[N]"

### Step 2: Create Investigation Directory

```bash
mkdir -p .oracle/[topic]/
```

### Step 3: Formulate Single Prompt

Create ONE prompt that all oracles receive. Do NOT specialize different oracles.

The prompt should include:
- Core question/task
- Relevant context (files, patterns, constraints)
- Success criteria
- Export instructions (write to `.oracle/[topic]/oracle-[N].md`)

### Step 4: Launch Oracles in Parallel

**CRITICAL**: Use a single message with multiple Task tool calls.

```
Task 1: Oracle 1 - [topic]
Task 2: Oracle 2 - [topic]
Task 3: Oracle 3 - [topic]
...
```

Each oracle receives identical instructions:

```markdown
# Oracle Investigation: [Topic]

## Mission
[Core question]

## Context
[Relevant background]

## Codebase: Green Goods
- Monorepo: packages/client, admin, shared, contracts, indexer, agent
- Hooks must be in shared package
- Single chain architecture
- Offline-first with job queue
- UUPS upgradeable contracts

## Investigation Protocol
1. Use extended thinking to reason through the problem
2. Search codebase thoroughly (Glob, Grep, Read)
3. Document your reasoning path
4. Be comprehensive - check all relevant files

## Output
Write findings to: `.oracle/[topic]/oracle-[N].md`

Include:
- Summary of findings
- Specific file:line references
- Severity ratings (CRITICAL, HIGH, MEDIUM, LOW)
- Recommended actions
```

### Step 5: Synthesis

After all oracles complete, launch synthesis agent:

```markdown
# Synthesis: [Topic]

Read all oracle reports in `.oracle/[topic]/` and create unified analysis.

## Synthesis Structure

### Convergent Findings
Issues identified by multiple oracles (high confidence):
- [Finding] - identified by oracles 1, 3, 5

### Divergent Findings
Conflicting assessments requiring review:
- Oracle 2 says X, Oracle 4 says Y

### Unique Discoveries
Valuable insights from single oracles:
- Oracle 6 found [unique issue]

### Consolidated Recommendations
Prioritized action items combining all insights.

Write synthesis to: `.oracle/[topic]/SYNTHESIS.md`
```

### Step 6: Present to User

Share synthesis with:
- Executive summary
- Top findings by severity
- Consolidated recommendations
- Offer deeper exploration if needed

## Green Goods Specific Focus Areas

When doing code sweeps, oracles should check:

1. **Architecture**
   - Hook boundary violations
   - Package-specific .env files
   - Hardcoded addresses

2. **Code Quality**
   - Dead code
   - Duplicate logic
   - `any`/`unknown` types

3. **Contracts**
   - Storage gap issues
   - Upgrade safety
   - Gas optimization

4. **Security**
   - Input validation
   - Auth bypass potential
   - Sensitive data exposure

5. **Offline-First**
   - Job queue edge cases
   - IndexedDB consistency
   - Sync conflict handling

## Example: Full Code Quality Sweep

User: "Have delphi x6 do a full sweep of this repo's code quality"

Response:
1. Create `.oracle/code-quality/`
2. Launch 6 oracles with identical prompt focusing on:
   - Dead code detection
   - Code smells
   - Architectural violations
   - Type issues
   - Duplicate logic
   - Security concerns
3. Each oracle writes to `.oracle/code-quality/oracle-[1-6].md`
4. Synthesis agent creates `.oracle/code-quality/SYNTHESIS.md`
5. Present consolidated findings to user

## Key Principle

> Identical starting conditions leading to different investigation paths. One oracle might discover a code change while another finds infrastructure issues - collectively providing comprehensive coverage.

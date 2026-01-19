# Receiving Code Review Skill

Evaluate code review feedback with technical rigor rather than performative agreement.

## Activation

Use when:
- Receiving PR review comments
- Processing feedback from code-reviewer agent
- Evaluating suggestions from team members

## Core Framework

### Step 1: Read Feedback Completely

Don't react to individual points. Read the entire review first.

### Step 2: Restate Requirements

In your own words, restate what the reviewer is asking for.

### Step 3: Verify Against Codebase

Check if the suggestion is correct for THIS codebase:
- Does the pattern they suggest exist elsewhere?
- Would it break existing functionality?
- Is there a reason for the current implementation?

### Step 4: Evaluate Technical Soundness

Consider:
- Is the suggestion technically correct?
- Does it align with Green Goods architecture?
- Does it follow CLAUDE.md guidelines?

### Step 5: Respond Appropriately

**If valid**: Acknowledge and implement
**If unclear**: Ask clarifying questions
**If incorrect**: Provide reasoned pushback

## Critical Prohibitions

**NEVER respond with**:
- "You're absolutely right!"
- "Great point!"
- "Thanks for catching that!"

These are performative, not technical.

**INSTEAD respond with**:
- "I'll update the error handling as suggested"
- "Checking the existing pattern in shared/hooks..."
- "This conflicts with the offline-first requirement because..."

## Handling Unclear Feedback

If feedback contains unclear items:

> **STOP - do not implement anything yet.**

Partial understanding creates implementation risk. Ask:
- "Can you clarify what you mean by X?"
- "Which specific file/line are you referring to?"
- "How would this interact with the existing Y?"

## Green Goods Specific Checks

Before implementing suggestions, verify:

1. **Hook Location**
   - Suggestion to add hook in client? REJECT - must be in shared
   - Use: `bash .claude/scripts/validate-hook-location.sh`

2. **Environment**
   - Suggestion for package-specific .env? REJECT
   - All env vars in root .env only

3. **Contract Addresses**
   - Suggestion to add address constant? REJECT
   - Use deployment artifacts

4. **i18n**
   - Suggestion adds UI text? Ensure translation keys added
   - Use: `node .claude/scripts/check-i18n-completeness.js`

## YAGNI Principle

When reviewer suggests "implementing properly":

1. Check actual usage in codebase
2. If feature/endpoint is unused, remove it instead
3. Don't implement unused functionality "properly"

## When to Push Back

Push back when suggestions:
- Break existing functionality
- Lack full codebase context
- Violate YAGNI principle
- Conflict with architectural decisions
- Are technically incorrect for the stack
- Violate Green Goods conventions

## How to Push Back

Provide evidence:
```
I checked [X] and found [Y]. The current implementation
handles [Z] because [reason]. Changing it would break
[specific thing].

Here's the relevant code: `file.ts:123`
```

## Correcting Errors

If your initial pushback was wrong:

```
You were right - I checked [X] and it does [Y].
Implementing now.
```

No defensive explanation needed. Just acknowledge and proceed.

## Example Responses

**Valid suggestion**:
```
Updating the error handling to use the pattern from
shared/utils/errors.ts as suggested.
```

**Need clarification**:
```
The feedback mentions "fix the type issue" but I see
multiple type assertions in this file. Which specific
line/assertion should be addressed?
```

**Pushback**:
```
The suggestion to add a runtime chain check conflicts
with our single-chain architecture (see CLAUDE.md).
The chain is set at build time via VITE_CHAIN_ID.
Should I document this more clearly instead?
```

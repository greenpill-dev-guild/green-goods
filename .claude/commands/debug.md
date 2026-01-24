# /debug - Debugging & Troubleshooting

Systematic debugging and emergency troubleshooting.

## Trigger

- `/debug` - Start systematic debugging
- `/debug [error message]` - Debug specific error
- `/debug --panic` - Emergency mode (when everything is broken)

## Process

1. Load the `debug` skill from `.claude/skills/debug/SKILL.md`
2. Follow root cause investigation protocol
3. Apply fix and verify

## Usage

### Standard Debugging
```bash
/debug                          # Start investigation
/debug TypeError: Cannot read   # Debug specific error
```

### Emergency Mode
```bash
/debug --panic                  # When everything is broken
```

## Root Cause Investigation

1. **Gather Evidence** - Read error messages thoroughly
2. **Reproduce** - Can you trigger it reliably?
3. **Pattern Analysis** - Compare working vs broken
4. **Hypothesis Testing** - One change at a time
5. **Fix & Verify** - Apply and test

## Emergency Protocol (--panic mode)

### Step 1: STOP
- Don't make more changes
- Don't try quick fixes

### Step 2: Assess
```bash
git status
git log --oneline -10
bun test 2>&1 | head -50
bun build 2>&1 | head -50
```

### Step 3: Stabilize
```bash
# Option A: Revert
git checkout [last-good-commit] -- .

# Option B: Stash
git stash && git checkout main

# Option C: Nuclear
cd .. && rm -rf green-goods && git clone [repo]
```

### Step 4: Fix incrementally
- One change at a time
- Verify after each fix

## Quick Fixes

### Lint Issues
```bash
bun format && bun lint --fix
```

### Build Broken
```bash
rm -rf node_modules/.cache packages/*/dist
bun install && bun build
```

### TypeScript Errors
```bash
rm -rf node_modules/@types
bun install && bun run tsc --noEmit
```

### Contracts Won't Compile
```bash
cd packages/contracts
forge clean && forge build
```

## Three-Strike Protocol

After 3 failed fixes:
1. STOP fixing
2. Document what you tried
3. Question the architecture
4. Ask for help

## Output

After debugging:
1. Root cause explanation
2. Fix applied
3. Verification results
4. Prevention recommendations

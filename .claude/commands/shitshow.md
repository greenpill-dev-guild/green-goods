# /shitshow - Emergency Troubleshooting

Crisis mode for when everything is broken.

## Trigger

User says `/shitshow` or "everything is broken"

## Process

1. Stop all current work
2. Assess the damage
3. Stabilize before fixing
4. Systematic recovery

## Step 1: STOP

- Don't make more changes
- Don't try quick fixes
- Don't panic

## Step 2: Assess

```bash
# What's the git state?
git status
git log --oneline -10

# What's broken?
bun test 2>&1 | head -50
bun build 2>&1 | head -50
bun lint 2>&1 | head -50

# Recent changes
git diff HEAD~5 --stat
```

## Step 3: Stabilize

Options in order of preference:

### Option A: Revert to Last Known Good

```bash
# Find last working commit
git log --oneline

# Revert to it
git checkout [commit] -- .
```

### Option B: Stash and Reset

```bash
# Save current work
git stash

# Reset to clean state
git checkout main
git pull
```

### Option C: Fresh Clone

```bash
# Nuclear option
cd ..
rm -rf green-goods
git clone [repo-url]
cd green-goods
bun install
```

## Step 4: Systematic Recovery

Once stable:

1. **Identify the cause**
   - What changed before it broke?
   - Single cause or multiple?

2. **Fix incrementally**
   - One change at a time
   - Verify after each fix

3. **Verify fully**
   ```bash
   bun format && bun lint && bun test && bun build
   ```

## Common Shitshows

### "Tests were passing, now they're not"

```bash
# Check what changed
git diff HEAD~1

# Run specific test
bun test [test-file]

# Check test environment
bun test --reporter=verbose
```

### "Build is broken"

```bash
# Clear caches
rm -rf node_modules/.cache
rm -rf packages/*/dist

# Fresh install
bun install

# Try build again
bun build
```

### "TypeScript errors everywhere"

```bash
# Check for version issues
bun why typescript

# Regenerate types
rm -rf node_modules/@types
bun install

# Run type check
bun run tsc --noEmit
```

### "Contracts won't compile"

```bash
cd packages/contracts

# Clean and rebuild
forge clean
forge build

# Check for missing deps
forge install
```

## Output

After stabilizing:
1. What broke
2. What fixed it
3. What was lost (if anything)
4. How to prevent next time

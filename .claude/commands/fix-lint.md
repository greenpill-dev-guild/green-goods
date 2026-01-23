# /fix-lint - Auto-fix Linting Issues

Automatically fix linting issues across the codebase.

## Trigger

User says `/fix-lint` or "fix linting"

## Process

1. Run linting with auto-fix
2. Report what was fixed
3. Show any remaining issues

## Commands

```bash
# Format with Biome
bun format

# Lint with auto-fix
bun lint --fix

# Full validation after
bun lint
```

## Package-Specific

```bash
# Client only
cd packages/client && bun lint --fix

# Contracts only
cd packages/contracts && forge fmt && solhint 'src/**/*.sol' --fix
```

## Output

After fixing:
1. Files modified
2. Issues auto-fixed
3. Remaining manual fixes needed
4. Verification command to run

# /pr - Create Pull Request

Create a pull request with proper issue linking and conventional commit format.

## Trigger

User says `/pr` or "create a PR"

## Process

1. Load the `create-pr` skill from `.claude/skills/create-pr/SKILL.md`
2. Execute the skill workflow
3. Create PR with GitHub CLI

## Quick Reference

```bash
# Check status
git status
git log main..HEAD --oneline

# Create PR
gh pr create --title "type(scope): description" --body "..."
```

## Conventional Commit Scopes

- `client` - PWA client
- `admin` - Admin dashboard
- `shared` - Shared package
- `contracts` - Smart contracts
- `indexer` - Envio indexer
- `agent` - Bot agent

## Required Checks Before PR

```bash
bash .claude/scripts/validate-hook-location.sh
node .claude/scripts/check-i18n-completeness.js
bun lint
bun test
```

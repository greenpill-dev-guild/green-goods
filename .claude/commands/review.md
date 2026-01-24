# /review - Code Review & PR Creation

Review code changes and create pull requests.

## Trigger

- `/review` - Review current changes against plan
- `/review pr` - Create a pull request
- `/review [PR#]` - Review a specific PR

## Process

1. Load the `review` skill from `.claude/skills/review/SKILL.md`
2. Follow the 6-pass review protocol
3. Post findings to GitHub if reviewing a PR

## Usage

### Review Changes
```bash
/review                 # Review working copy changes
/review pr              # Create PR with proper linking
/review 123             # Review PR #123
```

### Before PR Creation
```bash
# Verify Green Goods conventions
bash .claude/scripts/validate-hook-location.sh
node .claude/scripts/check-i18n-completeness.js

# Run validation
bun format && bun lint && bun test && bun build
```

## 6-Pass Review Protocol

1. **Pass 0**: Change explanation with Mermaid diagram
2. **Pass 1**: Technical issues (types, nulls, errors)
3. **Pass 2**: Code consistency (style, dead code, naming)
4. **Pass 3**: Architecture (abstractions, layer violations)
5. **Pass 4**: Environment compatibility (platform, browser)
6. **Pass 5**: Verification strategy
7. **Pass 6**: Synthesis and recommendation

## Conventional Commit Scopes

- `client` - PWA client
- `admin` - Admin dashboard
- `shared` - Shared package
- `contracts` - Smart contracts
- `indexer` - Envio indexer
- `agent` - Bot agent

## Output

Review report with:
- Change explanation
- Issue coverage table
- Categorized findings (Critical/High/Medium/Low)
- Recommendation (APPROVE/REQUEST_CHANGES)

PR with:
- Summary bullets
- Test plan checklist
- Issue linking

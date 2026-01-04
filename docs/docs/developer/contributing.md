# How to Contribute

Green Goods is open source and welcomes contributions from developers, designers, and documentation writers.

---

## Quick Start

1. **Fork the repo**: https://github.com/greenpill-dev-guild/green-goods
2. **Clone and setup**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/green-goods.git
   cd green-goods
   bun setup
   ```
3. **Create branch**:
   ```bash
   git checkout -b feat/your-feature
   ```
4. **Make changes, test, commit**
5. **Push and create PR**

---

## Code Style

### Formatting

**Biome** (35x faster than Prettier):
```bash
bun format
```

Auto-formats on save in VS Code.

### Linting

**0xlint** + Biome:
```bash
bun lint
```

~30ms on entire codebase.

### Conventional Commits

**Format**: `type(scope): description`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `chore`: Maintenance

**Examples**:
```
feat(client): add garden search filter
fix(contracts): resolve storage gap issue
docs: update installation guide
test(admin): add garden creation tests
```

---

## Testing Requirements

**Before PR**:
- [ ] Unit tests pass: `bun test`
- [ ] E2E smoke tests pass: `bun test:e2e:smoke` (for UI changes)
- [ ] Linter clean: `bun lint`
- [ ] Formatted: `bun format`
- [ ] TypeScript compiles: `bun build`

**Coverage**:
- New features: 70%+ unit test coverage
- Critical paths: 80%+ coverage
- Security code: 100% coverage
- UI changes: Add E2E test or update existing

**E2E testing** (for UI/auth changes):
- Run `bun test:e2e:smoke` locally before pushing
- See [Testing Guide](testing.md#e2e-testing-playwright) for writing E2E tests

---

## Pull Request Process

1. **Small PRs**: < 500 lines preferred
2. **Clear description**: What, why, how
3. **Link issue**: Fixes #123
4. **Screenshots**: For UI changes
5. **Tests included**: For new functionality
6. **Documentation updated**: README, docs, comments

**PR Template**:
```markdown
## What
Brief description of changes

## Why
Problem being solved

## How
Technical approach

## Testing
How to test this

## Screenshots
(if UI changes)
```

---

## Development Workflow

1. **Find an issue**: [Good first issues](https://github.com/greenpill-dev-guild/green-goods/labels/good%20first%20issue)
2. **Comment on issue**: "I'd like to work on this"
3. **Get assigned** (maintainers will assign)
4. **Create branch**: `feat/issue-123-description`
5. **Develop and test locally**
6. **Commit with conventional format**
7. **Push and create PR**
8. **Address review feedback**
9. **Merge** (maintainers merge after approval)

---

## Code Review Standards

**Reviewers check**:
- Functionality works as described
- Tests are comprehensive
- Code follows style guide
- No security vulnerabilities
- Documentation is updated
- Commits are clean

**Review time**: Usually 2-7 days

---

## Security & Responsible Disclosure

**Found a security issue?**

**DO NOT** open a public issue.

**Instead**:
1. Email: security@greengoods.app (or reach out in Telegram privately)
2. Include description, steps to reproduce, impact assessment
3. Allow reasonable time for fix (90 days)
4. Receive credit in security advisories

**Reward**: Eligible for bug bounties (when program launches)

---

## Documentation Contributions

See [Contributing to Documentation](docs-contributing) for the full workflow, asset guidelines, and style notes.

**Quick highlights:**

- Edit markdown files under `docs/` — GitBook pulls directly from this folder via Git Sync.
- Store new images/diagrams in `.gitbook/assets/` following the naming rules in the asset README.
- Use relative links for internal docs, specify code block languages, and keep heading levels sequential.
- Open PRs with the `docs` label so reviewers can route them quickly.

---

## Community

### Communication Channels

- 💬 **Dev Chat**: [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
- 🐙 **GitHub**: [Issues](https://github.com/greenpill-dev-guild/green-goods/issues) • [Discussions](https://github.com/greenpill-dev-guild/green-goods/discussions)
- 📣 **Updates**: [Twitter](https://x.com/greengoodsapp)

### Meeting Schedule

**Weekly standup**: Fridays 10am PT (optional, announced in Telegram)

---

## Roadmap & Priorities

**Current Priorities**:
1. Hypercert integration
2. Multi-chain expansion
3. Performance optimization
4. Mobile native apps

**View full roadmap**: [GitHub Projects](https://github.com/greenpill-dev-guild/green-goods/projects)

---

## Contributor Recognition

- Contributors listed in [Credits](../reference/credits)
- Mention in release notes
- Potential for core team invitation
- Future: Retroactive rewards (via Hypercerts!)

---

## Learn More

- [Developer Quickstart](../welcome/quickstart-developer)
- [Installation Guide](installation)
- [Testing Details](testing)
- [Architecture Docs](architecture/monorepo-structure)


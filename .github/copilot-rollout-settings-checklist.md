# GitHub Copilot Rollout Settings Checklist

Apply these settings in GitHub after the repo-backed rollout files are merged. They cannot be fully encoded in-repo today.

## 1. Copilot Code Review

- [ ] Configure automatic Copilot review through a ruleset that targets pull requests into `main` and `develop`.
  - Recommended value: enabled
  - Review trigger: open pull requests only
  - Review draft pull requests: disabled
  - Review new pushes to qualifying pull requests: enabled
- [ ] In repository settings, keep **Use custom instructions when reviewing pull requests** enabled so `.github/copilot-instructions.md` and `.github/instructions/**` are applied.
- [ ] Do not create a second guidance system in the GitHub UI. Leave UI-only coding guidelines empty or minimal unless they point back to the repo files above.
- [ ] Do not configure IDE/editor autocomplete rollout, prompt files, custom Copilot agents, or Copilot skills as part of this rollout.

## 2. Cost Controls

- [ ] Set a Copilot premium-request budget before enabling automatic review for maintainers.
  - Monthly premium-request budget: **TODO define with repo owners; do not guess**
  - Alert thresholds: `50%`, `80%`, `100%`
  - Recommended behavior at limit: pause or stop automatic review rather than silently overspend
- [ ] Review premium-request analytics after the first two weeks and keep the `main` / `develop` branch scope unless usage is clearly sustainable.

## 3. Security And Quality

- [ ] Enable GitHub Code Security or GitHub Advanced Security for this repository if available.
- [ ] Enable Code scanning and confirm the CodeQL job in `.github/workflows/shared.yml` succeeds on the default branch for both `javascript-typescript` and `actions`.
- [ ] Enable the dependency graph.
- [ ] Enable Dependabot alerts.
- [ ] Keep npm version-update PRs disabled until the Bun-first remediation loop is intentionally revisited.
- [ ] Enable secret scanning.
- [ ] Enable push protection for secrets.
- [ ] If the repository uses private vulnerability reporting, keep it enabled.

## 4. Protected Path Governance

- [ ] Require code-owner review on `main` and `develop` so `.github/CODEOWNERS` protects high-risk paths.
- [ ] Keep automatic Copilot review enabled even on protected paths, but preserve human merge authority for:
  - `.github/workflows/**`, `.github/copilot-instructions.md`, `.github/instructions/**`, `.github/dependabot.yml`, `.github/CODEOWNERS`
  - `AGENTS.md`, `packages/*/AGENTS.md`, `.codex/**`, `.claude/**`, `CLAUDE.md`
  - `.env*`
  - `packages/contracts/src/**`, `packages/contracts/test/**`, `packages/contracts/script/**`, `packages/contracts/deployments/**`, `packages/contracts/config/**`
  - `packages/indexer/schema.graphql`, `packages/indexer/config.yaml`
  - `scripts/contracts/verify-production.sh`

## 5. Signed Commits, Runner Controls, Firewall Controls

- [ ] Signed commits: if GitHub Copilot cloud agent or any autonomous remediation flow is enabled later, require signed commits first.
- [ ] Runner controls: restrict any Copilot-driven or security automation workflows to GitHub-hosted runners or an approved runner group only.
- [ ] Firewall controls: if self-hosted runners are used, restrict outbound network access to required registries and GitHub endpoints before enabling autonomous remediation.
- [ ] Do not enable autonomous deployment, upgrade, or `.env` write flows as part of this rollout.

## 6. Post-Enablement Verification

- [ ] Open a non-draft pull request into `develop` that touches one package and confirm automatic Copilot review runs.
- [ ] Push another commit to that pull request and confirm Copilot review reruns.
- [ ] Open a draft pull request and confirm Copilot does not review it.
- [ ] Open a pull request into a non-target branch and confirm automatic Copilot review does not run.
- [ ] Confirm CodeQL analyzes both `javascript-typescript` and `actions`.

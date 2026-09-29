# Agent reporting — Client ceremony handoff

## Lane

- Owner: Opus 5.5 (Claude)
- Branch: `feature/agent-reporting-core` (PR #2), with the state_api lane
- Status: in progress (see status.json). The ceremony pages and Shared hooks are implemented and
  fixture-tested; authenticated signing proof, deployed proxy proof and the section 9.3 permission
  mode remain. Independent review by Astra has not happened yet.
- Support owner: Afolabi, [afo@wefa.world](mailto:afo@wefa.world)

## Start gate

Completed on 2026-09-27 with the state_api lane (`parent_only`, PRD-998).

## What changed in PR #2

- Shared hooks `useAgentReportingCeremony` and `useAgentReportingRecovery` (declared exports) on the
  typed `CeremonyClient`. Nothing is requested until the person continues; proof signs the Agent's
  exact message with the existing wallet or passkey signer; new links pair through the chat; a
  refreshed tab resumes only its own session.
- Publishing checks the frozen envelope independently before reserving, rebuilds the `attest` call
  from its calldata, sends through the existing transaction sender, reports the broadcast hash as
  soon as it exists, classifies failures with the Work queue's send rules and replays an
  undelivered outcome with the same idempotency key after a reload.
- Client routes `/agent/reporting/:requestId`, `/agent/reporting/recover/:requestId` and the static
  `/agent/reporting/permissions` (no API calls; states that delegated publishing is unavailable)
  under PublicShell with `FocusedSiteHeader`: the mark and a Help control, no navigation or install
  CTA. Website presentation even when an installed app captures the link; a focused boot skeleton.
  The wallet runtime loads only on these pages and without analytics identity. Copy in en, es, pt.
- `vercel.json` proxies `/api/messaging` to the Agent on the same origin and serves both prefixes
  `no-store`, `no-referrer` and `noindex`. PostHog and Sentry drop link locators and take no
  recordings on ceremony pages. Ceremony queries never enter the persisted reading cache. The pages
  are not WebMCP routes. `DESIGN.browser.md` records the route exception.

The support contact is one Shared constant, which the header takes from `@green-goods/shared/config/app`
so public pages do not load the reporting rules. The Help control and the focused header are a
separate component rather than a `SiteHeader` variant: the editorial header's markup is geometry-locked to the boot skeleton, and the ceremony
header shares none of its behavior.

## What remains

- Authenticated Brave proof of wallet and passkey signing, and the deployed proxy, cookie, Origin
  and header checks (capability record section 4).
- The section 9.3 permission mode on `/agent/reporting/permissions`: owner revocation without the
  Agent, descriptor import and reconstruction. Delegation stays disabled until it passes.

## TDD Proof

- RED: with the pre-reservation envelope check removed from `useAgentReportingCeremony`,
  `bun run vitest run src/__tests__/hooks/agent-reporting/` (in `packages/shared`) fails
  "refuses an envelope that no longer matches its own digest before reserving anything"; with the
  restore-time replay removed it fails "replays an outcome it could not deliver".
- GREEN: the same command passes with both in place (10 tests).
- These are mutation checks on behavior written with the tests, not tests written before the code.

## Rendered proof

- **Storybook** (`Client/Public/AgentReporting/Ceremony`, app surface) on 2026-09-27: review at
  desktop width; pairing, review with the wrong account, prove (connected), outcome unknown and
  recovery code at 375 px. The other stories (intro, connect, submitted, published, not sent,
  unavailable, recovery confirm, permissions) are defined but were not inspected one by one, and
  these checks predate the Help control.
- **mock-auth localhost** (`client-http-3011`, `?mockAuth=deployer&presentation=website`) against the
  loopback driver on 2026-09-27: a real Agent-issued link rendered the intro with no API request;
  Continue produced one `POST /api/messaging/challenges` → 201 through the same-origin proxy and
  the connect stage; with no signer under mock auth, Sign to continue failed gracefully with no
  proof submitted. The permissions page made no API request; the page head carried
  `noindex, nofollow` and `no-referrer`, the focused header and no navigation.
- **Authenticated** wallet or passkey signing: pending (requires Brave with a real account).

## Validation Receipt

- Tested implementation commit SHA: `5005199ea54f327f70e63a71d183d6a4eb288821`
- Run at (UTC): 2026-09-29T00:15:14Z
- Exact command(s): the pre-push hook's
  `node scripts/dev/node-cli.js scripts/dev/ci-local.js --intent push --reuse-passing-receipts`
  (critical push plan against the PR base, `chore/whatsapp-prototype-scope-lock`)
- Result: every automated check passed: format, lint, validation-system-test, test-quality,
  abi-artifacts, the Shared, Client, Admin, Agent and Indexer typecheck, test and build legs,
  contracts-build, contracts-test, contracts-verify-fast, docs-authority, docs-test, docs-build,
  staged-modules, source-structure, design-guardrails, agent-guidance, supply-chain and
  story-quality. Turbo replayed the Shared and Client test legs, whose inputs are unchanged since
  `53e4dc7`, where they ran in full (Shared 6005 passed and 17 skipped, Client 1415); the Client
  build ran. `browser-proof` stays pending (manual).
- Validated paths: `.github bun.lock docs packages scripts` (everything the branch changes outside this hub)
- Worktree identity command and result:
  `git status --porcelain=v1 --untracked-files=all -- .github bun.lock docs packages scripts` → empty
- Evidence-only diff command and result (if applicable):
  `git diff --exit-code 5005199ea54f327f70e63a71d183d6a4eb288821..HEAD -- .github bun.lock docs packages scripts`
  → empty; the receipt commit changes only `.plans/`
- Evidence-only worktree-status command and result (if applicable):
  `git status --porcelain=v1 --untracked-files=all -- .github bun.lock docs packages scripts` → empty

## Risks / Blockers

Wallet prompts, passkey origin binding and mobile handoff are unproven. The beta frontend cannot run
ceremonies against the production Agent, which accepts one configured origin.

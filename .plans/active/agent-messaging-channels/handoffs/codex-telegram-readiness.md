# Telegram-first implementation and live-session handoff

**Updated:** 2026-10-03
**Owner:** Codex; Afolabi owns live testing and deployment
**Branch:** `feature/agent-reporting-telegram` (PR #949, stacked on #934 and #864)
**State:** first-report activation follow-up implemented; complete selected critical worktree gate and final-image Office smoke passed; production release and live acceptance unrun

This is the current execution handoff. It supersedes the laptop polling demo in the
[earlier Telegram handoff](claude-telegram-channel.md). Keep the production bot in webhook
mode and use the deployed browser origin for live testing. Do not start local polling with
the production bot token: that would displace its webhook.

## Accepted behavior

- Existing gardeners send private Telegram text, photos, PDF, DOCX, CSV or XLSX evidence.
  Corrections and the final report confirmation stay in chat. OpenAI extracts content;
  Jev makes bounded routing judgments; the deterministic field walk handles provider failure.
- The browser provides account proof, same-chat pairing, exact publication/review signing,
  optional verified Kernel first-report activation, outcome checking, and recovery.
  PWA installation is unnecessary. A wallet proof or paired session never grants membership
  or signing authority by itself.
- A person can attach one active Telegram and one active WhatsApp channel to the same proven
  account. Pairing transfers only a provisional identity with no account/signing history.
  Replacing a chat requires recovery and does not replace the other channel's conversation.
- New reporting databases enable intake, documents, model processing, publication and Telegram.
  Existing operator decisions survive upgrades. Voice and WhatsApp stay off.
- Kernel reporting remains limited to five publications in 24 hours, for one garden and channel.
  Review is a separate permission and needs its own effects/work-reference proof.
  Per-grant keys use encrypted software custody; the executor can decrypt them. This is not
  non-exportable KMS custody, and no owner key is held by the Agent. No grant is
  offered until the deployed module registry, full cost budget and signer custody gates pass.

## Models and root environment

Pinned snapshots are `gpt-4.1-mini-2025-04-14`,
`gpt-4o-mini-transcribe-2025-12-15`, and `jev-1.13.0`. Environment values cannot change
those model versions. The transcription snapshot is prepared; voice remains disabled.

Use the root `env.template` and `env.schema`. Required reporting/provider values are:

| Variable | Purpose |
| --- | --- |
| `AGENT_REPORTING_KEYS` | Versioned wrapping/HMAC key ring for private reporting state; absence keeps reporting off |
| `AGENT_REPORTING_OPENAI_API_KEY` | OpenAI extraction, document/photo interpretation, and optional transcription |
| `AGENT_REPORTING_JEV_API_KEY` | Jev bounded routing |
| `AGENT_REPORTING_SIGNER_KEYS` | Separate versioned wrapping ring for per-grant delegated signer files; required only for delegation |

Store references to actual approved 1Password fields, not plaintext secrets, in the template.
The user supplied the local and Fly credentials. Synthetic live text evaluations passed 12/12,
and media evaluations passed 9/9 after a prompt correction. Do not invent vault items. Before `bun run env:sync`, reconcile
the root template with existing settings because that command rewrites the root `.env`.
Do not create package environment files. Keep old wrapping versions during key rotation so
existing records remain readable; never reuse the reporting wrapping material as signer material.

The provider-only walkthrough evaluates synthetic English, Spanish and Portuguese examples,
including corrections, unstated values and status requests. Record latency, usage, accepted values,
fallback rate and the command's estimated OpenAI text cost. Jev cost is not measured by that estimate.
Run from the repository root after the key references are resolved:

```sh
bun --env-file=.env packages/agent/src/__tests__/reporting/driver/walkthrough.ts --models
```

Delegation also needs the existing `VITE_PIMLICO_API_KEY` (or server `PIMLICO_API_KEY`)
and `VITE_PIMLICO_SPONSORSHIP_POLICY_ID` (or server `PIMLICO_SPONSORSHIP_POLICY_ID`).
These are already declared; do not invent a sponsorship policy. Deployed policy/paymaster pins
and measured gas/wei budgets come from the verified module registry, never arbitrary environment values.
Live provider evidence below covers synthetic fixtures; it does not certify real garden reports.

## Remote API and browser flow

The Client proxies `/api/messaging/:path*` to the Agent's `/messaging/:path*` routes.
Deploy both the Agent and Client changes; the current production Agent has not loaded this feature.

1. Telegram stores the event/draft, asks for missing Action inputs, and issues a purpose-bound link.
2. An explicit browser action creates a challenge with the expected Origin and bootstrap header.
3. The connected account proves ownership through the existing EOA/ERC-1271/ERC-6492 verifier.
4. A code entered in the source chat binds that proof to the channel. The browser receives a
   short-lived scoped session; state changes require its CSRF header.
5. The browser reads the named draft/review and private media, validates the exact prepared
   envelope, and uses the existing owner sender. A verified Kernel grant instead freezes the actual first report for browser review.
   A second explicit action reserves the attempt, saves its public revocation descriptor, and
   prompts the owner to authorize that report and bounded permission. The SDK keeps the owner
   enable signature in the browser; the Agent receives a strict signature-free operation and
   returns only the delegated signature. The browser submits the completed operation to its bundler.
6. Durable attempt references and independent receipt reconciliation determine publication.
   An uncertain send stays reserved; refreshing a page or restarting the Agent cannot create
   a second publication or another budget reservation.

Relevant route families: `/messaging/challenges`, `/messaging/access`,
`/messaging/drafts/:id`, `/messaging/reviews/:id`, `/messaging/media/:id`,
`/messaging/operations/:id`, `/messaging/execution-grants`, and `/messaging/recovery/:id`.
Browser pages are `/agent/reporting/:requestId`, `/agent/reporting/recover/:requestId`,
and `/agent/reporting/permissions`. The permissions page reads public RPC and uses the owner
sender without an Agent connection. Kernel nonce invalidation affects all non-root permissions,
including those from other applications; the confirmation discloses this before signing.

## Deployment and bot checklist

1. Finish current-head local/CI validation; keep all three PRs as drafts until reviewed.
2. Provision the reporting/provider secrets in the existing Fly application and Client configuration.
   Retain the existing bot token, webhook secret, Pinata configuration, encrypted `/data` volume,
   single-machine topology, and chain `42161`. Ensure volume capacity for bounded private media.
3. Build and smoke-test the pinned Office image. Verify that the Fly runtime supports the
   bubblewrap namespaces, convert a synthetic DOCX and XLSX, and inspect the resulting PDF.
   Converter unavailability preserves native extraction; unsafe files never run unsandboxed.
   Fly synthetic DOCX/XLSX conversion now passes with the production module correction: headless
   `svp` backend and a read-only static `/etc/libreoffice` registry bind. The final validated image
   also passed unchanged; the original image predated these corrections.
4. Deploy the Agent and Client and verify HTTPS, no-store/security headers, the Client proxy,
   private preview scope and origin/cookie behavior. A 200 HTML SPA fallback is not API proof.
5. Use authenticated `/reporting/ops/health` and
   `POST /reporting/ops/controls/:name` (`enabled`, `reason`) to inspect persisted controls.
   Enable the intended Telegram controls explicitly if an earlier database has them paused.
6. Verify the existing bot's webhook points to `https://agent.greengoods.app/webhook/telegram`.
   The bot remains `@green_goods_bot`. No BotFather update or token rotation is needed:
   startup refreshes its private menu with the Telegram commands `start`, `status`, and `help`. Groups retain the existing path.
7. For delegation, deploy the new guard separately, record the code hash, verify the entire pinned
   Kernel/SDK/policy stack, measure gas/cost caps, prove adversarial execution and independent
   revocation, then add the verified registry entry. Source tests alone do not authorize activation.

## Aiyeloja two-account acceptance

Use Aiyeloja Family Garden `0xF7b892886998DAe960D64a9db488336684F137A0` on Arbitrum One.
Recheck actual roles for both accounts at the start of the session. The Telegram acceptance
assumes two Telegram identities, one wallet each: a private chat pairs with one wallet.
If both wallets use one Telegram account, run the steward review in the existing PWA until
a second Telegram identity is available; that does not establish the steward Telegram flow.

- Gardener: text plus photo, missing-field question, correction, account pairing, exact owner
  publication, durable receipt and return to chat. Declining a signature must leave a usable draft.
- Steward: find the gardener's published work, prepare approval/rejection, confirm the exact
  decision, sign as the steward and reconcile. Never approve one's own work.
- Repeat the browser flow on desktop and mobile, including reload after a reported send and
  an uncertain provider response. Record authenticated signing evidence; Storybook is layout proof.
- After the Kernel compatibility gate, activate a bounded reporting grant by approving and publishing the first confirmed
  report in the browser, then publish a second confirmed report from Telegram. Exercise expiry, fifth/sixth publication, wrong garden/channel, pause during
  an RPC read, restart, lost bundler response and direct owner removal with the Agent unavailable.
- WhatsApp needs access restored **and its live transport adapter**. The dual-channel identity
  architecture and synthetic tests do not constitute a deployed WhatsApp integration.

## Earlier validation receipt (historical)

- **Tested implementation commit SHA:** `202333ca6831e2e5d3bceae32a4c0894519ab019`
- **Run at (UTC):** `2026-10-02T09:09:30Z`
- **Exact command(s):** `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path shared:packages/shared/src/__tests__/modules/agent-reporting/grants.test.ts`
- **Result:** complete selected critical plan passed: package typechecks/tests/builds, 2,100 Solidity tests, contract release verification, docs, design/Storybook, source structure, supply chain, validation policy and immutable-report checks. Agent SQLite acceptance includes 116 passing tests. A first run failed only on the handoff's slash-command wording; the corrected commit passed the complete rerun.
- **Validated paths:** all repository implementation, dependency, configuration and validation paths outside `.plans`, represented by `. ':!.plans'`.
- **Worktree identity command and result:** `git status --porcelain=v1 --untracked-files=all -- . ':!.plans'` → empty output; clean validated paths.
- **Evidence-only diff command and result (if applicable):** Not applicable
- **Evidence-only worktree-status command and result (if applicable):** Not applicable

Rendered proof is **Storybook (Codex in-app browser)** on 2026-10-02: review at
1280×900 desktop and 375×812 mobile; no horizontal overflow; visible buttons at least 48px.
Grant, permission-removal confirmation, recovery and uncertain-send states were also inspected.
This is layout evidence, not authenticated wallet/passkey signing, live model quality or Telegram
production proof. Screenshots use synthetic garden content. Current-head GitHub CI follows the
normal push; the PR body records its live status. The feature hub remains active for the live gates.

## CI follow-up: Storybook asset input

GitHub CI at `bd3162c28148ae4e712e955fb0de2dc49ab8fcee` caught the new Client logo
read missing from the design deployment input list. The existing regression test reproduced it:
`node --test scripts/ops/vercel-ignore.test.mjs` failed with
`design reads packages/client/public/icon.png`. The build-input list now includes that exact file;
the same test passes. This source follow-up is outside the earlier receipt's evidence-only reuse.
The normal pre-push gate validates the new complete head; the PR body records that head and its
current GitHub CI status. No fixture, workflow requirement or skip rule was weakened.

## First-report activation follow-up, 2026-10-02

The user selected browser-only first-report activation. Kernel 0.3.1's direct
`installValidations` path installs a signer without the execute selector, so it cannot activate
a usable reporting permission. The first exact EAS report now uses the SDK ENABLE operation;
subsequent reports use DEFAULT operations with only the delegated signer. Permission status
checks the execute selector as well as signer, hook and non-revoked generation.

The activation API is under `/messaging/execution-grants/:id/activation`, with separate
`attempts`, `signature` and `outcome` endpoints. The strict 12-field unsigned operation forbids
owner signatures, factory deployment and EIP-7702 authorization. Signature exposure durably
records the exact operation hash and retains the budget before returning bytes. Only the exact
first-report receipt and usable onchain permission make the grant active; the first report is
never queued again. Migration 3 names `activation` attempts explicitly and preserves historical
attempts and outcomes.

Reporting allows five publications over 24 hours. Review is a separate five-review allowance
over one hour. The first item consumes one allowance. Role checks and self-review refusal remain
required; a wallet proof never grants a garden role.

Live model proof used synthetic content only. Nine native media fixtures passed after fixing
a photo prompt-injection failure that initially extracted an embedded false count. The adversarial
photo subsequently passed three independent repeats. Snapshot: `gpt-4.1-mini-2025-04-14`.
OpenAI estimated cost of the media lane, including failed runs and repeats, was approximately
$0.0118. Converted Office cases subsequently passed 2/2 on Fly using the provisioned key, with real
sandboxed conversion and Poppler inspection. They returned the pinned model, preserved quotations
and cell provenance, and rejected invented totals/embedded instructions. Provider latency was
4.292s for DOCX and 2.994s for XLSX; estimated token cost was $0.000948. All 11 synthetic media
cases have passing proof across the host and Fly runs; no single run covered all 11. This does
not certify real garden photographs.

The final Kernel fork runner passed 17/17 scenarios through EntryPoint `handleOps` with deployed
pinned SDK/Kernel/policy bytecode and a production guard. It includes first ENABLE, later DEFAULT,
malformed scope/calls, cumulative complete sponsorship cost, report/review count limits, separate
one-hour review expiry, owner uninstall, nonce revocation, stale enable replay and report expiry.
Proof: fork block `511136709`, verified at `2026-10-02T23:46:01.460Z`, source digest
`sha256:72da136a4312253633f75463a565f28207e6f16f9f4848b134f583b320f9bc88` across 1,815 public
source files. The artifact declares `workingTreeDirty: true` and `activationReady: false`.
The fixture uses ECDSA root authority, fixture EAS and a deposited fixture
paymaster. It is not proof of production passkey, EAS resolver/roles, live sponsorship or a
deployed guard; the verified registry remains empty.

Fly Office proof used a temporary no-service, no-volume machine with synthetic fixtures.
With the corrected compiled production module, DOCX produced a 19,384-byte one-page PDF and
XLSX a 19,028-byte one-page PDF. Machine `83dd19ec145278` exited zero and was destroyed.
Namespaces, network isolation, capability removal, minimal environment, resource caps and
active-content protections stayed enabled. The first image built and passed runtime import smoke
at `sha256:791ab05b23f4c9000193b1f1c4ae53c65ee9cd95ef7ea0543c5983a7ea031807`; it predates final
activation and Office corrections and is not the release image.

Rendered proof is **Storybook through Brave browser extension**, at 375×812 and 1280×900: no
horizontal overflow, 48px buttons, loaded logo/private fixture previews, and summary before
Allow and Publish. Preparing and uncertain states were inspected; uncertainty offers no second
publish action. Authenticated wallet/passkey proof remains pending.

Production health was 200 and Fly secret names were present. The live Client messaging path still
returned SPA HTML, so Client proxy deployment is required. No production release or contract
broadcast has occurred. The final immutable image also passed Office conversion; details below.

## Current uncommitted worktree validation, 2026-10-02

The complete selected critical QA plan passed at `2026-10-02T23:53:28Z`:
`bun run check --intent qa --base HEAD`. All 20 selected checks ran fresh, including format/lint,
ABI artifacts, source/test typechecks, Shared/Client/Admin/Agent suites, Agent build, Contracts
build/tests/release verification, documentation authority/build, staged boundaries and Storybook.
Shared passed 6,683 tests (17 governed skips), Client 1,533, Admin 1,164, Agent 426 units (one
governed skip) plus 137 SQLite tests, Contracts 319 tooling tests and 2,100 Solidity tests.
No check was suppressed or substituted. Separate source-structure, test-quality, vocabulary and
whitespace checks passed without expanding baselines.

This proof belongs to the uncommitted worktree based on HEAD
`fc6bf61d82dda8e787b0390a29fad79d5b8425c2`; it is not a commit-attributed receipt. The exact command
`git status --porcelain=v1 --untracked-files=all -- . ':!.plans'` returned implementation changes,
as expected. The historical commit receipt above does not cover these changes. Only Plan Hub
evidence is updated after this run; implementation source stays frozen. Current-head GitHub CI
for this follow-up and authenticated passkey proof remain pending.

## Final immutable image and Fly conversion proof

Build-only image: `registry.fly.io/green-goods:reporting-readiness-20261002-validated`, digest
`sha256:ff9482e25d37264e3ff7d7bf19b3fd8890dd22f87535976024b111aefaa6fa9e` (989 MB).
The frozen dependency install, Agent compile and untouched runtime imports passed. This build
includes the final gas reservation, identity-epoch and import corrections. No dependency or
lockfile changed. Optional Sentry source-map upload was skipped because the build secret was absent;
maps were stripped as configured. The image was pushed without releasing the application.

Disposable no-service, no-volume Fly machine `857495b473e108` resolved that exact digest and
ran the production converter without a module override. DOCX produced a 19,384-byte one-page
PDF at `2026-10-02T23:58:54Z`; XLSX produced a 19,028-byte one-page PDF at
`2026-10-02T23:58:56Z`. Poppler inspection passed and the process exited zero. The sandbox
and resource limits remained enabled. Fly's CLI startup monitor returned early during the
80-second image pull; machine logs establish the later successful run. This was synthetic
conversion proof, with no production reporting traffic or contract broadcast.
`flyctl machine status 857495b473e108 --app green-goods` confirmed `destroyed`, exit code zero,
and `oom_killed: false`; no test machine remains running.

## Guard deployment, page redraw and develop merge, 2026-10-03

Recorded by the Claude interface session with Afolabi. The sections above predate it.

- **Guard deployed.** `SingleAttestationPolicy` is on Arbitrum One at
  `0xfe7c50354cE1AC1d10aEe840a520A40103A3d971`, transaction
  `0x77b5ad3f59bf926c1598344e91ddc97d20f8791986e5025eae4ef79976f05b69`, block 511448509, deployer
  nonce 993, reviewed commit `e60ae197c`. Afolabi signed the broadcast from his own terminal.
  `bun run contracts -- verify single-attestation-policy --network arbitrum` returns `verified`:
  the receipt is the reviewed contract creation, and the live runtime hash
  `0x76f0a1fa648cf915dfe2a72a150622eb7d96f725cea6666e93f27f6e5645a0cf` equals the production
  build and the guard the fork proof exercised. The record is
  `packages/contracts/deployments/42161-single-attestation-policy.json`. Of checklist step 7 this
  closes the deployment and the code hash only. The paymaster pin, measured cost caps, passkey
  owner signing, production EAS publication and live sponsorship remain open, and the verified
  permission registry stays empty. The contract has no owner and no upgrade path.
- **Explorer source.** The same verify command takes `--publish-source` to submit the source
  after the deployment verifies. It uses no signer and sends no transaction. The live submission
  is Afolabi's to run and was still pending when this was written.
- **Browser pages redrawn.** The reporting, recovery and permissions pages keep each band (top
  bar, heading card, status card, bottom bar) at one height, carry their steps in the top bar, and
  move account and help into a sheet. Rendered proof is Storybook in headless Chromium and a
  localhost run against the loopback driver, with no wallet. Authenticated signing proof is still
  pending. The API, state machines, consent, grant limits and signing sequence are unchanged.
- **Develop merged in.** The branch contains develop as of `df0484c68`. The stack #864 → #934 →
  #949 stays linked, as stack 988. The reporting core's branch had come into conflict with develop,
  which stopped CI for this pull request above it. Develop is now merged into that branch as well,
  with the code-scanning fixes moved down into it, and this branch contains that merge. The link
  was removed for a few hours on 3 October and put back at Afolabi's instruction.
- **Where the live Agent can be tested.** At that head a production Agent linked to and accepted
  only `https://www.greengoods.app`, which is built from `main`, so the merge into develop put the
  pages on staging where the live Agent could not use them. The next section changes that.

## Staging route for live testing, 2026-10-03

Afolabi decided on 3 October to test on staging with the live Agent. For deployed Agents this
replaces the 29 September line "No browser-origin setting comes back", which was written for the
laptop demo.

- **One site per deployment.** `AGENT_REPORTING_SITE` names the Green Goods site a deployed Agent
  runs its ceremonies on: `production` (the default, `https://www.greengoods.app`) or `beta`
  (`https://beta.greengoods.app`, built from develop). Ceremony links point to that site and the
  ceremony API accepts no other origin. The addresses are fixed in `reporting/config.ts`: an
  address in the environment is ignored, and with reporting on an unknown name stops the Agent at
  start-up. Outside production the Client dev server is used whichever site is named.
- **The live Agent is set to beta.** `fly.toml` carries `AGENT_REPORTING_SITE = 'beta'`, so a deploy
  of the Agent from develop runs its ceremonies on the beta site with nothing else to set. A Fly
  secret of the same name would override the file.
- **Consequence.** While the live Agent is set to `beta`, a ceremony opened on the public site is
  refused. That costs nothing until `main` carries the pages. When reporting is released to main,
  remove the line from `fly.toml`, or set `production`, and deploy the Agent again.
- **To test.** Deploy the Agent from develop with the reporting secrets in place, then follow the
  deployment checklist above from step 4 on `https://beta.greengoods.app`. The start-up log line
  "Agent reporting starting" names the origin in use.
- **Not proven yet.** Nothing has run against the deployed Agent: the Client proxy, the cookies,
  the origin check and signing on beta are still to be observed. Recheck which accounts exist on
  beta before the session. Staging has had its own passkey configuration, so a passkey account
  there may differ from the one on the public site; a wallet account is the same on both.

## Delegation switched on for passkey accounts, 2026-10-04

Recorded by the Claude interface session with Afolabi, who asked for it. This closes checklist
step 7 as far as a fork can and adds the approved module for Arbitrum One.

- **What had blocked it.** Not only the empty module list. The first report's activation asked the
  owner's account for the Kernel SDK's owner validator. The app builds passkey accounts with
  permissionless, whose account object has none, so no real account could approve a permission.
  Earlier fork proof used an SDK account with a test key and could not see this.
- **The fix.** `owner-validator.ts` adapts the account the app already has: its root, read from
  the chain, must be the passkey validator, and the passkey signs one thing, the enable request
  of the permission the page rebuilt and verified. The owner's signature stays in the browser.
- **The approved module** (`grants.ts`): signer `0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF`,
  code hash `0x510a0a1ab8b3f256a5c90b5fff51a9fd98656bd1c8a29fbd7857faa70c400ccd`; guard
  `0xfe7c50354cE1AC1d10aEe840a520A40103A3d971`, code hash
  `0x76f0a1fa648cf915dfe2a72a150622eb7d96f725cea6666e93f27f6e5645a0cf`; both read from Arbitrum
  One at block 511565792. Paymaster `0x777777777777AeC03fd955926DbF81597e66834C`, the one a Green
  Goods passkey account's sponsored operation used in transaction
  `0xca40752b288dfd58aca1b7c5b1356acea6a2b22d9284a081f6ca80d9ed2b5083`. Reporting only: review is
  not approved, and a wallet account cannot hold a permission.
- **Caps.** 2,500,000 gas units for one report and 0.005 ETH for a permission's five. On the
  fork the first report used 2,969,802 gas and a later one 1,028,748. The cap is ten million gas
  at 0.5 gwei; the chain charged 0.02 gwei when measured. These come from the fork, not from a
  live sponsored run: tighten them once live reports show the bundler's real limits.
- **Fork proof.** `bun run contracts -- verify reporting-kernel --network arbitrum --mode simulate`
  at commit `3bf04e904b0f42aae169f068e534e5a081b3f57c`, fork block 511569150, verified
  `2026-10-04T09:09:56.372Z`, source digest
  `sha256:503c6e642756fc1af335245b8111697265fd780b4158db4ba65b8d02dd7bb585`, clean tree, 21 of 21
  checks. Four are new and use the approved module's own values: an account built as the app
  builds one is deployed by its first operation and joins the Community Garden; its passkey
  approves the permission and the report reaches the production EAS and work resolver under the
  deployed guard; the delegate publishes the next report alone; the owner removes the permission
  with the passkey and the delegate is refused. The passkey is a software key on the fork.
- **A stand-in.** The paymaster's address keeps its place in the policy and carries fixture code,
  because Pimlico's signature cannot be produced on a fork.
- **Not proven.** Live sponsorship through Pimlico's bundler, and a passkey on a real device.
  Acceptance is one passkey account on beta: allow reporting on a first report, publish it, then
  publish a second from the chat, then remove the permission on the permissions page.
- **To switch it off.** Remove the entry from `VERIFIED_PERMISSION_MODULES` and deploy, or unset
  any one of the Agent's three delegation settings. Existing permissions expire within a day
  and each owner can remove theirs on the permissions page without the Agent.
- **A known edge.** An account that has never sent an operation is not deployed, and a
  permission is approved by a deployed account alone. Such an account is offered the permission
  in chat and refused on the page; signing that report itself deploys the account.

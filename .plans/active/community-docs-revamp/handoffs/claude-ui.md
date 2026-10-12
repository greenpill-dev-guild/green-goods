# Community Docs Revamp - UI Handoff

## Lane

- Owner: Claude
- Branch: `chore/community-docs-revamp-plan` (PR #896). Worked in the session branch
  `claude/green-goods-community-docs-b0ebe9`, which starts at that branch's head (`83f71d85c`).
  Nothing is pushed. The branch has not been merged with `develop` since that head.
- Status: Phases 0, 1, and 2 and steps 4.1 and 4.2 are done and validated. The replay on the
  released product (4.3) and the read-through by people (4.4) are not run.

## Scope

- The non-pooling foundation in `plan.todo.md` Phases 0, 1, 2, and 4: community pages, the sidebar,
  redirects, consumer pointers, and screenshots.
- Docs content only. No product code, hooks, or shared state.

## What changed

Structure (AC-1):

- Community sidebar: Welcome, How It Works, Why We Build; Gardener (Install and Update, Join a
  Garden, Submit Work, Track Your Work, Recover Unsent Work); Steward (Create a Garden, Manage
  Members, Manage Actions, a link to Make an Assessment, Review Work, Commitment Pool, Mint Impact
  Certificate, Funding and Governance); Evaluator (its index and Make an Assessment); Funder
  (Donate, Endow, Remove an Endowment); FAQ; Glossary; Capability & Claims; Reference (Product
  History, Brand kit, Credits). Formal Ontology is under Builders, Reference.
- The FAQ is served at `/faq`; `/reference/faq` redirects. Make an Assessment moved to
  `community/evaluator-guide/`; its old slug redirects, and nine older redirects that pointed at
  the old slug now point at the page itself, because the audit rejects a redirect to a redirect.
  `/welcome/quickstart-evaluator` and `/evaluator/get-started` go to the Evaluator index.
- Consumers repointed: `docs/src/data/steward-path.json`, `docs/src/data/role-paths.json` and
  `Hero.tsx` (an Evaluator card), two persona-journey guide links in the projections data, the
  Builders pages `integrations/karma.mdx` and `architecture/anatomy.mdx`, the agent context
  pointer in `.claude/context/admin.md`, QA case DOCS-020 and four QA scenario titles, the growth
  routine's fallback loop, and the pinned assertion in `docs/scripts/llms.test.mjs`.

Pages:

- Rewritten: Welcome, How It Works, Why We Build; the Gardener index and its five pages; the
  Steward index, Create a Garden, Manage Actions, Review Work, Mint Impact Certificate, Funding and
  Governance; Make an Assessment; the Funder index and its three pages; the FAQ.
- New: Manage Members, and the Evaluator index.
- Touched lightly: Credits (privacy statements), Product History (em dashes only).
- Not touched: `steward-guide/commitment-pooling.mdx`, the Brand kit page, and every generated
  page (regenerated, never edited).
- `docs/README.md` carries the page contract and the voice rules (step 0.2).

## Evidence pass (step 0.3)

Every label and behavior on a page was read from the files in that page's `source_of_truth`
frontmatter and from `packages/shared/src/i18n/en.json`. The facts most likely to be questioned:

| Fact the pages state | Where it was read |
|---|---|
| The app runs only when installed; a browser tab shows the public site | `packages/client/src/routes/presentationMode.ts` |
| An update never applies by itself, and waits while a draft is saving or work is sending | `packages/shared/src/hooks/app/useServiceWorkerUpdate.ts`, `useWorkUpdateGuard.ts` |
| A lost passkey cannot be recovered by anyone: no recovery path exists | `packages/shared/src/workflows/auth-passkey-adapters.ts`, `packages/client/src/views/Login/index.tsx` |
| Request to Join appears only when the server allows requests | `packages/agent/src/config.ts`, `packages/client/src/components/Features/Garden/JoinGardenButton.tsx` |
| Nothing reaches the garden's record until Upload all, though files are prepared and uploaded to public storage before that | `packages/shared/src/providers/JobQueue.tsx`, `packages/shared/src/modules/work/prepare-queued-work.ts` |
| Submitted media is public and cannot be deleted; records cannot be edited or revoked | `packages/shared/src/modules/data/ipfs/pinata.ts`, `packages/contracts/config/schemas.json`, `packages/contracts/src/resolvers/Work.sol` |
| Location is added only with Share Location, to about 100 meters; camera details in a photo are not reliably removed | `packages/client/src/views/Garden/Details.tsx`, `packages/shared/src/modules/work/work-attachments.ts` |
| Usage is recorded and tied to the account address when signed in, with no setting to turn it off | `packages/shared/src/hooks/analytics/useAnalyticsIdentity.ts`, `packages/shared/src/modules/app/posthog-browser.ts` |
| A steward cannot review their own work, a decision is permanent, and none can be recorded after the action ends | `packages/contracts/src/resolvers/WorkApproval.sol` |
| An evaluator has no Work tab in the cockpit | `packages/shared/src/hooks/admin-ui/hub/hub.workbenchModel.ts` |
| Approval pays nobody; a gardener claims from the jar within a limit and a wait, and a claim is not checked against approved work | `packages/contracts/src/modules/CookieJar.sol` |
| A donation cannot be returned; an endowment can be withdrawn and is not guaranteed | `packages/contracts/src/modules/Octant.sol`, `packages/contracts/src/strategies/AaveV3ERC4626.sol`, `packages/contracts/src/vendor/octant/core/MultistrategyVault.sol` |
| Earnings reach the garden only when a steward runs a harvest, and the cockpit has no control for the split | `packages/contracts/src/resolvers/Yield.sol`, `packages/admin/src/views/Community/components/CommunityEndowmentTab.tsx` |
| Voting on priorities is switched off | `GOVERNANCE_ENABLED` in `packages/shared/src/config/app.ts`, read by `packages/admin/src/views/Community/components/CommunityWorkspaceContent.tsx` |
| Impact certificates are still being built | the hypercert capability record in `green-goods-projections.json` (`in-build`) |
| Passkey accounts have their network fees covered; wallet accounts pay | `packages/shared/src/modules/transactions/passkey-sender.ts`, `packages/shared/src/modules/transactions/wallet-sender.ts` |

These are source reads. None of it was replayed on the released product; that is step 4.3.

## Acceptance checks

AC-2, voice. Both searches from `eval.md`, run on the tested commit:

- Em dashes in hand-written community and Reference prose: no hits.
- Protocol and network names: 24 hits, all reviewed. Seven are file paths in `source_of_truth`
  frontmatter. One is the on-screen label **Ethereum Address or ENS Name**. The other sixteen are
  "Arbitrum", each where a reader paying or signing with their own wallet has to pick the network:
  the funder pages' prerequisites and success signals, the "Using your own wallet" notes, and two
  FAQ money answers. The steward pooling page has no hits.

AC-3, page contract. Fifteen task pages were checked for the six sections and one next step:

- All fifteen have Before you start, How you know it worked, What happens next, If something goes
  wrong, and exactly one next-step card.
- Twelve have a "Steps" heading. Install and Update, Manage Members, and Funding and Governance
  each cover several small jobs, so their numbered steps sit under a heading per job instead.
- The Steward and Evaluator indexes carry the same sections for getting access.
- `commitment-pooling.mdx` does not follow the contract. It is outside this hub.

AC-4, screenshots. Twenty-one images are used by community pages. Each has alt text and a caption
naming source and date, and the steps read complete without them.

| Image | Page | Storybook story |
|---|---|---|
| `client-sign-in.webp` | Install and Update | `client-layout-splash--entry-first-install` |
| `client-garden-filters.webp` | Join a Garden | `client-sheets-gardensfiltersheet--defaults` |
| `client-join-garden.webp` | Join a Garden | `client-sheets-joingardenconfirmdialog--default` |
| `client-cookie-jar-claim.webp` | Track Your Work | `client-wallet-cookiejartab--claimable-jar` |
| `admin-hub.webp` | Steward index | `admin-workspaces-hub--work-queue` |
| `admin-request-steward-access.webp` | Steward index | `admin-workflows-steward-access-request--review-request` |
| `admin-community-members.webp` | Manage Members | `admin-workspaces-community--endowment`, Members tab opened |
| `admin-edit-garden.webp` | Manage Members | `admin-workspaces-garden--settings` |
| `admin-review-queue.webp` | Review Work | `admin-workflows-hub-hubworkqueue--with-data` |
| `admin-review-form.webp` | Review Work | `admin-workflows-hub-reviewform--actionable` |
| `admin-reject-work.webp` | Review Work | `admin-workflows-hub-reviewform--reject-asks-for-a-reason` |
| `admin-create-assessment.webp` | Make an Assessment | `admin-workspaces-hub--create-assessment-route` |
| `admin-assessments-tab.webp` | Make an Assessment | `admin-workspaces-hub--assessments-tab` |
| `admin-cookie-jars.webp` | Funding and Governance | `admin-workflows-hub-cookiejarpayoutpanel--with-jars` |

Kept from earlier captures: `client-work-media.webp`, `client-work-review.webp`,
`client-work-offline.webp`, `admin-create-garden.webp`, `admin-create-action.webp`, and, reused
from the Builders images, `client-work-dashboard.webp` and `admin-hub-hypercerts.webp`.

Removed: three deck graphics under `img/community/` that carried another organization's branding
and protocol names; `admin-work-queue.png` and `admin-work-detail.png`, an old cockpit showing a
real garden, a member's photo, and an account address; `client-work-intro.png` and
`client-work-details.png`, an old app screen; and `admin-garden-overview.webp`, which nothing used.

Every person, garden, and address in the images is fixture data ("Rio Rainforest Lab", "Botanic
Commons", "Comunidad Verde", "Green Goods Community Garden", "Riverside Commons Garden").

Text-only, because no fixture story renders the screen faithfully:

- Submit Work's Start and Details steps. The published stories mock the flow at Media and Review.
- An open submission in the cockpit. Its route story renders "Work not found".
- The Endowment tab and the Payouts tab. Their route stories render read errors in the deployed
  Storybook.
- The Donate and Endow dialogs, and Manage Endowments.

AC-5, truth fixes. All six `ui` items in `spec.md` are resolved: the translated-docs claim, "Work
Dashboard", the three unsourced numbers, the six-role list on Welcome, "designed to preserve your
principal", and em dashes. Each was confirmed by search on the tested commit.

AC-8, consumers. `git grep` for the old assessment path finds the redirect entry and one product
link (below). `git grep` for `/reference/faq` finds only the redirect entry.

## Rendered check

Label: clean-room Playwright, headless Chromium, run locally against the production docs build of
the tested commit. The build was answered from disk by request interception, with the host's
clean-URL rules. It is not the deployed site and not an authenticated session.

- 30 pages at 1440 by 900 and at 390 by 844: every page returned 200 with its heading, no
  horizontal overflow, no broken image, a caption for every figure, and no page error. Requests to
  the web font host were blocked to keep the run offline.
- Redirects land where expected: `/reference/faq`, the old assessment slug,
  `/welcome/quickstart-evaluator`, and `/evaluator/get-started`.
- Fifteen anchors resolve, including `/faq#is-what-i-upload-private`, `/faq#evaluator`,
  `/community/how-it-works#impact-reporting-verification`, and the glossary's `#garden`,
  `#work-approval`, `#hypercert`, and `#cookie-jar`.
- Search returns the new pages for "unsent work" and "evaluator".
- Markdown twins exist for the FAQ, the Evaluator pages, and Manage Members; the Welcome twin
  lists Evaluator; the old assessment twin is gone; `llms.txt` lists the new pages.
- One finding outside this work: the Brand kit page has two favicon previews with empty alt text.

## TDD Proof

- RED: not applicable
- GREEN: not applicable
- Proof limit: `not_applicable`. Docs pages, navigation, and redirects have no unit-testable
  behavior. Proof is the `eval.md` gate chain, a rendered check, and the replayed read-through.
  One existing test changed with its data: `docs/scripts/llms.test.mjs` pins an item of the
  steward path, and the path changed.

## Validation

Run from the repository root on the tested commit. `bun run check --plan -- --intent qa` selected
fifteen checks for the changed paths. The package tests are there because the ontology projection
data is shared; the advisory browser proof is there because the QA catalog changed.

| Check | Result |
|---|---|
| `format`, `lint` | Passed |
| `shared-typecheck`, `agent-typecheck` | Passed |
| `shared-test` | 610 files passed, 2 skipped; 7,309 tests passed, 19 skipped |
| `client-test` | 149 files, 1,706 tests passed |
| `admin-test` | 146 files, 1,296 tests passed |
| `agent-test` | 46 files passed, 1 skipped (524 tests, 1 skipped), then 21 files (196 tests) |
| `docs-authority` | 72 generator and audit tests passed; the audit reported no hard errors and two advisory notes on Builders pages this work did not write; 17 projections current |
| `docs-test` | Passed (90 tests in a direct run) |
| `docs-build` | Production build generated; the search index covers 72 live routes |
| `ontology` | 69 tests passed; all guards passed, 7 findings baselined |
| `qa-id-ledger` | 443 ids; none removed, reintroduced, or reactivated |
| `agent-tools-test` | 11 files, 260 tests passed |
| `browser-proof` | Advisory and pending. Not run: it needs an authenticated Brave session on the QA app |

Outcome line: "passed; 14 fresh passes, 0 reused, 0 unrun of 15 selected checks (qa)", with
`pendingManual: browser-proof`.

Run separately on the same commit: `bun run check --only docs-generated` (17 projections current),
`bun run check --only vocabulary` (no banned, renamed, or untranslated vocabulary),
`bun run check --only guidance-links` (91 guidance files OK), `bun run --cwd docs audit -- --ci`
(no hard errors), and the two voice searches (0 and 24 hits, reviewed above).

An earlier full run on `48c6220d0` passed the same way. It was superseded by the sidebar label
commit, so the receipt below is for the later commit.

## Validation Receipt

- Tested implementation commit SHA: `0b22f55ccba3582105b7d3ac38df3f6d1522a8cb`
- Run at (UTC): `2026-10-12T21:03:06Z`
- Exact command(s): `bun run check -- --intent qa --no-fail-fast`; `bun run check --only docs-generated`; `bun run check --only vocabulary`; `bun run check --only guidance-links`; `bun run --cwd docs audit -- --ci`; the two searches in `eval.md`; a Playwright script, kept outside the repository, that loads `docs/build` in headless Chromium
- Result: 14 of 14 automated checks passed fresh, with the advisory `browser-proof` pending; 60 rendered page loads clean; 4 redirects, 15 anchors, search, and Markdown twins confirmed. The planner run finished at `2026-10-12T21:07:55Z`; the rendered check started at `2026-10-12T21:08:15Z`, and the focused checks and voice searches at `2026-10-12T21:08:48Z`
- Validated paths: `docs .claude/context/admin.md scripts/data/qa-test-catalog.json scripts/docs scripts/quality packages/shared/src/ontology`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- docs .claude/context/admin.md scripts/data/qa-test-catalog.json scripts/docs scripts/quality packages/shared/src/ontology` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 0b22f55ccba3582105b7d3ac38df3f6d1522a8cb..HEAD -- docs .claude/context/admin.md scripts/data/qa-test-catalog.json scripts/docs scripts/quality packages/shared/src/ontology` → exit 0, no output. The commit that carries this handoff changes only `.plans/active/community-docs-revamp/`
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- docs .claude/context/admin.md scripts/data/qa-test-catalog.json scripts/docs scripts/quality packages/shared/src/ontology` → empty

## What remains

- 4.3, the replay on the released product. Authenticated surfaces (sign-in, passkey and wallet
  signing, the installed app, the offline queue) need a person's Brave session. Not run.
- 4.4, the read-through by people (AC-9). Not run. An agent replay does not stand in for it.
- A merge with `develop`. The branch is 53 commits behind. The host tool that syncs this worktree
  refused, because the merge would touch files the sandbox protects.
- Start and Details figures for Submit Work, and funder figures, once a fixture story exists.
- Decisions Q3, Q4, Q9, and Q10.

## Risks / Blockers

Found in the product while reading it. None is fixed here; a docs change should not alter product
behavior.

1. **Create Garden may refuse to deploy from a fresh form.** `Deploy Garden` calls
   `submitCreation()`, which returns false unless the creation workflow is in its review state
   (`packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts`). The one-page form in
   `packages/admin/src/views/Garden/CreateGarden.tsx` never sends the step events that reach that
   state, so a first attempt should show **Cannot deploy yet**. `develop` has the same code. A
   click-through on the Storybook route story (fields filled, one area chosen, Deploy Garden
   pressed) showed no visible reaction, which fits but does not prove it, because that harness
   may not show toasts. No test covers the controller. The page tells the reader what to do if
   they see that message. Needs a check with a deployer account.
2. **Public evidence links may use the wrong explorer address.**
   `packages/client/src/components/Public/PublicEvidenceDialog.tsx` builds links on the bare
   `easscan.org` domain. `packages/shared/src/utils/eas/explorers.ts` has the network-aware
   helper, and the released network is not the one the bare domain serves. Read in code, not
   clicked.
3. **In-app Help answers use retired names.** `en.json` help answers say "Work Dashboard" (the
   screen is Your Work) and "Discord" (the community link is Telegram).
4. **One public page links the old assessment URL.**
   `packages/client/src/components/Public/PublicWhoTendsAGarden.tsx`. The new redirect covers it.

Sensitive files changed, for the reviewer: `.claude/context/admin.md` (one path),
`scripts/data/qa-test-catalog.json` (one path, four titles), `docs/routines/growth-pulse.md` (the
fallback loop), and the ontology data and gate described in the `state_api` handoff. No permission
or safety check was loosened.

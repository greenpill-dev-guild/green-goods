# PRD-1375 integration with develop

User-authorized scope: integrate the six cockpit slices with the latest fetched develop,
refresh the four derived files, and run validation plus key regression checks. DL-145 data
implementation remains separate. No publication, deployment, transaction or Linear mutation
is included.

Current target: `e465ab1f537611af4b66063274adb9d4ce80d610`, discovered by the final remote
check while the first integration was closing. Round 2 below supersedes the first round's
base and current-state claims. Earlier passing evidence remains historical and is not
represented as proof of this newer tree.

## Round 1 integration

- Source base: `652825db9ebe88458dfbf7e6246147190e93fdac`.
- Fetched develop and integrated base: `f5c4064c0135359dbff5828ff19a4a04bc3ad086`.
- Original reviewed patch SHA-256:
  `c4926823695dfffe4267a02b8c968b4db084a0e15cd50d7ec40aa96330cd7054`.
- Preserved all 61 original paths in the path-scoped stash
  `e514776a28485332b4665469918bdc876542505a`, verified byte-for-byte before the fast-forward.
  The original patch and evidence remain under ignored `tmp/`.
- Fast-forwarded this isolated detached checkout, then applied the 57 non-derived paths.
  No runtime merge conflicts occurred. Upstream locale additions were retained by key.
- Kept develop's registry and generated files as the refresh baseline. All four existing
  export targets, implementations, proof files and consumers match the integrated HEAD;
  only Shared's manifest changes their evidence inputs. Recomputed the four fingerprints
  with the existing printer, preserving lifecycle, proof lists and review dates, including
  develop's newer auth certification.
- Ran the canonical docs generator. The API index adds two exports and corresponding counts;
  Commands and Glossary change only their source digests. Develop's CMS commands are retained.
- No dependency installation or upgrade. The upstream lockfile and manifests outside the two
  approved Shared export additions remain unchanged relative to the integrated base.

The original [slice handoff](prd-1375-cockpit-slices.md) records the earlier implementation
and frozen-base proof. It remains historical evidence; its validation does not stand in for
the integration checks below. The Plan Hub sync gate remains parent-only/preserve-existing.

## Round 1 validation

Fresh proof completed on the combined working tree over `f5c4064c0135359dbff5828ff19a4a04bc3ad086`.
No commit-attributed proof is claimed for uncommitted files. Exact commands are exported to
`tmp/prd-1375-integrated-commands.txt`; the selected plans are retained alongside their logs.

| Proof | Observed result |
|---|---|
| Selected QA plan, explicit integrated base | 19 fresh passes, 0 reused, 0 unrun. Log: `tmp/prd-1375-integrated-qa.log`; plan: `tmp/prd-1375-integrated-qa-plan.json`. |
| Shared focused regressions | 6 files, 161 tests passed: steward access, garden derived state, session, passkey-server signup profiles, auth services and confirm-dialog focus. |
| Admin focused regressions | 7 files, 104 tests passed: settings editor/save recovery, Edit Garden, Overview/activity navigation, Members, Hub grid and jar panel/modals. |
| Critical owner/consumer types | Shared, Client, Admin and Agent source and test typechecks passed. |
| Builds | Admin passed (69.268s); Docs passed (47.535s), including search-index validation; Storybook passed (271.716s), with 478 components/2775 stories/46 groups. |
| Supplemental guards | 7 fresh passes, 0 reused, 0 unrun: validation-system (432 tests), test-quality, source-structure, generated docs, em dashes, brand-voice parity and React patterns. Log: `tmp/prd-1375-integrated-extra.log`. |
| Complete CI-tagged Storybook suite | Final run: 197 files/755 tests passed; 281 untagged files excluded by the maintained selection. Log: `tmp/prd-1375-integrated-story-ci-final.log`. |
| Rendered/interactions proof | Storybook with isolated Chromium fixtures: 21 desktop/phone/localized capture cases, 12 interaction checks and 7 final recovery/layout checks passed. No page errors or horizontal page overflow. Evidence: `tmp/prd-1375-integration-proof/`. |

The QA and supplemental plans together cover every check/command selected by the integrated
push plan; QA additionally runs the Admin, Docs and Storybook builds. The supplemental plan
does not duplicate the already executed owner/consumer tests. All required critical overrides
were retained. No Git push was performed.

The first broad Storybook run had 754 passes and one 15-second timeout in the unchanged public
Ceremony layout story. No geometry assertion failure was reported before the timeout. Its three-test file
passed alone with the original limit; after the build-heavy work finished, the complete
755-test suite passed with the same source, timeout and assertions. The original failed log
is preserved as `tmp/prd-1375-integrated-story-ci.log`; the isolated rerun is
`tmp/prd-1375-integrated-ceremony-focused.log`. No test or harness change was made.

Key regressions: existing-access filtering and role/account recovery, latest signup/session
profile behavior, settings draft/save/held-send/retry/dirty-close recovery, responsive queue
and empty actions, member keyboard/mobile filtering, activity navigation/day groups/pagination,
and Shared media-card consumers. Rendered proof uses isolated Chromium Storybook fixtures.

The fresh captures include 1440px desktop, 390px phone and 1920px queue frames in EN/ES/PT as
applicable. Edit Garden with its cap enabled still measures 686px client/686px scroll at
1440×900; all six message areas reserve 32px. Keyboard member filtering, phone select/reset,
empty actions at 390/1023/1024/1440px, the 192px queue mosaic, chooser Retry/Escape/focus return,
workspace tab order, settings dirty-close/Keep Editing, dated activity/Show More and filtered
phone activity all passed. These are fixture-based Storybook checks, not authenticated signing
or real uploads. No wallet confirmation was performed.

## Round 1 state and limits

The six slices and four refreshed derived files are integrated locally in this checkout.
Runtime/guidance source matches the reviewed patch, with the upstream locale additions
preserved. Registry semantic/lifecycle/proof/review fields match the latest fetched develop.
No contract/indexer changes, dependency installation, new dependency changes or lockfile edits
were introduced by this integration. The main checkout and other sessions were untouched.

Changes remain uncommitted on this detached checkout. No branch was created, no PR or push was
made, and no current-head GitHub CI is claimed. The original backup remains available; the
canonical integrated patch, path list and fingerprints are exported separately under ignored
`tmp/`. Merge readiness still requires validation/CI for the eventual integrated commit.

## Round 2: latest develop

The final remote check found `e465ab1f537611af4b66063274adb9d4ce80d610`. Fetched it, preserved
the validated first-round tree in path-scoped stash
`46e842dfe2fe26f7d616f62af9274f0ca758eb3e`, verified all 62 paths, and fast-forwarded only
this detached checkout. The original and first-round backups remain available.

Reapplied the 55 non-locale/non-derived cockpit paths unchanged. Each locale merged the
17 cockpit key changes onto the new upstream catalog, with no same-key conflicts and no
upstream additions lost. The newer published voucher, public-information, support and CMS
changes are preserved as part of develop, not expanded cockpit implementation scope.

The four derived files were refreshed again against this newer HEAD. Existing seam export
targets and all registered source, consumer and proof inputs are unchanged relative to this
HEAD; only Shared's manifest affects their fingerprints. Certification fields are preserved.
The canonical docs generator supplies the current digests and two-export inventory update.

Fresh validation passed on the combined working tree over this HEAD. Exact commands are in
`tmp/prd-1375-e465-commands.txt`; no commit-attributed proof is claimed for uncommitted files.

| Proof | Observed result |
|---|---|
| Selected QA plan, explicit current base | 20 fresh passes, 0 reused, 0 unrun. Log: `tmp/prd-1375-e465-qa.log`; plan: `tmp/prd-1375-e465-qa-plan.json`. |
| Focused regression tests | 15 files/271 tests passed: Shared 161, Admin 104, Client 6. Covers the cockpit, auth/session integration, focused-account sheet and public footer. |
| Critical owner/consumer types | Shared, Client, Admin and Agent source and test typechecks passed. |
| Builds | Admin passed (69.088s); Docs passed (14.851s), including search-index validation; Storybook passed (149.035s), with 481 components/2793 stories/46 groups. |
| Supplemental guards | 7 fresh passes: validation-system (432 tests), test-quality, source-structure, generated docs, em dashes, brand-voice parity and React patterns. Log: `tmp/prd-1375-e465-extra.log`. |
| Complete CI-tagged Storybook suite | 197 files/755 tests passed (305.54s); 284 untagged files excluded by the maintained selection. Log: `tmp/prd-1375-e465-story-ci.log`. No source, assertion, timeout or harness changes. |
| Rendered/interactions proof | Storybook with isolated Chromium and seeded fixtures: 21 desktop/phone/localized captures, 12 interaction checks and 7 recovery/layout checks passed. No page errors or horizontal page overflow. Evidence: `tmp/prd-1375-e465-proof/`. |

The QA and supplemental plans cover every check/command selected by the current push plan,
with all required critical overrides retained. The QA plan also runs the three builds above.
This is local proof; no Git push or current-head GitHub CI is claimed.

Fresh regression checks retain the Round 1 coverage: responsive Hub actions and queue geometry,
metric/media consumers, Edit Garden draft/save/retry/dirty-close recovery, Profile access
filtering and chooser recovery, Members keyboard/mobile filtering, and Garden tab order,
activity navigation/day groups/Show More. The new captures again confirm the cap-enabled
Edit Garden body is 686px client/686px scroll at 1440×900, with six 32px message reserves.
EN/ES/PT and phone/desktop cases passed. Visually inspected the fresh cap-enabled desktop
editor and filtered phone activity captures. This is Storybook proof in isolated Chromium;
authenticated signing and real uploads were not exercised.

Final source preservation checks verified all 61 non-closeout file hashes from the validated
tree. Each locale retains all current upstream keys plus exactly the 17 cockpit changes;
registry semantic, lifecycle, proof and certification fields match the new HEAD. There are
no integration changes to contracts, indexer or lockfile. Shared's manifest adds only the two
reviewed exports. The index is empty, and the change set remains 58 modified plus 4 new files.
Review receipt: `tmp/prd-1375-e465-final-review.json`.

Final patch: `tmp/prd-1375-integrated-e465.patch`; file list and per-file hashes:
`tmp/prd-1375-integrated-e465-files.txt` and `tmp/prd-1375-integrated-e465-manifest.json`.
The detached checkout remains uncommitted; both backups and earlier evidence are retained.
No branch was created, and no push, PR, deployment, transaction or Linear mutation occurred.

## DL-145 boundary

Existing truthful unavailable-state presentation is retained. No claim-history read,
deposit-source reconstruction, jar-attributed yield projection, indexer schema/event change
or sibling Cookie Jar implementation is added. DL-145 remains locked and separately scoped.

Task record: PRD-1375 integration | Type: integration | Outcome: complete locally; DL-145 data remains separate and unstarted
Agent/model: Codex / unknown | Coverage: this integration turn

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | 2026-11-05T06:26:55Z → unknown | Fetch, checkout ownership and backup guards |
| implement | unknown → 2026-11-05T06:35:41Z | Combined source and derived evidence |
| verify | unknown → 2026-11-05T06:59:10Z | 19 QA + 7 supplemental checks, 265 focused tests, full 755-test Storybook rerun and fresh rendered proof |
| review | unknown → 2026-11-05T06:59:10Z | Source preservation, locale union, latest auth certification and exact generated-file diff inspected |
| implement | unknown → 2026-11-05T07:24:19Z | Second integration onto the newer published develop head; four derived files refreshed |
| verify | unknown → 2026-11-05T07:31:18Z | 20 QA + 7 supplemental checks, 271 focused tests, 755 Storybook tests and fresh rendered proof on e465ab1f5 |
| review | unknown → 2026-11-05T07:31:18Z | 61 source hashes, locale union, certification metadata and separate DL-145 boundary verified |

Human corrections: 0; attention: unknown.

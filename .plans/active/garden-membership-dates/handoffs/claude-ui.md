# Garden membership dates: UI implementation

Owner: Codex. Local implementation is complete; lane certification remains pending a committed implementation and fresh receipt. Existing branch and unrelated work were preserved.

PWA member rows use the selected garden's first join date; member details show join/rejoin/current-role facts with existing copy controls. Profile garden cards use one account-level read. Admin member rows show the join date; Manage Members shows full addresses and date facts. Confirmed individual and partial batch writes schedule the existing delayed garden refresh before close; removal and close also schedule it. No signing or permission behavior changed.

## Verification

- Client GardenGardeners/GardensList/LeaveGardenAction focused suites: 57 passed; final cached-error follow-up roster 7 passed.
- Client source and test typechecks passed, with source repeated after the follow-up.
- Admin ManageMembersDialog/CommunityMembersTab/CommunityMembersDialogs focused suites: 31 passed initially. Final directory 3 and dialog/refresh 16 passed after integration fixes.
- Final Admin source and test typechecks passed.
- Controlled Client date-source mutation failed the join-date regression and was restored. Admin RED tests caught cached dates on a failed refresh and missing success/partial-batch refresh callbacks.

## Rendered proof

Engine/session: Storybook in the Codex in-app Chromium browser, synthetic fixtures, 2026-11-11 America/Los_Angeles (2026-11-12 UTC). Observed desktop and 390×844 layouts: Shared facts, rejoined profile card, PWA roster and opened member detail, Admin full address and copy control, unavailable profile dates, and loading state. Temporary viewport reset afterward. Preview left open on the rejoined profile card.

The Storybook clipboard is mocked: the existing Copy Address control switched to its success icon; this is not a real clipboard-transfer proof. Authenticated-session profile proof is pending; no authenticated profile or signing flow was exercised. Static build passed. See data handoff for broader unrelated check failures and mandatory rollout ordering.

Task record: garden-membership-dates | Type: feature | Outcome: local implementation complete; publication pending
Agent/model: Codex / exact model unknown | Coverage: approved implementation segment

| Phase | Start → end (UTC) | Result |
| --- | --- | --- |
| investigate | 2026-11-12 02: 43:13 → 02: 46:02 | Scope, owning code, and accepted date meanings established |
| implement | 2026-11-12 02: 46:02 → 03:05:23 | Indexer facts, Shared reader/hook/view, Client and Admin wired |
| verify | 2026-11-12 02: 47:54 → 2026-11-12T03:09:55.590952+00:00 | Working-tree focused tests, types, static build and rendered proof below |

Human corrections: 0 observed in this segment; attention: unknown. Intervals include parallel work and must not be summed.

Final verification boundary: 2026-11-12T03:12:03.992276+00:00. Final scoped formatting/diff checks and 32-hub plan validation passed. No publication or membership change occurred.

## Admin member polish

The user explicitly approved labeled copying, per-person role addition using the existing signing flow, and clearer bulk staging. Local implementation is complete; committed certification and publication remain pending.

- `MemberIdentity` shows the exact address with Copy Address, Copied, an accessible success announcement, and a retryable error. The shared clipboard helper remains authoritative.
- Manage Members offers Add role beside each person's role chips. Permission and busy-state guards remain in place; existing removal and confirmation behavior is preserved.
- Role addition fixes the member, shows their current roles, and requires an explicit additional role before submission. It reuses exact-role checking and the existing single/batch signing path. Failed attempts retain the same person and role; clearing recovery removes the choice. Unsettled recovery imports only the selected member's row.
- Bulk entry reads person → role → Add to list. The final action names the people/roles to submit and shows signature count. Single-member recovery uses a compact row; bulk entry retains reserved list geometry.
- New strings are present in English, Spanish, and Brazilian Portuguese. The supplied design books informed clickability and action hierarchy; document contents were treated as references.

### Focused proof

- Four Admin suites: **70 tests passed** (`MemberIdentity`, `ManageMembersDialog`, `AddMembersDialog`, `CommunityMembersDialogs`). The initial copy test failed on the missing component; role tests failed before the new mode existed.
- Admin source and test typechecks passed. Scoped formatting (19 files), Oxlint, React boundary checks, design tokens/vocabulary, brand parity, Storybook coverage, and story quality passed.
- Focused Storybook Chromium suite: **22 stories passed** across Add Members and staged recovery. Static Storybook build passed with 497 components and 2,854 stories.
- Broad Storybook CI failed in unrelated ceremony, route, profile, owner-recovery and confirmation stories and reached its 600-second bound. The focused member suite passed separately.
- Broad source-structure check still reports only the pre-existing `Public/Fund.tsx` and `useCommitmentDialogController.ts` length violations. Broad test-quality reports unrelated seam fingerprints, a signer-server direct-import violation, and a one-case cookie-jar handoff test. Those files were left untouched.
- The selector sees concurrent work across hundreds of paths and selects unrelated critical gates. This bounded change did not run those unrelated suites. No Shared mutation hook, contract, dependency, manifest, or harness configuration changed in this polish segment.

Local command logs: `/private/tmp/gg-member-polish/`. These are working-tree observations, not commit-attributed receipts.

### Rendered proof

Engine/session: **Storybook in Codex in-app Chromium, synthetic fixtures**, 2026-11-12 UTC. Observed 1280×900 desktop, 390×844 mobile, and the default viewport: full addresses and labeled copy controls, copy success feedback, roster → fixed-person role dialog, unchosen submit disabled, keyboard role selection, discard/Keep Editing, return focus to the same member, bulk staging and count/signature feedback, compact failed-role recovery, and removal clearing the failed choice. Temporary viewport overrides were reset; the Add role preview remains open.

Storybook clipboard is mocked. Unit tests exercise the actual shared clipboard helper against controlled browser API success/rejection; this is not authenticated clipboard or signing proof. No garden transaction was sent.

Task record: garden-membership-dates / Admin member polish | Type: UI improvement | Outcome: local implementation complete; publication pending
Agent/model: Codex / exact model unknown | Coverage: approved polish segment only

| Phase | Start → end (UTC) | Result / evidence |
| --- | --- | --- |
| investigate | 2026-11-12 03:17:17 → unknown | Rendered audit, owning code, design references, and scope lock |
| wait | unknown → unknown | User approved all three improvements; resolved |
| implement | unknown → 2026-11-12 04:00:35 | Scoped controls, role mode, recovery, locale strings, stories and regression cases |
| verify | 2026-11-12 03:33:12 → 2026-11-12 04:02:10 | Focused tests, types, static/build guards and labeled rendered proof above |
| review | unknown → 2026-11-12 04:02:10 | Responsive alignment, error color, recovery choice reset, and unrelated-work boundary checked |

Human corrections: 0 observed in this segment; attention: unknown. Intervals include tools and overlap; do not sum them as active effort.

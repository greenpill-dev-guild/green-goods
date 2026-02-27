# Green Goods V1 QA Issue Drafts (Product Sync - Feb 25, 2026)

Source: Meeting notes + transcript provided in this thread.

Scope: Product QA only (client PWA + admin dashboard). Excludes treasury/ops strategy.

## How to use

1. Create a new issue using the template noted per draft (Bug Report / User Story / Polish).
2. Set the title (exact or tweaked).
3. Add the suggested labels.
4. Paste the "Issue Body" section into the issue.

## Label notes (repo drift)

- The repo has an issue template "Polish" that applies label `polish`, but the GitHub repo does not currently have a `polish` label. For polish items, use `design` (and optionally `component`) plus `client`/`admin`.
- The repo has a "User Story" template that applies `enhancement`, and also has a `story` label. Recommended: add both `enhancement` + `story` + scope labels (or drop one depending on your board filters).

---

## Bugs (12)

### 1) V1 QA: Garden creation doesn't set/select domain(s)

Template: Bug Report  
Labels: `bug`, `admin`, `state-logic`, `triage`  
Source: 01:00:35 ("domain not being set during the garden creation flow")

Issue Body:

### Bug Description
During the admin garden creation flow, the garden's domain(s) are not set. There is no domain selection step, so new gardens can be created without domains, breaking domain-based action sets.

### Steps to Reproduce
1. Go to `dashboard.greengoods.app`.
2. Log in as a Deployer/Operator who can create gardens.
3. Start "Create garden".
4. Complete the flow and create a garden.
5. Inspect the created garden's configuration/actions.

### Expected Behavior
Garden creation requires selecting at least 1 domain (or sets a correct default), and the domain(s) persist on the created garden, driving the correct action set.

### Actual Behavior
No domain selection happens and domain(s) are not set on the created garden.

### Environment
Prod admin dashboard (Feb 25, 2026). Repro seen during QA call.

#### Notes / Acceptance Criteria
- [ ] Create flow includes an explicit domain selection step (or valid default).
- [ ] Garden persists selected domains to storage/on-chain config as intended.
- [ ] Existing gardens created without domains have a remediation path (e.g., admin can set domains post-create).

---

### 2) V1 QA: Admin garden creation flow broken after contract upgrade

Template: Bug Report  
Labels: `bug`, `admin`, `contract`, `triage`  
Source: 01:10:46 + 01:17:39 ("get to the end, but it won't work")

Issue Body:

### Bug Description
Garden creation currently fails at/near the final step in the admin dashboard after a recent contract upgrade (UI not updated to match).

### Steps to Reproduce
1. Go to `dashboard.greengoods.app`.
2. Log in as a Deployer/Operator.
3. Start "Create garden".
4. Proceed through the flow to the final step and attempt to create the garden.

### Expected Behavior
Garden creation completes successfully and the garden appears in the gardens list with expected configuration.

### Actual Behavior
Creation fails at the end (exact error/behavior needs capturing).

### Environment
Prod admin dashboard (Feb 25, 2026).

#### Debug Notes to Capture
- Browser console logs
- Any contract revert/error message
- Which deployment/chain the dashboard is pointed at

#### Acceptance Criteria
- [ ] Create garden works end-to-end on prod for Deployer/Operator.
- [ ] UI uses latest deployments/ABIs/config aligned with the upgraded contracts.

---

### 3) V1 QA: Vault withdraw shows "amount exceeds balance" / decimal precision issues on small amounts

Template: Bug Report  
Labels: `bug`, `admin`, `state-logic`, `contract`, `triage`  
Source: 00:55:23-00:58:14 (withdraw error + decimals suspicion)

Issue Body:

### Bug Description
With small vault deposits (e.g., cents), withdrawing can fail with "amount exceeds available balance" and/or the UI won't allow enough decimal precision to withdraw correctly (dust remains / partial withdrawal).

### Steps to Reproduce
1. Go to `dashboard.greengoods.app`.
2. Navigate to Vaults.
3. Deposit a very small amount (e.g., ~$0.21).
4. Attempt to withdraw the same or smaller amount.

### Expected Behavior
- Withdraw up to the available balance succeeds.
- Balance/amount display is accurate for small amounts.
- Amount input supports required precision for the vault/token decimals.

### Actual Behavior
- Error: "amount exceeds available balance" even when it does not.
- Decimal precision appears insufficient; cannot withdraw fully/accurately.

### Environment
Prod admin dashboard (Feb 25, 2026).

#### Notes / Suspected Cause
Possible token-decimals vs shares-decimals mismatch (e.g., 6 vs 18), rounding, or UI input step constraints.

#### Acceptance Criteria
- [ ] Withdraw calculations use correct decimals throughout.
- [ ] UI shows non-zero balances for small deposits (or uses "< $0.01" style).
- [ ] Amount input supports needed decimal places and doesn't block valid withdrawals.

---

### 4) V1 QA: "Time spent (hours)" multiplies input by 60 (e.g., 60 -> 3600)

Template: Bug Report  
Labels: `bug`, `client`, `state-logic`, `triage`  
Source: 00:19:24 + 00:24:58

Issue Body:

### Bug Description
In work action forms, the "time spent (hours)" field multiplies entered hours by 60. Example: entering 60 hours results in 3600 hours.

### Steps to Reproduce
1. Open the client app (`www.greengoods.app`).
2. Start a work submission for an action that includes a "time spent (hours)" field.
3. Enter `60`.

### Expected Behavior
The value remains `60` hours (and any stored value reflects 60 hours).

### Actual Behavior
The value is multiplied (60 -> 3600).

### Environment
Observed during QA call (Feb 25, 2026) on mobile.

#### Acceptance Criteria
- [ ] No unintended unit conversion in UI or persisted data.
- [ ] If storage uses minutes internally, display and storage units are consistent and correctly converted.

---

### 5) V1 QA: Work form feedback textarea can't scroll; text becomes hidden behind UI/keyboard

Template: Bug Report  
Labels: `bug`, `client`, `design`, `triage`  
Source: 00:23:49

Issue Body:

### Bug Description
When typing longer feedback in work action forms on mobile, the feedback textarea does not scroll properly, so text below the fold becomes unreadable/uneditable (often hidden behind the submit button and/or keyboard).

### Steps to Reproduce
1. On mobile, open client app.
2. Start a work action submission.
3. Type enough text in the feedback field to exceed the visible area.
4. Try to scroll within the textarea to view/edit the bottom lines.

### Expected Behavior
Textarea scrolls and the caret/content remain visible while typing/editing.

### Actual Behavior
Scrolling stops; content below is inaccessible/hidden.

### Environment
Observed during QA call (Feb 25, 2026).

#### Acceptance Criteria
- [ ] Textarea scroll works on iOS Safari + Android Chrome.
- [ ] Content isn't obscured by fixed buttons or keyboard.

---

### 6) V1 QA: Viewing a submitted work shows "Garden failed to load"

Template: Bug Report  
Labels: `bug`, `client`, `state-logic`, `triage`  
Source: 00:30:21 ("garden failed to load")

Issue Body:

### Bug Description
When attempting to open/view details for a submitted work item, the app shows "Garden failed to load / something wrong while loading the garden" instead of the work detail.

### Steps to Reproduce
1. Open a garden in the client app.
2. Navigate to submitted works.
3. Tap a work item to view details.

### Expected Behavior
Work details load successfully.

### Actual Behavior
Error message: "garden failed to load / something wrong while loading the garden".

### Environment
Observed during QA call (Feb 25, 2026).

#### Acceptance Criteria
- [ ] Work detail view loads reliably.
- [ ] If garden fetch fails, error handling is scoped and doesn't block the work detail unnecessarily.

---

### 7) V1 QA: Back navigation from work detail routes to homepage instead of returning to garden

Template: Bug Report  
Labels: `bug`, `client`, `state-logic`, `triage`  
Source: 00:31:48

Issue Body:

### Bug Description
After viewing a work submission detail, pressing back returns to the homepage instead of the previous garden/work list context.

### Steps to Reproduce
1. From a garden, open a work submission detail.
2. Press the back button in the UI.

### Expected Behavior
Returns to the previous page (garden work list or garden detail view).

### Actual Behavior
Redirects to homepage.

### Environment
Observed during QA call (Feb 25, 2026).

#### Acceptance Criteria
- [ ] Back navigates to previous route reliably (or uses a sensible fallback if history is missing).

---

### 8) V1 QA: Work submissions UI scroll intermittently sticks/locks (can't scroll full content)

Template: Bug Report  
Labels: `bug`, `client`, `design`, `triage`  
Source: ~00:29:09 ("stays halfway")

Issue Body:

### Bug Description
Scrolling in the work submissions UI intermittently gets stuck (scroll position freezes "halfway"), preventing users from seeing the full content/list without waiting/retrying.

### Steps to Reproduce
1. Open a garden in the client app.
2. Go to submitted works list (or work review view).
3. Attempt to scroll through the list and/or detail content.

### Expected Behavior
Smooth, reliable scrolling with access to full content.

### Actual Behavior
Scroll becomes stuck/locked intermittently; sometimes resolves after a delay.

### Environment
Observed during QA call (Feb 25, 2026).

#### Acceptance Criteria
- [ ] No scroll lock on iOS Safari + Android Chrome.
- [ ] If virtualization is used, it does not prevent full navigation of content.

---

### 9) V1 QA: Logout does not actually sign out (session persists after reopening)

Template: Bug Report  
Labels: `bug`, `client`, `infrastructure`, `triage`  
Source: 00:36:08-00:38:23

Issue Body:

### Bug Description
Logout appears to succeed ("successfully logged out"), but on reopening the app/site the user is still logged in.

### Steps to Reproduce
1. Open client app.
2. Navigate to profile/menu.
3. Click Logout.
4. Close the PWA/tab, then reopen.

### Expected Behavior
User is signed out and must log in again.

### Actual Behavior
User remains logged in after reopening.

### Environment
Observed during QA call (Feb 25, 2026).

#### Acceptance Criteria
- [ ] Logout clears auth/session state reliably across reloads/reopens.
- [ ] Works for both passkey and wallet auth modes.

---

### 10) V1 QA: Profile "Refresh/Update app" button not working (users stuck on old PWA build)

Template: Bug Report  
Labels: `bug`, `client`, `infrastructure`, `triage`  
Source: 00:40:31

Issue Body:

### Bug Description
The profile "refresh/update app" button intended to pull the latest build does not work, causing users to stay on older app versions due to caching/versioning.

### Steps to Reproduce
1. Open client app on an older cached version.
2. Go to profile.
3. Click the refresh/update button.

### Expected Behavior
App checks for a new build/service worker update and reloads into the latest version.

### Actual Behavior
Button does nothing (no update).

### Environment
Observed during QA call (Feb 25, 2026).

#### Acceptance Criteria
- [ ] Update button triggers SW update + hard reload path.
- [ ] UI shows "update available" when applicable.

---

### 11) V1 QA: Chrome PWA install/add-to-home-screen fails with "still adding previous sites"

Template: Bug Report  
Labels: `bug`, `client`, `infrastructure`, `triage`  
Source: 00:40:31-00:41:36

Issue Body:

### Bug Description
On Chrome, attempting to install/add Green Goods to home screen can fail with a message like "still adding previous sites," preventing installation.

### Steps to Reproduce
1. On Android Chrome, open Green Goods.
2. Attempt "Install app" / "Add to home screen".
3. Observe the error message and failed install.

### Expected Behavior
PWA installs successfully.

### Actual Behavior
Install fails with Chrome message "still adding previous sites" (exact string to confirm via screenshot).

### Environment
Observed during QA call (Feb 25, 2026).

#### Notes / Next Debug Data
- Device + Chrome version
- Whether the app was previously installed then removed
- Screenshot of message

---

### 12) V1 QA: ENS/subdomain assignment not working (subdomain not set)

Template: Bug Report  
Labels: `bug`, `client`, `shared`, `state-logic`, `triage`  
Source: ~00:46:59-00:47:57 (ENS/subdomain not set)

Issue Body:

### Bug Description
ENS/subdomain functionality exists but is "kind of broken"; users are not getting their garden subdomain/ENS name set as expected.

### Steps to Reproduce
1. Use the client app to sign in (passkey and/or wallet).
2. Perform the flow that should assign a subdomain/ENS name (exact trigger to confirm).
3. Check whether the subdomain/ENS name is assigned and visible.

### Expected Behavior
Subdomain/ENS name is assigned and persisted per the intended registry flow.

### Actual Behavior
Subdomain/ENS name is not set.

### Environment
Observed during QA call (Feb 25, 2026).

#### Acceptance Criteria
- [ ] Subdomain assignment works end-to-end on prod.
- [ ] Clear UI indication of assigned name (or explicit "not available yet" state).

---

## Polish (2)

### P1) Login UX: Warn about passkey account loss when deleting app; guide users to wallet login

Template: Polish  
Labels: `design`, `client`, `triage`  
Source: 00:43:07-00:46:07 (deleting app creates a new account; wallet login recommended)

Issue Body:

### Current State
Users can log in with passkeys, but if they delete/remove the app (PWA) they can lose the passkey context and end up with a new account. This is confusing during onboarding/QA and can lead to accidental data loss expectations.

### Desired State
- Login and profile screens clearly explain passkey vs wallet tradeoffs.
- Add an explicit warning for passkey users about deleting the PWA/browser data.
- Strongly recommend wallet login for persistent identity (especially for gardeners).
- Ensure copy is consistent and localized.

### Component/Area
client

### Figma Reference
TBD

---

### P2) Admin UX: Role-gating for "Create garden" needs an explanation/empty state

Template: Polish  
Labels: `design`, `admin`, `triage`  
Source: 01:07:45 (couldn't find create garden button; explained by operator role)

Issue Body:

### Current State
If a user is not an Operator/Deployer, the "Create garden" affordance is missing, causing confusion ("I can't see a button to create a garden").

### Desired State
Show a clear empty state or disabled CTA explaining:
- Which role is required to create gardens
- How to request access / who to contact
- Optional: show current detected role (User/Operator/Deployer)

### Component/Area
admin

### Figma Reference
TBD

---

## Future Features (User Stories) (6)

### F1) Story: Allow adding/removing domains on an existing garden (post-creation)

Template: User Story  
Labels: `story`, `enhancement`, `admin`, `state-logic`, `triage`  
Source: 01:00:35 (add additional domains later; currently not supported)

Issue Body:

### Story Title
As an operator/deployer, I want to add (and optionally remove) domains on an existing garden so the garden can evolve over time.

### Context
Gardens may start with a narrow focus and later expand to additional domains. Domains determine available actions and UI; lack of domain management blocks growth.

### Done State
- [ ] Admin UI supports adding domains to an existing garden.
- [ ] (Optional) Admin UI supports removing domains with safe constraints (no data loss).
- [ ] Client action list updates to reflect new domains.
- [ ] Existing work/submissions remain intact and correctly categorized.

### PRD & Documentation Links
- Meeting notes: Feb 25, 2026 Product Sync (QA call)

### Relevant Details
- Decide whether domain changes are versioned/audited.
- Default behavior for gardens created without domains (see bug issue).

### Primary Scope
admin

---

### F2) Story: Allow per-garden action selection within domains (UI refinement)

Template: User Story  
Labels: `story`, `enhancement`, `admin`, `client`, `state-logic`, `triage`  
Source: 00:58:14-00:59:19 (low priority)

Issue Body:

### Story Title
As an operator, I want to enable/disable specific actions within selected domains so gardeners see only what's relevant.

### Context
Domains provide predefined action sets, but some gardens want a smaller subset to reduce UI clutter and confusion.

### Done State
- [ ] Admin has an "Actions" configuration per garden (defaults to all domain actions enabled).
- [ ] Operators can toggle actions on/off.
- [ ] Client only shows enabled actions for that garden.
- [ ] Safe defaults and migrations for existing gardens.

### PRD & Documentation Links
- Meeting notes: Feb 25, 2026 Product Sync (QA call)

### Relevant Details
Mark as low priority; can ship after V1 stabilization.

### Primary Scope
cross-package

---

### F3) Story: Garden data uploads (files/metadata, including KML) with size limits + storage monitoring

Template: User Story  
Labels: `story`, `enhancement`, `admin`, `client`, `infrastructure`, `triage`  
Source: 01:01:30-01:06:47 (KML and general uploads; defer until monitoring)

Issue Body:

### Story Title
As an operator, I want to upload garden-related files/metadata (e.g., KML, spreadsheets) so mapping and assessment workflows have the needed canonical data.

### Context
Campaign onboarding often already produces KML files. Capturing these in Green Goods enables future mapping/assessment features without depending on external platforms.

### Done State
- [ ] UI supports attaching files/metadata to a garden or assessment (final placement to decide).
- [ ] Supports KML and general files with clear allowed types.
- [ ] Storage usage is tracked (monitoring/quotas).
- [ ] File size limits are enforced with good error messaging.
- [ ] Uploaded files are viewable/downloadable by authorized roles.

### PRD & Documentation Links
- Meeting notes: Feb 25, 2026 Product Sync (QA call)

### Relevant Details
- Decide whether this belongs to garden creation vs assessment flow.
- Define initial limits (MB) after observing real usage.

### Primary Scope
cross-package

---

### F4) Story: Services offered "Other" option with freeform suggestion

Template: User Story  
Labels: `story`, `enhancement`, `client`, `design`, `triage`  
Source: 00:27:15-00:29:09

Issue Body:

### Story Title
As a user, I want an "Other" option in the services offered flow so I can suggest services not listed (e.g., housing).

### Context
The current services list can't capture new/unknown services. "Other" enables feedback loops without blocking submissions.

### Done State
- [ ] "Other" option is available in services offered UI.
- [ ] Selecting "Other" reveals a required freeform text input.
- [ ] The suggestion is persisted with the submission and visible in review.
- [ ] Copy is localized.

### PRD & Documentation Links
- Meeting notes: Feb 25, 2026 Product Sync (QA call)

### Relevant Details
Consider adding "Housing" to the preset list if it's already common.

### Primary Scope
client

---

### F5) Story: Add additional sign-in options (e.g., Google) to improve UX + recovery

Template: User Story  
Labels: `story`, `enhancement`, `client`, `infrastructure`, `triage`  
Source: 00:46:07-00:47:57 (sign in with Google / digital identity systems)

Issue Body:

### Story Title
As a gardener, I want to sign in with Google (and potentially other identity providers) so I can recover access and avoid account loss from passkey/PWA deletion.

### Context
Passkey UX is convenient but can be fragile in a PWA context if the app/browser data is deleted. Wallet login is robust but not always the smoothest onboarding path. Additional sign-in options can improve adoption and reduce support burden.

### Done State
- [ ] Client offers at least one additional sign-in provider (e.g., Google) via the chosen auth stack.
- [ ] Accounts can be linked without breaking existing on-chain identity assumptions.
- [ ] Clear UX for choosing wallet vs passkey vs provider login.
- [ ] No impact to single-chain invariant.

### PRD & Documentation Links
- Meeting notes: Feb 25, 2026 Product Sync (QA call)

### Relevant Details
Define whether provider login maps to a smart account, an EOA, or is just a recovery layer.

### Primary Scope
client

---

### F6) Story: Work review clarity: show action/category on each submission (list + detail)

Template: User Story  
Labels: `story`, `enhancement`, `client`, `design`, `triage`  
Source: 00:33:57 (show action/category)

Issue Body:

### Story Title
As an operator, I want each work submission to clearly show which action/category it corresponds to so I can review efficiently.

### Context
Current submissions can look homogeneous; reviewers need quick context (action name/domain) to validate work without opening every item.

### Done State
- [ ] Work submissions list shows action name (and optionally domain/category).
- [ ] Work submission detail includes the action context prominently.
- [ ] Optional: filters by domain/action.

### PRD & Documentation Links
- Meeting notes: Feb 25, 2026 Product Sync (QA call)

### Relevant Details
Keep labels/strings localized.

### Primary Scope
client


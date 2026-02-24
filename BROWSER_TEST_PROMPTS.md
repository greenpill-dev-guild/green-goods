# Browser Test Prompts — Cracked Coder Agents

Each prompt below is designed to be launched via the `Task` tool with `subagent_type: "cracked-coder"`. Each agent reads the relevant code, identifies and fixes issues that prevent the user action from working end-to-end, then verifies the fix compiles and passes tests.

**Monorepo root**: `/Users/afo/Code/greenpill/green-goods`
**Chain**: Arbitrum (42161), set via `VITE_CHAIN_ID` in root `.env`
**Admin app**: port 3002 | **Client PWA**: port 3001

---

## Primary Actions

### 1. Create Garden (Admin)

```
TASK: Ensure the "Create Garden" flow works end-to-end in the admin app.

CODEBASE CONTEXT:
- View: packages/admin/src/views/Gardens/CreateGarden.tsx
- Steps: packages/admin/src/components/Garden/CreateGardenSteps/ (DetailsStep.tsx, TeamStep.tsx, ReviewStep.tsx, shared.tsx)
- Hooks: packages/shared/src/hooks/garden/useGardenDraft.ts
- State machine: packages/shared/src/workflows/createGarden.ts
- Form schema: Zod validation in shared.tsx (name, slug, description, location, bannerImage, openJoining, gardeners[], operators[])
- Router: packages/admin/src/router.tsx → /gardens/create

WHAT TO VERIFY & FIX:
1. Read all files above. Trace the full flow: form mount → field validation → step navigation → draft persistence → review → submission
2. Check the 3-step wizard navigation (Details → Team → Review):
   - Does NEXT properly validate the current step's fields before advancing?
   - Does BACK preserve entered data?
   - Does the step indicator update correctly?
3. Check the DetailsStep form fields:
   - Name input + slug auto-generation (3-50 chars, lowercase, hyphens, no leading/trailing hyphens)
   - Description textarea
   - Location input
   - Banner image upload (FileUploadField component) — does it handle drag-drop and click-to-upload?
4. Check the TeamStep:
   - Gardener address list (add/remove addresses, validation of Ethereum address format)
   - Operator address list
5. Check the ReviewStep:
   - Does it display all entered data correctly?
   - Is the submit button properly gated on form validity?
6. Check the state machine transitions: idle → collecting → review → submitting → success/error
   - Does SUBMIT event properly call the contract?
   - Does RETRY work (max 3 retries)?
7. Check draft auto-save/resume (IndexedDB persistence via useGardenDraft)
8. Run: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter createGarden` (or relevant test files)
9. Run: `cd /Users/afo/Code/greenpill/green-goods/packages/admin && bun build` to verify compilation

FIX any issues found: broken imports, missing props, validation bugs, state machine transition errors, form field binding issues, etc.

REPORT: List every issue found and fixed. If the flow appears correct, confirm with evidence (test output, successful build).
```

### 2. Make Assessment (Admin)

```
TASK: Ensure the "Create Assessment" flow works end-to-end in the admin app.

CODEBASE CONTEXT:
- View: packages/admin/src/views/Gardens/Garden/CreateAssessment.tsx
- Steps: packages/admin/src/components/Assessment/CreateAssessmentSteps/ (StrategyKernelStep.tsx, DomainActionStep.tsx, SdgHarvestStep.tsx, shared.tsx)
- State machine: packages/shared/src/workflows/createAssessment.ts
- Types: packages/shared/src/types/index.ts (GardenAssessment, AssessmentWorkflowParams)
- Router: packages/admin/src/router.tsx → /gardens/:id/assessments/create

WHAT TO VERIFY & FIX:
1. Read all files above. Trace the full flow: wizard mount → step validation → submission
2. Check the 3-step wizard:
   STEP 1 — Strategy Kernel:
   - Title, Diagnosis fields
   - SMART Outcomes (array of structured outcomes — check add/remove behavior)
   - Cynefin Phase selector (Clear, Complicated, Complex, Chaotic)
   STEP 2 — Domain & Actions:
   - Domain selector (filtered by garden's domainMask)
   - Action selection (checkboxes/cards for available actions)
   STEP 3 — SDG & Harvest:
   - SDG target multi-select (1-17)
   - Reporting period date pickers (start/end, cross-field validation: end > start)
   - Attachment uploads
3. Check the state machine: idle → validating → invalid/ready → submitting → success/error
   - isValid guard checks all required fields + date range
   - SUBMIT triggers contract call
   - RETRY logic (max 3)
4. Check form schema validation in shared.tsx:
   - Date parsing (handles ISO strings and epoch ms/s)
   - Cross-field validation (endDate after startDate)
   - Required vs optional fields
5. Check that the assessment gets properly encoded for on-chain submission
6. Run relevant tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter createAssessment`
7. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/admin && bun build`

FIX any issues found.

REPORT: List every issue found and fixed with file paths and line numbers.
```

### 3. Deposit Funds in Vault (Admin)

```
TASK: Ensure the "Deposit Funds in Vault" flow works end-to-end in the admin app.

CODEBASE CONTEXT:
- View: packages/admin/src/views/Gardens/Garden/Vault.tsx
- Deposit modal: packages/admin/src/components/Vault/DepositModal.tsx
- Position card: packages/admin/src/components/Vault/PositionCard.tsx
- Hooks: packages/shared/src/hooks/vault/useVaultOperations.ts (useVaultDeposit)
- Form: packages/shared/src/hooks/vault/useDepositForm.ts
- Preview: useVaultPreview hook
- Types: packages/shared/src/types/vaults.ts (DepositParams, VaultPreview, GardenVault)
- Router: packages/admin/src/router.tsx → /gardens/:id/vault

WHAT TO VERIFY & FIX:
1. Read all files above. Trace the full deposit flow:
   Vault page → Position card "Deposit" button → Modal opens → Asset selector → Amount input → Preview → Submit
2. Check the DepositModal:
   - AssetSelector component works with multiple vaults
   - Amount input with decimal validation (useDepositForm)
   - "Max" button fills balance correctly (formatUnits with proper decimals)
   - Preview shows estimated shares (useVaultPreview with debounced amount)
   - Gas estimation (useEstimateGas + useGasPrice)
   - Submit button gating: !selectedVault || !primaryAddress || amountBigInt <= 0n || hasBlockingError || !decimalsReady || paused
3. Check useVaultDeposit hook:
   - Multi-step: check maxDeposit limit → approve token allowance → deposit
   - Stages: "approval" | "deposit"
   - Proper error handling with parseContractError
4. Check useDepositForm:
   - Decimal precision validation
   - Positive amount validation
   - Balance limit validation (amount ≤ balance)
5. Check the PositionCard shows correct vault data (asset symbol, balance, net deposited)
6. Run tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter vault`
7. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/admin && bun build`

FIX any issues: broken hooks, incorrect BigInt handling, missing token approval step, UI state bugs, etc.

REPORT: List every issue found and fixed.
```

### 4. Join Garden (Client PWA)

```
TASK: Ensure the "Join Garden" flow works end-to-end in the client PWA.

CODEBASE CONTEXT:
- Garden detail view: packages/client/src/views/Home/Garden/index.tsx
- Join hook: packages/shared/src/hooks/garden/useJoinGarden.ts
- Auth: packages/shared/src/providers/Auth.tsx
- Types: packages/shared/src/types/index.ts (Garden — openJoining field)
- Router: packages/client/src/router.tsx → /home/:id

WHAT TO VERIFY & FIX:
1. Read all files above. Trace the join flow:
   Garden detail page → "Join" button visible (openJoining=true && !isMember) → Click → Transaction → Success
2. Check the garden detail view:
   - Join button visibility logic: openJoining enabled AND user NOT already a member
   - Uses isGardenMember(userAddress, gardeners[], operators[], gardenId) utility
   - Button states: normal → loading (isJoining) → success/error
   - Pending joins stored in localStorage for 15 min optimistic UI
3. Check useJoinGarden hook:
   - joinGarden(gardenAddress, sessionOverride?) → txHash
   - checkGardenOpenJoining(gardenAddress) → boolean
   - Auth branching: passkey (sponsored via smart account) vs wallet (user pays gas)
   - Wallet submissions simulated first to catch errors
   - Error handling: isAlreadyGardenerError special case
4. Check that the member list updates after joining (query invalidation)
5. Check offline handling: does the join queue if offline?
6. Run tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter joinGarden`
7. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/client && bun build`

FIX any issues: missing button, broken auth branching, incorrect membership check, missing optimistic update, etc.

REPORT: List every issue found and fixed.
```

### 5. Upload Work (Client PWA)

```
TASK: Ensure the "Upload Work" flow works end-to-end in the client PWA.

CODEBASE CONTEXT:
- Main view: packages/client/src/views/Garden/index.tsx (multi-tab form)
- Tab views:
  - Intro: inline in Garden/index.tsx (action + garden selection)
  - Media: packages/client/src/views/Garden/Media.tsx
  - Details: packages/client/src/views/Garden/Details.tsx
  - Review: packages/client/src/views/Garden/Review.tsx
- Form hook: packages/shared/src/hooks/work/useWorkForm.ts
- Mutation: packages/shared/src/hooks/work/useWorkMutation.ts
- Images: packages/shared/src/hooks/work/useWorkImages.ts
- Drafts: packages/shared/src/hooks/work/useDrafts.ts, useDraftAutoSave.ts, useDraftResume.ts
- Types: WorkSubmission, WorkInput in packages/shared/src/types/index.ts
- Router: packages/client/src/router.tsx → /garden

WHAT TO VERIFY & FIX:
1. Read all files above. Trace the 4-tab flow:

TAB 1 — Intro:
- Action card carousel with domain filter tabs
- Garden card carousel
- Both must be selected to enable "Start Gardening" button
- Selection state persisted in useWorkFlowStore

TAB 2 — Media:
- Gallery/Camera/Video upload buttons
- Image compression via browser-image-compression
- Min/max image count validation from action's mediaInfo config
- VITE_DEBUG_MODE=true should bypass media requirements
- Audio notes support (optional)

TAB 3 — Details:
- useWorkForm builds dynamic Zod schema from action's inputs[] array
- Fixed fields: timeSpentMinutes (hours input × 60), feedback
- Dynamic fields: text, textarea, number, select, band, multi-select, repeater
- Location toggle (optional geolocation capture)

TAB 4 — Review:
- Read-only summary of all entered data
- "Upload Work" button calls useWorkMutation

2. Check useWorkMutation:
   - Auth branching: wallet (direct/offline) vs passkey (queued via job queue)
   - Offline detection → queued upload
   - Optimistic cache insertion
   - IPFS upload for images

3. Check draft management:
   - Auto-save on exit (useDraftAutoSave)
   - Resume dialog on re-entry (useDraftResume)
   - Draft keyed by {gardenAddress}-{actionUID}
   - Clear on successful submit

4. Run tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter work`
5. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/client && bun build`

FIX any issues: broken tab navigation, missing form fields, draft persistence bugs, image upload failures, etc.

REPORT: List every issue found and fixed.
```

### 6. Approve Work (Client PWA)

```
TASK: Ensure the "Approve Work" flow works end-to-end in the client PWA.

CODEBASE CONTEXT:
- Work detail view: packages/client/src/views/Home/Garden/Work.tsx
- Approval drawer: packages/client/src/views/Home/Garden/WorkApprovalDrawer.tsx
- Approval hook: packages/shared/src/hooks/work/useWorkApproval.ts
- Batch approval: packages/shared/src/hooks/work/useBatchWorkApproval.ts
- Work list: packages/client/src/components/Features/Garden/Work.tsx
- Types: WorkApprovalDraft, Confidence enum in packages/shared/src/types/index.ts
- Router: packages/client/src/router.tsx → /home/:id/work/:workId

WHAT TO VERIFY & FIX:
1. Read all files above. Trace the approval flow:
   Garden detail → Work tab → Pending work item → Work detail → [Approve]/[Reject] buttons → Feedback drawer → Submit

2. Check work detail view (Work.tsx):
   - Viewing modes: Operator (can approve/reject), Gardener (submitted it), Viewer (read-only)
   - Role detection logic for showing/hiding approval buttons
   - Fixed footer bar with [Reject] and [Approve] buttons
   - Offline work handling (workId starts with 0xoffline_)

3. Check WorkApprovalDrawer:
   - Confidence selector: NONE, LOW, MEDIUM, HIGH (default MEDIUM for approve)
   - Must be ≥ LOW to submit approval
   - Feedback textarea: optional for approvals, REQUIRED for rejections
   - Submit button gating

4. Check useWorkApproval hook:
   - Draft: { actionUID, workUID, approved, feedback, confidence, verificationMethod }
   - Auth branching: wallet (direct) vs passkey (queued)
   - Optimistic updates with 60s pending auto-clear
   - Proper query invalidation after approval

5. Check useBatchWorkApproval:
   - Multiple approvals in single transaction
   - Optimistic updates across multiple gardens

6. Check success state:
   - Shows checkmark + "Work Approved/Rejected" message
   - Auto-navigates back to garden after 2.5s

7. Run tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter workApproval`
8. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/client && bun build`

FIX any issues: broken role detection, missing drawer animation, form validation bugs, etc.

REPORT: List every issue found and fixed.
```

### 7. Deposit Funds in Cookie Jar (Admin)

```
TASK: Ensure the "Deposit Funds in Cookie Jar" flow works end-to-end in the admin app.

CODEBASE CONTEXT:
- View: packages/admin/src/views/Gardens/Garden/CookieJars.tsx
- Hooks: packages/shared/src/hooks/ — look for cookie jar related hooks (useCookieJarDeposit, useGardenCookieJars, useCookieJarWithdraw, useCookieJarPause, useCookieJarUnpause, useCookieJarEmergencyWithdraw)
- Types: packages/shared/src/types/ — CookieJar types
- ABIs: packages/shared/src/utils/blockchain/abis.ts
- Router: packages/admin/src/router.tsx → /gardens/:id/cookie-jars

WHAT TO VERIFY & FIX:
1. Read the CookieJars view and all related hooks
2. Trace the deposit flow:
   Cookie jars page → Select jar → Enter amount → Approve token (if needed) → Deposit

3. Check the CookieJars view:
   - Jar overview cards (balance, max withdrawal, interval)
   - Deposit section: jar selector, amount input, wallet balance display
   - Token approval step before deposit
   - Submit button gating

4. Check useCookieJarDeposit hook:
   - Validates: allowance, approval
   - CookieJarDepositParams structure
   - Error handling

5. Check useGardenCookieJars:
   - Fetches available jars for a garden
   - Returns jar count and jar data

6. Check admin controls:
   - Pause/unpause (useCookieJarPause/Unpause)
   - Emergency withdrawal (owner only)
   - Max withdrawal limit updates
   - Interval updates

7. Run tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter cookieJar`
8. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/admin && bun build`

FIX any issues found.

REPORT: List every issue found and fixed.
```

### 8. Make Impact Report (Admin)

```
TASK: Ensure the "Create Hypercert / Impact Report" flow works end-to-end in the admin app.

CODEBASE CONTEXT:
- List view: packages/admin/src/views/Gardens/Garden/Hypercerts.tsx
- Create view: packages/admin/src/views/Gardens/Garden/CreateHypercert.tsx
- Detail view: packages/admin/src/views/Gardens/Garden/HypercertDetail.tsx
- Related hooks: search for useHypercert* hooks in packages/shared/src/hooks/
- Types: packages/shared/src/types/index.ts
- Router: packages/admin/src/router.tsx → /gardens/:id/hypercerts, /gardens/:id/hypercerts/create

WHAT TO VERIFY & FIX:
1. Read all files above. Trace the hypercert creation flow:
   Hypercerts list → "Create" button → Wizard steps → Review → Mint

2. Check the list view:
   - Displays existing hypercerts (title, minted date, attestation count, units, work scopes)
   - "Create" button gated on management permissions (useGardenPermissions)
   - Active marketplace listings display

3. Check the create wizard (CreateHypercert.tsx):
   - What steps exist in the HypercertWizard component?
   - Form fields at each step
   - Validation rules
   - Attestation selection
   - Metadata structure
   - Distribution settings

4. Check the hooks:
   - useHypercerts() — fetches hypercerts for a garden
   - Any creation/minting hook
   - Marketplace approval gate

5. Run tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter hypercert`
6. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/admin && bun build`

FIX any issues found.

REPORT: List every issue found and fixed. Note if the hypercert feature is fully implemented or partially stubbed.
```

---

## Secondary Actions

### 9. Withdraw Funds from Vault (Admin)

```
TASK: Ensure the "Withdraw Funds from Vault" flow works end-to-end in the admin app.

CODEBASE CONTEXT:
- Vault view: packages/admin/src/views/Gardens/Garden/Vault.tsx
- Withdraw modal: packages/admin/src/components/Vault/WithdrawModal.tsx
- Position card: packages/admin/src/components/Vault/PositionCard.tsx
- Hook: packages/shared/src/hooks/vault/useVaultOperations.ts (useVaultWithdraw)
- Types: packages/shared/src/types/vaults.ts (WithdrawParams)
- Router: /gardens/:id/vault

WHAT TO VERIFY & FIX:
1. Read the WithdrawModal and useVaultWithdraw hook
2. Trace the withdrawal flow:
   Vault page → Position card "Withdraw" button → Modal → Shares input → Preview → Submit

3. Check the WithdrawModal:
   - Asset selector (if multiple)
   - Shares input field with "Max" button
   - Preview: estimated assets to receive (useVaultPreview with redeem preview)
   - Withdraw button gating (shares > 0, maxRedeem check)

4. Check useVaultWithdraw:
   - Validates maxRedeem limit
   - Single-step transaction (no approval needed for withdrawal)
   - Proper error handling
   - Query invalidation after success

5. Run tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter vault`
6. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/admin && bun build`

FIX any issues found.

REPORT: List every issue found and fixed.
```

### 10. Withdraw Funds from Cookie Jar (Admin)

```
TASK: Ensure the "Withdraw Funds from Cookie Jar" flow works end-to-end in the admin app.

CODEBASE CONTEXT:
- View: packages/admin/src/views/Gardens/Garden/CookieJars.tsx
- Hook: useCookieJarWithdraw (search in packages/shared/src/hooks/)
- Types: CookieJar withdrawal types in packages/shared/src/types/
- Router: /gardens/:id/cookie-jars

WHAT TO VERIFY & FIX:
1. Read the CookieJars view, focusing on the withdrawal section
2. Trace the withdrawal flow:
   Cookie jars page → Select jar → Enter amount → Enter purpose → Confirm → Withdraw

3. Check the withdrawal UI:
   - Jar selector (for jars with balance > 0)
   - Amount input with max withdrawal limit enforcement
   - Purpose/reason text field (required)
   - Confirmation dialog before withdrawal
   - Cooldown interval check (can't withdraw too frequently)

4. Check useCookieJarWithdraw:
   - Validates amount against max withdrawal limit
   - Checks withdrawal interval cooldown
   - Error handling for insufficient balance, paused jars

5. Check admin controls in the same view:
   - Pause/unpause functionality
   - Emergency withdrawal (owner only, if enabled)
   - Settings updates (max withdrawal, interval)

6. Run tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter cookieJar`
7. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/admin && bun build`

FIX any issues found.

REPORT: List every issue found and fixed.
```

### 11. Create Garden Conviction Pools (Admin)

```
TASK: Ensure the "Create Garden Conviction Pools" flow works end-to-end in the admin app.

CODEBASE CONTEXT:
- Signal pool view: packages/admin/src/views/Gardens/Garden/SignalPool.tsx
- Strategies view: packages/admin/src/views/Gardens/Garden/Strategies.tsx (if exists)
- Garden detail: packages/admin/src/views/Gardens/Garden/Detail.tsx (has "Create Pools" button)
- Hooks: search for useGardenPools, useCreateGardenPools, useConvictionStrategies, useRegisteredHypercerts, useRegisterHypercert, useDeregisterHypercert, useHypercertConviction, useAllocateHypercertSupport in packages/shared/src/hooks/
- Types: HypercertSignal, MemberPower, VoterAllocation in packages/shared/src/types/
- Router: /gardens/:id/signal-pool, /gardens/:id/signal-pool/:poolType

WHAT TO VERIFY & FIX:
1. Read all files above. There are TWO entry points for pool creation:
   a. Garden detail page → "Create Pools" button (uses useCreateGardenPools)
   b. Signal pool page → pool management

2. Check pool creation flow:
   - useCreateGardenPools hook: what does it do? (creates both hypercert + action pools)
   - Confirmation dialog before creation
   - Transaction handling + error states

3. Check signal pool view (SignalPool.tsx):
   - Pool type tabs: Hypercert pool vs Action pool
   - Pool address card display
   - Registered items with conviction weight percentages (progress bars)
   - Registration form: input field + register button (for managers only)
   - Deregistration: delete button with confirmation dialog

4. Check conviction weight hooks:
   - useHypercertConviction: loads conviction weights
   - useRegisteredHypercerts: lists registered items
   - useRegisterHypercert / useDeregisterHypercert: mutations

5. Check permission gating:
   - useGardenPermissions.canManageGarden() gates management controls
   - Pool creation requires management permissions

6. Run tests: `cd /Users/afo/Code/greenpill/green-goods && bun run test -- --filter conviction` or `pool` or `signal`
7. Build: `cd /Users/afo/Code/greenpill/green-goods/packages/admin && bun build`

FIX any issues found.

REPORT: List every issue found and fixed. Note if pools need to be created first before the signal pool page is useful.
```

---

## Usage

Launch each prompt as a cracked-coder agent:

```typescript
// Example: verify and fix the Create Garden flow
Task({
  description: "Fix Create Garden flow",
  prompt: "<paste prompt #1 above>",
  subagent_type: "cracked-coder",
})
```

Each agent will:
1. Read all relevant source files
2. Trace the flow logic to identify bugs
3. Fix any issues found (edit code directly)
4. Run tests and build to verify
5. Report what was found and fixed

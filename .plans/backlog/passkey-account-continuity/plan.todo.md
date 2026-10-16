# Keep Older Passkey Accounts Working on Every Site Plan

**Feature Slug**: `passkey-account-continuity`
**Stage**: `backlog`
**Status**: `ACTIVE — planned and de-risked; waiting on decisions 1 to 7`
**Created**: `2026-10-16T19:35:57.040Z`
**Last Updated**: `2026-10-16`

Read [brief.md](brief.md) for the problem and [spec.md](spec.md) for the current behaviour and
evidence. The clean-room proof behind this plan is
[reports/2026-10-16-clean-room-proof.md](reports/2026-10-16-clean-room-proof.md).

## Decision Log

Rows 1 to 7 are proposed. Nothing in them is decided until Afo answers it; the recommendation is
the plan's default if he agrees. Row 8 was answered on 2026-10-16.

| # | Decision | Recommendation | Rationale |
|---|---|---|---|
| 1 | Keep older accounts instead of moving them to new ones | Keep them: add them to the directory, and share host-bound passkeys across sites with a related-origins file. Moving stays a support fallback. | A move costs the address, gardens, roles, history and name. Both keep-paths passed the clean-room proof, including the deployed validator accepting the signatures. |
| 2 | When an account is added to the directory | Inside the next sign-in on the site where it already works, using the same passkey prompt; plus one action in the account screen for people with a saved session. | Recent sign-ins need no extra step. A saved session never prompts, so it needs a button. |
| 3 | What checks the proof of possession on the agent | The app's own WebCrypto verifier, moved into `@green-goods/shared/public-contracts` so both sides run one implementation. | The agent's `@simplewebauthn/server`, as locked, throws on every ES256 assertion: it resolves `@peculiar/asn1-schema` 2.6.0 while the signature schema in `@peculiar/asn1-ecc` registers in 2.10.0. Fixing that is a dependency change; track it separately (follow-up F1). |
| 4 | Publish `/.well-known/webauthn` on www and beta | Yes, listing every Green Goods origin. | It's the only way to use a host-bound passkey on another site without a new account. Chrome refused the cross-site ceremony without the file and when www was missing from it. |
| 5 | A remembered name that is now taken (January to August accounts were never reserved) | Ask for another name in the adoption step. | The account follows the passkey, not the name, so a new name changes nothing else. A silent suffix would leave people guessing their own sign-in name. |
| 6 | Where the saved-session action lives | A row in the account screens that already exist (client profile, admin account panel), never a banner. | Existing chrome, no layout shift; it shows only for passkey sessions without a directory entry. |
| 7 | The three staging test accounts from June and July | Confirm they are team tests, then drop them. Support-assisted if not. | The hosted server stopped accepting the staging origin (probed 4 October), so they can't sign in by name to adopt. |
| 8 | COM-39 | **Decided 2026-10-16:** rewritten around keeping accounts, with moving as the fallback ([handoffs/com-39-update-draft.md](handoffs/com-39-update-draft.md)). | Afo chose the rewrite. The old text counted only from late June and planned a move. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror: the directory's registration rules and store,
      and the app's in-page ceremony with a local signature check
- [x] List human judgment points before implementation (decisions 1 to 8)
- [x] Decision 8: COM-39 rewritten (2026-10-16)
- [x] Define what is out of scope ([brief.md](brief.md))
- [x] Prove the risky parts before planning steps (clean-room report)
- [ ] Afo answers decisions 1 to 7
- [ ] Choose validation per step with `bun run check --plan -- --intent qa` at implementation time

## Requirements Coverage

| Requirement (spec.md) | Lane | Planned Step | Status |
|---|---|---|---|
| R1 Adopt an older account with proof of possession | `state_api` | 2, 3, 4, 5 | ⏳ |
| R2 A hosted name stays with its passkey | `state_api` | 4, 5 | ⏳ |
| R3 Remembered names that are taken get a new name | `state_api`, `ui` | 5, 7 | ⏳ |
| R4 Directory sign-in names a passkey stored with a hex ID | `state_api` | 1 | ⏳ |
| R5 Host-bound passkeys work on other Green Goods sites | `ui` | 8 | ⏳ |
| R6 The app says where a passkey works when a browser can't share it | `ui` | 9 | ⏳ |
| R7 Sign-in never waits on adoption | `state_api` | 6 | ⏳ |
| R8 Adoption keeps the same account address | `state_api` | 6 | ⏳ |
| R9 Telemetry sizes what is left, without names | `state_api` | 10 | ⏳ |

## Implementation Steps

Order follows dependencies: shared contract, then agent, then shared workflows, then client
surfaces. Shared auth and the agent's passkey directory are critical surfaces: read every touched
line and keep the selector's critical override.

### Step 1: Directory sign-in names hex-ID passkeys (state_api)

**Files**: `packages/shared/src/public-contracts/passkey-directory.ts`,
`packages/shared/src/workflows/auth-passkey-directory.ts`,
`packages/shared/src/__tests__/workflows/authServices.test.ts`

- Add optional `signingId` (the browser's base64url credential ID) to
  `PasskeyDirectoryCredential`, and correct the `id` comment: it is the ID the account was made
  with, which Kernel hashes into the address. It's base64url for directory sign-ups and may be
  hex for an adopted hosted account.
- `signInWithDirectory` passes `{ id, signingId: credential.signingId }` to
  `getPasskeyRequestIds` and `matchesBrowserId`, instead of `signingId: credential.id`. Today that
  disables the hex branch, so a hex ID is read as base64url and names the wrong bytes.
- **RED**: an entry with a hex `id` fails sign-in (the rig shows `NotAllowedError` on beta and
  www). **GREEN**: it signs in, and the session keeps the hex string as `credential.id`.

### Step 2: One assertion verifier for the app and the agent (state_api)

**Files**: new `packages/shared/src/public-contracts/passkey-assertion.ts`, its export from the
existing `public-contracts` index, `packages/shared/src/modules/auth/passkey-assertion.ts` (keeps
its logging and delegates), `packages/shared/src/__tests__/modules/passkey-assertion.test.ts`

- Move the pure check (type, challenge, origin, RP ID hash, UP and UV flags, P-256 signature) with
  no logger import. Use the existing leaf; add no new export subpath.
- **GREEN**: the existing verifier tests pass at the new location, and the agent test in step 5
  imports it through `@green-goods/shared/public-contracts` under Bun.

### Step 3: Store adopted entries (state_api, agent)

**Files**: `packages/agent/src/services/db/schema.ts`,
`packages/agent/src/services/db/passkey-directory.ts`,
`packages/agent/src/services/passkey-directory-adapters.ts`,
`packages/agent/src/__tests__/test-utils/passkey-directory-store-contract.ts`

- Add nullable `signingId` and `source` (`registered` by default, `adopted` for adoption) to
  `passkey_credentials`, and a `purpose` column to the challenge table so adoption challenges
  can't answer a registration. Migrate in place: existing rows read as `registered`.
- Keep the first-registration-wins rule and the unique credential rule.
- **RED/GREEN**: the store contract test covers both stores (memory and SQLite) for an adopted
  row and for a challenge used for the wrong purpose.

### Step 4: Ask the hosted server which passkey holds a name (state_api, agent)

**Files**: `packages/agent/src/services/passkey-directory-adapters.ts`,
`packages/agent/src/__tests__/passkey-directory.test.ts`

- Return the hosted server's listed credentials (`id`, `publicKey`) rather than a yes or no. The
  existing name check becomes "any listed". Keep the 4-second timeout and key-free error text.

### Step 5: The adoption calls (state_api, agent)

**Files**: `packages/agent/src/services/passkey-directory.ts`,
`packages/agent/src/api/routes/passkey-directory.ts`,
`packages/shared/src/public-contracts/passkey-directory.ts`,
`packages/agent/src/__tests__/passkey-directory.test.ts`,
`packages/agent/src/__tests__/test-utils/software-passkey.ts` (add an assertion maker)

- `gg_startPasskeyAdoption` issues a single-use challenge (5 minutes, purpose `adoption`).
  `gg_completePasskeyAdoption` takes the name, the stored credential ID string, the browser ID,
  the public key, the passkey's domain and the assertion. Both use the `passkey_registration`
  rate-limit class.
- Rules, in order, as prototyped in the rig:
  1. The origin is explicitly allowed.
  2. The domain is one a passkey can already carry: `greengoods.app`, `www.greengoods.app`,
     `beta.greengoods.app` or `staging.greengoods.app`.
  3. The page sits on that domain or under it, so adoption happens where the passkey already works.
  4. The challenge is spent before anything else.
  5. The stored ID's bytes (hex or base64url) equal the assertion's `rawId`.
  6. The assertion verifies with step 2's checker.
  7. The name is free, or the hosted server lists this same passkey for it (ID bytes and key).
  8. A hosted lookup failure answers `unavailable`.
  9. Store the ID string exactly, never re-encoded.
- **RED/GREEN**: one test per refusal the rig exercised (replay, wrong key, taken name, wrong
  site), plus a hosted name held by another passkey, a hosted name held by this passkey, and an
  unadoptable domain.

### Step 6: Adopt inside sign-in, never in its way (state_api, shared)

**Files**: new `packages/shared/src/workflows/auth-passkey-adoption.ts`,
`packages/shared/src/workflows/authServices.ts`,
`packages/shared/src/__tests__/workflows/authServices.test.ts`

- Hosted sign-in on its home site: look the name up on the hosted server for its key, take the
  ceremony challenge from `gg_startPasskeyAdoption`, run the ceremony under the page's host, and
  check it locally against the listed key, as the directory path already does. Then submit the
  adoption in the background.
- "Use this device's passkey" does the same with the remembered credential.
- If the directory can't be reached, sign-in runs exactly as today. An adoption failure is logged
  and retried next time, never shown as a sign-in failure.
- Before sending, rebuild the Kernel address from the entry and compare it with the stored
  address; send nothing on a mismatch. **RED/GREEN** in `authServices.test.ts`: assert the ID
  handed to Kernel, not a mocked address.
- Only if decision 2 is accepted. Otherwise step 7 is the sole trigger.

### Step 7: One action for saved sessions (ui)

**Files**: a shared hook in `packages/shared/src/hooks/auth/` (for example
`usePasskeyAdoption.ts`), the client profile screen, `packages/admin/src/components/Layout/AccountProfilePanel.tsx`,
`packages/shared/src/i18n/{en,es,pt}.json`

- Show a row only for passkey sessions whose name has no matching directory entry: "Sign in on
  every Green Goods site", with one button that runs the adoption prompt. For a taken name
  (decision 5), ask for a new name in the same row.
- Draft copy is in [spec.md](spec.md#draft-copy).

### Step 8: The related-origins file (ui, client)

**Files**: new `packages/client/public/.well-known/webauthn`, `packages/client/vercel.json`,
`scripts/dev/smoke-prod.js`

- Serve `{"origins": [...]}` listing `https://greengoods.app`, `https://www.greengoods.app`,
  `https://beta.greengoods.app`, `https://staging.greengoods.app`,
  `https://admin.greengoods.app`, `https://beta.admin.greengoods.app` and
  `https://staging-admin.greengoods.app`, with a `Content-Type: application/json` header rule. All
  of them share one label, well inside Chrome's limit.
- Today both hosts answer that path with the app's HTML through the catch-all rewrite. A static
  file takes precedence, as `assetlinks.json` already does.
- Add a smoke check: www and beta answer JSON whose `origins` match the list. Staging serves the
  beta deployment, so it gets the file too.

### Step 9: Say where the passkey works (ui, shared)

**Files**: `packages/shared/src/workflows/auth-passkey-errors.ts`,
`packages/shared/src/hooks/auth/login-error-message.ts`,
`packages/shared/src/i18n/{en,es,pt}.json`,
`packages/shared/src/__tests__/hooks/loginScreenMessages.test.ts`

- When the hosted server lists the name and the ceremony is refused, show the "made on another
  site" copy instead of "Sign in was cancelled." WebAuthn reports a missing passkey and a
  dismissal the same way, so the copy must read true in both cases.
- When a cross-site ceremony fails with `SecurityError` (a browser without related-origin
  support), name the site where the passkey works. Where
  `PublicKeyCredential.getClientCapabilities()` exists, read `relatedOrigins` first and show that
  copy without attempting the ceremony.

### Step 10: Telemetry (state_api)

**Files**: `packages/shared/src/modules/app/analytics-events.ts` and its callers

- `auth_passkey_adoption_started`, `_success` and `_failed` (with a reason), plus two fields on
  `auth_passkey_login_failed`: `hosted_name` and `related_origin`. No names or keys.

### Step 11: Proof (qa)

- Rerun the clean-room rig ([artifacts/rig/README.md](artifacts/rig/README.md)) on the branch.
- Authenticated device proof, which passkey signing requires (AGENTS.md, Browser Evidence), on
  Android Chrome and iPhone Safari. Afo runs it:
  1. A January-to-August-style account adopts on www, then signs in by name on admin.
  2. A beta-bound passkey signs in on www once step 8 is live.
  3. A garden action signs from admin.

## Follow-ups outside this plan

- **F1. Lockfile duplicate.** `@simplewebauthn/server` 13.3.3 resolves `@peculiar/asn1-schema`
  2.6.0 while `@peculiar/asn1-ecc` 2.10.0 uses 2.10.0, so `verifyAuthenticationResponse` throws
  "Cannot get schema for 'ECDSASigValue' target" for every ES256 assertion. Registration is
  unaffected (attestation `none`). Fixing it changes dependencies, which needs approval.
- **F2.** Rewrite COM-39 (decision 8). Done on 2026-10-16.
- **F3.** Retire the hosted fallback once telemetry shows few unadopted hosted names signing in.

## Validation

- Choose per step with `bun run check --plan -- --intent qa` and the owning package guide.
- Before a push: `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts`, with the
  critical override retained for shared auth and the agent directory.
- Rendered proof follows AGENTS.md Browser Evidence: clean-room Chromium for the rig, authenticated
  device proof for signing.

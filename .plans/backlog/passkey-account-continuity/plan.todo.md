# Keep Older Passkey Accounts Working on Every Site Plan

**Feature Slug**: `passkey-account-continuity`
**Stage**: `backlog`
**Status**: `ACTIVE — planned and de-risked; waiting on decisions 1 to 7`
**Created**: `2026-10-16T19:35:57.040Z`
**Last Updated**: `2026-10-16`

Read [brief.md](brief.md) for the problem and [spec.md](spec.md) for the current behaviour and
evidence. The clean-room proof behind this plan is
[reports/2026-10-16-clean-room-proof-fifth-review.md](reports/2026-10-16-clean-room-proof-fifth-review.md).

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
| R6 The app says where a passkey works, or which sites it may work on | `ui` | 9 | ⏳ |
| R7 Sign-in never waits on adoption | `state_api` | 5, 6 | ⏳ |
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
`packages/agent/src/__tests__/test-utils/passkey-directory-store-contract.ts`,
`packages/agent/src/__tests__/storage.sqlite.test.ts`

- Add columns with the schema's existing `ensureColumn` helper. `CREATE TABLE IF NOT EXISTS` never
  alters a live table, so new definitions alone would not reach production.
  - On `passkey_credentials`:
    - `signingId`, nullable: the browser's base64url credential ID.
    - `credentialKey`: the credential's bytes in base64url, taken from the assertion's `rawId`
      at adoption, never by re-reading the submitted string, which can be valid hex and valid
      base64url at once.
    - `source`: `TEXT NOT NULL DEFAULT 'registered'`, and `adopted` for adoption.
  - On the challenge table, `purpose` (`TEXT NOT NULL DEFAULT 'registration'`), so an adoption
    challenge can't answer a registration.
- Backfill `credentialKey` by copying `credentialId` for existing rows. Directory sign-ups store
  the browser's base64url ID, and copying rather than decoding cannot misread one that also looks
  like hex.
- Make the pair unique: one index on `(credentialKey, publicKey)`. That stops the hex and
  base64url spellings of one passkey sitting under two names. ID bytes alone stay non-unique,
  because an assertion's signature does not cover `rawId`. A client can claim anyone's ID bytes,
  and only the pair is bound to a proven key.
- Keep the first-registration-wins rule for names. `credentialId` keeps the account's exact
  string for Kernel.
- Drop the existing `credentialId UNIQUE` column constraint, or a claimed string could still
  reserve someone else's ID. SQLite can't drop it in place, so rebuild `passkey_credentials` in
  one transaction: new table, copy, swap, indexes.
- **RED/GREEN**:
  - The store contract test covers both stores (memory and SQLite):
    - an adopted row;
    - a challenge used for the wrong purpose;
    - one credential refused under a second name when its ID arrives in the other spelling;
    - a claimed ID with a different key stored beside the real one, neither blocking the other.
  - `storage.sqlite.test.ts` builds the v2.0.1 schema with a stored passkey and a pending
    challenge, then runs `initSchema` over it. It asserts:
    - the new columns and their defaults, and the backfilled key;
    - the rebuilt table, with the pair index and no string-only unique `credentialId`;
    - that both rows survive.

### Step 4: Ask the hosted server which passkey holds a name (state_api, agent)

**Files**: `packages/agent/src/services/passkey-directory-adapters.ts`,
`packages/agent/src/__tests__/passkey-directory.test.ts`

- Return the hosted server's listed credentials (`id`, `publicKey`) rather than a yes or no. The
  existing name check becomes "any listed". Keep the 4-second timeout and key-free error text.
- Keep each `id` exactly as the hosted server lists it. Step 5 compares it as a string, because
  a hosted account's address follows that exact string.
- The listing carries no domain, and nothing else reliably derives one. Step 9's copy is shaped
  by that.

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
  4. The challenge is spent before anything else. Its verdict is applied at rule 7.
  5. Either reading of the stored ID equals the assertion's `rawId`: hex, when the string is
     shaped like hex, or base64url. `getPasskeyRequestIds` already tries both.
  6. The assertion verifies with step 2's checker.
  7. An identical completion returns the stored result. Identical means the same name, the exact
     same stored ID string, the same credential bytes and the same key. The other spelling of the
     same passkey is a different account to Kernel, so it is never identical. Otherwise a spent
     or expired challenge refuses.
  8. The name is free, or the hosted server lists this same passkey for it: the same key, and an
     `id` string exactly equal to the submitted stored ID. Bytes are not enough here. Rule 5 only
     proves which passkey the browser used, while the hosted account's address follows the
     hosted server's exact string, so the other spelling would point the name at a different
     account.
  9. The same credential, meaning its ID bytes and proven key together, is not held under
     another name. `rawId` sits outside the assertion's signature, so ID bytes alone prove
     nothing about who holds them.
  10. A hosted lookup failure answers `unavailable` with a refusal code the client does not retry
      (`-32000`, not the retried `-32603`).
  11. Store the ID string exactly, never re-encoded, with `credentialKey` beside it.

  Refusals after rule 5 need a proven assertion, so an unproven caller learns nothing about names
  or credentials.
- **RED/GREEN**:
  - Refusals: a replay under another name, a wrong key, a mismatched ID in base64url and in hex,
    the same credential under a second name in the other spelling, the held name sent again with
    the ID in the other spelling, a taken name, the wrong site,
    an unadoptable domain, a hosted name held by another passkey, a hosted name submitted with the
    other spelling of its listed ID, and the hosted lookup down.
  - A spoofed `rawId`, where an attacker's own assertion claims a victim's ID bytes, must neither
    block the victim's later adoption nor open anything.
  - Successes:
    - a hosted name held by this passkey;
    - an identical retry after success, which returns the stored result;
    - a stored ID valid in both spellings, accepted through its base64url reading.
  - The rig ran every refusal except the domain and hosted cases, plus the two-spelling success
    and the spoofed `rawId`, all against its prototype (scenarios C, F and G of the
    [report](reports/2026-10-16-clean-room-proof-fifth-review.md)).

### Step 6: Adopt during sign-in, never in its way (state_api, shared)

**Files**: new `packages/shared/src/workflows/auth-passkey-adoption.ts`,
`packages/shared/src/config/passkeyServer.ts` (the adoption client),
`packages/shared/src/workflows/authServices.ts`,
`packages/shared/src/__tests__/workflows/authServices.test.ts`

- Adoption calls get their own directory client, with no transport retry.
  - The start call sits beside sign-in and has a 3-second timeout.
  - The completion runs in the background with 10 seconds. That outlasts the agent's 4-second
    hosted lookup plus verification, so a slow hosted server is never reported as a failure
    after the agent has stored the adoption.
  - The sign-in client keeps its 6-second timeout and one retry.
- **Hosted sign-in on its home site.**
  - Start `gg_startPasskeyAdoption` at the same moment as the hosted lookup, never before it.
  - When the lookup answers, run the ceremony at once. Use the adoption challenge if it has
    already arrived. Otherwise use a locally made challenge and skip adoption for this sign-in.
  - Either way, check the assertion locally against the key the hosted server listed, as the
    directory path already does, and submit the completion in the background.
  - This replaces the hosted server's `startAuthentication` and `verifyAuthentication`: the app
    no longer asks it for a challenge or a verdict. The local check covers what that verdict
    covered: the challenge, origin, RP ID hash, user presence and verification, and the
    signature against the listed key.
  - So adoption adds no wait. The ceremony starts when the lookup answers, one hosted round trip
    sooner than today.
- **Only the hosted path merges**, because only it already waits on a lookup before the ceremony.
  "Use this device's passkey" and saved sessions adopt from step 7's button.
- **When not to adopt.** Skip adoption when the directory lookup failed earlier in the same
  sign-in. An adoption failure is logged and tried again at a later sign-in, never shown as a
  sign-in failure.
- **Address guard.** Before sending, rebuild the Kernel address from the entry and compare it with
  the stored address. Send nothing on a mismatch.
- **RED/GREEN** in `authServices.test.ts`:
  - With the adoption start held open (a promise that never settles), hosted sign-in starts its
    ceremony as soon as the hosted lookup answers. It uses a local challenge, calls neither
    `startAuthentication` nor `verifyAuthentication`, and sends no completion.
  - The local check refuses what the hosted verdict refused: an assertion for another
    credential, one signed by a key other than the listed one, and one over a stale challenge.
  - With the challenge ready before the lookup answers, sign-in completes, and the background
    completion carries that challenge, the hosted account's exact ID string (not the browser
    ID), its key and the page's RP ID.
  - Assert the ID handed to Kernel, not a mocked address.
- This step runs only if decision 2 is accepted. Otherwise step 7 is the sole trigger.

### Step 7: One action for saved sessions (ui)

**Files**: a shared hook in `packages/shared/src/hooks/auth/` (for example
`usePasskeyAdoption.ts`), the client profile screen, `packages/admin/src/components/Layout/AccountProfilePanel.tsx`,
`packages/shared/src/i18n/{en,es,pt}.json`

- Show a row only for passkey sessions whose name has no matching directory entry: "Sign in on
  every Green Goods site", with one button that runs the adoption prompt. For a taken name
  (decision 5), ask for a new name in the same row.
- Draft copy is in [spec.md](spec.md#draft-copy).
- **RED/GREEN** in a component test, with the shared hook mocked at its boundary:
  - The row appears for a passkey session without a directory entry.
  - A taken name keeps the row and asks for another name.
  - Adopting under the new name succeeds, and the row disappears.

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
- The file helps only entries whose domain the directory knows: directory sign-ups and adopted
  accounts. An unadopted hosted account still asks for the page's own host. So it adopts on its
  home site first (steps 6 and 7), and step 9's copy sends it there.
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
- The hosted server never says which site a passkey belongs to (step 4). Hosted accounts were made
  only on www and beta, with staging retired. So for an unadopted hosted name, the copy names the
  hosted sites other than the current one:
  - beta, when the person is on www;
  - www, when on beta;
  - both, anywhere else.
- A directory or adopted entry carries its domain, so the copy names that site exactly. That
  covers a cross-site ceremony that fails with `SecurityError`, from a browser without
  related-origin support.
- A ceremony needs related origins only when the page's host is neither the entry's domain nor
  under it. Only then, and only where `PublicKeyCredential.getClientCapabilities()` exists,
  read `relatedOrigins` and show the copy without attempting the ceremony. A beta entry on beta
  and an apex entry on admin always go ahead.
- **RED/GREEN** in `loginScreenMessages.test.ts`, in en, es and pt: the copy for an unadopted
  hosted name on www, on beta and on admin, and for an adopted beta entry on www. With
  `relatedOrigins: false`, a beta entry on beta and an apex entry on admin still run their
  ceremony.

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

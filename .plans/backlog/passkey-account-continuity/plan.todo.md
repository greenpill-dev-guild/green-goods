# Keep Older Passkey Accounts Working on Every Site Plan

**Feature Slug**: `passkey-account-continuity`
**Stage**: `backlog`
**Status**: `ACTIVE — planned and de-risked; waiting on decisions 1 to 7 and 9`
**Created**: `2026-10-16T19:35:57.040Z`
**Last Updated**: `2026-10-17`

Read [brief.md](brief.md) for the problem and [spec.md](spec.md) for the current behaviour and
evidence. The clean-room proof behind this plan is
[reports/2026-10-16-clean-room-proof-fifth-review.md](reports/2026-10-16-clean-room-proof-fifth-review.md).

## Decision Log

Rows 1 to 7 and 9 are proposed. Nothing in them is decided until Afo answers it; the
recommendation is the plan's default if Afo agrees. Row 8 was answered on 2026-10-16.

| # | Decision | Recommendation | Rationale |
|---|---|---|---|
| 1 | Keep older accounts instead of moving them to new ones | Keep them: add them to the directory, and share host-bound passkeys across sites with a related-origins file. Moving stays a support fallback. | A move costs the address, gardens, roles, history and name. Both keep-paths passed the clean-room proof, including the deployed validator accepting the signatures. |
| 2 | When an account is added to the directory | Inside the next sign-in on the site where it already works, using the same passkey prompt; plus one action in the account screen for people with a saved session. | Recent sign-ins need no extra step. A saved session never prompts, so it needs a button. |
| 3 | What checks the proof of possession on the agent | The app's own WebCrypto verifier, moved into `@green-goods/shared/public-contracts` so both sides run one implementation. | The agent's `@simplewebauthn/server`, as locked, throws on every ES256 assertion: it resolves `@peculiar/asn1-schema` 2.6.0 while the signature schema in `@peculiar/asn1-ecc` registers in 2.10.0. Fixing that is a dependency change; track it separately (follow-up F1). |
| 4 | Publish `/.well-known/webauthn` on www and beta | Yes, listing every Green Goods origin. | It's the only way to use a host-bound passkey on another site without a new account. Chrome refused the cross-site ceremony without the file and when www was missing from it. |
| 5 | A remembered name that is now taken (January to August accounts were never reserved) | Ask for another name in the adoption step. | The account follows the passkey, not the name, so a new name changes nothing else. A silent suffix would leave people guessing their own sign-in name. |
| 6 | Where the saved-session action lives | A row in the account screens that already exist (client profile, admin account panel), never a banner. | Existing chrome, no layout shift; it shows only while the session's account has no directory entry. |
| 7 | The three staging test accounts from June and July | Confirm they are team tests, then drop them. Support-assisted if not. | The hosted server stopped accepting the staging origin (probed 4 October), so they can't sign in by name to adopt. |
| 8 | COM-39 | **Decided 2026-10-16:** rewritten around keeping accounts, with moving as the fallback ([handoffs/com-39-update-draft.md](handoffs/com-39-update-draft.md)). | Afo chose the rewrite. The old text counted only from late June and planned a move. |
| 9 | The signature counter, once hosted sign-in stops asking the hosted server for a verdict (step 6) | Don't track it, as the directory's own sign-in doesn't today. List the gap in the spec's risks, and revisit if the account's on-chain check ever reads the counter. | The deployed validator decides what the account can sign, and its source says it ignores the counter, so a copied key signs without any sign-in. Synced passkeys from Apple and Google report 0, so for most people there is nothing to compare. Every adopted account moves to the directory's sign-in, whichever trigger adopts it, so keeping the hosted verdict in step 6 alone would only delay the change. Tracking adds a column, one more call, and a refusal that keeps the owner out until support clears it ([step 6](#step-6-adopt-during-sign-in-never-in-its-way-state_api-shared)). |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror: the directory's registration rules and store,
      and the app's in-page ceremony with a local signature check
- [x] List human judgment points before implementation (decisions 1 to 9)
- [x] Decision 8: COM-39 rewritten (2026-10-16)
- [x] Define what is out of scope ([brief.md](brief.md))
- [x] Prove the risky parts before planning steps (clean-room report)
- [ ] Afo answers decisions 1 to 7 and 9
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

- Add optional `signingId` to `PasskeyDirectoryCredential`: the browser's base64url credential
  ID, which the lookup fills from the stored `credentialKey` (steps 3 and 5). Correct the `id`
  comment: it is the ID the account was made with, which Kernel hashes into the address. It's
  base64url for directory sign-ups and may be hex for an adopted hosted account.
- `signInWithDirectory` passes `{ id, signingId: credential.signingId }` to
  `getPasskeyRequestIds` and `matchesBrowserId`, instead of `signingId: credential.id`. Today that
  disables the hex branch, so a hex ID is read as base64url and names the wrong bytes.
- `switchingAccounts` compares the exact ID string as well as the key point. The other spelling
  of one passkey is another account (step 3), so signing in by that spelling's name is a switch.
  Compared by key alone, it keeps the saved-address check on, and the sign-in fails.
- **RED**: an entry with a hex `id` fails sign-in (the rig shows `NotAllowedError` on beta and
  www). **GREEN**: it signs in, and the session keeps the hex string as `credential.id`.
- **RED/GREEN**: a device that cached a legacy hex spelling signs in by both names. Its own name
  keeps the saved address, and the hosted spelling's name switches to that account's address.

### Step 2: One assertion verifier for the app and the agent (state_api)

**Files**: new `packages/shared/src/public-contracts/passkey-assertion.ts`, its export from the
existing `public-contracts` index, `packages/shared/src/modules/auth/passkey-assertion.ts` (keeps
its logging and delegates), `packages/shared/src/__tests__/modules/passkey-assertion.test.ts`

- Move the pure check (type, challenge, origin, RP ID hash, UP and UV flags, P-256 signature) with
  no logger import. Use the existing leaf; add no new export subpath.
- Give it bytes, not a browser `Credential`: `authenticatorData`, `clientDataJSON` and `signature`
  as `Uint8Array`. The app's wrapper reads them from the `Credential` the ceremony returns, and
  the agent decodes them from the request (step 5). The rig wrapped decoded bytes in a fake
  `Credential` (`rig-server.ts`); production code must not copy that.
- **GREEN**: the existing verifier tests pass through the app's wrapper, a new test calls the byte
  form directly, and the agent test in step 5 imports it through
  `@green-goods/shared/public-contracts` under Bun.

### Step 3: Store adopted entries (state_api, agent)

**Files**: `packages/agent/src/services/db/schema.ts`,
`packages/agent/src/services/db/passkey-directory.ts`,
`packages/agent/src/services/passkey-directory-adapters.ts`,
`packages/agent/src/__tests__/test-utils/passkey-directory-store-contract.ts`,
`packages/agent/src/__tests__/storage.sqlite.test.ts`

- Add columns with the schema's existing `ensureColumn` helper. `CREATE TABLE IF NOT EXISTS` never
  alters a live table, so new definitions alone would not reach production.
  - On `passkey_credentials`:
    - `credentialKey`: the credential's bytes in base64url, taken from the assertion's `rawId`
      at adoption, never by re-reading the submitted string, which can be valid hex and valid
      base64url at once. Step 5's lookup returns it as `signingId`. No separate browser-ID column:
      a browser's credential ID is `rawId` in base64url by definition, and step 5's rule 5 has
      already matched those bytes to the stored ID. Every insert writes it, and the rebuilt
      table declares it `NOT NULL`: a registration from its verified credential ID, already
      the browser's base64url ID, and an adoption from `rawId`.
    - `source`: `TEXT NOT NULL DEFAULT 'registered'`, and `adopted` for adoption.
  - On the challenge table, `purpose` (`TEXT NOT NULL DEFAULT 'registration'`), so an adoption
    challenge can't answer a registration. An adoption challenge fills the table's existing
    `userName`, `rpId` and `origin` from the start call (step 5), so completion is held to them.
- Backfill `credentialKey` by copying `credentialId` for existing rows. Directory sign-ups store
  the browser's base64url ID, and copying rather than decoding cannot misread one that also looks
  like hex.
- Make the account unique: one index on `(credentialId, publicKey)`, the exact string Kernel
  hashes and the key in its stored form. Together they give the Kernel address, so one account
  can't sit under two names.
  - The other spelling of one passkey is another account. A device that cached a legacy
    spelling keeps it (`authServices.test.ts`, "preserves an authenticated legacy ID
    spelling"), so that spelling may adopt under another name, in either order.
  - ID bytes stay non-unique, because an assertion's signature does not cover `rawId`. A client
    can claim anyone's ID bytes; with its own key, the claim lands as its own entry.
  - `publicKey` has one spelling per point: `0x04`, then lowercase x and y. Registration
    already writes that form (`uncompressedP256PublicKey`), and step 5 rewrites an adopted key
    into it. The verifier accepts the point with or without `04` and in either case, so a
    raw-text index would let one account hold two names.
- Move each store's own duplicate check to the same `(credentialId, publicKey)` key. Today the
  SQLite insert refuses any row whose `credentialId` string is already stored
  (`SELECT 1 ... WHERE credentialId = ?`), and the memory store compares the same strings, so a
  claimed string would still block the owner.
- Keep the first-registration-wins rule for names. `credentialId` keeps the account's exact
  string for Kernel.
- Drop the existing `credentialId UNIQUE` column constraint, or a claimed string could still
  reserve someone else's ID. SQLite can't drop it in place, so rebuild `passkey_credentials` in
  one transaction: new table, copy, swap, indexes. The rebuild runs only while that constraint
  exists, so a second `initSchema` changes nothing.
- Raise the `PRAGMA user_version` that `initSchema` sets last from 8 to 9, so the version names
  the new shape. It is set after every other statement, so a rebuild that throws leaves 8.
- **RED/GREEN**:
  - The store contract test covers both stores (memory and SQLite):
    - an adopted row, with its challenge's domain and origin in `rpId` and `origin`;
    - a challenge used for the wrong purpose, and an adoption challenge kept with its name,
      domain and origin;
    - the other spelling of a held passkey accepted under another name, as its own account;
    - one account refused under a second name, including when its key arrives without `04` or
      in upper case;
    - a claimed ID with a different key stored beside the real one, neither blocking the other;
    - a registration after the upgrade, which writes `credentialKey`, offers it from the lookup
      as `signingId`, and refuses the same account under another name.
  - `storage.sqlite.test.ts` builds the v2.0.1 schema with a stored passkey and a pending
    challenge, then runs `initSchema` over it. It asserts:
    - the new columns and their defaults, and the backfilled key;
    - the rebuilt table, with the `(credentialId, publicKey)` index and no string-only unique
      `credentialId`;
    - that both rows survive;
    - `user_version` 9, and that a second `initSchema` changes nothing. The file's two
      existing assertions of 8 move to 9.

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
`packages/agent/src/__tests__/test-utils/software-passkey.ts` (add an assertion maker),
`packages/agent/README.md` (the Production Checklist)

- `gg_startPasskeyAdoption` takes the name and the passkey's domain, applies rules 1 to 3, and
  issues a single-use challenge (5 minutes, purpose `adoption`). It stores the challenge with
  the normalized name, the domain as its `rpId`, and the origin.
  `gg_completePasskeyAdoption` takes the name, the stored credential ID string, the public key,
  the passkey's domain and the assertion. It takes no browser ID: the agent derives it from the
  assertion's `rawId` (step 3's `credentialKey`). Both use the `passkey_registration` rate-limit
  class.
- **Wire form.** The assertion travels as WebAuthn's JSON form: base64url strings for `id`,
  `rawId`, `response.authenticatorData`, `response.clientDataJSON` and `response.signature`. The
  route decodes them into step 2's byte input before rule 5, and a missing or malformed field
  refuses.
- Rules, in order, as prototyped in the rig:
  1. The origin is explicitly allowed.
  2. The domain is one a passkey can already carry: `greengoods.app`, `www.greengoods.app`,
     `beta.greengoods.app` or `staging.greengoods.app`.
  3. The page sits on that domain or under it, so adoption happens where the passkey already works.
  4. The challenge is spent before anything else. Its verdict, which includes the name, domain
     and origin it was started for, is applied at rule 7.
  5. Either reading of the stored ID equals the assertion's `rawId`: hex, when the string is
     shaped like hex, or base64url. `getPasskeyRequestIds` already tries both.
  6. The submitted key is rewritten into the stored form (`0x04`, then lowercase x and y), and a
     key that isn't an uncompressed P-256 point refuses. The assertion verifies against it with
     step 2's checker. Every later rule compares keys in that form.
  7. An identical completion returns the stored result. Identical means the same name, the exact
     same stored ID string, the same credential bytes and the same key. The other spelling of the
     same passkey is a different account to Kernel, so it is never identical. Otherwise a spent
     or expired challenge refuses, as does one started for another name, domain or origin.
  8. The name is free, or the hosted server lists this same passkey for it: the same key in the
     stored form, and an `id` string exactly equal to the submitted stored ID. Bytes are not
     enough here. Rule 5 only proves which passkey the browser used, while the hosted account's
     address follows the hosted server's exact string, so the other spelling would point the
     name at a different account.
  9. The same account, meaning its exact ID string and proven key together, is not held under
     another name. The other spelling of the same passkey is another account to Kernel, so it
     may be. ID bytes decide nothing here: `rawId` sits outside the assertion's signature.
  10. A hosted lookup failure answers `unavailable` with a refusal code the client does not retry
      (`-32000`, not the retried `-32603`).
  11. Store the ID string exactly, never re-encoded, with `credentialKey` beside it, the key in the
      stored form, and the challenge's domain and origin in the row's existing `rpId` and
      `origin`.

  Refusals after rule 5 need a proven assertion, so an unproven caller learns nothing about names
  or credentials.
- **Recovery, before step 5 deploys.** The directory becomes the only record of an adopted
  account's passkey, as it already is for directory sign-ups.
  - Extend the `/data` snapshot item in the Production Checklist of `packages/agent/README.md`
    to say so, and to ask for a restore rehearsal before a release that adds adoption.
  - Take a consistent backup of `/data/agent.db`, restore it into a separate volume, and check
    that `passkey_credentials` keeps every row, its account index and `user_version` 9 (AC-13).
  - Keep the snapshot ID and restore details in the private recovery record, with only a dated
    summary in the release's operations receipt, as the 2.0.0 runbook does.
- **RED/GREEN**:
  - Refusals: a replay under another name, a wrong key, a mismatched ID in base64url and in hex,
    the same account under a second name, including with its key spelled another way (no `04`,
    upper case), the held name sent again with the ID in the other spelling, a taken name, the
    wrong site, an unadoptable domain, a hosted name held by another passkey, a hosted name
    submitted with the other spelling of its listed ID, a key that isn't a P-256 point, a
    completion for another name, domain or origin than its challenge's, and the hosted lookup
    down.
  - Completion runs through the real JSON-RPC route (`api/routes/passkey-directory.ts`) with the
    software passkey's JSON-encoded assertion and succeeds; a malformed field refuses.
  - A spoofed `rawId`, where an attacker's own assertion claims a victim's ID bytes, must neither
    block the victim's later adoption nor open anything.
  - Successes:
    - a hosted name held by this passkey;
    - the other spelling of a held passkey, as its own account, in either order: a fresh device
      adopts the hosted spelling, then the device that cached the legacy spelling adopts it
      under a new name, and each name signs in to its own address (step 1 tests the sign-in);
    - an identical retry after success, which returns the stored result;
    - a stored ID valid in both spellings, accepted through its base64url reading;
    - a hex stored ID, whose lookup then offers the assertion's `rawId` in base64url as
      `signingId`: the credential that was proven, not one the client named.
  - The rig ran every refusal except the domain, hosted, key-spelling, non-point key and
    challenge-binding cases, plus the two-spelling success and the spoofed `rawId`, all against
    its prototype (scenarios C, F and G of the
    [report](reports/2026-10-16-clean-room-proof-fifth-review.md)).
  - The prototype's pair-only index refused the other spelling under a second name. This plan
    now accepts it as its own account, so that case is a planned test, not rig evidence.

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
- **Hosted sign-in on its home site**, once the directory has answered that it doesn't hold the
  name:
  - Start `gg_startPasskeyAdoption` with the typed name and the page's host as the domain, at the
    same moment as the hosted lookup, never before it. A hosted passkey's domain is the host
    that made it, which on its home site is the page's host.
  - When the lookup answers, run the ceremony at once. Use the adoption challenge if it has
    already arrived. Otherwise use a locally made challenge and skip adoption for this sign-in.
  - Either way, check the assertion locally against the key the hosted server listed, as the
    directory path already does, and submit the completion in the background, in step 5's wire
    form.
  - This replaces the hosted server's `startAuthentication` and `verifyAuthentication`: the app
    no longer asks it for a challenge or a verdict. The local check covers the challenge,
    origin, RP ID hash, user presence and verification, and the signature against the listed
    key.
  - It does not cover the signature counter. It never reads bytes 33 to 36 of the authenticator
    data, and the hosted lookup returns no counter to compare. Whether the hosted verdict
    compares one, or checks anything else, is unverified, so the local check is not claimed as
    its equal. Decision 9 settles the counter.
  - So adoption adds no wait. The ceremony starts when the lookup answers, one hosted round trip
    sooner than today.
- **Only the hosted path merges**, because only it already waits on a lookup before the ceremony.
  "Use this device's passkey" and saved sessions adopt from step 7's button.
- **When the directory is down.** If the directory lookup failed earlier in the same sign-in,
  start no adoption and run today's hosted sign-in unchanged: the hosted server's
  `startAuthentication`, the ceremony and `verifyAuthentication`. R7 promises sign-in as today
  without the directory, and the hosted verdict may check more than the local check does.
- **When adoption fails.** An adoption failure is logged and tried again at a later sign-in,
  never shown as a sign-in failure.
- **Address guard.** Before sending, rebuild the Kernel address from the entry and compare it with
  the stored address. Send nothing on a mismatch.
- **Keys compare by point.** `authenticateWithServer` matches the cached key against the hosted
  one as lower-case strings (`authServices.ts:229`). A session that signed in through the
  directory caches the directory's `0x04` spelling, so compare x and y there, as `keyCoordinates`
  already does in the directory sign-in.
- **Signature counter (decision 9).** Whichever trigger adopts an account, its later sign-ins
  run the directory's local check, which doesn't read the counter today. With decision 9's
  default nothing more changes, and the spec lists the gap under risks. If decision 9 chooses
  tracking instead:
  - Step 3 adds a `signCount` column. Registration and adoption store the assertion's counter,
    and the lookup returns it.
  - Step 2's verifier refuses a counter that isn't above a nonzero stored one, as WebAuthn
    describes.
  - After a sign-in that reports a nonzero counter, the app sends the assertion to a new
    `gg_recordPasskeyCounter` beside step 5's calls. It runs step 2's check without the
    challenge and keeps the higher value. No fresh challenge is needed, because a replayed
    assertion only repeats a count that was already real.
  - The merged sign-in has nothing to compare, since the hosted lookup returns no counter, so
    tracking starts at adoption.
  - Tests: against a nonzero stored counter, the verifier refuses an equal one, a lower one and
    0, and accepts a higher one; it accepts 0 over 0. The record call never lowers the stored
    value and refuses another key's signature.
- **RED/GREEN** in `authServices.test.ts`:
  - With the adoption start held open (a promise that never settles), hosted sign-in starts its
    ceremony as soon as the hosted lookup answers. It uses a local challenge, calls neither
    `startAuthentication` nor `verifyAuthentication`, and sends no completion.
  - With the directory lookup failing, hosted sign-in calls `startAuthentication` and
    `verifyAuthentication` as today and starts no adoption.
  - A cached key and a hosted key that differ only in spelling still match, so the cached ID
    stays among the alternatives.
  - The local check refuses an assertion for another credential, one signed by a key other
    than the listed one, and one over a stale challenge.
  - With the challenge ready before the lookup answers, sign-in completes, and the background
    completion carries that challenge, the hosted account's exact ID string (not the browser
    ID), its key and the page's RP ID.
  - Assert the ID handed to Kernel, not a mocked address.
- This step runs only if decision 2 is accepted. Otherwise step 7 is the sole trigger.

### Step 7: One action for saved sessions (ui)

**Files**: a shared hook in `packages/shared/src/hooks/auth/` (for example
`usePasskeyAdoption.ts`), the client profile screen, `packages/admin/src/components/Layout/AccountProfilePanel.tsx`,
`packages/shared/src/i18n/{en,es,pt}.json`,
`packages/shared/src/__tests__/workflows/auth-passkey-adoption.test.ts`

- Show a row while the session's account has no directory entry: "Sign in on other Green Goods
  sites", with one button that runs the adoption prompt.
  - Look the name up and compare the entry with the session's account: the exact ID string and
    the key point, which together give its Kernel address. No entry, or an entry for another
    account, shows the row, including one for the other spelling of this passkey. An entry for
    this account hides it.
  - When another passkey holds the name (decision 5), the row asks for a new name.
  - Its start call carries the session's name and passkey domain (`cachedPasskeyRpId`).
  - After a successful adoption, the hook saves the adopted name, normalized, with
    `setStoredUsername`, so the next lookup asks for that name and the row stays hidden.
- **The button reports its own outcome.** Unlike step 6's background adoption, the person
  asked for this one.
  - While it runs, the button is busy and can't be pressed twice.
  - A dismissed or cancelled prompt returns the row to idle, with no error.
  - Offline, a start that times out, an unavailable hosted lookup (`-32000`) or any other
    refusal shows the `failed` copy and keeps the button, so the person can try again. Step
    10 logs the reason.
- Draft copy is in [spec.md](spec.md#draft-copy).
- **RED/GREEN** in a component test, with the shared hook mocked at its boundary:
  - The row appears for a passkey session without a directory entry, when another passkey
    holds its name, and when the entry holds the other spelling of this passkey. It stays
    hidden when the entry is this account's.
  - A taken name keeps the row and asks for another name.
  - Adopting under the new name succeeds, and the row disappears.
  - A cancelled prompt returns the row to idle without an error. Offline, a timed-out start
    and an unavailable hosted lookup show the `failed` copy, with the button still there.
- **RED/GREEN** for the hook itself, in `auth-passkey-adoption.test.ts`, with only the browser,
  the directory client and the session stubbed: a cached app-made credential goes through start,
  ceremony and completion.
  - The start carries the session's name and `cachedPasskeyRpId`, and the ceremony runs under
    that RP ID.
  - The completion carries the exact stored ID string and key, in step 5's wire form.
  - The address guard sends nothing for an entry that rebuilds another address.
  - After adopting under a new name, the stored username is that name, normalized. A remount
    looks it up and keeps the row hidden.
  - A cancelled ceremony sends no completion, and an unavailable hosted lookup comes back as a
    retryable failure.

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
`packages/shared/src/workflows/auth-passkey-directory.ts`,
`packages/shared/src/workflows/authServices.ts`,
`packages/shared/src/hooks/auth/login-error-message.ts`,
`packages/shared/src/i18n/{en,es,pt}.json`,
`packages/shared/src/__tests__/hooks/loginScreenMessages.test.ts`,
`packages/shared/src/__tests__/workflows/authServices.test.ts`,
`docs/docs/builders/integrations/passkey.mdx`

- When the hosted server lists the name and the ceremony is refused, show the "made on another
  site" copy instead of "Sign in was cancelled." WebAuthn reports a missing passkey and a
  dismissal the same way, so the copy must read true in both cases.
- The hosted server never says which site a passkey belongs to (step 4). Hosted accounts were made
  only on www and beta, with staging retired. So for an unadopted hosted name, the copy names the
  hosted sites other than the current one:
  - beta, when the person is on www;
  - www, when on beta;
  - both, anywhere else.
- On www and beta, either of which can be the account's home site, the refusal may only be a
  dismissed prompt. So the copy there (`otherSiteHome`) starts with "Try again here." before it
  names the other site. Elsewhere, such as admin, `otherSite` names both.
- A directory or adopted entry carries its domain, so the copy names that site exactly. When a
  cross-site ceremony fails with `SecurityError`, what the browser reported decides the copy:
  - `relatedOrigins: false`: the unsupported-browser copy, shown before any ceremony (next
    bullet).
  - `relatedOrigins: true`: the browser supports the feature, so the file or its list is wrong.
    Show the neutral `relatedOriginFailed` copy, which names the site and never says to update
    the browser.
  - No `getClientCapabilities()`: the cause can't be told apart, so the neutral copy too.
- **Carry the context to the copy.** Only the workflows know what the copy needs.
  `signInWithDirectory` knows the entry's domain before its ceremony, and `authenticateByName`
  knows that a refusal followed a hosted lookup that listed the name. Both wrap the ceremony's
  error in a typed sign-in error from `auth-passkey-errors.ts` that carries `hostedName`, the
  entry's `domain` when there is one, and the `relatedOrigins` result. `login-error-message.ts`
  maps that error to copy; a bare DOM exception keeps today's copy.
- A ceremony needs related origins only when the page's host is neither the entry's domain nor
  under it. Only then, and only where `PublicKeyCredential.getClientCapabilities()` exists,
  read `relatedOrigins` and show the copy without attempting the ceremony. A beta entry on beta
  and an apex entry on admin always go ahead.
- **The builder page.** `docs/docs/builders/integrations/passkey.mdx` still says older accounts
  stay on the hosted server and sign in as before. Rewrite that part for what ships:
  - an adopted account signs in by name through the directory, under its passkey's domain;
  - the related-origins file, which lets that passkey work on the other Green Goods sites in
    browsers that support it;
  - the hosted fallback: only for names the directory doesn't hold, checked locally on the home
    site, and today's flow whenever the directory is down.
  - Proof: render the root plan and run what it selects for docs, at least
    `bun run audit -- --ci` and `bun run build` from `docs/`.
- **RED/GREEN** in `loginScreenMessages.test.ts`, in en, es and pt: the copy for an unadopted
  hosted name on www and beta, which starts with "Try again here.", and on admin, and for an
  adopted beta entry on www. With
  `relatedOrigins: false`, a beta entry on beta and an apex entry on admin still run their
  ceremony. With `relatedOrigins: true` and a missing file (`SecurityError`), the neutral copy
  shows, never the update-your-browser copy. A `NotAllowedError` there keeps its own copy.
- **RED/GREEN** through the workflows, in `authServices.test.ts`: a hosted `NotAllowedError`
  reaches the message helper marked as a hosted name, and a directory `SecurityError` carries
  the entry's domain and the capability result.

### Step 10: Telemetry (state_api)

**Files**: `packages/shared/src/modules/app/analytics-events.ts` and its callers

- `auth_passkey_adoption_started`, `_success` and `_failed` (with a reason), plus two fields on
  `auth_passkey_login_failed`: `hosted_name` and `related_origin` (`unsupported`, `failed` or
  `unknown`, step 9's three cases), so a broken file shows up as `failed`. No names or keys.

### Step 11: Proof (qa)

- Rerun the clean-room rig ([artifacts/rig/README.md](artifacts/rig/README.md)) on the branch,
  with a www-bound hosted passkey added to scenario A: it adopts on www, then signs in by name
  on admin, which needs www's file.
- Authenticated device proof, which passkey signing requires (AGENTS.md, Browser Evidence), on
  Android Chrome and iPhone Safari. Afo runs it:
  1. A January-to-August-style account adopts on www, then signs in by name on admin.
  2. A September-style account, made on www through the hosted server, adopts on www, then
     signs in by name on admin once step 8 is live. That ceremony needs www's file, and it is
     the brief's success signal.
  3. A beta-bound passkey signs in on www once step 8 is live.
  4. Accounts 1 and 2 each sign a garden action on admin.

## Open Review Items

Afo's direction on 2026-10-17: review findings that arrive after #1111's thirteenth round are
recorded here for the implementation steps to settle, not fixed in this PR. Each names the step
it changes.

- **O1. An omitted capability is unknown (step 9, AC-6).** WebAuthn lets a browser leave the
  `relatedOrigins` key out of `getClientCapabilities()`, and absence means unknown. Treat an
  omitted key, or a query that rejects, like a missing method: attempt the ceremony, and on a
  cross-site `SecurityError` show the neutral copy, never the unsupported-browser copy. Add a test
  for the omitted key. Raised by Codex on `fa5cc950e`.
- **O2. A refusal the hook can read (steps 5 and 7).** `name_taken` and a hosted outage both
  answer `-32000` with only a message today, so the saved-session hook can't tell a taken name,
  which needs the rename, from a failure that needs a retry. Give adoption refusals a structured
  reason (`error.data.reason`) or distinct codes, and test both outcomes through the real client.
  Raised by Codex on `bf45b41ac`.
- **O3. Validate names at start and completion (step 5).** Run the directory's existing name
  check (`isRegistrablePasskeyName`: 3 to 64 characters, no control characters) in
  `gg_startPasskeyAdoption` and again at completion, with a route-level refusal test for an
  invalid name. Normalizing alone doesn't enforce it. Raised by Codex on `bf45b41ac`.
- **O4. App-made sign-ins and decision 2 (steps 6 and 7).** Step 6 leaves "Use this device's
  passkey" out of automatic adoption, but that is how a signed-out January-to-August account
  signs in. So that group, about 45 people, would still need the account-screen action, while
  decision 2's rationale says recent sign-ins need no extra step. Settle it with decision 2:
  adopt inside that sign-in too, with a test for the signed-out local-cache path, or narrow the
  promise. Raised by Codex on `bf45b41ac`.
- **O5. Prove the telemetry (step 10).** No acceptance check covers R9. Add workflow-level
  assertions that background adoption, the saved-session action and typed related-origin
  failures emit `auth_passkey_adoption_started`, `_success` and categorized `_failed`, plus
  `hosted_name` and `related_origin`, and that no name, credential ID or key enters a payload.
  Raised by Codex on `bf45b41ac`.
- **O6. The challenge's wire form (steps 5 and 6).** The start response crosses JSON-RPC, which
  has no byte type, and `navigator.credentials.get` needs the exact bytes. Return the challenge in
  base64url, decode it in the adoption client, and test start through completion over the real
  JSON-RPC transport. Raised by Codex on `bf45b41ac`.

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

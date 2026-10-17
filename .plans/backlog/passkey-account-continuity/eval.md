# Keep Older Passkey Accounts Working on Every Site Evaluation Plan

## Release Gates

1. **Correctness.** An adopted account opens at the same address on every site its passkey can
   reach, and the deployed WebAuthn validator accepts its signatures there.
2. **Safety.** Adoption refuses every case in AC-3. No name, key or credential ID reaches a log.
3. **Regression safety.** Directory sign-up and sign-in, hosted sign-in on its home site, session
   restore and signing behave as before. Sign-in never waits on adoption. Hosted sign-in's local
   check doesn't read the signature counter (AC-12).
4. **Evidence quality.** Every claim carries its evidence label: clean-room Chromium with a
   virtual authenticator, authenticated device, or a read-only `eth_call`.
5. **Human judgment.** Decisions 1 to 7 and 9 in [plan.todo.md](plan.todo.md) are answered before
   any step starts. Shared auth and the agent directory keep the critical override.
6. **Recovery.** AC-13 passes before step 5 deploys, because adoption makes the directory the
   only record of more accounts.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Directory sign-in, hex stored ID | An entry whose `id` is hex signs in, and the session keeps that string as the Kernel identity | `state_api` | RED today: `NotAllowedError` on beta and www (clean-room report, scenario A). Unit test after step 1. |
| AC-2 | Adoption, success | A remembered passkey is adopted on the site where it works. Sign-in by name then succeeds on admin and beta with the same address. The completion's JSON-encoded assertion is decoded at the route and verifies. | `state_api` | Prototype passed (scenario C, address check D). Agent and shared tests after steps 5 and 6. |
| AC-3 | Adoption, refusals and retries | Refused: a replay under another name, a wrong key, a submitted ID whose bytes differ from the assertion (base64url and hex), the same credential under a second name in the other spelling, the held name sent again with the ID in the other spelling, a taken name, the wrong site, an unadoptable domain, a hosted name held by a different passkey, a hosted name submitted with the other spelling of its listed ID, the hosted lookup down, the same credential under a second name with its key spelled another way (no `04`, upper case), a key that isn't a P-256 point, a completion for another name, domain or origin than its challenge's, and a malformed assertion field. An identical retry after success returns the stored result. Accepted: a stored ID valid in both spellings, through its base64url reading. A hex stored ID's lookup offers the assertion's `rawId` in base64url as `signingId`. A spoofed `rawId`, claiming someone else's ID bytes with the claimer's key, may be stored as its own entry, but never blocks that person's own adoption and never opens anything. | `state_api` | The prototype refused the first seven, returned the stored result for the retry, accepted the two-spelling ID, and kept the spoof harmless (scenarios C, A, F and G). Route tests after step 5 cover every case. |
| AC-4 | Related origins | A hosted beta account adopts on beta. With the file on beta, sign-in by name then works on www and admin, and the passkey signs a user operation on each. Without the file, or with www missing, Chrome refuses. | `ui` | Passed in clean-room Chromium: adopted on beta, then signed in by name through the prototype directory on both sites, with signatures from both validated (scenarios A and E); controls refused. Smoke check and device walk after step 8. |
| AC-5 | On-chain acceptance | Signatures made through related origins and after adoption validate against Arbitrum's deployed validator; a tampered hash does not | `state_api` | Passed via read-only `eth_call` with a state override (scenario E). Rerun on the branch. |
| AC-6 | Copy and builder docs | Wrong-site and unsupported-browser failures show the new copy in en, es and pt. The unsupported-browser copy appears only when the ceremony needs related origins: with `relatedOrigins: false`, a beta entry on beta and an apex entry on admin go ahead. The account row and its done message promise other sites only in browsers that allow it and on devices that have the passkey. The builder passkey page describes adoption, related origins and the hosted fallback. With `relatedOrigins: true` and a missing file, the neutral copy shows instead of the update-your-browser copy. | `ui` | Unit tests after step 9, plus the docs audit and build |
| AC-7 | Saved sessions | The account row shows only for passkey sessions without a directory entry. A taken name keeps the row and asks for another name, and adopting under the new name succeeds. The row disappears after adoption. | `ui` | Component test and Storybook after step 7 |
| AC-8 | QA review | The full journey on Android Chrome and iPhone Safari, including a September www account that adopts on www, signs in on admin and signs a garden action (the brief's success signal) | `qa_pass_1` | Authenticated device proof (step 11) |
| AC-9 | Regression review | Existing passkey specs and auth tests pass, and the critical gate is green | `qa_pass_2` | `node scripts/dev/ci-local.js --intent push` receipts |
| AC-10 | Sign-in and adoption race | With the adoption start held open, hosted sign-in starts its ceremony when the hosted lookup answers, makes no retry, and sends no completion. With the challenge ready first, the background completion carries that challenge and the hosted account's exact ID, key and RP ID. After a directory answer, hosted `startAuthentication` and `verifyAuthentication` are no longer called; after a failed directory lookup, both run as today and no adoption starts. The local check refuses another credential, another key and a stale challenge. A cached key and a hosted key that differ only in spelling still match. | `state_api` | Unit tests for both orders after step 6. Not measured in the rig. |
| AC-11 | Store upgrade | A v2.0.1 database gains the new columns with defaults and backfill. It is rebuilt with a unique `(credentialKey, publicKey)` pair in place of the string-only `credentialId` constraint, keeps its passkeys and pending challenges, and moves `user_version` from 8 to 9. A second `initSchema` changes nothing, and a registration after the upgrade writes `credentialKey`. | `state_api` | `storage.sqlite.test.ts` after step 3 |
| AC-12 | Signature counter (decision 9) | By default, the local check that replaces the hosted verdict doesn't read the counter, and the spec lists that under risks. If decision 9 chooses tracking: a counter that isn't above a nonzero stored one is refused (0 included), 0 over 0 is accepted, adoption stores the counter, and the record call never lowers it or accepts another key's signature. | `state_api` | Not measured in the rig. Unit and route tests after steps 2, 5 and 6, only if tracking is chosen. |
| AC-13 | Directory recovery | Before step 5 deploys, the agent's Production Checklist says the directory is the only record of adopted passkeys, and a consistent backup restored into a separate volume keeps every `passkey_credentials` row, its pair index and `user_version` 9. | `qa_pass_2` | Afo runs it. The private recovery record keeps the details, and the release's operations receipt a dated summary. |

## Test Strategy

- **Unit (shared):**
  - directory sign-in with hex and base64url IDs;
  - the verifier at its new home;
  - the verifier's counter rule, only if decision 9 chooses tracking (AC-12);
  - the adoption client's address guard, its silent failure, and its no-wait rule with a
    never-settling start (AC-10);
  - the outage path, which keeps today's hosted calls, and key matching by point (AC-10);
  - error copy per site, including a related-origins failure in a browser that reported
    support.
- **Unit and route (agent):**
  - the adoption rules with a software passkey that makes assertions, sent as JSON through the
    real JSON-RPC route, including mismatched IDs in both spellings and an identical retry;
  - the store rules for both stores, including uniqueness across ID and key spellings and a
    registration after the upgrade;
  - the v2.0.1 upgrade and the move to `user_version` 9 in `storage.sqlite.test.ts` (AC-11);
  - the hosted lookup with a stubbed fetch;
  - the counter record call, only if decision 9 chooses tracking (AC-12).
- **Docs:** after step 9, `bun run audit -- --ci` and `bun run build` from `docs/` (AC-6).
- **Operations:** the restore rehearsal before step 5 deploys (AC-13).
- **Integration:** the clean-room rig in [artifacts/rig/](artifacts/rig/README.md), rerun on the
  branch. Cross-site ceremonies need real hostnames on the default port, so this stays a
  scripted manual proof rather than a CI test (proof limit).
- **E2E / Playwright:** extend `tests/specs/client.passkey.spec.ts` only for adoption on a single
  origin, which a virtual authenticator can cover in CI.
- **Manual:** authenticated device proof (AC-8); Afo runs it.
- **TDD proof:** RED and GREEN commands and evidence are recorded in lane handoffs and summarized
  in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Walk the journeys in AC-2, AC-4 and AC-7 on devices, and check the copy in all three languages.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` passes.
- Re-run the rig and the critical gate, then close the loop on remaining defects.

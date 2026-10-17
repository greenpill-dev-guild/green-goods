# Clean-room proof after the fifth review: related origins and adoption (2026-10-16)

**Evidence label:** clean-room Chromium, virtual authenticator. Signature checks are read-only
`eth_call`s against Arbitrum One. This is not authenticated-device proof; plan step 11 owns that.

**Supersedes** [2026-10-16-clean-room-proof-third-review.md](2026-10-16-clean-room-proof-third-review.md)
as the plan's current evidence. That report superseded the second-review, after-review and
first reports of the same day. The fourth review changed only plan text, so it has no run.

Since the third-review run:
- The prototype keys credential uniqueness on the ID bytes and the proven public key together.
  An assertion's signature does not cover `rawId`, so ID bytes alone are whatever a client
  claims.
- Scenario A now follows the hosted account's real journey. A saved session on beta adopts
  first. Sign-in by name on beta, www and admin then goes through the prototype directory,
  instead of a fixed entry handed to the sign-in code.
- A new scenario G has an attacker sign with their own passkey while claiming a victim's ID.

On every check the runs share, the outcome is unchanged. All earlier reports stay as written.

## Setup

- Headless Chromium 148.0.7778.96 (Playwright 1.60.0) with a CDP virtual authenticator: ctap2,
  internal transport, resident key, user verification on.
- Pages served on `beta.greengoods.app`, `www.greengoods.app` and `admin.greengoods.app` over a
  local CONNECT proxy, so hostnames and port 443 are real to the browser. The certificate was a
  throwaway, pinned by its SPKI hash, and deleted afterwards. Nothing outside `greengoods.app` was
  tunnelled.
- Code under test: this PR branch on develop `af1f9cb2c`. Every passkey module the page imports
  is identical to `origin/main` `1e79fcf1e` (v2.0.1+); `git diff --stat` is empty for those files.
- Run at 2026-10-16T23:54Z. This report and
  [results-2026-10-16-fifth-review.json](../artifacts/rig/results-2026-10-16-fifth-review.json)
  come from that single run.
- Before the run, the control server answered `?ror=of` with 400 `bad_mode` and a bare `/mode`
  with `off`.
- The rig: [artifacts/rig/](../artifacts/rig/README.md).

## Results

### A: a beta-bound passkey with `/.well-known/webauthn` on beta listing every origin

- The device holds one resident passkey for `beta.greengoods.app`.
- A saved session on beta, holding that passkey as a hosted session does, adopted it first. The
  prototype directory then held the name with the domain `beta.greengoods.app`.
- `signInWithDirectory` then signed in by name through that directory on beta, on www and on
  admin. Every ceremony on www and admin made the browser fetch beta's file (six fetches logged).
- Kernel-encoded user-operation signatures validated in scenario E: one made on beta, one on www
  and one on admin, all under `beta.greengoods.app`.
- The same passkey handed to the sign-in code as a fixed entry with its ID in hex form failed
  with `NotAllowedError` on beta and on www.
  `signInWithDirectory` passes `signingId: credential.id`, which skips the hex branch of
  `getPasskeyRequestIds` (plan step 1).
- Adoption attempted from www for the beta passkey was refused as `wrong_site`, by design.

### A′: controls on www

- Without the file, Chrome threw `SecurityError`: "…an attempt to fetch the .well-known/webauthn
  resource of the claimed RP ID failed."
- With a file that omits www, Chrome threw `SecurityError`: "…fetching the .well-known/webauthn
  resource of the claimed RP ID was successful, but no listed origin matched the caller."

### C: an app-made passkey from the local path, adopted on www

- `createPasskey` stored the credential and the domain `greengoods.app`. The device's passkey
  carries the same domain.
- **Prototype check order** (the order plan step 5 specifies):
  1. Spend the challenge.
  2. Match either reading of the submitted ID to the assertion's `rawId`.
  3. Verify the assertion with the app's own checker.
  4. Apply the challenge verdict, the name rule, and uniqueness on the assertion's ID bytes and
     proven key together.

  An identical completion returns the stored result. Identical means the same name, the exact
  same ID string, the same credential bytes and the same key.
- Outcomes:

  | Attempt | Result |
  |---|---|
  | Adopt the remembered passkey under its name | adopted |
  | The identical request again (a lost response, retried) | the stored result (`alreadyAdopted`) |
  | The same answer under another name | `challenge_expired` |
  | Another account's public key | `verification_failed` |
  | Another credential's ID, base64url | `credential_mismatch` |
  | Another credential's ID, hex | `credential_mismatch` |
  | This passkey under a second name, its ID spelled in hex | `credential_exists` |
  | This passkey under the name it holds, its ID spelled in hex | `name_taken`, not the stored result |
  | A different passkey asking for the held name | `name_taken` |

- On admin, the browser remembered nothing, yet sign-in by name through the directory succeeded.
  It also succeeded on beta.
- A signature from admin validated (scenario E).
- `@simplewebauthn/server` 13.3.3, loaded as ESM under Bun from the agent package, threw "Cannot
  get schema for 'ECDSASigValue' target" on every assertion. `bun.lock` hoists
  `@peculiar/asn1-schema` 2.6.0 for it, while `@peculiar/asn1-ecc` 2.10.0 registers its schema in
  its own 2.10.0 copy. The prototype therefore decided with the app's verifier (plan decision 3,
  follow-up F1).

### F: a stored ID that is valid in both spellings

- The runner put a passkey for `greengoods.app` on the authenticator through
  `WebAuthn.addCredential`, with ID bytes whose canonical base64url is
  `deadbeefcafe0123456789abcdef0123` and a key it generated.
- That string also reads as hex: 16 bytes as hex, 24 as base64url, and the authenticator holds
  the 24.
- The page remembered it as a session does, with no browser ID stored.
- Adoption on www succeeded through the base64url reading, and an identical retry returned the
  stored result.
- Sign-in by name on admin succeeded with that ID. A reader that always took the hex reading would
  have refused this legitimate passkey as `credential_mismatch`.

### G: a spoofed `rawId`

- On www, a victim's app-made passkey was remembered by the page. A separate attacker passkey,
  with a known key, was added to the authenticator.
- The attacker signed a fresh adoption challenge with their own passkey, then rewrote the
  assertion's `id` and `rawId` to the victim's credential. They submitted it under the name
  `squatter` with their own key.
- The signature does not cover `rawId`, so the claim passed the ID match and the signature check.
  The prototype stored it as its own pair: the victim's ID bytes with the attacker's key.
- The victim then adopted under their own name, and it succeeded. With uniqueness on ID bytes
  alone, the squat would have refused them as `credential_exists`.
- On admin, the victim signed in by name. Signing in as `squatter` failed closed ("Passkey
  server authentication failed"): the entry asks for the victim's credential, and the local
  check rejects that signature against the attacker's key.

### D: same account

The Kernel 0.3.1 address derived from the stored credential and the one derived from the adopted
entry were equal (`0x2b36a1677182333084EBdEC2bf63b3CbF1a0bDF2`, from a throwaway key), via
`arb1.arbitrum.io`.

### E: the deployed validator

`isValidSignatureWithSender` on `0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd`, run as an
`eth_call` with the test key written into the validator's storage slot by state override:

| Signature | Result | Same signature over another hash |
|---|---|---|
| Beta passkey, signed on beta | `0x1626ba7e` (valid) | `0xffffffff` |
| Beta passkey, signed on www through related origins | `0x1626ba7e` (valid) | `0xffffffff` |
| Beta passkey, signed on admin through related origins | `0x1626ba7e` (valid) | `0xffffffff` |
| Adopted apex passkey, signed on admin | `0x1626ba7e` (valid) | `0xffffffff` |

This matches the validator source, which checks neither the origin nor the RP ID hash.

## Live checks the same day

- `/.well-known/webauthn` on www and beta answers 200 `text/html` with the app shell, because of
  the client's catch-all rewrite.
- `/.well-known/assetlinks.json` on www answers `application/json`.

## Not covered

- Real devices: Android Credential Manager and iCloud Keychain behaviour, passkey sync, and the
  installed apps.
- Browsers other than Chromium; WebKit has no virtual authenticator in Playwright.
- The agent's real adoption code, which does not exist yet. This run used a prototype with the
  rules plan step 5 specifies.
- Timing: no latency was measured. Plan step 6's no-delay rule and its timeouts need their own
  tests.
- Production data: no production write was made.

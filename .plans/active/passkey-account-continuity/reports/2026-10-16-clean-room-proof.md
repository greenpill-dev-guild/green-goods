# Clean-room proof: related origins and adoption (2026-10-16)

**Evidence label:** clean-room Chromium, virtual authenticator. Signature checks are read-only
`eth_call`s against Arbitrum One. This is not authenticated-device proof; plan step 11 owns that.

## Setup

- Headless Chromium 148.0.7778.96 (Playwright 1.60.0) with a CDP virtual authenticator: ctap2,
  internal transport, resident key, user verification on.
- Pages served on `beta.greengoods.app`, `www.greengoods.app` and `admin.greengoods.app` over a
  local CONNECT proxy, so hostnames and port 443 are real to the browser. The certificate was a
  throwaway, pinned by its SPKI hash, and deleted afterwards. Nothing outside `greengoods.app` was
  tunnelled.
- Code under test: this checkout's HEAD `06a31dbf5`. Every passkey module the page imports is
  identical to `origin/main` `1e79fcf1e` (v2.0.1+; `git diff --stat` empty for those files).
- The rig and its raw output: [artifacts/rig/](../artifacts/rig/README.md) and
  [results-2026-10-16.json](../artifacts/rig/results-2026-10-16.json).

## Results

### A: a beta-bound passkey with `/.well-known/webauthn` on beta listing every origin

- The device holds one resident passkey for `beta.greengoods.app`.
- `signInWithDirectory` succeeded on beta, on www and on admin. Each sign-in on www and admin made
  the browser fetch beta's file (five fetches logged).
- A Kernel-encoded user-operation signature made on www under `beta.greengoods.app` validated
  (scenario E).
- The same entry with its ID in hex form failed with `NotAllowedError` on beta and on www.
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
- Adoption (prototype directory, the app's own assertion check) succeeded.
- Refusals:

  | Attempt | Refused as |
  |---|---|
  | Replaying the same assertion | `challenge_expired` |
  | Another account's public key | `verification_failed` |
  | Adopting the name again | `name_taken` |

- On admin, the browser remembered nothing, yet sign-in by name through the directory succeeded.
  It also succeeded on beta.
- A signature from admin validated (scenario E).
- `@simplewebauthn/server` 13.3.3, loaded as ESM under Bun from the agent package, threw "Cannot
  get schema for 'ECDSASigValue' target" on every assertion. `bun.lock` hoists
  `@peculiar/asn1-schema` 2.6.0 for it, while `@peculiar/asn1-ecc` 2.10.0 registers its schema in
  its own 2.10.0 copy. The prototype therefore decided with the app's verifier (plan decision 3,
  follow-up F1).

### D: same account

The Kernel 0.3.1 address derived from the stored credential and the one derived from the adopted
entry were equal (`0x4B49…53Db`, a throwaway key), via `arb1.arbitrum.io`.

### E: the deployed validator

`isValidSignatureWithSender` on `0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd`, run as an
`eth_call` with the test key written into the validator's storage slot by state override:

| Signature | Result | Same signature over another hash |
|---|---|---|
| Beta passkey, signed on beta | `0x1626ba7e` (valid) | `0xffffffff` |
| Beta passkey, signed on www through related origins | `0x1626ba7e` (valid) | `0xffffffff` |
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
- The agent's real adoption code, which does not exist yet; this run used a prototype.
- Production data: no production write was made.

# Keep Older Passkey Accounts Working on Every Site Spec

## Summary

Older passkey accounts get the reach that directory accounts have, without becoming new accounts.
Two mechanisms do it. **Adoption** adds an older account to the directory under its name, keyed to
the same credential and public key, after the person proves on a fresh challenge that they hold
the passkey. **Related origins** (`/.well-known/webauthn`) let a browser use a passkey tied to
`www.greengoods.app` or `beta.greengoods.app` on the other Green Goods sites. The account address
follows the passkey's key and credential ID, never the name or the site, so neither mechanism
moves anyone.

## Users

Counts are one-off reads of PostHog sign-ups in the app project, taken 2026-10-16. They are
people per month, summed.

| Group | Made | Passkey domain | Account record | Opens today | People |
|---|---|---|---|---|---|
| App-made | Jan to early Aug 2026, www | `greengoods.app` | Only in the creating browser's storage | In that browser, on www | ~45 |
| Hosted, www | Aug to 13 Oct 2026 | `www.greengoods.app` | Hosted server (name, ID, key) | www and its installed app, on any device the passkey syncs to | ~15 |
| Hosted, beta | Sep to 5 Oct 2026 | `beta.greengoods.app` | Hosted server | beta only | 8 |
| Hosted, staging | Jun to Jul 2026 | `staging.greengoods.app` | Hosted server, which stopped accepting the origin (probed 4 Oct) | A saved session only | 3 |
| Directory | From 14 Oct 2026 | `greengoods.app` | Directory | Every Green Goods site | 1 |

In the 30 days to 2026-10-16, 6 people used a passkey session on www and 3 on beta.

- **Primary:** gardeners and operators in the older groups who want another site or device.
- **Secondary:** stewards, who otherwise re-add moved accounts to gardens; Afo, who handles the
  support requests.

## How it works today (v2.0.1)

- **Sign-up** goes to the directory, which issues `greengoods.app` (`PASSKEY_RP_ID`) to https
  pages under it (`packages/agent/src/services/passkey-directory.ts`).
- **Sign-in by name** asks the directory first (`signInWithDirectory`: lookup, in-page ceremony
  under the entry's domain, local signature check). When the name isn't there, it falls back to
  the hosted server, whose options name the page's own host (`authenticateWithServer` in
  `packages/shared/src/workflows/authServices.ts`). On the wrong site the device has no passkey for
  that host. The prompt fails with `NotAllowedError`, and the app shows "Sign in was cancelled."
- **A saved session** restores with no ceremony. Signing uses the stored domain, or the site's
  hostname when none was stored (`cachedPasskeyRpId`).
- **"Use this device's passkey"** signs in from the remembered credential, and is the only way
  in for the app-made group.

## Functional Requirements

1. **R1 Adoption.** A person whose older account works on the current site can add it to the
   directory. They prove possession with an assertion over a single-use directory challenge. The
   entry keeps the stored credential ID string exactly, the browser's credential ID, the public
   key, the passkey's domain and the origin it was adopted from.
2. **R2 Hosted names keep their owner.** A name the hosted server holds can be adopted only by the
   passkey the hosted server lists for it. That takes the same public key and the listed ID string
   exactly; matching bytes are not enough, because the account's address follows that string.
3. **R3 Taken remembered names.** An app-made account whose remembered name is now taken, in
   either list, is asked for another name. The account does not change.
4. **R4 Hex IDs.** Directory sign-in names a passkey whose stored ID is hex, as some hosted
   accounts are.
5. **R5 Related origins.** A host-bound passkey signs in and signs on every Green Goods site in a
   browser that supports related origin requests, once its account is in the directory with its
   domain. That happens when it is adopted on its home site. An unadopted hosted account's lookup
   carries no domain, so the file alone can't help it.
6. **R6 Clear failures.** On the wrong site, or in a browser without related-origin support when
   the ceremony needs them (the page's host is neither the passkey's domain nor under it), the
   app replaces "Sign in was cancelled." with where the passkey works:
   - The exact site, when the entry carries its domain (directory and adopted entries).
   - The sites it may have been made on, for an unadopted hosted name, whose lookup carries no
     domain.
   - Neutral copy that names the site, when the browser reported related-origin support and
     the ceremony still failed. It never tells the person to update a browser that works.
7. **R7 Sign-in first.** Adoption never blocks, delays or fails a sign-in:
   - Its calls run beside the hosted lookup, never before the ceremony.
   - They are never retried. The start call has a 3-second timeout, and the background
     completion has 10 seconds.
   - Without the directory, including when its lookup fails, sign-in runs as today, with the
     hosted server's own challenge and verdict.
8. **R8 Same account.** Adoption sends nothing unless the entry rebuilds the session's own
   address.
9. **R9 Telemetry.** Adoption outcomes, plus off-site hosted failures, are measurable without
   names, keys or IDs.

## Design

### Adoption inside sign-in (decision 2)

```mermaid
sequenceDiagram
  participant App as App (home site)
  participant Hosted as Hosted passkey server
  participant Dir as Directory (agent)
  participant Device as Device passkey
  par Lookup and challenge at the same moment
    App->>Hosted: pks_getCredentials(name)
    Hosted-->>App: id, public key
  and
    App->>Dir: gg_startPasskeyAdoption (3 s timeout, no retry)
    Dir-->>App: challenge, if it arrives in time
  end
  App->>Device: get(adoption challenge if it arrived, else a local one; this host)
  Device-->>App: assertion
  App->>App: check assertion against the listed key, open the session
  opt Only when the adoption challenge was used
    App-)Dir: gg_completePasskeyAdoption(name, ids, key, domain, assertion) (10 s, no retry)
    Dir->>Hosted: same passkey under this name?
    Dir-->>App: adopted, the stored result for a retry, or a refusal the app logs
  end
```

The person sees one passkey prompt, as today. It starts as soon as the hosted lookup answers, one
hosted round trip sooner than today. The hosted server's own start and verify calls are replaced
by a local check against the listed key, the check the directory path already runs. That check
doesn't read the signature counter, which the hosted verdict may compare (decision 9). A
challenge that hasn't arrived by then is dropped, and the sign-in goes ahead without adoption.
Their next sign-in by name on any site finds the directory entry first.

Only the hosted path merges, because it is the one that already waits on a lookup before its
ceremony. It merges only after the directory has answered that it doesn't hold the name. When
the directory lookup fails, sign-in takes today's hosted path, the hosted start and verify calls
included. A saved session, or "Use this device's passkey" (the only way in for the app-made
group), adopts from a button in the account screen (decision 6).

### Related origins (decision 4)

The browser fetches `https://<passkey domain>/.well-known/webauthn` and continues only if it lists
the calling origin. www and beta are the client project's production and beta deployments, so one
static file in `packages/client/public/.well-known/` serves both, and staging inherits it from beta.
With an adopted entry, the existing directory sign-in already runs the ceremony under the entry's
domain, and its local check compares the page origin and the domain hash. The rig ran it unchanged.

### Contract changes

- `PasskeyDirectoryCredential` gains optional `signingId`, which the lookup fills from the stored
  `credentialKey`. `id` stays the Kernel identity input.
- **New RPC methods.** `gg_startPasskeyAdoption` and `gg_completePasskeyAdoption` run on the
  existing `/public/passkeys/rpc` route, with the same origin allowlist and the registration
  rate-limit class.
  - The start takes the name and the passkey's domain. Its challenge is stored with both and the
    origin, and completion must match all three.
  - Completion takes no browser ID; the agent derives it from the assertion's `rawId`. It
    rewrites the key into the stored form, `0x04` then lowercase x and y.
  - The assertion travels as base64url JSON. The route decodes it into the shared check's byte
    input and refuses a malformed field.
  - Completion is idempotent. A request with the same name, exact ID string, credential bytes
    and key as a stored entry returns that entry's result. The ID string must match exactly,
    because Kernel hashes it.
  - When the hosted lookup is down, completion answers with a code viem does not retry.
- **Adoption client.** The app calls these methods through its own client, with no transport
  retry.
  - The start call sits beside sign-in, so it gets 3 seconds.
  - The completion runs in the background, so it gets 10 seconds. That outlasts the agent's
    4-second hosted lookup.
- **Store.**
  - New columns: `credentialKey` (the credential's bytes in base64url, taken from the
    assertion's `rawId`; unique only together with `publicKey`, which every row stores in one
    spelling) and `source` (`registered` or `adopted`), plus a challenge `purpose`.
  - All are added with `ensureColumn`. Existing rows are backfilled by copying `credentialId`, and
    every new row writes `credentialKey`: a registration from its credential ID, an adoption
    from `rawId`.
  - The table is rebuilt once to drop the string-only unique constraint on `credentialId`.
  - `initSchema` then sets `user_version` 9, up from 8.

### Draft copy

The login screen says "passkey" in Spanish and Portuguese, so these drafts do too. The admin
screens say "clave de acceso" and "chave de acesso"; that mismatch predates this plan.

| Key (proposed) | en | es | pt |
|---|---|---|---|
| `app.account.passkeyEverywhere.title` | Sign in on other Green Goods sites | Inicia sesión en otros sitios de Green Goods | Entre em outros sites do Green Goods |
| `app.account.passkeyEverywhere.body` | Your passkey works here. Turn this on to sign in by name, with the same account, on other Green Goods sites: in browsers that allow it, and on devices that have this passkey. | Tu passkey funciona aquí. Activa esto para iniciar sesión con tu nombre, con la misma cuenta, en otros sitios de Green Goods: en los navegadores que lo permiten y en los dispositivos que tienen esta passkey. | Sua passkey funciona aqui. Ative isto para entrar com seu nome, com a mesma conta, em outros sites do Green Goods: nos navegadores que permitem isso e nos dispositivos que têm esta passkey. |
| `app.account.passkeyEverywhere.action` | Turn on | Activar | Ativar |
| `app.account.passkeyEverywhere.done` | Done. You can sign in with {name} on other Green Goods sites, in browsers that allow it, from any device that has this passkey. | Listo. Puedes iniciar sesión con {name} en otros sitios de Green Goods, en los navegadores que lo permiten, desde cualquier dispositivo que tenga esta passkey. | Pronto. Você pode entrar com {name} em outros sites do Green Goods, nos navegadores que permitem isso, de qualquer dispositivo que tenha esta passkey. |
| `app.account.passkeyEverywhere.nameTaken` | {name} is taken. Choose another name to sign in with. Your account stays the same. | {name} ya está en uso. Elige otro nombre para iniciar sesión. Tu cuenta no cambia. | {name} já está em uso. Escolha outro nome para entrar. Sua conta continua a mesma. |
| `app.login.error.otherSite` | Sign in didn't finish. If you made this account on {sites}, sign in there once. After that it can work on other Green Goods sites too. | No se completó el inicio de sesión. Si creaste esta cuenta en {sites}, inicia sesión allí una vez. Después podrá funcionar también en otros sitios de Green Goods. | O login não foi concluído. Se você criou esta conta em {sites}, entre lá uma vez. Depois ela poderá funcionar também em outros sites do Green Goods. |
| `app.login.error.relatedOriginUnsupported` | This browser can't use your passkey here. Sign in on {site} instead, or update your browser. | Este navegador no puede usar tu passkey aquí. Inicia sesión en {site} o actualiza tu navegador. | Este navegador não consegue usar sua passkey aqui. Entre em {site} ou atualize seu navegador. |
| `app.login.error.relatedOriginFailed` | Your passkey couldn't be used on this site just now. Sign in on {site} instead. | No se pudo usar tu passkey en este sitio en este momento. Inicia sesión en {site}. | Não foi possível usar sua passkey neste site agora. Entre em {site}. |

- `{sites}` lists the hosted sites other than the current one: `beta.greengoods.app` on www,
  `www.greengoods.app` on beta, and both, joined by "or", anywhere else. The hosted lookup carries
  no domain (plan step 4), so the copy can only name where hosted accounts were made.
- `{site}` is the exact domain a directory or adopted entry carries.
- The row and its done message promise no more than adoption gives. A passkey made for one site
  reaches the others only in a browser with related-origin support, and adoption puts no
  passkey on a device it hasn't synced to.
- If decision 2 is declined, `app.login.error.otherSite` reads instead "Sign in didn't finish. If
  you made this account on {sites}, sign in there and turn on Sign in on other Green Goods
  sites."

## Research Evidence

- **Clean-room proof (2026-10-16):** [reports/2026-10-16-clean-room-proof-fifth-review.md](reports/2026-10-16-clean-room-proof-fifth-review.md), which supersedes the four
  earlier reports of the same day.
  Headless Chromium 148 with a CDP virtual authenticator, the real hostnames on the default port
  through a local proxy, and the app's own sign-in, verifier, signing owner and Kernel encoding.
  Signatures were checked against the deployed validator with a read-only `eth_call`.
- **Validator source:** WebAuthn validator `0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd` on
  Arbitrum One (verified source). Its `WebAuthn.verifySignature` checks the flags, the response
  type, the challenge and the P-256 signature. It states that it does not check the origin, the
  RP ID hash or the signature counter.
- **Signature counter:** the app's verifier (`modules/auth/passkey-assertion.ts`) reads no
  counter, the directory store keeps none, and the hosted lookup returns only an ID and a key
  (`PasskeyServerCredential` in `authServices.ts`). Synced passkeys from Apple and Google report
  0 on every sign-in. That rests on secondary sources
  ([uzyn, 2025](https://uzyn.com/2025/passkey-has-a-theft-detection-feature-but-big-tech-broke-it/),
  [MojoAuth](https://mojoauth.com/blog/signcount-is-dead-why-passkey-clone-detection-doesnt-work-anymore));
  none is first-party. [WebAuthn](https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion)
  compares counters only when either value is nonzero, and leaves refusal to the relying party.
- **Live probes (2026-10-16):** the www, beta, admin and beta.admin bundles all carry the directory
  client. The agent accepts the apex, www, beta, staging, admin, beta.admin and staging-admin
  origins and refuses other subdomains. `/.well-known/webauthn` on www and beta answers 200
  `text/html` (the app shell, via the catch-all rewrite), while `/.well-known/assetlinks.json`
  answers `application/json`.
- **Lockfile:** `bun.lock` hoists `@peculiar/asn1-schema` 2.6.0, which `@simplewebauthn/server`
  13.3.3 uses. `@peculiar/asn1-ecc` 2.10.0 and its siblings require `^2.10.0`. In the rig the
  library threw "Cannot get schema for 'ECDSASigValue' target" on every assertion, loaded as ESM
  under Bun from the agent package, as the agent loads it.
- **Browser support for related origin requests:** see the next section.
- **Code reviewed:** `authServices.ts`, `auth-passkey-directory.ts`, `auth-passkey-adapters.ts`,
  `auth-passkey-ids.ts`, `modules/auth/session.ts`, `modules/auth/passkey-assertion.ts`,
  `config/passkeyServer.ts` (shared); `passkey-directory.ts`, `passkey-directory-adapters.ts`,
  `db/passkey-directory.ts`, `api/routes/passkey-directory.ts` (agent);
  `packages/client/vercel.json`; permissionless 0.2.57 Kernel signature encoding
  (`accounts/kernel/utils/signMessage.js`).
- **Open inferences:** that the app-made group's passkeys carry the apex rests on code reading
  plus the fact that they signed on 1.2, which signed under the apex. That the staging accounts
  are team tests is unconfirmed. Device behaviour on Android and iPhone is unproven.

### Browser support for related origin requests

Checked 2026-10-16.

| Platform | Support | Source |
|---|---|---|
| Android | Chrome and Edge 128+, Firefox 152+ | [passkeys.dev device support](https://passkeys.dev/device-support/) |
| iPhone and iPad | iOS and iPadOS 18+ (every iOS browser uses WebKit) | passkeys.dev; [Safari 18 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-18-release-notes): "Added support for using passkeys across related origins." |
| macOS | Safari on macOS 15+, Chrome and Edge 128+, Firefox 152+ | passkeys.dev |
| Windows, ChromeOS, Linux | Chrome and Edge 128+, Firefox 152+ | passkeys.dev |

- Chrome introduced the feature with Chrome 128 and 129
  ([Chrome blog](https://developer.chrome.com/blog/passkeys-updates-chrome-129)).
- Chrome Status's own entry for it is stale ("No active development", no milestones), so it is
  not a source here.
- [web.dev](https://web.dev/articles/webauthn-related-origin-requests) still says Firefox was
  "still considering" the feature as of January 2026. Mozilla's standards position closed as
  positive on 2026-03-11 (mozilla/standards-positions#1052). The Firefox 152+ rows rest on
  passkeys.dev alone; Firefox's own release notes were not checked.

What the [specification](https://www.w3.org/TR/webauthn-3/#sctn-related-origins) (WebAuthn Level
3) requires of step 8:

- **Where and how it's fetched.** The browser fetches `https://<RP ID>/.well-known/webauthn` on
  the default port, over HTTPS, without credentials or a referrer. Redirects are followed only
  over https, and the final status must be 200.
- **Format.** The content type must be `application/json`, and the file must contain an `origins`
  array of strings. An entry that is not a URL is skipped.
- **Which pages it covers.** It applies to both `create()` and `get()`. The RP ID's own origin
  doesn't need listing.
- **Label limit.** Browsers must support at least five registrable-origin labels; Chrome's cap is
  five. Every Green Goods origin shares the one label `greengoods`.
- **Without support.** A browser throws `SecurityError`.
  `PublicKeyCredential.getClientCapabilities()` reports `relatedOrigins` when supported (Chrome
  133+), so step 9 can choose its copy before trying a ceremony.

What this leaves: iPhones on iOS 17 or earlier, and any browser outside these rows, keep a
host-bound passkey on its home site. Adoption still gives those accounts sign-in by name there
from any device the passkey syncs to.

## Human Judgment Points

- Decisions 1 to 9 in [plan.todo.md](plan.todo.md#decision-log).
- Protected or high-risk surfaces: shared Auth workflows and the agent's passkey directory (both
  critical), and the client's static `.well-known` folder and `vercel.json`.
- Keep visible during review: the directory becomes the record for adopted accounts too; the
  hosted server stays the authority for hosted names; and nothing re-encodes a stored ID.

## Non-Functional Constraints

- **Package boundaries:** the agent consumes Shared only through `@green-goods/shared/public-contracts`;
  hooks live in `packages/shared/src/hooks`; no new export subpath.
- **Security:**
  - The challenge is single-use and spent first, with a 5-minute lifetime.
  - Both the origin allowlist and the domain allowlist apply.
  - Adoption happens on the passkey's own domain.
  - Possession is proven, and a hosted name must match its listed passkey.
  - The signature counter follows decision 9. The validator ignores it either way.
  - Rate limits use the registration class.
- **Privacy:** names, keys and IDs stay out of logs and telemetry, as the directory already does.
- **Performance:** adoption adds no wait to a sign-in.
  - The challenge request runs beside the hosted lookup, and the ceremony starts when the lookup
    answers, as today.
  - Adoption calls are never retried. The start call gets 3 seconds and the background
    completion 10.
  - The completion runs after the session opens.
- **Offline / sync:** adoption needs the network and is skipped offline; nothing is queued.
- **Localization:** en, es and pt for every new string.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Shared auth workflows, contract, verifier, telemetry | `state_api` | Steps 1, 2, 6, 10 |
| Agent directory store, hosted lookup, RPC | `state_api` | Steps 3, 4, 5 |
| Account row, copy, related-origins file, builder docs | `ui` | Steps 7, 8, 9 |
| Contracts | `contracts` | `n/a`: the validator already accepts these signatures |
| QA | `qa_pass_1`, `qa_pass_2` | Step 11, sequential |

## Risks

- **A browser without related-origin support.**
  - Risk: a host-bound passkey stays on its home site there.
  - Mitigation: step 9's copy names that site, and adoption still gives sign-in by name across
    devices on the home site.
- **An adopted entry that opens a different account.**
  - Risk: a re-encoded ID or the wrong key would point the name at another address.
  - Mitigation: the exact ID string (for a hosted name, the hosted server's own string), ID
    bytes matched to the assertion, a proven key, and the client's address guard before sending.
- **One passkey under two names.**
  - Risk: the hex and base64url spellings of one credential's ID, or its key written with or
    without `04` or in another case, pass a string-only uniqueness check.
  - Mitigation: uniqueness on `credentialKey` and `publicKey` together, with every key stored in
    one spelling.
- **A spoofed `rawId`.**
  - Risk: an assertion's signature does not cover `rawId`. A client can claim anyone's ID bytes
    with its own key, and under byte-only uniqueness reserve them before the owner adopts.
  - Mitigation: uniqueness on the pair, so the claim lands as a separate entry. It opens nothing,
    because the local check refuses the real passkey's signature against the claimed key (rig
    scenario G).
- **A client-chosen browser ID.**
  - Risk: a stored browser ID the client picked would make every directory sign-in ask for the
    wrong credential.
  - Mitigation: there is no such input. `signingId` is `credentialKey`, from the assertion's
    `rawId`, which rule 5 matched to the stored ID.
- **An ID valid in both spellings.**
  - Risk: reading an even-length, all-hex base64url ID only as hex refuses a legitimate passkey.
  - Mitigation: accept either reading, as the app's sign-in already does, and key uniqueness on
    the assertion's bytes (rig scenario F).
- **A copied passkey that counts its signatures.**
  - Risk: the local check that replaces the hosted verdict doesn't read the signature counter, so
    it can't notice a copy the hosted verdict might have refused.
  - Mitigation: what the account can sign doesn't depend on it, because the validator ignores the
    counter. Decision 9 chooses whether the directory tracks it and refuses a counter that isn't
    above a nonzero stored one.
- **The hosted server down during adoption.**
  - Risk: the directory can't confirm who holds a hosted name.
  - Mitigation: refuse with a non-retried `unavailable` and try again at a later sign-in; sign-in
    is unaffected.
- **The directory down during hosted sign-in.**
  - Risk: replacing the hosted verdict there too would drop whatever it checks, just when
    nothing else can answer.
  - Mitigation: the merged path needs a directory answer first. A failed directory lookup takes
    today's hosted path, start and verify included.
- **A retried completion after a lost response.**
  - Risk: an automatic retry meets the spent challenge and reports an expiry instead of the real
    outcome.
  - Mitigation: no transport retry for adoption calls, a completion deadline longer than the
    agent's hosted lookup, and identical completions return the stored
    result.
- **An upgrade that misses the new columns.**
  - Risk: `CREATE TABLE IF NOT EXISTS` leaves the production table as it was.
  - Mitigation: `ensureColumn`, plus a test that upgrades a v2.0.1 database and checks that
    `user_version` moves from 8 to 9.
- **A wrong related-origins response.**
  - Risk: the app's HTML is served instead of the file, or it's served with the wrong type.
  - Mitigation: a static file, an explicit header, and a smoke check on www and beta.
- **Losing the directory database.**
  - Risk: it becomes the only record for adopted accounts as well.
  - Mitigation: step 5 extends the `/data` snapshot item in the agent's Production Checklist
    (`packages/agent/README.md`). Before it deploys, a restore into a separate volume must keep
    every `passkey_credentials` row (AC-13).

## Related

- PRD-1107 built the directory. COM-39 was rewritten around this plan on 2026-10-16 (decision 8).
- `green-goods-name-reservation` owns name normalization and reservation; adoption applies the
  directory's existing name rules (`isRegistrablePasskeyName`).

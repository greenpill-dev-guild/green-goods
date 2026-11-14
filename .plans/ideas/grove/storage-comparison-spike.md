# Grove: Solid versus EDV comparison spike

> **14 November framing note (D31 to D33).** This hub's project is Green Goods working in a fully local environment, and Grove names its extension only. This document was written when Grove named the whole local system: where it says Grove outside the extension's graph, agent and Pi work, read the local environment.

**Accepted research scope:** 13 November 2026. **State:** planned, unrun. This specifies C1a in [the delivery plan](plan.todo.md#community-sharing-delivery-order), with E22 in [the acceptance gates](eval.md#community-sharing-gates). It authorizes planning the experiment, not installation, deployment or private-data collection. **Sequenced 14 November (D21 in [spec.md](spec.md#decision-log)):** this is the next lane after the MVP, which moves records by encrypted file only.

**Solid plus client-side encryption is the preferred optional storage adapter. EDV remains a research alternative.** Validate Solid first against the local-key, two-device flow; repeat the same fixture on an EDV client/server pair when that research is pursued. Local/direct sharing needs neither API, and a failed privacy/permission/recovery gate blocks private use of that adapter. Do not require an EDV implementation or two backends to complete a passing Solid slice. [C5 research](collaboration-passkey-spike.md) can still compare a native ciphertext relay, with Keyhive experimental.

## The store interface comes first

Grove reaches hosted storage through one small interface: put, get, list and delete of immutable, opaque objects under unguessable names, with a conditional write. Prove that interface with a plain folder before any provider. Solid is then one adapter behind it, and the preferred one (D12).

Everything a store holds is a shared file as [the contract](community-sharing.md#encryption-contract) defines it. A store never holds a key that is not wrapped, and Solid's access rules are a second control, not the confidentiality mechanism. Once content is ciphertext, what Solid adds over a plain blob store is a standard protocol and a community's own choice of operator. What it costs is a browser sign-in flow in both clients and a server to run. This spike measures both, so the preference rests on evidence.

## Fixed test conditions

- Two physical member devices: a phone browser/PWA candidate and a laptop's packaged Brave extension. Record OS/browser versions, origin/RP boundaries and foreground/background limits. A desktop-only or two-tab run is partial evidence, not phone proof.
- Device A is the capturing member. Device B is a separately enrolled reviewer with its own signing/encryption keys. Each can play steward or contributor in a separate scenario without sharing root keys. A denied-recipient fixture runs in a separate clean profile; this does not require buying a third device.
- Use synthetic knowledge and impact records: a page/lesson, a field observation and one bounded media attachment. Same record IDs, revisions, selected fields, audiences, consent and revocation cases on both backends. No public PDS, IPFS or chain publication.
- Private keys originate and remain on authorized member devices, protected by the chosen local unlock mechanism. Use a locally held encrypted recovery export. No remote KMS, identity provider or storage operator may recover or use content-decryption keys. Remote public-key resolution is not remote private-key custody.
- Give the test operator a full storage dump, logs, service credentials and the ability to bypass storage ACLs. They still must not decrypt content or issue a valid community grant. Keep the trusted packaged-client/update boundary explicit: this is not proof against arbitrary malicious client code on an unlocked endpoint.
- Internet services may assist authentication, signaling and storage. Capture/review work without them. Test lack of connectivity and recovery independently from backend availability; do not assume WebRTC is required for this comparison.

## Two variants and the reusable core

| Component | A: Solid | B: EDV |
|---|---|---|
| Local core | Same workspace, signed community policy, local key provider, consent, revisions and outbox | Same core |
| Stored representation | Versioned encrypted envelopes and encrypted manifests in scoped Pod containers | Encrypted documents/recipient envelopes through a pinned EDV client |
| Service authorization | Selected Solid-OIDC client plus provider WAC/ACP support | Selected server's capability invocation/authentication support |
| Content authorization | Grove-approved device recipients, independent of Pod ACLs | Grove-approved recipients, independent of server capability grants |
| Crypto reuse | Reviewed envelope implementation; document any EDV-style format reuse | Reuse client crypto/key interfaces where compatible with local custody |
| Queries | Local search first | Same local search; blinded remote index is an optional measured bonus |
| Runtime | Selected Pod outside extension | Selected EDV server outside extension; no implied remote KMS requirement |

An EDV-style envelope on Solid is not an EDV server or proof that an unmodified EDV client can use Pod endpoints. Keep wire-format, key-management and storage-API compatibility claims separate.

## Walkthrough

1. Create the community offline on A, with local member/device keys and a recovery export. Capture and personally review both source types before any provider login.
2. Enroll B through an expiring, authenticated invitation. Confirm its key fingerprint through a separate trusted interaction. Grant review of collection X; do not grant collection Y or community administration.
3. Authenticate to the selected backend. Preview the exact revision, fields, recipients, purpose and destination, then send encrypted records. B verifies the grant, decrypts, commits and returns an authenticated receipt before reviewing/correcting. Storage receipt, device receipt and review remain distinct.
4. Attempt collection-Y reads and administration from B; submit forged grants, wrong-audience records and replayed/stale revisions. Inspect the host's full view and the denied profile. Repeat after bypassing storage ACLs.
5. Interrupt upload, download, import and acknowledgment. Close/lock each client, reopen offline, then reconnect. Retry the same operation IDs. Distinguish data saved locally, stored remotely, received and reviewed.
6. Simulate loss of A: clear only its disposable test profile, recover it from the encrypted export, and explicitly enroll a fresh device key. No provider reset yields content keys. Separately test forgotten unlock material, corrupt backup and loss of every usable recovery path; show honest unrecoverability.
7. Remove B while it is offline. Reconcile the signed membership epoch before new sharing, rotate future content keys, and prove B cannot decrypt new revisions. Record that already received plaintext/keys remain available to B. Expire a grant and attempt a stale offline write.
8. Export the encrypted corpus plus permitted grants, change storage endpoint/operator, and restore into the same local community identity. Do not infer cross-protocol portability from a provider-only export: test Grove's neutral bundle and list any conversion required.

## Acceptance and decision criteria

| Concern | Required result | Evidence to retain |
|---|---|---|
| Recovery | Device loss can recover authorized content through the documented local recovery path; host reset alone cannot decrypt; unavailable recovery fails visibly | Restore walkthrough, protected export format, new-key enrollment, loss/corruption outcomes |
| Community permissions | Reader/reviewer cannot add members, access another collection, become publisher or accept writes without the required grant | Signed policy/grant cases; role, audience, expiry and writer denials; no private access inherited just from an onchain role |
| Host privacy | Full host access reveals no raw content, content keys, recoverable wrapping secret, sensitive titles, model text or media previews | Storage/log/network inspection, unauthorized decryption attempts and metadata inventory |
| Local keys | All private-key operations for content custody remain local; remote public-key discovery and service credentials are clearly distinguished | Key-provider call tracing, persistence/unlock inspection, no remote KMS dependency |
| Offline correctness | Acknowledged captures survive restart, retries deduplicate, and stale policy causes visible queuing/rejection rather than unauthorized sharing | Same interruption matrix and receipt IDs on both variants |
| Identity portability | Local/community identity survives logout, provider removal and migration; account linking does not grant content access | Before/after IDs, scoped bindings, disconnect and rebinding cases |
| Build burden | Reused library behavior is separated from new Grove code, adaptations and missing features; no unsupported effort percentage | Exact packages/versions/licenses, adapter-owned files/interfaces, custom crypto/key/discovery work, transitive bundle/WASM cost and unresolved maintenance risks |
| Operations/accessibility | Phone and desktop have usable unlock/pair/recovery flows; exact infrastructure, availability and maintenance costs are visible | Device matrix, member steps, service/process count, observed timings/bytes/memory where available; no fabricated scores |

Host privacy includes contents and avoidable metadata. Neither variant is assumed to hide IP addresses, transfer sizes or access timing. Record such leakage explicitly. Revoking a server capability is not the same as rotating a content key, and neither can make a prior recipient forget.

Privacy, permission and recovery failures are **blocking**, even if a variant is faster or needs fewer lines of code. Optional encrypted-index features cannot compensate for a failing core gate. Where the cryptographic boundary is identical, compare maintenance, accessibility, migration and community operating burden before performance. “Neither passes” is a valid result; keep the working local flow and do not admit sensitive data.

## Output, costs and unresolved prerequisites

Produce one evidence sheet with Pass / Fail / Unproven per criterion and evaluated variant, exact source/release pins, owned implementation work and remaining gaps. Solid is the accepted design preference, not a passed experiment. EDV can remain Unproven when not evaluated; compare it as research without blocking a passing Solid adapter. No weighted score or production-security certification is inferred; reconcile C3 with the reviewed evidence.

The inspected [EDV browser client](https://github.com/digitalbazaar/edv-client) supplies crypto/key-provider interfaces; its remote-KMS example is not Grove's custody model. The inspected [Bedrock server](https://github.com/digitalbazaar/bedrock-edv-storage) is one implementation with a multi-service setup and [non-commercial licensing terms](https://github.com/digitalbazaar/bedrock-edv-storage/blob/main/LICENSE.md). Check the exact chosen implementation and licence, including funded-community use; do not treat those terms as a restriction of the EDV specification itself. [Solid](https://solidproject.org/TR/protocol) and [EDV](https://identity.foundation/edv-spec/) protocol status, implementations and browser compatibility must be pinned for the eventual experiment.

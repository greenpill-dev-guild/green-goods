# Grove: community identity and encrypted sharing

**Accepted direction:** 13 November 2026. **State:** design, not implemented. This is the current identity, privacy and device-sharing contract referenced by [spec.md](spec.md). [Research and source limits](sharing-research.md) distinguish observed capabilities from proposals. [Flows](architecture-flows.md) show the initial experience; [delivery checkpoints](plan.todo.md#community-sharing-delivery-order) define the next proof.

**Coordinate locally. Govern together. Share by context. Publish by choice.**

Grove's common loop is **capture → review → share**. A useful article, a community lesson and evidence of regenerative work enter the same loop. Their meanings stay distinct: a saved observation is not automatically Green Goods Work, and community review is not protocol WorkApproval. The living graph helps people explore connections; it is one view of the records, alongside capture and review lists.

## Privacy follows the audience

| Context | Who can read | What crosses the boundary |
|---|---|---|
| Local | The person on their unlocked device; optionally their paired devices | Nothing by default. Local AI reads only the selected local context. |
| Community | Explicitly authorized members and devices | A selected, end-to-end encrypted copy or collaboration collection. A storage operator receives ciphertext. |
| Between communities | Named recipients approved by the source community | A new, minimized projection with its own audience, keys, purpose and provenance. |
| Public commons | Anyone | A separately prepared and approved release: a report, knowledge resource, claim or attestation. |

These are audience contexts, not an automatic publication ladder. A community can share a summary while keeping the source private, or keep all records local indefinitely. Each additional audience requires an explicit decision. In the hair metaphor, “black hair,” “black with gray,” and the family history are separate disclosures, each supported by the appropriate source context. A public reader does not need access to the family record.

**Accepted preferences:** Solid for optional hosted storage, with encryption on authorized clients; Yjs for optional co-editing, with encrypted updates and verified writer permissions. Identity, community authority and private keys remain local. Encrypted record exchange is still the baseline. EDV and Automerge + Keyhive remain research alternatives, with Keyhive experimental and synthetic-data-only. These are design choices, not implementation or security receipts.

The [two-device collaboration/passkey comparison](collaboration-passkey-spike.md) includes independent existing-passkey, offline-unlock and recovery proof. The [storage spike](storage-comparison-spike.md) validates preferred Solid first and retains EDV comparison as research. Local/direct sharing needs no provider account or CRDT. [Role mapping](identity-role-mapping.md) distinguishes community/member associations, protocol roles and local grants; [local-first research](local-first-options.md) records alternatives.

## Identity belongs to the community first

Keep **identity, authority, encryption and service login separate**:

| Identity or key | Purpose | Control and visibility |
|---|---|---|
| Local member identity | Identify an author and their devices in a workspace | Created offline. No Ethereum wallet, email account, public registry or Solid login required. Use distinct identifiers/keys across communities where correlation is unwanted. |
| Community identity | Identify the group and its governance policy | A community-controlled identifier with signed controller changes, member/device grants and recovery rules. Initial policy may delegate to one steward; multi-steward approval is a supported design requirement. |
| Device signing and encryption keys | Authenticate changes and deliver decryption keys | Separate keys per device and purpose. Adding a phone does not clone a community root key. A sensor can submit observations without reading the community archive. |
| Solid WebID/OIDC account | Authenticate to a selected Pod | Optional service binding. It does not replace the local member identity or decide who receives content keys. |
| ATProto/Certified account | Attribute a deliberately shared or published record | Optional binding, using a community-chosen provider or self-hosted PDS. No requirement to expose the private member roster. |
| Ethereum account/GardenAccount | Connect to existing public protocol identity and actions | Optional, scoped binding with proof of control and applicable garden authority. Linking can reveal correlations. |

Select and pin the offline DID method in **C0**, after testing rotation, recovery and portability. `did:key` is useful for immutable device keys but cannot itself rotate or deactivate; do not make it the permanent community governance root. Peer DIDs are a candidate, not a completed selection. DIDs provide identifiers and verification material; Grove still needs an explicit membership policy and encrypted key delivery.

The community's signed policy and grants are verified by recipient clients. Pod ACL edits, a CRDT roster edit, or an administrator at a hosting company cannot issue valid decryption grants. A community can appoint an identity-service operator while retaining its own controller/recovery keys. Provider login is a replaceable convenience, with the extent of custody visible to members.

### Connecting offchain and onchain identity

1. Create a local workspace and community identity. Store local workspace IDs independently of any chain address.
2. Invite a member or pair another device through an authenticated, expiring exchange. Confirm the recipient key using a QR code plus a human-verifiable fingerprint or equivalent authenticated channel. Issue only the intended grants.
3. If requested, add a **private association** between the local community and a service account or garden. Have both sides prove control of the exact association, including audience, purpose, nonce, expiry and version. A service login alone does not prove community authority.
4. For an Ethereum binding, identify the account with chain and address (CAIP-10). Use a domain-separated signed challenge/typed statement. Verify EOAs and ERC-1271 contract accounts through separate paths, and check the relevant GardenAccount/Hats authority. A valid wallet signature is not automatically authority to represent a garden.
5. Publish the association only if separately approved. A signature can remain offchain; a transaction is needed only for the selected protocol action. Future contract enforcement of a Grove credential is a separate integration, not something a DID grants automatically.

Certified's currently inspected EVM-link schema is EOA-only. Do not route GardenAccount signatures through that path or claim compatibility without a tested contract-wallet adapter. SIWE can authenticate a wallet session; it does not encrypt content. Changes in garden authority require revalidation, and external publication does not silently change community membership.

## Encryption contract

**Required:** only authorized endpoints can decrypt shared content, including when the Pod or relay operator is curious or compromised. Solid permissioning is an additional server-side control, not the confidentiality mechanism.

The first implementation candidate is an **encrypted resource envelope**: encrypt a resource revision with a fresh random data key using authenticated encryption, then wrap that key to the authorized recipient-device keys through a reviewed implementation of a standard envelope/HPKE scheme. Web Crypto can supply AES-GCM; it is not a complete sharing protocol. The library, envelope format, signature format, algorithms and version migration remain **C1** decisions. Do not hand-build a new cryptographic protocol.

Bind encrypted content and key grants to the community, collection, record/revision, sender and key epoch. Authenticate the sender separately from the ability to decrypt. Use unique nonces under each encryption key, validate size/schema before applying content, and reject tampering, replay and audience substitution. Keep sensitive provenance, titles, coordinates and recipient details inside encrypted payloads wherever routing permits. Use opaque external identifiers; avoid publicly exposing plaintext hashes of guessable private observations.

For small groups exchanging reviewed resources, per-resource key wrapping is the first candidate. Evaluate **MLS (RFC 9420)** if live collaboration and frequent membership changes justify group epoch machinery. MLS manages group keys; it does not replace storage, local recovery, community governance or record authorization. Do not require both key-management approaches in the first pilot, and do not claim forward secrecy or post-compromise security from AES-GCM alone.

### Keys, recovery and lifecycle

- **Local unlock:** keep a random vault key wrapped by an actual unlock secret or supported WebAuthn PRF-derived key. Do not persist an unprotected wrapping secret beside the ciphertext and claim protection from a copied browser profile. Passkey assertions are not reusable encryption keys. C0a/E24 tests actual existing-credential reuse, origin/RP boundaries, blocked-network reopen, unsupported PRF and independent recovery; no silent credential/account migration. Local capture remains available through the independently proven local unlock path.
- **Pairing:** generate a new device key, authenticate it, and grant the minimum collections. Pairing credentials are single-use/expiring; content keys never travel as URL query parameters or general relay credentials. A phone's private inbox stays private until its owner shares selected records.
- **Recovery:** provide an encrypted offline recovery export for individuals. Community succession uses a documented controller policy; any recovery member able to decrypt counts as an authorized recipient. No provider-held universal decryption key. The exact threshold mechanism and loss scenarios are C0/C1 gates, not invented capabilities.
- **Membership changes:** remove a device from future grants, rotate affected collection/epoch keys, and create a fresh collaboration document where history must be excluded. New members receive no prior history unless explicitly granted. Old recipients can retain old plaintext and keys; revocation cannot make them forget.
- **Offline changes:** retain captures and proposed edits locally. If membership freshness cannot be established under the agreed offline policy, queue new shared writes/key grants rather than claiming immediate global revocation. Reconcile signed epochs before applying pending shared changes.
- **Derived data:** encrypt captures, media, thumbnails, model outputs, indexes, shared history and backups at their relevant audience boundary. Pi persists references and receipts, not decrypted source packets or key material. Locking clears usable in-memory key/context caches and pauses protected tasks.
- **Failure and erasure:** failed unlock or decryption is visible, never an empty successful record. Erasure invalidates local derivatives and pending tasks. Shared withdrawal requests cannot guarantee deletion from other members' devices or public archives.

E2EE protects content from the storage operator. It does not hide all traffic, file sizes or access timing, prevent denial of service, or protect an unlocked compromised endpoint. Clients track signed versions/epochs to detect known rollback; first-contact completeness and isolated offline forks need explicit reconciliation proof. Use packaged trusted client code, with a separately evaluated phone-app update boundary. A host serving malicious executable code to an unlocked client is a different threat from storing ciphertext.

## Solid as an optional encrypted mailbox and store

Solid is the preferred optional adapter, subject to C1a/C3 proof. Start with one community-selected Pod and separate containers for audience-scoped collections. Write opaque encrypted resource envelopes and encrypted manifests over HTTPS. Use immutable revision/object IDs, conditional writes where needed, and local outbox receipts; fetch and verify the stored version before displaying delivery success. Notifications can prompt reconciliation but do not prove delivery. A receipt means stored or received, not reviewed or published. EDV remains a research alternative, not a second required backend.

A Pod may be community-operated on an existing laptop or hosted by a chosen operator. Local capture and review work when it is unavailable. Members need no dedicated node purchase. Always-on asynchronous sharing still needs some reachable replica or storage service; a sleeping laptop cannot provide that availability.

The extension runs a **Solid client**, not a complete Pod server. Browser libraries exist; MV3 redirect/login, CORS, token handling, CSP and suspension still require C3 proof. A conventional Community Solid Server runs outside the extension. Local DIDs do not automatically log in through Solid-OIDC: map a selected service principal to the privately verified community membership. Import/export must preserve encrypted records and their key grants independently of the Pod URL.

## Networking and synchronization

| Layer | First choice | Boundary |
|---|---|---|
| Durable local capture | Encrypted local store, scoped revisions and outbox | Works without connectivity or model availability. |
| Device discovery/pairing | QR invitation and fingerprint confirmation | Establishes trust, not a data transport or permission to read everything. |
| Offline transfer | Encrypted export/import bundles | Dependable initial fallback; OS file sharing can carry ciphertext. |
| Direct active-device transfer | WebRTC data channel, authenticated peer identity | Requires signaling; STUN/TURN may be needed across networks. LAN-only signaling is a separate tested path. |
| Internet asynchronous sharing | Solid is preferred when optional hosted storage is needed | Ciphertext only; local identity/keys stay independent. EDV remains research. Reconcile when online; never auto-publish. |
| Collaborative draft merge | Yjs is preferred for optional co-editing | Encrypt updates and verify writers. One audience per document; domain roles/approvals remain Grove-owned. Automerge + Keyhive stays experimental research. |
| Nearby sensor input | File import first; Web Bluetooth GATT where supported | Browser/device-specific, user-initiated. Not generic browser-to-browser Bluetooth mesh. |
| Later cross-community exchange | Optional KOI adapter | Semantic discovery and selected exchange. It receives only data approved for its audience. |

**A CRDT is optional for the first shared flow.** Immutable captures, versioned review decisions and approved release artifacts can move as signed encrypted records. C5 compares Yjs with Automerge + Keyhive using synthetic data, without making co-editing a pilot requirement. Maintain one audience per document, including awareness/presence. Yjs client IDs are not member identities; Keyhive cryptographic powers are not community roles. Validate writer authority independently of mutable draft content and keep governance in verified policy state. A reader with a decryption key still cannot issue an accepted writer command. Keyhive's protected creation, revocation, recovery and new-reader history behavior require explicit negative cases in E25.

Never send a private collaborative document's history to a broader audience by filtering its current visible state. Build a fresh projection/document: removed text can remain in CRDT history, and Keyhive's inspected integration grants new readers the existing document's whole history. All carriers must preserve the same confidentiality and authorization requirements, with format differences tested explicitly. Stock `y-websocket` with a readable server-side Y.Doc does not meet the hosting-operator requirement.

This is a **community replica network**: devices keep selected local copies and exchange them when reachable. It is not yet an automatic radio mesh or an always-running browser network. Multi-hop store-and-forward needs deduplication, quotas, expiry, encrypted routing and reconciliation tests; it is deferred. Phone capture uses a browser/PWA companion as the first candidate, with the desktop extension as a richer workspace. Do not promise one extension runs on every phone or that mobile browsers stay alive in the background. Existing hardware remains the target; local model suitability must be measured per device, with manual capture/review always usable.

## Share and publish are separate decisions

A share approval binds **exact revision/digest, audience, purpose, included fields and permitted destination**. A broader audience or changed content needs a new approval. Recipient/community review happens after the initial consented encrypted share and records its own decision. Community review can authorize a subsequent report or public projection according to policy; it does not automatically authorize publication.

Optional adapters consume that approved projection:

- **ATProto/Certified:** attributable knowledge, activity claims and social distribution. A Certified group service is a chosen delegated publisher, not Grove's private identity root or key custodian. Spaces is unnecessary for the initial encrypted shared layer and does not supply host-blind E2EE by itself.
- **Ethereum/Green Goods:** garden association and deliberate protocol actions. Existing Work/WorkApproval authority remains unchanged. Review the payload before the first public upload, not merely before signing the transaction.
- **IPFS/Filecoin:** optional distribution/archive of approved public artifacts, or separately approved encrypted backups with explicit retention/key policy. Do not claim permanent availability without storage/renewal arrangements or place all private evidence there by default.
- **KOI:** optional discovery and source/provenance exchange between communities. A node signature does not grant membership or certify impact.

## Decisions still requiring implementation evidence

Offline DID and controller succession; reviewed encryption library/envelope; existing-passkey/PRF unlock and recovery; historic-access policy; browser/phone support; optional storage interoperability; authenticated signaling and TURN arrangement; and the Yjs/Automerge + Keyhive comparison. MLS remains conditional. These are bounded gates in the delivery plan. No provider account, infrastructure deployment or dependency installation is required to complete this design revision.

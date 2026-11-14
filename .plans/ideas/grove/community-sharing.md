# Grove: community identity and encrypted sharing

**Accepted direction:** 13 November 2026; ten decisions recorded 14 November. **State:** design, not implemented, and no property below has been tested. This is the identity, privacy and device-sharing contract. [spec.md](spec.md#decision-log) owns the decision log and cites decisions as D-numbers, recommendations as R-numbers and open questions as O-numbers. [Flows](architecture-flows.md) show the sequences, [identity and roles](identity-role-mapping.md) maps accounts and authority, the [plan](plan.todo.md#mvp-order) gives the proof order, and [research](sharing-research.md) records the sources.

**Coordinate locally. Govern together. Share by context. Publish by choice.**

Grove's common loop is **capture → review → share**. A useful article, a community lesson and evidence of regenerative work enter the same loop. Their meanings stay distinct: a saved observation is not automatically Green Goods Work, and community review is not protocol WorkApproval. On the laptop, a graph helps people explore connections; it is one view of the records, alongside capture and review lists.

## Terms

These words mean one thing each across the hub. They describe Grove's local context and are proposals for the ontology change protocol, not ontology edits (D23).

| Term | Meaning in Grove | Not the same as |
|---|---|---|
| Community | A group that keeps and shares records under its own member list. It exists locally and can be linked to a Garden by choice | A Garden, which the ontology defines as "a community of gardeners" with an onchain account. The Community garden role |
| Member | A person admitted to a community. In Grove a member is the set of that person's enrolled devices in that community | A garden member, which the protocol derives from Hats |
| Device | One browser profile holding its own keys: the web app on a phone, or the extension on a laptop | A person. A passkey, which can sync to many devices |
| Member list | The community's signed, versioned list of members, devices, roles and controllers | A Pod's access list. A garden's role graph |
| Controller | A steward whose device may sign changes to the member list | A garden owner or operator, unless the community chooses the same person |
| Capture | A saved source with its origin, time and consent context, kept as immutable revisions | Green Goods Work |
| Focus | The community's written list of topics, goals and open questions, written and signed by a steward as a community record | A Garden's domains or Actions |
| Assessment | The agent's advice on an item it brought in: why it was brought in, its source, author and date, and what to check before sharing | A review decision. An approval |
| Personal review | The author's own check and correction before anything is shared | Community review |
| Projection | The exact fields of one revision selected for one audience | The stored record. A computed view of the graph, which the workspace lane also calls a projection |
| Share approval | The author's recorded approval of one projection for named recipients, a purpose and a destination | A release approval. WorkApproval |
| Destination | Where an approved projection is going: a named community, a named partner community, or later a public service | The recipients, which are the devices a file names. The carrier that moves the file |
| Shared file | The signed, encrypted file that carries approved projections to named devices | A backup |
| Receipt | A recipient device's signed statement that it stored a shared file | A review. A command receipt in the workspace lane |
| Review decision | A member's signed accept, reject or comment on a revision they received | WorkApproval. Evaluator verification |
| Correction | A new revision that supersedes a received one | An edit in place |
| Release approval | A steward's recorded approval of a projection for a partner community or the public | The author's share approval |
| Vault | The encrypted store on one device | Hosted storage |
| Recovery code | A secret created at setup that opens a recovery export without a passkey or the lost device | A password to a service |

## Privacy follows the audience

| Audience | Who can read | What crosses the boundary | Who approves (D17) |
|---|---|---|---|
| Local | The person on their unlocked device, and their own paired devices | Nothing by default. On the laptop, what the agent brings in as the person browses lands here first. Local AI reads only the selected local context | Nobody; it is theirs |
| Community | Named members' devices | A selected, end-to-end encrypted copy | The author, for every share of their own capture |
| Partner community | Named recipients in another community | A new, minimized projection with its own recipients, purpose and provenance | A steward. Also the author, if a corrected version of their capture is leaving |
| Public | Anyone | A separately prepared release: a report, knowledge resource, claim or attestation | A steward, in a later lane |

These are audiences, not a ladder toward publication. A community can share a summary while keeping the source private, or keep everything local indefinitely. Each additional audience requires an explicit decision. Take a description of someone's hair: "black hair", "black with gray" and the family history behind it are three separate disclosures, each resting on the right source. A public reader does not need the family record. In the same way a funder can read that soil cover improved without receiving the field notes, the participants' names or the plot's coordinates.

## Who cannot decrypt, and who can

**Required (D20):** whoever stores or relays shared records cannot read them and cannot grant itself access. That covers a Pod, a mailbox, a relay, and anyone who obtains a shared file. Storage permissions are an extra control, never the confidentiality mechanism.

Three limits belong beside that requirement wherever it is stated:

- **The publisher of the client code is trusted.** The extension is packaged code. The phone web app is served from the web each time it updates, so whoever serves it could ship code that reads an unlocked vault. Green Goods is that publisher and is trusted. O8 asks what constrains updates before sensitive records are admitted.
- **An unlocked or compromised device exposes what it can decrypt** and can sign as its owner until it is removed.
- **Removal cannot make anyone forget.** A recipient keeps what it already received.

Hosts still see file sizes, timing, addresses and how many recipients a file has.

## What the agent reads

On the laptop, an agent brings in relevant knowledge and resources as the person browses, and assesses each item before the person reviews it (D26 to D30). The steward's written focus tells it what is relevant. A focus counts only when a device the current member list names as a steward signed it. A focus from anyone else is refused, and after a change of steward the new steward signs it again.

- **What it may read (D27):** the text of any page the person visits, except in private windows and on a block list of sensitive sites the person can extend.
- **What it keeps (R17):** only what it brings in. Text from any other page is discarded on the device, and no address is logged.
- **Where it runs:** on the laptop only, with a local model. Nothing a page contains leaves the device because the agent read it.
- **What it decides (D28):** only whether to bring an item in. It never brings in something it would recommend discarding, and it never shares. A person reviews every item and can discard it; sharing follows the approvals below (D17).
- **When the vault locks:** the agent stops. The focus is an encrypted record, so the agent cannot judge relevance while locked. Queued page text is dropped, a check in progress is cancelled, and nothing resumes until the person unlocks.
- **What the assessment says (D29):** why the item was brought in, its source, author and date, and what to check before sharing, such as names, contact details and exact locations. It is advice. It cannot establish that a claim is true or that work happened.

Reading every page is the largest privacy exposure in this design. The block list is the only thing between a private page and local storage, so it ships covering banking, mail, health, government accounts and password managers, and the agent skips any page with a password field (R18). E27 tests all of this, and O12 asks whether a browser store will accept the access it needs.

## Identity belongs to the community first

Keep **identity, authority, encryption and service login separate**:

| Identity or key | Purpose | Control and visibility |
|---|---|---|
| Device keys | Sign what a device sends and receive what is encrypted to it | Created on the device and never exported. One signing key and one key-agreement key per device, and a separate pair for each community (W3) |
| Member | Identify an author across their devices in one community | Created offline. No wallet, email, public registry or Solid login. Not reused across communities unless the member chooses |
| Community | Identify the group and its controllers | The member list. Its identifier is the hash of its first version, so no provider account can be its root |
| Passkey | Unlock a vault where supported (D19) | Held by the passkey provider and able to sync. It identifies no device and admits none |
| Solid WebID, ATProto or Certified account, Ethereum account, GardenAccount | Optional associations for storage, attribution or protocol actions | Later lanes. Each is a private, signed link that grants no role and no key; see [identity and roles](identity-role-mapping.md) |

**No identifier scheme is selected (R2).** The MVP identifies a device by its public keys and a community by the hash of its first member list. An earlier draft required choosing a DID method first. Nothing in the MVP needs an outside verifier, so that choice waits until one does; `did:key` can express a device key then, and it cannot rotate, so it never becomes the community's root.

### The member list

No maintained browser library provides community membership and key grants (see [dependencies](dependencies.md#community-identity-encryption-and-device-sharing)), so Grove defines this part itself and keeps it small (R3). This is a design to prove in C0, not a selected format:

- The list is a chain of signed versions. Each version names the one before it by hash. The first version's hash is the community's identifier.
- One steward's device signs changes in the MVP (D18). A version signed by anyone else is ignored.
- Each version lists members, their device keys, their roles and the controllers. Adding or removing a member or device is a new version.
- A second controller is required before real data (D18). Two versions that claim the same predecessor are a fork: clients refuse both and show the conflict. They never merge them (O6).
- A recovery code is created at setup (D18). It opens the steward's recovery export, which holds a succession key; that key can appoint a new controller device and do nothing else.
- A partner community is another member list. Two communities exchange their current list heads through the same pairing step members use.

Recipient clients verify the member list themselves. An edit to a Pod's access list, a storage administrator, or a login to any service cannot add a member or a device.

### Who approves

- **The author** approves every share of their own capture. The approval names the exact revision, the fields, the recipients, the purpose and the destination. Changed content, recipients or destination need a new approval, and an approval for one destination cannot be used for another.
- **Recipients** record review decisions and corrections. Reading a record gives no authority to release it.
- **The author again**, if a corrected version of their capture is to leave the community.
- **A steward** approves partner summaries and public releases.
- Grove stores each reviewer's decision and does not compute a "community approved" state (R14). A steward's release approval names the decisions it relied on.

Community acceptance is never Green Goods WorkApproval, evaluator verification or a certified impact claim.

## Encryption contract

**Shared files (R1).** For each share, the client builds a manifest, signs it with the sending device's key, and encrypts manifest and content together under a fresh random key. It wraps that key to each recipient device's public key using one existing multi-recipient format. The candidates are age v1 and HPKE (RFC 9180); C1 chooses on what the supported devices can run (O3). Do not hand-build a cryptographic protocol.

The signed manifest binds the community, the member-list version the sender used, the sender, the named recipients, the purpose and destination, the approval, and a digest of each included revision and field selection. Signing before encrypting, with the recipients inside the signed part, stops a recipient passing the file on as if it were addressed to someone else. Recipients reject a file that fails its signature, names a sender who is not in the list, does not name them, repeats a file they already stored, or was built on a list older than one they hold.

A fresh key for every file means removing a member needs no group key to rotate: the next file is simply not wrapped to them. It also sets the limits:

- There is no forward secrecy. A device key that leaks later opens every stored file addressed to it, so a hosted store should delete files once they are received.
- Sender authentication comes from the signature, not from the encryption format.
- MLS (RFC 9420) would add forward secrecy and post-compromise security for live groups. It stays research until co-editing or frequent membership change justifies it.

**At rest.** Each device keeps a random vault key. Private keys and record payloads are stored encrypted under it. The vault key is itself stored wrapped, once per way of opening the vault on that device. The recovery code is listed for contrast: it opens a recovery export, not the vault.

| Way in | How | Standing |
|---|---|---|
| Passkey | A secret the passkey returns through WebAuthn PRF, combined with a key that never leaves the device | D19, where the provider supports it. C0a proves which providers do |
| Passphrase | A memory-hard key derivation | D19, everywhere the passkey path is unavailable |
| Recovery code | A high-entropy code created at setup, held off the device. It does not unwrap the vault key | D18. Opens a recovery export only |

The passkey is never the only way in (R4). Its secret belongs to the credential, so it is the same from every `greengoods.app` site and from any extension with permission for that domain, and it follows the passkey wherever it syncs. Combining it with a device-held key means neither a copied browser profile nor another site is enough alone. A passkey assertion is not an encryption key, and a synced passkey never enrols or re-admits a device.

New captures are encrypted to the device's own public key, so saving works while the vault is locked (R15). Reading, reviewing and sharing need it unlocked. Locking clears keys and decrypted context from memory and pauses protected tasks.

## Keys, recovery and lifecycle

- **Pairing:** each side shows a code; the other scans it and both confirm a short comparison string read aloud or compared by eye. Pairing exchanges public keys and the member-list head. It grants nothing by itself: the controller's next list version does.
- **Recovery:** a member restores from a recovery export with their recovery code, or from their second device. A recovery export holds records and the member's place in the community. It never holds a device's private keys, so a backup cannot bring back the identity of a lost or removed device. A restored device creates new keys and is added to the list again; an old device key is never revived. Restoring a vault restores no Ethereum account. Losing every path fails visibly.
- **Removal:** the controller signs a version without the device. Files made after a sender holds that version are not wrapped to it. Where history must be excluded, start a new collection.
- **Stale member lists (D24):** a device stops sharing when its copy of the list is older than seven days, until a newer one arrives in any shared file. Each community can change the number: the controller signs the new limit into the member list, so every device applies the same one. Capture and personal review never pause. The controller re-signs the current head at least that often so that an unchanged list still counts as fresh; C0 proves the mechanism.
- **Derived data:** thumbnails, model outputs, indexes and backups are encrypted at the same boundary as their source. Pi keeps references and receipts, never decrypted sources or keys.
- **Telemetry (R7):** private records never pass through Shared's upload or telemetry helpers, which record file names and content identifiers today.
- **Failure and erasure:** a failed unlock or decryption is shown, never an empty successful record. Erasure invalidates local derivatives and pending tasks. A withdrawal cannot delete copies on other devices or in public archives (O7).

Clients track signed versions to detect a rollback they have seen before. A first contact cannot know it has the latest list, and devices that were offline together can disagree; C0 must show what each does.

## Carriers

| Carrier | Standing | Boundary |
|---|---|---|
| Encrypted file | MVP (D21) | Share sheet, a cable or any messenger can carry it. It is the only carrier and the permanent fallback |
| Hosted mailbox | Next lane | A generic store of opaque objects: put, get, list and delete by an unguessable name. Solid is the preferred adapter (D12); the interface is proved first so identity and keys never depend on a provider. See the [storage spike](storage-comparison-spike.md) |
| WebRTC between open devices | Research | Needs a signalling service and often a relay; both devices must be awake |
| Sensors | Later | File import first. Web Bluetooth reaches supported peripherals in Chromium only and is absent on iOS |
| KOI | Next lane | Discovery and provenance between communities. It receives only what was approved for its audience and grants no membership |

Devices keep selected copies and exchange them when a person carries a file across. This is not a mesh and no browser stays reachable in the background. Unattended delivery needs a reachable store, which is why the mailbox is the next lane.

## Co-editing, later

Encrypted record exchange is the baseline, and immutable captures and review decisions need no merge engine. Yjs is the preferred engine when two people must edit one draft at once (D16). It supplies merging only: it has no encryption and no check on who wrote an update, its WebRTC provider's password protects signalling, and its IndexedDB provider stores plaintext. When the lane opens, use the Yjs core with one new document per audience in which every key holder may write (R9), and give non-editors immutable records. Never send a private document's history to a wider audience by filtering what is visible now; build a new projection.

## Share and publish are separate decisions

Publication is a later lane. Three facts about the existing Green Goods path shape it:

- **Data becomes public at upload, not at the transaction.** Work media and metadata are pinned to public IPFS before the transaction is sent. For queued work that happens during background preparation, once the connection is confirmed and before the person taps Upload all.
- **The existing gate is a standing consent per account**, and that consent record is published inside the metadata.
- **Location and camera metadata are stripped** before a photo is pinned.

So a release approval must be recorded before a record is handed to that queue, must bind a digest of the exact payload to be uploaded, and must be honored again at every send (R6). Grove does not reuse the public Work queue for private records.

A link between a community and a Garden is proved by an account that wears that garden's steward or owner Hat, with a fresh role check, and kept private unless separately approved (R8). The GardenAccount's own signature follows whoever holds the garden token and is not steward authority. ATProto and Certified are optional publishers: a Certified group service holds the group account's credentials and is a delegated publisher, never Grove's identity root. IPFS and Filecoin are optional destinations for approved public artifacts. Details are in [identity and roles](identity-role-mapping.md).

## What still needs proof

Everything. In order: whether keys and captures survive on real devices (C0b), whether existing passkeys can unlock a vault (C0a), the file format and its rejections (C1), pairing and the member list (C0), recovery, and then the whole loop on a phone and a laptop (C2). The [plan](plan.todo.md#mvp-order) gives each step's exit and the [gates](eval.md#community-sharing-gates) give its pass condition. No provider account, infrastructure deployment or dependency installation is authorized by this revision.

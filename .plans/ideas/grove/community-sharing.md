# Local identity and encrypted sharing

**Accepted direction:** 13 November 2026; decisions recorded 14 November, including the corrected framing (D31 to D33). **State:** design, not implemented, and no property below has been tested. This is the identity, privacy and device-sharing contract for Green Goods working locally. It is the layer under the app and under Grove, the extension, and it does not belong to Grove. [spec.md](spec.md#decision-log) owns the decision log and cites decisions as D-numbers, recommendations as R-numbers and open questions as O-numbers. [Flows](architecture-flows.md) show the sequences, [identity and roles](identity-role-mapping.md) maps accounts and authority, the [plan](plan.todo.md#mvp-order) gives the proof order, and [research](sharing-research.md) records the sources.

**Coordinate locally. Govern together. Share by context. Publish by choice.**

The common loop is **capture → review → share**. A work report, a promise and a piece of knowledge, such as a useful article or a community lesson, enter the same loop. Recorded locally, a work report, a steward's decision on it and a promise are Green Goods' own flows working without a chain (D31). They become the onchain Work, WorkApproval and pool records only when someone publishes them, which is a later lane. On the laptop, Grove's graph helps people explore connections; it is one view of the records, alongside capture and review lists.

## Terms

These words mean one thing each across the hub. They describe the local environment and are proposals for the ontology change protocol, not ontology edits (D33).

| Term | Meaning locally | Not the same as |
|---|---|---|
| Garden | Locally, the group people belong to: a signed member list, with its roles, Actions and records on its members' devices. It can start locally and be linked to an onchain Garden by choice (D33) | Its onchain account and tokens, which exist only once the garden is published or linked |
| Community | The people of one garden. A plain word in this hub, not a separate entity | The Community garden role |
| Member | A person in a garden's member list, with a Green Goods role there. Locally a member is the set of that person's enrolled devices in that garden | An onchain role holder, which the protocol derives from Hats |
| Device | One browser profile holding its own keys: the Green Goods app on a phone or in a browser, or Grove on a laptop | A person. A passkey, which can sync to many devices |
| Member list | The garden's signed, versioned list of members, devices, roles and controllers | A Pod's access list. The onchain role graph |
| Controller | A steward whose device may sign changes to the member list | The holder of the onchain owner or operator Hat, unless the garden chooses the same person |
| Capture | Anything a member saves: a work report, a promise, or knowledge such as a guide, a lesson, a link or a page. Each keeps its origin, time and consent context as immutable revisions | A published record |
| Work report | A member's record of work they did, made through the existing work screen or free-form in their own words with photos (D34) | A published Work attestation. An approval |
| Promise | An offer or an ask, made through the existing promise screens or free-form (D34) | A promise registered in an onchain pool |
| Structured version | The agent's proposal of a free-form work report or promise in the existing shape, each value kept with the words it was read from (D35, D36). A new revision, never an edit in place | A decision. The author's approval |
| Assessment | Green Goods' own: the baseline, method, outcome targets, selected Actions and reporting period a steward or evaluator writes before work begins. Locally it is a garden record | The agent's assessment of an item, which this hub always names in full |
| Focus | What the agent takes its direction from: the garden's current assessment, plus any extra topics a steward adds to watch, such as funding or partnerships (D43) | A separate record that must be written before the agent can work |
| Agent's assessment | The agent's advice on an item it brought in: why it was brought in, its source, author and date, and what to check before sharing | The garden's assessment. A review decision. An approval |
| Intention | A signed, locally approved request to move money or tokens: a claim, an award, a vault action or a certificate. It settles only when a device connects and the right person confirms (D40) | A payment. A balance |
| Local build | The gardener app or the steward cockpit published at its own address, with no analytics and no hosted calls (D44) | Today's hosted app at its current address |
| Personal review | The author's own check and correction before anything is shared | Community review |
| Projection | The exact fields of one revision selected for one audience | The stored record. A computed view of the graph, which the workspace lane also calls a projection |
| Share approval | The author's approval of one projection for named recipients, a purpose and a destination, signed by one of the author's devices | A release approval. WorkApproval |
| Destination | Where an approved projection is going: a named garden, a named partner community, or later a public service | The recipients, which are the devices a file names. The carrier that moves the file |
| Shared file | The signed, encrypted file that carries approved projections to named devices | A backup |
| Receipt | A recipient device's signed statement that it stored a shared file | A review. A command receipt in the workspace lane |
| Review decision | A member's signed accept, reject or comment on a revision they received. A steward's decision on a work report is the local form of work approval | A published WorkApproval. Evaluator verification |
| Correction | A new revision that supersedes a received one | An edit in place |
| Release approval | A steward's approval of a projection for a partner community or the public, signed by a steward's device | The author's share approval |
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

- **The publisher of the client code is trusted.** The extension is packaged code. The local builds of the app and the cockpit are served from the web each time they update, so whoever serves it could ship code that reads an unlocked vault. Green Goods is that publisher and is trusted. O8 asks what constrains updates, and no sensitive record is admitted until the owner answers it.
- **An unlocked or compromised device exposes what it can decrypt** and can sign as its owner until it is removed.
- **Removal cannot make anyone forget.** A recipient keeps what it already received.

Hosts still see file sizes, timing, addresses and how many recipients a file has.

## What the agent reads

On the laptop, Grove's agent brings in relevant knowledge and resources as the person browses, assesses each item before the person reviews it (D26 to D30), and structures free-form reports when they are reviewed (D35). The garden's current assessment tells it what is relevant, with any extra topics a steward adds (D43). An assessment counts only when its signer could write one in the member list it was signed under: a steward, an owner or an evaluator. Extra topics count only from a steward. Anything else is refused.

- **What it may read (D27):** the text of any page the person visits, except in private windows and on a block list of sensitive sites the person can extend.
- **What it keeps (R17):** only what it brings in. Text from any other page is discarded on the device, and no address is logged. A matched page waits for its check in a queue with a limit on size and on age, and page text past either limit is dropped unchecked.
- **Where it runs:** on the laptop only, with a local model. Nothing a page contains leaves the device because the agent read it.
- **What it decides (D28):** only whether to bring an item in. It never brings in something it would recommend discarding, and it never shares. A person reviews every item and can discard it; sharing follows the approvals below (D17).
- **When the vault locks:** the agent stops. The assessment it follows is an encrypted record, so the agent cannot judge relevance while locked. Queued page text is dropped, a check in progress is cancelled, and nothing resumes until the person unlocks.
- **What the agent's assessment says (D29):** why the item was brought in, its source, author and date, and what to check before sharing, such as names, contact details and exact locations. It is advice. It cannot establish that a claim is true or that work happened.
- **What it structures (D34 to D36):** a free-form work report or promise, when someone reviews it on a laptop. It proposes the existing shape. For a work report that is the report contract Green Goods' messaging Agent already fills: title, time spent, notes, the Action's details and the photos. For a promise it is the existing promise fields. Each value keeps the words it was read from, and anything the words do not state stays empty. It picks an Action only when the garden's Action list is on the device. The proposal is a new revision. The reviewer accepts or corrects it, and if someone other than the author reviewed it, the author approves that version before it leaves the garden (D17).
- **Where its proposals appear (D41):** on a laptop, beside the app's and the cockpit's own screens, through a bridge limited to the local builds' addresses. Grove receives the record under review and no keys. Grove's own page holds the graph.

Reading every page is the largest privacy exposure in this design. The block list is the only thing between a private page and local storage, so it ships covering banking, mail, health, government accounts and password managers, and the agent skips any page with a password field (R18). E27 tests all of this, and O12 asks whether a browser store will accept the access it needs.

## Identity belongs to the community first

Keep **identity, authority, encryption and service login separate**:

| Identity or key | Purpose | Control and visibility |
|---|---|---|
| Device keys | Sign what a device sends and receive what is encrypted to it | Created on the device and stored wrapped under the vault key; they never leave the device. One signing key and one key-agreement key per device, and a separate pair for each garden (W3) |
| Member | Identify an author across their devices in one community | Created offline. No wallet, email, public registry or Solid login. Not reused across communities unless the member chooses |
| Garden, locally | Identify the group and its controllers | The member list. Its identifier is the hash of its first version, so no provider account can be its root |
| Passkey | Unlock a vault where supported (D19) | Held by the passkey provider and able to sync. It identifies no device and admits none |
| Solid WebID, ATProto or Certified account, Ethereum account, GardenAccount | Optional associations for storage, attribution or protocol actions | Later lanes. Each is a private, signed link that grants no role and no key; see [identity and roles](identity-role-mapping.md) |

**No identifier scheme is selected (R2).** The MVP identifies a device by its public keys and a community by the hash of its first member list. An earlier draft required choosing a DID method first. Nothing in the MVP needs an outside verifier, so that choice waits until one does; `did:key` can express a device key then, and it cannot rotate, so it never becomes the community's root.

### The member list

No maintained browser library provides community membership and key grants (see [dependencies](dependencies.md#community-identity-encryption-and-device-sharing)), so this project defines this part itself and keeps it small (R3). This is a design to prove in C0, not a selected format:

- The list is a chain of signed versions. Each version names the one before it by hash. The first version's hash is the community's identifier.
- One steward's device, the active signer, signs changes in the MVP (D18). A version signed by anyone else is ignored, except a takeover by a named controller.
- Each version lists members, their device keys, their roles and the controllers. Adding or removing a member or device is a new version.
- A second controller is required before real data (D18). The list names it. It can sign one kind of version, a takeover, which makes its own device the active signer and removes the old one. A takeover needs neither the lost controller's devices nor the recovery code, and after it anything the old signer signs is refused. Two versions that claim the same predecessor are a fork: clients refuse both and show the conflict. They never merge them. How the garden then gets back to one head, without the lost controller, is part of O6 and is settled before a second controller is added.
- A recovery code is created at setup (D18). It opens the steward's recovery export, which holds a succession key; that key can appoint a new controller device and do nothing else.
- A partner community is another member list. Two communities exchange their current list heads through the same pairing step members use.

Recipient clients verify the member list themselves. An edit to a Pod's access list, a storage administrator, or a login to any service cannot add a member or a device.

### Who approves

- **The author** approves every share of their own capture. The approval names the exact revision, the fields, the recipients, the purpose and the destination. Changed content, recipients or destination need a new approval, and an approval for one destination cannot be used for another. The one exception is a steward's report (D45).
- **Recipients** record review decisions and corrections. Reading a record gives no authority to release it.
- **The author again**, if a corrected version of their capture is to leave the community.
- **A steward** approves partner summaries and public releases. A steward can include an approved work report in a report to a funder or partner on that approval alone (D45).
- **Every approval is signed** by a device of the person who gives it, over a digest of the whole projection: the revision, the fields, the recipients, the purpose and the destination. A recipient checks that signature against the member list the file names. It rejects a file whose approval is missing, is signed by anyone other than the author or a steward as the case requires, or is signed by a device that list does not hold. The sending device's signature on the manifest never stands in for an approval.
- Each reviewer's decision is stored, and no "community approved" state is computed (R14). A steward's release approval names the decisions it relied on.

Community acceptance is never Green Goods WorkApproval, evaluator verification or a certified impact claim.

## Encryption contract

**Shared files (R1).** For each share, the client builds a manifest, signs it with the sending device's key, and encrypts manifest and content together under a fresh random key. It wraps that key to each recipient device's public key using one existing multi-recipient format. age v1 is such a format. HPKE (RFC 9180) wraps a key to one recipient and defines no file format, so it is a candidate only inside a named, reviewed envelope that carries one wrap per recipient. C1 chooses on what the supported devices can run (O3), and with no such envelope it chooses age. Do not hand-build a cryptographic protocol.

The signed manifest binds the community, the member-list version the sender used, the sender, the named recipients, the purpose and destination, each approval with its own signature, and a digest of each included revision and field selection. Signing before encrypting, with the recipients inside the signed part, stops a recipient passing the file on as if it were addressed to someone else. Recipients reject a file that fails its signature, names a sender who is not in the list, does not name them, repeats a file they already stored, carries an approval that fails its own check, or was built on a list older than one they hold.

A fresh key for every file means removing a member needs no group key to rotate: the next file is simply not wrapped to them. It also sets the limits:

- There is no forward secrecy. A device key that leaks later opens every stored file addressed to it, so a hosted store should delete files once they are received.
- Sender authentication comes from the signature, not from the encryption format.
- MLS (RFC 9420) would add forward secrecy and post-compromise security for live groups. It stays research until co-editing or frequent membership change justifies it.

**At rest.** Each device keeps a random vault key. Private keys and record payloads are stored encrypted under it. A device's signing and key-agreement private keys are created exportable once, wrapped under the vault key and stored only in that wrapped form. After unlock the client imports them so that scripts can use them and cannot copy them, and it drops them on lock. They are never stored in a usable form outside the vault, because same-origin code could then sign or decrypt while the vault is locked. The vault key is itself stored wrapped, once per way of opening the vault on that device. The recovery code is listed for contrast: it opens a recovery export, not the vault.

| Way in | How | Standing |
|---|---|---|
| Passkey | A secret the passkey returns through WebAuthn PRF, combined with a key that never leaves the device | D19, where the provider supports it. C0a proves which providers do |
| Passphrase | A memory-hard key derivation. C1 names the algorithm, its salt and its cost, and measures it on the supported phone and laptop | D19, everywhere the passkey path is unavailable |
| Recovery code | A high-entropy code created at setup, held off the device. It does not unwrap the vault key | D18. Opens a recovery export only |

The passkey is never the only way in (R4). Its secret belongs to the credential, so it is the same from every `greengoods.app` site and from any extension with permission for that domain, and it follows the passkey wherever it syncs. Combining it with a device-held key means neither a copied browser profile nor another site is enough alone. That device-held key is the only secret kept outside the vault: scripts can use it and cannot copy it, and it opens nothing without the passkey's secret. A passkey assertion is not an encryption key, and a synced passkey never enrols or re-admits a device.

New captures are encrypted to the device's own public key, so saving works while the vault is locked (R15). C1 states one envelope for a capture, the same whether the vault was locked or unlocked when it was made, and says when, if ever, a locked capture is rewrapped. Reading, reviewing and sharing need it unlocked. Locking clears keys and decrypted context from memory and pauses protected tasks.

## Keys, recovery and lifecycle

- **Pairing:** each side shows a code; the other scans it and both confirm a short comparison string read aloud or compared by eye. Pairing exchanges public keys and the member-list head. It grants nothing by itself: the controller's next list version does.
- **Recovery:** a member restores from a recovery export with their recovery code, or from their second device. A recovery export holds records and the member's place in the community. It never holds a device's private keys, so a backup cannot bring back the identity of a lost or removed device. A restored device creates new keys and is added to the list again; an old device key is never revived. Restoring a vault restores no Ethereum account. Losing every path fails visibly.
- **Removal:** the controller signs a version without the device. Files made after a sender holds that version are not wrapped to it. Where history must be excluded, start a new collection.
- **Stale member lists (D24):** a device stops sharing when its copy of the list is older than seven days, until a newer one arrives. Each community can change the number: the controller signs the new limit into the member list, so every device applies the same one. Capture and personal review never pause. The controller re-signs the current head at least that often so that an unchanged list still counts as fresh. Refreshing never pauses. The controller's device can re-sign the head after any length of idle time, and it can send the list alone, with no records, as a membership file. A device accepts a newer list from a shared file, a membership file or a repeated pairing, whether or not its own copy has expired. So a community whose devices all sat idle past the limit shares again once the controller re-signs and the members import the result. C0 proves the mechanism.
- **Derived data:** thumbnails, model outputs, indexes and backups are encrypted at the same boundary as their source. Pi keeps references and receipts, never decrypted sources or keys.
- **Telemetry (R7):** private records never pass through Shared's upload or telemetry helpers, which record file names and content identifiers today.
- **Failure and erasure:** a failed unlock or decryption is shown, never an empty successful record. Erasure invalidates local derivatives and pending tasks. A withdrawal cannot delete copies on other devices or in public archives (O7).

Clients track signed versions to detect a rollback they have seen before. A first contact cannot know it has the latest list, and devices that were offline together can disagree; C0 must show what each does.

## Carriers

| Carrier | Standing | Boundary |
|---|---|---|
| Encrypted file | MVP (D21) | Share sheet, a cable or any messenger can carry it. It is the only carrier and the permanent fallback |
| Direct sync between open devices | Next lane (D42, C10) | Carries the same signed, encrypted files. Needs a signalling service and often a relay, and both devices must be awake |
| Hosted mailbox | A later lane, after direct sync | A generic store of opaque objects: put, get, list and delete by an unguessable name. Solid is the preferred adapter (D12); the interface is proved first so identity and keys never depend on a provider. See the [storage spike](storage-comparison-spike.md) |
| Sensors | Later | File import first. Web Bluetooth reaches supported peripherals in Chromium only and is absent on iOS |
| KOI | Next lane | Discovery and provenance between communities. It receives only what was approved for its audience and grants no membership |

Devices keep selected copies and exchange them when a person carries a file across. That is the mesh of devices in its simplest form (D32): nothing is discovered or relayed automatically, and no browser stays reachable in the background. Direct sync between devices that are open at the same time is the next lane (D42). Unattended delivery needs a reachable store, which is why the mailbox follows it.

## Co-editing, later

Encrypted record exchange is the baseline, and immutable captures and review decisions need no merge engine. Yjs is the preferred engine when two people must edit one draft at once (D16). It supplies merging only: it has no encryption and no check on who wrote an update, its WebRTC provider's password protects signalling, and its IndexedDB provider stores plaintext. When the lane opens, use the Yjs core with one new document per audience in which every key holder may write (R9), and give non-editors immutable records. Never send a private document's history to a wider audience by filtering what is visible now; build a new projection.

## Money settles when connected

Money and tokens cannot move on local devices (D40). A cookie-jar claim, a voucher award, a vault action or a certificate is prepared and approved locally as a signed intention, under today's rules and limits. An intention names its amount, its purpose and its approver. It settles only when a device connects and the right person confirms it, once. Until then nothing has moved, and every screen says so. Balances shown locally are last-known and carry their date. F7 designs the intention's format and who may confirm each kind (O14), and E38 tests it.

## Share and publish are separate decisions

Publishing to the chain is a later lane. Three facts about the existing Green Goods upload path shape it:

- **Data becomes public at upload, not at the transaction.** Work media and metadata are pinned to public IPFS before the transaction is sent. For queued work that happens during background preparation, once the connection is confirmed and before the person taps Upload all.
- **The existing gate is a standing consent per account**, and that consent record is published inside the metadata.
- **Location and camera metadata are stripped** before a photo is pinned.

So a release approval must be recorded before a record is handed to that queue, must bind a digest of the exact payload to be uploaded, and must be honored again at every send (R6). In local operation a work report stays out of that queue until then.

A link between a local garden and its onchain Garden is proved by an account that wears that garden's steward or owner Hat, with a fresh role check, and kept private unless separately approved (R8). The GardenAccount's own signature follows whoever holds the garden token and is not steward authority. ATProto and Certified are optional publishers: a Certified group service holds the group account's credentials and is a delegated publisher, never the local identity root. IPFS and Filecoin are optional destinations for approved public artifacts. Details are in [identity and roles](identity-role-mapping.md).

## What still needs proof

Everything. In order: whether keys and captures survive on real devices (C0b), whether existing passkeys can unlock a vault (C0a), the file format and its rejections (C1), pairing and the member list (C0), recovery, and then the whole loop on a phone and a laptop (C2). The [plan](plan.todo.md#mvp-order) gives each step's exit and the [gates](eval.md#community-sharing-gates) give its pass condition. No provider account, infrastructure deployment or dependency installation is authorized by this revision.

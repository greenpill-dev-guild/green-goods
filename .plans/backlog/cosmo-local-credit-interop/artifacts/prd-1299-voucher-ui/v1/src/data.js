/* Review data: version, sources and their status, journeys (walks), the role/action matrix,
   decisions and terminology. build.mjs also reads this file to write the markdown matrices, so the
   artifact and the repository handoff can't drift. English only: this is review apparatus, not
   product copy. */
GG.VERSION = { name: "PRD-1299 design v1", date: "2026-10-22", label: "v1 · 22 Oct 2026" };

GG.TAGS = {
  req: ["req", "Approved requirement"],
  sel: ["sel", "Selected design, not built"],
  ui: ["loc", "Design proposal (this package)"],
  open: ["open", "Open decision"],
  dep: ["gap", "Enforcement pending"],
  live: ["live", "Live today"],
  reh: ["open", "Rehearsal only"]
};

GG.JOURNEYS = {
  entry: "Entry and discovery", gd: "Cross-garden personal G$ purchase", vs: "Voucher service (escrow, acceptance, final split)",
  hx: "Holdings, purchases and voucher exchange", rw: "Linked G$ and voucher rewards", is: "Issuer admission and caps (proposed)"
};

GG.WALKS = [
  { id: "W1", title: "G$ purchase: the member", surface: "member", steps: [
    ["M01@default", "Lina's Home. Her active garden is Riverside Commons Garden."],
    ["M02@ggcg", "She visits Green Goods Community Garden. Visiting doesn't change her active garden."],
    ["M03@default", "The AI membership offer takes her own G$, with approval. Price in G$ only."],
    ["M04@garden", "She picks the garden that holds her payment: one where she is a member."],
    ["M04@details", "Service recipient, refund destination, and the top-up choice (off by default)."],
    ["M04@review", "Every consented fact on one screen: gross, fee and net, custody in plain words, the order of events, two prompts."],
    ["M05@ready", "Transaction review: G$ on Celo to the buyer garden's registered Safe, with a reference."],
    ["M05@sent", "Sent. Not yet checked."],
    ["M06@sent", "Her purchase page: waiting for a Riverside Commons steward. Age is metadata."],
    ["M06@checked", "A steward recorded the deposit. Waiting for the provider."],
    ["M06@accepted", "Accepted doesn't mean paid: the deposit is applied next."],
    ["M06@applied", "Deposit applied. Access is a separate, external status."],
    ["M06@active", "The provider reports access active. Lina confirms the promise was kept."],
    ["M06@payout", "Payout to the provider's team under its payout plan. Sent is not confirmed."],
    ["M06@done", "Closed."]
  ] },
  { id: "W2", title: "G$ purchase: the two gardens' stewards", surface: "steward", steps: [
    ["S03@check", "Riverside Commons (buyer garden): the proposed Member Deposits card shows Lina's G$ to check."],
    ["S04@exact", "Check Deposit: the Celo read beside the steward's own attestation."],
    ["S04@recorded", "Recorded."],
    ["S01@default", "Green Goods Community Garden (provider): two asks; only Lina's has a recorded deposit."],
    ["S02@ready", "Guarded approval: sourced checks, protocol pool warning, the consequence before signing."],
    ["S02@done", "Approved."],
    ["S03@apply", "Back at Riverside Commons: apply the deposit to the accepted promise."],
    ["S05@ready", "Apply states the exclusive outcome: payout or refund, never both."],
    ["S06@payout", "Payout plan by recognition, preserved. Access recorded separately."]
  ] },
  { id: "W3", title: "G$ purchase: exceptions and recovery", surface: "both", steps: [
    ["M05@unknown", "Uncertain result: Send is replaced by Check Transfer."],
    ["M05@found", "Lookup found the transfer. No second payment."],
    ["M05@sponsor", "Sponsorship failed: nothing sent, two honest options."],
    ["M06@underpaid", "10.00 G$ short: send the rest, or withdraw."],
    ["S04@short", "The steward can't record below the price. Returning happens off-record from the Safe."],
    ["M06@stale", "The provider changed the terms: fresh consent, maybe a top-up."],
    ["S02@stale", "The provider can't approve on old consent."],
    ["S02@unverified", "No deposit recorded: Approve stays off (decision D1)."],
    ["M06@declined", "Declined: full recorded refund queued."],
    ["S06@refundfail", "Refund failed on Celo: requeue the same refund."],
    ["M06@refundfail", "The member sees the delay, the owner, and that it can't pay twice."],
    ["M06@refunded", "Refunded."],
    ["S04@late", "A deposit after withdrawal: record it and queue the full refund."],
    ["M06@late", "The member sees the same facts."],
    ["M04@offline", "Offline: agreements and payments never queue."]
  ] },
  { id: "W4", title: "Voucher service: the holder", surface: "member", steps: [
    ["M02@sunroot", "Visiting Sunroot Skills Hub (fictional issuer). Offers name the vouchers they take."],
    ["M07@default", "The offer: 100 Sunroot vouchers for 10 lessons, remedy and acceptance window disclosed."],
    ["M08@terms", "Exact terms and every lifecycle rule before consent."],
    ["M08@accounts", "Two accounts: the Green Goods account agrees; the Gnosis wallet holds and deposits."],
    ["M08@approval", "Sunroot approves the setup before the escrow takes vouchers."],
    ["M08@deposit", "Deposit review on Gnosis: exact amount, escrow for this promise, two prompts."],
    ["M08@wait", "Deposited. Escrow proof sent, not yet received."],
    ["M09@proof", "The holder's page while proof is in transit. Cancel is still possible."],
    ["M09@ready", "Escrow ready. Sunroot accepts by the cutoff, or the holder can cancel."],
    ["M09@started", "Accepted and active on Gnosis. Report a Problem replaces Cancel Setup."],
    ["M09@lessons", "3 of 10 lessons reported with proof; Sunroot proposes ending early."],
    ["M10@review", "Final split: approve delivered lessons and the full allocation, separately."],
    ["M10@ready", "Both confirmations given. Freezing is final."],
    ["M10@frozen", "Frozen. Read-only."],
    ["M09@moving", "Two transfers, each with its own state."],
    ["M09@settled", "Financially closed. Not a kept mark; not an outside service."]
  ] },
  { id: "W5", title: "Voucher service: issuer and provider", surface: "steward", steps: [
    ["S07@ready", "Issuer approves the setup: approval is not acceptance. Cap shown as policy."],
    ["S07@partial", "Multisig: 1 of 2 signatures."],
    ["S07@done", "Approved."],
    ["S08@ready", "Guarded acceptance: consent, escrow proof, window."],
    ["S08@done", "Accepted. Activation on Gnosis pending until it replies."],
    ["S09@delivered", "Delivered lessons from evidence rows."],
    ["S09@split", "Split within the remedy; nothing calculated per lesson."],
    ["S09@review", "Issuer authorization and the consequence."],
    ["S09@sent", "Sent. Editable until the holder freezes."],
    ["S10@inflight", "Legs sent."],
    ["S10@settled", "Settled. Released vouchers return to the reserve; nothing is burned."]
  ] },
  { id: "W6", title: "Voucher service: exceptions and races", surface: "both", steps: [
    ["M09@revised", "Revised terms: fresh consent before anything continues."],
    ["S08@stale", "The provider can't accept on old consent."],
    ["M09@cutoff", "Window passed: vouchers stay in escrow until the holder cancels."],
    ["S08@cutoff", "The provider can't accept after the window."],
    ["M09@cancelpending", "Cancellation sent; the race is explained before the outcome is known."],
    ["S08@race", "The provider sees the pending cancellation; only one outcome counts."],
    ["M09@canceled", "Cancellation won: all 100 back."],
    ["M09@crossed", "Acceptance won: the promise started; remedy path instead of cancel."],
    ["M08@depunknown", "Uncertain deposit: check the escrow before retrying."],
    ["S08@noproof", "A sent message is not proof."],
    ["M10@outside", "A proposal above the issuer's authorized return is blocked."],
    ["S09@outside", "The provider sees the same limit while drafting."],
    ["M09@legfail", "Release done, refund failed: retry sends the same 60."],
    ["S10@legfail", "Steward view of the same leg."],
    ["S10@ackwait", "Done on Gnosis, confirmation not back: not a failure."],
    ["M10@full", "Full discharge variant."],
    ["M10@none", "Full return variant."]
  ] },
  { id: "W7", title: "Holdings and the voucher exchange", surface: "member", steps: [
    ["M12@default", "Wallet › Vouchers (proposed tab): issuer, unit, network; escrow listed apart."],
    ["M12@detail", "Earned and bought on separate lines."],
    ["M14@quote", "Exchange quote: rehearsal banner, local price, inventory, minimum output."],
    ["M14@assets", "Only directly accepted assets; no G$."],
    ["M14@review", "Transaction review: allowance then swap."],
    ["M14@approved", "Allowance given."],
    ["M14@done", "Bought, not earned. Buy More buys again."],
    ["M14@stale", "Quote expired."],
    ["M14@low", "Inventory too low."],
    ["M14@unknown", "Uncertain result: receipt lookup first."],
    ["M14@receipt", "Receipt found."],
    ["M12@stale", "Stale balances keep their values with a time."],
    ["M12@nowallet", "No Gnosis wallet: connect."]
  ] },
  { id: "W8", title: "Linked G$ and voucher rewards (PRD-1323/1324)", surface: "both", steps: [
    ["M16@default", "Promises sheet rows: \"Pays\" and \"Takes\", issuer named, never summed."],
    ["M15@open", "A request paying 120 G$ and 20 vouchers, as two lines."],
    ["M15@consent", "Exact reward consent, with each recipient account."],
    ["M15@nognosis", "No Gnosis recipient: consent blocked."],
    ["M15@kept", "Kept: G$ received, vouchers on the way."],
    ["S13@gdone", "Steward inspector: one reward done, one pending."],
    ["S13@vfail", "Voucher delivery failed: retry the same reward record."],
    ["M15@vfail", "Member sees the delay and the owner."],
    ["S13@both", "Both received."],
    ["M15@both", "Both received."],
    ["S13@gardener", "Gardener issuer: admission status and current cap."],
    ["S13@legacy", "Legacy promise: no implied voucher reward."]
  ] },
  { id: "W9", title: "Issuer admission, caps and pause (proposed)", surface: "steward", steps: [
    ["S12@default", "Voucher Issuers card: every cap and admission says \"policy\"."],
    ["S11@identity", "Admit a gardener: a distinct issuer identity."],
    ["S11@terms", "Published terms."],
    ["S11@cap", "Cap and growth rule."],
    ["S11@review", "Record Admission, not Enable."],
    ["S11@saved", "Recorded as policy."],
    ["S12@pause", "Record a Pause: states what the contracts can't do."],
    ["M07@paused", "Member view of a paused issuer."]
  ] },
  { id: "W10", title: "Where personal purchases live", surface: "member", steps: [
    ["M01@needs", "The Wallet launcher counts purchases that need the member."],
    ["M13@default", "Wallet › Purchases (proposed): own G$ and voucher purchases across gardens."],
    ["M13@empty", "Empty state."]
  ] }
];

GG.ROLES = [
  { a: "Agree to an own-G$ purchase (request and pledge)", who: "Buyer (gardener)", acct: "Green Goods account · Arbitrum", pre: "Offer opted in to the personal G$ route, approval-gated; buyer holds a role in the buyer garden; buyer garden has a registered Celo Safe", ev: "Offer at its terms revision; garden roles; settlement account registry", auth: "Provider, buyer garden, service recipient, terms revision, service units, price, refund account, top-up choice", pend: "Account prompt", ok: "Request and pledge recorded", fail: "Nothing recorded; inputs kept", rec: "Buyer retries. A revision change needs fresh consent.", scr: "M04", tags: ["req", "sel"] },
  { a: "Send G$ to the buyer garden's Safe", who: "Buyer", acct: "Green Goods account · Celo", pre: "Pledge recorded", ev: "Registry Safe address; live G$ token fee", auth: "Gross, token fee, net arrival, destination, network fee or sponsorship, reference", pend: "Account prompt", ok: "Transfer hash (payment sent, not checked)", fail: "Rejected, sponsorship failed, insufficient G$, or uncertain", rec: "Buyer looks the transfer up by reference before any resend. Nothing queues offline.", scr: "M05", tags: ["req", "sel"] },
  { a: "Record a member's deposit (attestation)", who: "Buyer-garden settlement steward", acct: "Steward wallet · Arbitrum", pre: "Pledge names this garden; fresh Celo read of a matching transfer", ev: "Celo transfer log (time-stamped); pledge expected amount, refund account, top-up consent", auth: "The net amount that arrived for this pledge", pend: "Wallet prompt", ok: "Deposit recorded", fail: "Stale read, not found, or underpaid (cannot record below price)", rec: "Refresh. Ask for the rest. An unrecorded underpayment is returned from the Safe by its signers, outside the record (D4).", scr: "S03, S04", tags: ["req", "sel", "open"] },
  { a: "Approve an own-G$ request (guarded acceptance)", who: "Provider steward", acct: "Steward wallet · Arbitrum", pre: "Exact consent to the current revision; deposit recorded (prototype rule, D1); pool open", ev: "Signed request; funding record; terms revision", auth: "Acceptance of one claim, closing the others", pend: "Wallet prompt", ok: "Accepted (not yet funded)", fail: "Unchanged", rec: "Provider retries. Stale consent: buyer agrees again.", scr: "S01, S02", tags: ["req", "sel", "open"] },
  { a: "Apply the deposit to the accepted promise", who: "Buyer-garden settlement steward", acct: "Steward wallet · Arbitrum", pre: "Accepted with the funder as counterparty; deposit recorded", ev: "Pooling read; funding record", auth: "Binding the deposit to one exclusive outcome", pend: "Wallet prompt", ok: "Funding applied", fail: "Blocked until accepted", rec: "Wait for acceptance. May become automatic at acceptance (confirm).", scr: "S05", tags: ["sel", "open"] },
  { a: "Set up and report external access", who: "Provider (offer holder), its steward, or its integration", acct: "Open (record or callback)", pre: "Funding applied", ev: "Provider's membership system", auth: "Access active or not provided", pend: "-", ok: "Access active (reported, dated)", fail: "Not provided", rec: "Buyer uses Not Yet or the dispute path.", scr: "S06, M06", tags: ["ui", "open"] },
  { a: "Confirm the purchase was kept", who: "Buyer", acct: "Green Goods account · Arbitrum", pre: "Promise active; access reported", ev: "Provider report and evidence", auth: "Kept (existing confirm flow)", pend: "Account prompt", ok: "Fulfilled", fail: "Unchanged", rec: "Existing Not Yet and dispute paths.", scr: "M06", tags: ["live", "sel"] },
  { a: "Pay out under the payout plan", who: "Buyer-garden settlement steward (payer garden)", acct: "Steward wallet · Arbitrum; executor on Celo", pre: "Fulfilled", ev: "Payout plan; recognition snapshot", auth: "Existing plan: create, split by recognition, finalize, prepare, dispatch", pend: "Dispatched; waiting for Celo acknowledgment", ok: "Confirmed; funding closed", fail: "Failed child", rec: "Requeue the same child (steward).", scr: "S06", tags: ["live", "sel"] },
  { a: "Refund the recorded deposit", who: "Buyer-garden settlement steward", acct: "Steward wallet · Arbitrum; executor on Celo", pre: "Declined, withdrawn, canceled or expired; never after kept", ev: "Funding record; pooling terminal state", auth: "Full recorded amount to the immutable refund account", pend: "Queued, dispatched", ok: "Refunded (acknowledged)", fail: "Failed attempt", rec: "Requeue the same refund child (steward). It can't be canceled or duplicated.", scr: "S03, S06, M06", tags: ["req", "sel"] },
  { a: "Withdraw a request", who: "Buyer", acct: "Green Goods account · Arbitrum", pre: "Before acceptance", ev: "Claim state", auth: "Withdrawal", pend: "Account prompt", ok: "Withdrawn; refund owed if a deposit was recorded", fail: "Unchanged", rec: "Late deposit: steward records then refunds.", scr: "M06", tags: ["req", "sel"] },
  { a: "Agree to voucher terms", who: "Source buyer", acct: "Green Goods account · Arbitrum", pre: "Offer revision current; issuer not paused (policy)", ev: "Voucher terms record", auth: "Exact revision, voucher amount, remedy, acceptance window, cancellation rules", pend: "Account prompt", ok: "Consent recorded; setup prepared", fail: "Nothing recorded", rec: "Retry; a revision change needs fresh consent.", scr: "M08", tags: ["req", "sel"] },
  { a: "Approve a voucher setup", who: "Issuer authority", acct: "Issuer Safe · Gnosis (multisig)", pre: "Setup prepared for this promise, presenter, token and amount", ev: "Setup and consent records", auth: "The escrow may take this exact deposit", pend: "Signatures collected", ok: "Setup approved", fail: "Missing signer", rec: "Setup waits; holder may cancel.", scr: "S07, M08", tags: ["req", "sel"] },
  { a: "Deposit vouchers into escrow", who: "Voucher holder", acct: "Gnosis wallet (not the passkey account)", pre: "Issuer approved; balance sufficient", ev: "Gnosis balance; setup record", auth: "Allowance and deposit of the exact amount, keyed to this promise", pend: "Two wallet prompts", ok: "Deposited", fail: "Rejected or uncertain", rec: "Holder checks the escrow before any retry.", scr: "M08", tags: ["req", "sel", "open"] },
  { a: "Deliver escrow evidence", who: "System (authenticated message)", acct: "Gnosis to Arbitrum", pre: "Deposit confirmed", ev: "Authenticated escrow receipt", auth: "-", pend: "Sent, not received", ok: "Received; escrow ready", fail: "Delayed", rec: "Wait; no manual override. Holder may cancel before acceptance.", scr: "M08, M09, S08", tags: ["req", "sel"] },
  { a: "Accept a voucher request (guarded)", who: "Provider steward", acct: "Steward wallet · Arbitrum", pre: "Exact consent current; escrow evidence received; inside the window", ev: "Consent record; escrow receipt; window", auth: "Acceptance", pend: "Wallet prompt", ok: "Accepted; activation pending", fail: "Blocked or lost the race to cancellation", rec: "Blocked: wait or holder re-consents. Race: one outcome is shown.", scr: "S08", tags: ["req", "sel"] },
  { a: "Activate the promise on Gnosis", who: "System (message)", acct: "Arbitrum to Gnosis", pre: "Accepted", ev: "Activation acknowledgment", auth: "-", pend: "Sent", ok: "Done on Gnosis; confirmed", fail: "Delayed", rec: "Resend the same activation.", scr: "M09, S10", tags: ["sel"] },
  { a: "Cancel a voucher setup", who: "Holder", acct: "Green Goods account · Arbitrum; abort on Gnosis", pre: "Not accepted", ev: "Escrow state", auth: "Authenticated abort and setup refund", pend: "Cancellation on its way", ok: "All vouchers back, or acceptance won the race", fail: "Delayed", rec: "Resolves to one outcome. A timer never refunds.", scr: "M09", tags: ["req", "sel", "open"] },
  { a: "Deliver the service and add evidence", who: "Provider (offer holder and team)", acct: "Green Goods account · Arbitrum", pre: "Promise accepted and active", ev: "Existing proof records (media, notes, links)", auth: "Evidence per delivered unit", pend: "Proof uploading (the existing proof queue may hold evidence offline; it never holds money)", ok: "Evidence on the promise", fail: "Proof failed to send (DL-075)", rec: "Try Again or Discard on the proof (provider).", scr: "S09, M09", tags: ["live", "sel"] },
  { a: "Report delivery and propose the final split", who: "Provider steward (or the offer holder; confirm, D10), with issuer authorization", acct: "Steward wallet · Arbitrum; issuer Safe · Gnosis", pre: "Promise active; delivery evidence", ev: "Evidence records; remedy terms", auth: "Delivered units; allocation within the remedy; authorized return", pend: "Sent to the holder", ok: "Waiting for freeze", fail: "Outside the authorization (blocked)", rec: "Edit until frozen.", scr: "S09", tags: ["req", "sel", "open"] },
  { a: "Approve delivered units and freeze the split", who: "Holder", acct: "Green Goods account · Arbitrum (confirm, D10)", pre: "Proposal within the remedy and authorized", ev: "Delivery evidence; authorization record", auth: "Delivered units and the full allocation, irreversibly", pend: "Account prompt", ok: "Frozen; two legs start", fail: "Unchanged", rec: "Not Yet routes to the dispute path. After freeze: only retries.", scr: "M10", tags: ["req", "sel", "open"] },
  { a: "Release and refund legs", who: "System; retry by holder or provider steward (D9)", acct: "Gnosis (escrow)", pre: "Frozen", ev: "Escrow per-leg state and acknowledgments", auth: "Same amounts and recipients", pend: "Sent", ok: "Done on Gnosis; confirmed; closed when both settle", fail: "One leg failed", rec: "Retry the same leg.", scr: "M09, S10", tags: ["req", "sel", "open"] },
  { a: "Swap at a voucher exchange", who: "Buyer", acct: "Gnosis wallet", pre: "Pool takes the asset directly; fresh quote; inventory", ev: "Pool quoter and balance", auth: "Amount, minimum output, deadline, recipient, fee", pend: "Two wallet prompts", ok: "Received (bought, not earned)", fail: "Stale, low inventory, rejected, sponsorship, uncertain", rec: "Receipt lookup before buying again.", scr: "M14", tags: ["req", "sel", "reh"] },
  { a: "Agree to linked rewards", who: "Contributor", acct: "Green Goods account; Gnosis recipient bound", pre: "Request with G$ and voucher terms", ev: "Terms records", auth: "Each reward's amount, source, network and recipient", pend: "Account prompt", ok: "Accepted with both terms", fail: "Blocked without a Gnosis recipient", rec: "Connect a wallet, then agree.", scr: "M15", tags: ["req", "sel"] },
  { a: "Approve a request's voucher payment", who: "Requesting-garden steward", acct: "Steward wallet · Arbitrum (and the garden's Gnosis holder)", pre: "Garden holds the vouchers", ev: "Terms record; holdings", auth: "Source of the voucher payment", pend: "Wallet prompt", ok: "Approved", fail: "Unchanged", rec: "Retry.", scr: "S13", tags: ["req", "sel", "open"] },
  { a: "Deliver a voucher reward", who: "System (adapter); retry by requesting steward", acct: "Gnosis", pre: "Kept; entitlement derived", ev: "Stored delivery result", auth: "-", pend: "Sent", ok: "Delivered; confirmed", fail: "Stored failure", rec: "Retry the same entitlement after repair.", scr: "S13, M15", tags: ["req", "sel"] },
  { a: "Admit a gardener issuer", who: "Garden steward (authority open)", acct: "Policy record", pre: "Member; issuer terms (COM-46)", ev: "Terms draft", auth: "Identity, terms, cap", pend: "-", ok: "Admitted (policy)", fail: "-", rec: "Edit or revoke the record.", scr: "S11, S12", tags: ["ui", "dep", "open"] },
  { a: "Record an issuer pause", who: "Garden steward", acct: "Policy record", pre: "Admitted issuer", ev: "-", auth: "A visible pause decision (not enforcement)", pend: "-", ok: "Recorded", fail: "-", rec: "Lift the record.", scr: "S12", tags: ["dep", "open"] }
];

GG.DECISIONS = [
  { id: "D1", afo: true, t: "Can a provider accept an own-G$ request before its deposit is recorded?", rec: "No. Approve stays off until the buyer-garden steward records the deposit; accepted and applied stay separate states.", why: "The brief rules out a hidden garden subsidy. Today's settlement spec lets acceptance proceed without a deposit, which fronts the service from the Safe.", owner: "Afo; confirm against the SettlementModule upgrade" },
  { id: "D2", afo: true, t: "Where do members track personal purchases and voucher holdings?", rec: "Two new Wallet tabs, Vouchers and Purchases, beside Tokens and Cookies; the Wallet launcher counts what needs the member.", why: "Purchases sit in another garden's pool, and the locked PWA rule says garden sheets never mix gardens. The wallet is the member's own account surface.", owner: "Afo (PWA lock owner)" },
  { id: "D3", afo: true, t: "Where do buyer-garden stewards check and refund members' deposits?", rec: "A Member Deposits card on the buyer garden's Promises tab, under Review Promises (amends DL-068's rail order).", why: "It is a different object from promises, so it earns its own card, and it sits beside the asks it unblocks.", owner: "Afo (design lock)" },
  { id: "D4", afo: false, t: "Underpayment and unapproved excess", rec: "The record never takes less than the price. An unrecorded underpayment returns from the Safe, outside the record. Excess the member didn't approve as a top-up comes back with the outcome.", why: "The brief requires an express top-up approval; the existing spec turns any excess into a top-up on delivery.", owner: "Contract session (SettlementModule upgrade)" },
  { id: "D5", afo: false, t: "Acceptance window and who may trigger the abort after it", rec: "Show a fixed window from escrow readiness. Only the holder cancels; time alone never refunds.", why: "Locked rule: a timer or delayed acknowledgment never authorizes a refund.", owner: "COM-46 terms; reconciliation handoff" },
  { id: "D6", afo: false, t: "Network fee sponsorship for personal purchases on Celo and Gnosis", rec: "Show sponsorship when it is available and name its failure; never hide the fee.", why: "Sponsorship policy for personal spending isn't set.", owner: "Operations" },
  { id: "D7", afo: false, t: "Live purchase asset for voucher exchanges", rec: "WXDAI stays labeled as rehearsal only. No live asset is shown until one is selected.", why: "WXDAI is the rehearsal asset; PRD-1197 and COM-46 decide anything live.", owner: "PRD-1197, COM-46" },
  { id: "D8", afo: false, t: "Gnosis holder account for the pilot", rec: "Name two accounts: the Green Goods account agrees and freezes; an external Gnosis wallet holds and deposits.", why: "The passkey validator doesn't exist on Gnosis yet.", owner: "PRD-1315 (Gnosis member accounts)" },
  { id: "D9", afo: false, t: "Who may retry a failed release or refund leg", rec: "The holder and the provider steward, always with the frozen amounts.", why: "The retry must not need the party who may have caused the failure.", owner: "Reconciliation handoff" },
  { id: "D10", afo: false, t: "Who proposes the final split, and which account freezes it", rec: "The provider proposes with issuer authorization; the holder freezes with the Green Goods account.", why: "Matches the locked flow (holder reviews and freezes). The account binding must be confirmed.", owner: "Reconciliation handoff" },
  { id: "D11", afo: false, t: "Source of a request's voucher payment", rec: "Show the source on every reward line: the requesting garden's own vouchers, or earned issuance from the issuer's reserve.", why: "PRD-1317 allows both; the pilot may use one.", owner: "PRD-1315" },
  { id: "D12", afo: true, t: "Gardener issuer admission, caps and pause before enforcement exists", rec: "Draw them as policy records with \"policy\" chips and \"Record\" verbs in Community › Members. No switch that looks like enforcement.", why: "Independent steward suspension, per-gardener identity and caps are unresolved in PRD-1315.", owner: "Afo; PRD-1315" },
  { id: "D13", afo: false, t: "How external access is reported", rec: "A dated status with its source; payment never sets it.", why: "Provisioning is a separate integration.", owner: "Product and the provider integration" },
  { id: "D14", afo: true, t: "What a partly delivered service promise shows as its outcome", rec: "Keep the promise's outcome separate from the voucher split. The page shows \"3 of 10 lessons delivered\" and the frozen split, and leaves the promise's kept status to its own confirmation.", why: "The core has no partial-kept state, and the locked rule forbids letting a settlement mark the promise fulfilled.", owner: "Afo; contract session" }
];

GG.TERMS = [
  { id: "T1", term: "voucher, named with issuer and unit", st: "Decided 21 Oct", en: "Sunroot Skills Hub voucher · 100 Sunroot vouchers", es: "vale de Sunroot Skills Hub · 100 vales de Sunroot", pt: "vale da Sunroot Skills Hub · 100 vales de Sunroot", note: "Never credit, token or points on the instrument. The wallet's existing Tokens tab is not used for vouchers." },
  { id: "T2", term: "earn / buy / swap / use", st: "Proposal, recommend adopt", en: "earned · bought · swap · use at an offer", es: "ganados · comprados · intercambiar · usar en un ofrecimiento", pt: "ganhos · comprados · trocar · usar em uma oferta", note: "\"Bought, not earned\" is a fixed phrase. \"Use\" means presenting vouchers at an offer; \"swap\" only appears at an exchange." },
  { id: "T3", term: "voucher exchange (a Cosmo-Local pool)", st: "Proposal, recommend adopt", en: "Sunroot voucher exchange", es: "intercambio de vales de Sunroot", pt: "troca de vales da Sunroot", note: "\"Pool\" keeps meaning a Green Goods promise pool." },
  { id: "T4", term: "vale (es, pt)", st: "Proposal, Gui to review pt", en: "voucher", es: "vale", pt: "vale", note: "Masculine in both. Plural vales." },
  { id: "T5", term: "kept (promises) vs used (vouchers)", st: "Proposal, recommend adopt", en: "Kept · used", es: "Cumplida · usados", pt: "Cumprida · usados", note: "Settled vouchers are \"settled\", not \"kept\" and not \"redeemed\"." },
  { id: "T6", term: "escrow", st: "New proposal", en: "escrow", es: "depósito de garantía", pt: "depósito em garantia", note: "Long in es and pt; the prototype tests it. Never used for G$ held in a garden Safe, which is described as custody by stewards." },
  { id: "T7", term: "freeze the final split", st: "New proposal", en: "Freeze Split · final split", es: "Fijar el reparto · reparto final", pt: "Fixar a divisão · divisão final", note: "Signals irreversibility without a legal term." },
  { id: "T8", term: "Redeem", st: "Decided (reserved)", en: "Redeem (vaults only)", es: "Redimir (solo bóvedas)", pt: "Resgatar (somente cofres)", note: "Never used for vouchers." },
  { id: "T9", term: "Record a Pause / Record Admission", st: "New proposal", en: "Record a Pause · Record Admission", es: "Registrar una pausa · Registrar admisión", pt: "Registrar uma pausa · Registrar admissão", note: "\"Record\" marks a policy record that isn't enforced." },
  { id: "T10", term: "custody of a member's G$", st: "New proposal", en: "held by Riverside Commons stewards · a Safe its stewards control", es: "lo guardan los responsables · un Safe que controlan sus responsables", pt: "guardado pelos responsáveis · um Safe controlado pelos responsáveis", note: "Never \"escrow\", never \"trustless\"." }
];

GG.TAGS.none = ["neu", "Not implemented"];
GG.TAGS.local = ["neu", "Local only, not inspected"];

GG.SOURCES = [
  ["req", "21 Oct voucher direction: promises run on vouchers; curated gardener issuance; presentment opens a promise; the instrument is a voucher; curated, capped issuance.", "spec.md § Voucher direction; Linear PRD-1315 (read 22 Oct)"],
  ["req", "Voucher and G$ terms bind at acceptance. One commitment may carry both, each with its own receipt.", "Linear architecture document (20 Oct); PRD-1299, PRD-1323, PRD-1324"],
  ["req", "Locked A, B and C: escrow before promise activation; exact consent enforced before core acceptance; one immutable final split per escrow.", "codex-voucher-reconciliation.md as summarized in the 22 Oct session brief. The file sits in another session's local checkout and could not be read here."],
  ["req", "Cross-garden personal G$ purchase: opted-in, approval-gated Individual Offer; buyer garden Safe custody; steward attestation; full settlement or full refund of the recorded net deposit.", "22 Oct session brief (service-access handoffs, not readable here)"],
  ["req", "PWA: garden-scoped Home, sheets never mix gardens, visiting never switches gardens. Locked card picks for both surfaces.", "pwa-interface-simplification spec (18 to 21 Oct); app-cockpit-unification spec (18 and 21 Oct); design decision log to DL-096"],
  ["sel", "Contract inventory: CommitmentPooling and SettlementModule upgraded; VoucherEntitlementModule, GnosisVoucherAdapter, VoucherRedemptionModule and GnosisVoucherEscrow new; registry, Hats, Celo executor, G$, Safes, CCIP and the CLC token and pool reused.", "22 Oct session brief. spec.md and PRD-1315 still record the 20 Oct no-core-upgrade boundary; the brief supersedes them."],
  ["sel", "Member funding states (Pledged, DepositRecorded, Consumed, Closed, RefundQueued, Refunded, Withdrawn) and the payout plan split by recognition.", "commitment-pooling settlement-spec.md §3; Shared settlement-workflow module"],
  ["live", "G$ commitment pooling with Celo settlement: offers, requests, claims, confirmation and payout plans.", "Arbitrum and Celo. The 20 Oct snapshot (42 commitments, no payout plans, no member funding) was not refreshed here."],
  ["live", "Cosmo-Local v1.0.0 contracts deployed on Gnosis by CLC; the first-slice implementations match the published artifacts.", "claude-conformance-evidence-2026-10-20.md"],
  ["none", "Nothing voucher-related exists on develop (20d8c812) or any pushed branch. No cockpit screen calls the existing recordFundingDeposit hook.", "Search of every remote branch and of packages/, 22 Oct"],
  ["local", "Another session's local checkpoint may hold voucher contracts, stories and walkthroughs from the older lifecycle (acceptance before escrow, incremental release). Not inspected, not treated as the target.", "22 Oct session brief"],
  ["open", "Go or no-go for the two voucher pools (PRD-1197, due 22 Oct). PRD-651 release gates unchanged. Issuer terms (COM-46) not agreed.", "Linear, read 22 Oct"]
];

GG.EVIDENCE = "Rendered evidence in this package shows the hand-built prototype, not the product: headless Chromium through Playwright 1.56 in the cloud session, mock data, no sign-in, no wallet, no chain. Product rendered proof: none, because none of these screens is implemented; there is no authenticated Brave, mock-auth localhost, Storybook or CI Playwright proof. Transaction prompts, sponsorship, cross-chain messages, indexer freshness, Celo and Gnosis reads, multisig signatures and races are drawn as states, never executed. Fees, prices, addresses, dates, people and every garden other than Green Goods Community Garden are fictional. The four reconciliation and service-access handoffs named in the brief were not readable from this environment; the design follows the brief's summary of them, and each fact to confirm is marked in the notes and the handoff.";

GG.MAPS = [
  { title: "Cross-garden personal G$ purchase", sub: "A gardener completes a course requested by Garden A, receives G$, and spends her own G$ on an AI membership offered through Green Goods' pool.",
    stages: ["Discover", "Agree", "Pay", "Verify", "Accept", "Fund", "Deliver", "Close or refund"],
    lanes: [
      ["Buyer (member app)", ["M01", "M02@ggcg", "M03"], ["M04@garden", "M04@review"], ["M05@ready", "M05@unknown"], ["M06@sent", "M06@underpaid"], ["M06@checked", "M06@stale"], ["M06@accepted", "M06@applied"], ["M06@active"], ["M06@payout", "M06@declined", "M06@refunded"]],
      ["Buyer-garden steward", [], [], [], ["S03@check", "S04@exact", "S04@short", "S04@late"], [], ["S03@apply", "S05@ready"], [], ["S06@payout", "S06@refundfail"]],
      ["Provider steward", [], [], [], [], ["S01@default", "S02@ready", "S02@unverified"], [], ["S06@provider"], []],
      ["System", [], ["consent and pledge (Arbitrum)"], ["G$ transfer (Celo)"], ["Celo read"], ["acceptance guard"], ["funding consumed"], ["access system (external)"], ["executor and acknowledgment"]]
    ] },
  { title: "Voucher service", sub: "Escrow before activation, exact consent before acceptance, one immutable final split. Fictional partial example: 3 of 10 lessons; 40 to the issuer reserve, 60 back.",
    stages: ["Discover", "Agree", "Accounts", "Approve and deposit", "Evidence", "Accept", "Activate", "Deliver", "Freeze", "Settle"],
    lanes: [
      ["Holder (member app)", ["M02@sunroot", "M07"], ["M08@terms", "M09@revised"], ["M08@accounts", "M08@wrongwallet"], ["M08@approval", "M08@deposit", "M08@depunknown"], ["M08@wait", "M09@proof"], ["M09@ready", "M09@cancelpending", "M09@cutoff"], ["M09@started", "M09@crossed"], ["M09@lessons"], ["M10@review", "M10@outside", "M10@frozen"], ["M09@moving", "M09@legfail", "M09@settled"]],
      ["Provider steward", [], [], [], [], [], ["S08@ready", "S08@race", "S08@noproof"], ["S08@done"], ["S09@delivered", "S09@split"], ["S09@sent"], ["S10@inflight", "S10@legfail", "S10@settled"]],
      ["Issuer authority", [], [], [], ["S07@ready", "S07@partial"], [], [], [], ["S09@review"], [], []],
      ["System", [], ["consent record (Arbitrum)"], ["setup prepared"], ["escrow (Gnosis)"], ["authenticated evidence"], ["acceptance guard"], ["activation message"], ["evidence records"], ["one decision per escrow"], ["two legs and acknowledgments"]]
    ] },
  { title: "Holdings, exchange, rewards and issuer policy", sub: "The broader voucher experience around the two routes.",
    stages: ["Hold", "Get", "Earn", "Track", "Govern (proposed)"],
    lanes: [
      ["Member app", ["M12@default", "M12@detail", "M12@stale"], ["M14@quote", "M14@review", "M14@unknown", "M14@done"], ["M16@default", "M15@open", "M15@consent", "M15@kept"], ["M01@needs", "M13@default"], ["M07@paused"]],
      ["Steward cockpit", [], [], ["S13@gdone", "S13@vfail", "S13@gardener"], [], ["S12@default", "S11@identity", "S12@pause"]]
    ] }
];

GG.OWNERS = [
  ["PRD-1324 (app, 2.1.0)", "M15, M16", "Linked rewards on promise detail and rows: accepted G$ and voucher terms with issuer and unit; consent naming each recipient; each reward's own pending, received and delayed state, separate from work completion.", "PRD-1321, PRD-1322; this design's approval"],
  ["PRD-1323 (cockpit, 2.1.0)", "S13, S12", "Inspector rewards with independent receipts and a same-record retry; voucher payment terms; a gardener issuer's admission status and cap, shown as policy.", "PRD-1321, PRD-1322; PRD-1315 for issuer identity"],
  ["PRD-1297 (voucher UI)", "M02, M07, M08, M09, M10, M12, M14, S07, S08, S09, S10, S11", "Offers that take vouchers; setup across two accounts; the holder page with races and recovery; the irreversible split; holdings; the voucher exchange; issuer approval; guarded acceptance; the split proposal; transfer legs; issuer admission as policy.", "PRD-1315 freeze; PRD-1317 and PRD-1318 contracts; PRD-1096 rehearsal; COM-46 terms"],
  ["PRD-1297 (G$ purchase; may need its own issue)", "M01, M03, M04, M05, M06, M13, S01, S02, S03, S04, S05, S06", "The own-G$ route on offers; buyer garden and consent; the Celo send review; the purchase page with refunds; Wallet › Purchases; guarded approval; Member Deposits; deposit attestation; apply; payout and refund recovery.", "CommitmentPooling and SettlementModule upgrades; decisions D1 to D4"]
];

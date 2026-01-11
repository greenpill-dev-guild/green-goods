# Using Attestation & Hypercerts Data

Verify on-chain records and prepare for future impact tokenization.

---

## Verifying Attestations

**Get Attestation UID** from GraphQL query, then verify on EAS explorer.

**Example**:
- Work attestation UID: `0x1234...abcd` (from query result)
- View on: https://arbitrum.easscan.org/attestation/view/{UID}

**What to Verify**:
- Attester (garden account)
- Schema UID matches expected
- Timestamp
- Data (decoded)
- Referenced attestations (work → approval chain)

---

## Attestation Chains

**Trace work through approval**:
1. Find work attestation
2. Look for approval attestations referencing it
3. Verify operator who approved
4. Check timestamps
5. Confirm data consistency

---

## Karma GAP Integration

**Query GAP Attestations**:
- Green Goods automatically creates GAP attestations
- Gardens = GAP Projects
- Approved work = GAP Impacts

**View on Karma GAP**: https://gap.karmahq.xyz/

[Karma GAP Technical Details →](../../developer/karma-gap)

---

## Future: Hypercerts

**Coming Soon**:
- Gardens mint Hypercerts
- Aggregated verified work
- Fractionalized ownership
- Impact markets

[Learn About Hypercerts →](../../concepts/hypercerts)

---

## Example Evaluation Workflow

**Grant Allocation Decision**:
1. Query gardens by location/focus
2. Calculate approval rates
3. Verify top candidates' attestations on-chain
4. Export data for board presentation
5. Make funding decision

---

## Learn More

- [Accessing Data](accessing-data)
- [External Frameworks](external-frameworks)
- [Attestations Concept](../../concepts/attestations)


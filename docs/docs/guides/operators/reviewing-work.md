# Reviewing & Approving Work

Validate gardener submissions fairly and create on-chain attestations.

---

## Review Workflow

1. **Access Pending Work**: Admin dashboard → Work Reviews
2. **View Submission**: Click to see photos, metrics, context
3. **Evaluate Quality**: Check against action requirements
4. **Approve or Reject**: With feedback
5. **Attestation Created**: Automatic on-chain record

---

## Review Checklist

- [ ] Photos clear and show before/after
- [ ] Metrics are reasonable
- [ ] Work matches selected action
- [ ] Evidence sufficient
- [ ] Location makes sense

---

## Approval Decision

**Approve When**:
- ✅ Meets all requirements
- ✅ Clear evidence provided
- ✅ Metrics are accurate
- ✅ Quality workmanship

**Result**: Creates EAS attestation + Karma GAP impact attestation

---

## Rejection Guidelines

**Reject When**:
- ❌ Photos unclear/missing
- ❌ Metrics inflated
- ❌ Wrong action selected
- ❌ Insufficient evidence

**MUST Provide**:
- Specific feedback
- What needs improvement
- How to correct
- Encouragement to resubmit

**Example Feedback**:
```
"Photos are good but metrics seem high. 50 trees in 2 hours is difficult. 
Please recount and resubmit with accurate number. Great work overall!"
```

---

## Best Practices

- Review within 24-48 hours
- Be consistent in standards
- Provide constructive feedback
- Recognize exceptional work
- Document review guidelines

---

## What Happens On-Chain

When you approve:
1. WorkApprovalResolver validates your operator status
2. EAS attestation created linking work → approval
3. Karma GAP impact attestation triggered
4. Indexer updates GraphQL API
5. Gardener receives confirmation

---

## Learn More

- [Managing Gardens](managing-gardens)
- [Reporting Impact](reporting-impact)
- [Attestations](../../concepts/attestations)


---
title: Frequently Asked Questions
slug: /reference/faq
audience: all
owner: docs
last_verified: 2026-02-19
feature_status: Live
source_of_truth:
  - docs/docs/intro.md
  - docs/docs/developers/reference/api-index.mdx
  - docs/docs/developers/reference/deployment-indexer-status.mdx
---

Common questions about Green Goods, organized by role.

## General

### What is Green Goods?

Green Goods is an offline-first web app for documenting regenerative work, reviewing submissions, and producing verifiable on-chain records.

### What chains are currently in scope?

- Arbitrum One (`42161`) for production workflows.
- Celo (`42220`) for production workflows.
- Sepolia (`11155111`) for testnet and validation workflows.

### Can Green Goods work offline?

Yes. Gardener workflows support offline drafts and queued sync when connectivity returns.

### Is Green Goods free to use?

- Gardener flows are passkey-first and gasless for common submission workflows.
- Operator actions that submit transactions can require network gas.

### Is uploaded data private?

No by default. Garden and attestation data is designed to be publicly verifiable. Do not include sensitive personal information in uploads.

## Gardener

### How do I sign up?

1. Open [greengoods.app](https://greengoods.app).
2. Choose passkey sign in.
3. Complete device biometric confirmation.

### Do I need crypto to submit work?

No. Gardener submission flows are designed to work without wallet management.

### What if my submission is rejected?

Use operator feedback to update evidence and resubmit. See:

- [Submit Work with MDR](../gardener/submit-work-mdr)
- [Common Errors](../gardener/common-errors)

### How do I track approval status and attestations?

See [Track Status and Attestations](../gardener/track-status-and-attestations).

## Operator

### How do I get operator access?

Operator permissions are assigned by admins or existing operator governance in a garden context.

### Can I create a new garden?

Use [Create Garden](../operator/create-garden). Availability depends on your current permissions.

### Where are treasury and governance workflows documented?

Use the operator treasury/governance pages:

- [Vaults and Treasury](../operator/vaults-and-treasury)
- [Cookie Jars](../operator/cookie-jars)
- [Conviction and Signal Pools](../operator/conviction-and-signal-pools)

Check [Deployment and Indexer Status](../developers/reference/deployment-indexer-status) before announcing those flows as live.

### How much does operator activity cost?

Gas cost depends on chain conditions and operation type. Validate current costs in your wallet before signing.

## Evaluator

### Do I need an account to query data?

No for read-only query access to public surfaces.

### Where are canonical endpoints and schemas listed?

Use [API Index](../developers/reference/api-index).

### How do I verify attestation chains?

Use [Verify Attestation Chains](../evaluator/verify-attestation-chains).

### Can I export data for analysis?

Yes. Start with:

- [Query Indexer](../evaluator/query-indexer)
- [Query EAS](../evaluator/query-eas)
- [Export and Analysis](../evaluator/export-and-analysis)

## Technical

### Is Green Goods open source?

Yes. Repository: [greenpill-dev-guild/green-goods](https://github.com/greenpill-dev-guild/green-goods)

### How do I run Green Goods locally?

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
bun setup
bun dev
```

See [Developer Getting Started](../developers/getting-started).

### How do I contribute?

Open an issue or PR in GitHub and follow the developer docs in [Developer Hub](../developers/getting-started).

## Troubleshooting

### App does not load

- Check connection.
- Refresh and clear browser cache.
- Confirm service availability in GitHub issues.

### Media upload fails

- Check file size and permissions.
- Retry with stable connection.
- Use offline draft flow if connectivity is unstable.

### Transaction fails

- Confirm correct network.
- Confirm wallet balance for gas.
- Retry with updated gas estimate.

## Support

- Telegram: [Join chat](https://t.me/+N3o3_43iRec1Y2Jh)
- Bug reports: [GitHub Issues](https://github.com/greenpill-dev-guild/green-goods/issues)
- Feature requests: [GitHub Discussions](https://github.com/greenpill-dev-guild/green-goods/discussions)

For role-first guides:

- [Gardener](../gardener/get-started)
- [Operator](../operator/get-started-and-roles)
- [Evaluator](../evaluator/get-started)
- [Developers](../developers/getting-started)

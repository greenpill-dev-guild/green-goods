# Frequently Asked Questions

Common questions about Green Goods, organized by topic and user role.

---

## General Questions

### What is Green Goods?

Green Goods is an offline-first Progressive Web App that makes it simple to document, verify, and fund regenerative impact work. It turns conservation activities into permanent on-chain records.

### What chains is Green Goods deployed on?

- **Arbitrum One** (42161) - Production
- **Celo** (42220) - Production
- **Base Sepolia** (84532) - Testnet

### Is Green Goods free to use?

**For Gardeners**: Yes! Passkey authentication and gasless transactions (sponsored by Pimlico).

**For Operators**: Small gas fees for transactions (approving work, managing members). Typically < $0.50 per transaction on L2s.

### What wallets are supported?

**Gardeners**: No wallet needed—uses passkey (Face ID/Touch ID).

**Operators**: MetaMask, WalletConnect, Coinbase Wallet, and any wallet supported by Reown AppKit.

### Can I use Green Goods offline?

**Yes!** The gardener app works completely offline:
- Take photos
- Fill forms
- Submit work (queued)
- Auto-syncs when online

### Is my data private?

**Public by Design**:
- Garden data is publicly queryable
- Work submissions visible to operators
- Approved work creates public attestations

**Privacy Considerations**:
- Wallet addresses are pseudonymous
- Exact GPS coordinates visible only to operators
- Photos you upload are public (via IPFS)
- Don't include sensitive personal info

---

## Gardener Questions

### How do I sign up?

1. Visit [greengoods.app](https://greengoods.app)
2. Click "Sign Up with Passkey"
3. Use Face ID/Touch ID/Fingerprint
4. Done in ~30 seconds!

[Gardener Quickstart →](../welcome/quickstart-gardener.md) • [Gardener Hub](for-gardeners.md)

### Do I need cryptocurrency?

**No!** Gardeners use passkey authentication with gasless transactions. You never need to buy crypto or manage private keys.

### How long until my work is approved?

**Typical**: 24-48 hours

**Depends on**:
- Operator availability
- Garden activity level
- Work complexity
- Review backlog

### What if my work is rejected?

- Read operator feedback carefully
- Understand what needs improvement
- Revise and resubmit
- Or document future work better
- Learn and improve!

### Can I join multiple gardens?

**Yes!** You can join as many gardens as you want and submit work to each one.

### How do I get paid?

**Currently**: Green Goods creates verified on-chain records. Gardens and funders determine compensation.

**Future**: Hypercerts will enable direct retroactive funding for verified work.

### What if I lose my phone?

**Passkeys are device-bound**. If you lose your phone:
- Your smart account is still accessible
- Contact support for recovery assistance
- Future: Multi-device passkey sync

---

## Operator Questions

See the [Operator Hub](for-operators.md) for a role-specific landing page with all guides and tooling.

### How do I become an operator?

**Two paths**:
1. **Admin grant**: Platform admins designate you
2. **Garden assignment**: Existing operators add you to their gardens

Contact us in [Telegram](https://t.me/+N3o3_43iRec1Y2Jh) to request operator status.

### Can I create a new garden?

**Only admins** can create gardens currently. Operators can manage gardens they're assigned to.

**To request a garden**:
- Contact admin team via [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
- Provide garden details
- Demonstrate community need

### How much does it cost to approve work?

**Gas fees on L2s**:
- Arbitrum: ~$0.10-0.50 per approval
- Celo: ~$0.05-0.20 per approval
- Base: ~$0.10-0.30 per approval

**Depends on**: Network congestion and gas prices.

### How many operators should a garden have?

**Recommended**: 2-3 active operators

**Why**:
- Distributes review workload
- Provides backup coverage
- Ensures consistency
- Prevents single point of failure

### What if I disagree with another operator's decision?

**Garden Governance**:
- Discuss privately first
- Establish shared standards
- Document review criteria
- Escalate to garden admin if needed

### How do I generate reports for funders?

1. Admin dashboard → Your garden
2. Click "Export Data"
3. Choose format (CSV/JSON)
4. Select date range
5. Download report

Includes all approved work, metrics, and attestation links.

---

## Evaluator Questions

See the [Evaluator & Funder Hub](for-evaluators.md) for curated guides, recipes, and external references.

### Do I need an account to access data?

**No!** The GraphQL API is public: https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql

### Are there API rate limits?

**Currently no**, but we may add reasonable limits to prevent abuse in the future.

### How do I verify attestations?

1. Get attestation UID from GraphQL query
2. Visit EAS explorer for your chain
3. View attestation details
4. Verify signature and data

[Verification Guide →](../guides/evaluators/using-attestation-data.md)

### Can I export all data?

**Yes!** Via GraphQL queries. No limits on data export for research/analysis.

### How do I cite Green Goods data in research?

**Citation format**:
```
Green Goods Protocol. (2024). [Garden Name] Impact Data. 
Retrieved from https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql
Verified on-chain: [Attestation UID]
```

---

## Technical Questions

### Is Green Goods open source?

**Yes!** MIT License.

**Repository**: https://github.com/greenpill-dev-guild/green-goods

### What tech stack does Green Goods use?

**Frontend**: React + TypeScript + Vite + Tailwind
**Blockchain**: Solidity + Foundry + EAS
**Indexer**: Envio + PostgreSQL + GraphQL
**Storage**: IPFS via Storacha

[Technical Architecture →](../developer/architecture/monorepo-structure.md)

### How are attestations stored?

**On-chain** (via EAS):
- Attestation UID
- Schema reference
- Attester signature
- Compact data

**Off-chain** (IPFS):
- Photos/videos
- Detailed metadata
- Referenced by CID in attestation

### What is EAS?

**Ethereum Attestation Service**: A protocol for on-chain and off-chain attestations. Used by ENS, Gitcoin, Optimism, and Green Goods.

[Learn more: attest.sh](https://attest.sh)

### What is Karma GAP?

**Grantee Accountability Protocol**: Standardized impact reporting framework. Green Goods automatically creates GAP attestations.

[Karma GAP Details →](../developer/karma-gap.md)

### Can I run Green Goods locally?

**Yes!**

```bash
git clone https://github.com/greenpill-dev-guild/green-goods.git
cd green-goods
bun setup    # Checks deps, installs packages, creates .env
vi .env      # Add your API keys
bun dev
```

[Installation Guide →](../developer/installation.md)

### How do I contribute code?

1. Fork the repository
2. Create a feature branch
3. Make changes and test
4. Submit pull request

[Contributing Guide →](../developer/contributing.md)

---

## Troubleshooting

### App won't load

- Check internet connection
- Try different browser (Chrome/Safari recommended)
- Clear cache and reload
- Check [status page](https://github.com/greenpill-dev-guild/green-goods/issues)

### Photos won't upload

- Check file size (< 10 MB)
- Verify internet connection
- Try again in a few minutes
- Check camera permissions

### Transaction failing

- Check wallet has gas
- Verify correct network selected
- Try increasing gas limit
- Contact support if persistent

### Can't connect wallet

- Update wallet extension
- Try different wallet
- Clear wallet cache
- Check network is supported

---

## Getting Help

### Community Support

- 💬 **Telegram**: [Join chat](https://t.me/+N3o3_43iRec1Y2Jh)
- 📖 **Docs**: You're here!
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/greenpill-dev-guild/green-goods/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/greenpill-dev-guild/green-goods/discussions)

### Documentation

- [Gardener Quickstart](../welcome/quickstart-gardener.md) • [Gardener Hub](for-gardeners.md)
- [Operator Quickstart](../welcome/quickstart-operator.md) • [Operator Hub](for-operators.md)
- [Evaluator Quickstart](../welcome/quickstart-evaluator.md) • [Evaluator & Funder Hub](for-evaluators.md)
- [Developer Quickstart](../welcome/quickstart-developer.md)
- [Core Concepts](../concepts/roles.md)

---

## Still Have Questions?

Ask in our [Telegram community](https://t.me/+N3o3_43iRec1Y2Jh) or [open a discussion on GitHub](https://github.com/greenpill-dev-guild/green-goods/discussions)!


---
title: Credits
slug: /reference/credits
audience: all
owner: docs
last_verified: 2026-10-13
feature_status: Live
source_of_truth:
  - LICENSE
  - package.json
  - packages/shared/package.json
  - packages/client/package.json
  - packages/admin/package.json
  - packages/agent/package.json
  - packages/agent/src/services/db/core.ts
  - packages/indexer/package.json
  - docs/package.json
  - packages/shared/src/ontology/green-goods-projections.json
  - packages/shared/src/modules/data/ipfs/pinata.ts
  - packages/shared/src/modules/work/prepare-queued-work.ts
  - packages/shared/src/hooks/analytics/useAnalyticsIdentity.ts
  - packages/shared/src/modules/app/posthog-browser.ts
  - packages/contracts/src/resolvers/Work.sol
  - packages/contracts/src/resolvers/WorkApproval.sol
---

# Credits

Green Goods is built by its team and contributors, with feedback from the communities using it. Thank you to everyone who writes code, tests a flow, improves a guide, translates a screen, or shares what happened in the field.

## License

The code and documentation are available under the MIT License. Read the [License guide](/builders/reference/license) for what it permits, and the [full license](https://github.com/greenpill-dev-guild/green-goods/blob/develop/LICENSE) for its terms.

## Core Team

### The Green Goods team

Development happens in the open on [GitHub](https://github.com/greenpill-dev-guild/green-goods). The work includes the app, steward dashboard, contracts, infrastructure, documentation, and community support.

## Contributors

The [GitHub contributors list](https://github.com/greenpill-dev-guild/green-goods/graphs/contributors) and [release notes](https://github.com/greenpill-dev-guild/green-goods/releases) credit the people whose changes have landed. To take part, read [how to contribute](/builders/how-to-contribute).

## Built With

### Blockchain Infrastructure

Green Goods uses [Ethereum Attestation Service](https://attest.sh) for records, [Pimlico](https://pimlico.io) for smart-account infrastructure, and [Reown](https://reown.com) for wallet connections. The [Builders integrations](/builders/integrations) explain how these and other integrations fit together, including their current limits.

### Development Tools

The apps use [React](https://react.dev), [Vite](https://vite.dev), and [TypeScript](https://www.typescriptlang.org). [Foundry](https://getfoundry.sh) supports contract development, [Envio](https://envio.dev) indexes records, and [Docusaurus](https://docusaurus.io) powers these docs.

### Infrastructure & Services

Work media uses [IPFS](https://ipfs.tech) through [Pinata](https://pinata.cloud). Repository deployment and operations use Vercel and Docker; the messaging runtime uses SQLite. Biome checks formatting and linting. Current setup belongs in the [Builders guide](/builders/getting-started).

### Blockchain Networks

The main app and garden records use Arbitrum. Celo-related integrations and test networks have separate readiness and activation requirements. See [Deployments & Addresses](/builders/reference/deployments) for the current records; listing a network here does not promise that every feature runs on it.

### Open Source Libraries

The project also depends on work from OpenZeppelin, Viem, TanStack Query, Zustand, Radix UI, React Hook Form, Zod, and many other open-source contributors. The package manifests in the [repository](https://github.com/greenpill-dev-guild/green-goods) hold the current dependency lists.

## Funding & Support

### Grants & Sponsors

To discuss supporting Green Goods, contact the team through [Telegram](https://t.me/+N3o3_43iRec1Y2Jh). To support a garden directly, follow the [Funder Guide](/community/funder-guide/).

## Community Partners

### Regenerative Finance Ecosystem

Green Goods grew from the Greenpill network's work on regenerative funding and community coordination. Shared tools and research help inform the product; using or discussing a tool does not imply a formal partnership.

### Community Partners {#community-partners-1}

Gardens, local organizers, testers, and community members shape the work through their experience and feedback. Contact the team about collaboration through the community chat.

## Acknowledgements

### Inspiration

Thank you to the people exploring public-goods funding, impact measurement, and community verification, and to the teams maintaining the tools Green Goods uses.

### Special Thanks

Thank you to early users and testers who point out confusing instructions, missing evidence, and recovery problems. Those observations improve both the product and these guides.

## Brand Assets

### Logo & Identity

Use the [Brand kit](/brand-kit) for current logos, icons, palette, fonts, and editable templates. Keep proportions and space around the artwork. Do not imply official endorsement without permission. Brand usage guidance and open questions are on that page.

## Contact

### Development Team

- [Telegram community chat](https://t.me/+N3o3_43iRec1Y2Jh)
- [GitHub repository](https://github.com/greenpill-dev-guild/green-goods)
- [Green Goods on X](https://x.com/greengoodsapp)

### For Press & Media

Contact the team through Telegram for media inquiries and attribution questions.

## Contributing

Start with [how to contribute](/builders/how-to-contribute). Accepted code and documentation changes appear in Git history and the contributor list. This page does not promise rewards for contributing.

## Legal

### Terms of Service

The [MIT License](https://github.com/greenpill-dev-guild/green-goods/blob/develop/LICENSE) includes the software's terms and its “as is” warranty disclaimer. It does not guarantee service availability or results.

### Privacy

Submissions, media links, account addresses, and recorded decisions are public. Records may show the account's chosen name. Usage and error analytics are linked to the account address when someone is signed in. Read the [FAQ privacy answers](/faq#privacy) before submitting information or photos.

### Disclaimer

Green Goods records claims and community decisions; it does not guarantee their accuracy or a particular outcome. Approval does not guarantee payment. Endowments carry risks, including loss and limited withdrawal availability; read the [Funder Guide](/community/funder-guide/) before using them.

# Glossary

## Garden
A community hub for regenerative work, represented as an NFT using the ERC-6551 Tokenbound Account standard. Each Garden has its own smart contract account that can hold assets, manage members, and coordinate impact work. Gardens are localized to specific bioregions and serve as hubs for coordinating conservation and community action.

## Gardener
Community members who perform on-the-ground conservation and regenerative work. Gardeners submit work through the Green Goods PWA using the MDR (Media-Details-Review) workflow, documenting their contributions with photos and metrics. Gardeners can belong to multiple gardens and earn recognition for verified work.

## Garden Operator
Trusted coordinators who manage gardens and validate gardener submissions. Operators review work submissions, approve or reject them with feedback, and oversee garden membership. Operators have elevated permissions within their assigned gardens but cannot create new gardens (admin-only).

## Action
A task or bounty available for gardeners to complete within a garden. Actions define specific regenerative activities (like planting trees, litter cleanup, or biodiversity surveys) with clear instructions, metrics, and optional time windows. Each action is registered on-chain and tracks completion statistics.

## Work Submission
Documentation of completed regenerative work submitted by a gardener. Work submissions follow the MDR workflow and include before/after photos, task details, metrics, and metadata. Submissions are stored in IPFS and referenced on-chain via EAS attestations once approved.

## Work Approval
The validation process where operators review gardener work submissions and either approve or reject them with constructive feedback. Approved work creates on-chain attestations that serve as permanent, verifiable records of impact. Approvals trigger Karma GAP impact attestations automatically.

## Attestation
An on-chain record created using the Ethereum Attestation Service (EAS). Green Goods uses three attestation types: work submissions, work approvals, and garden assessments. Attestations are permanent, cryptographically signed records that prove specific claims about impact work.

## EAS (Ethereum Attestation Service)
A protocol for making on-chain and off-chain attestations about any subject. Green Goods uses EAS to create verifiable records of gardener work, operator approvals, and garden assessments. Learn more at [attest.sh](https://attest.sh).

## Schema
A structured template that defines the format of an attestation. Green Goods uses three schemas:
- **Work Submission Schema**: Captures gardener work with media and metadata
- **Work Approval Schema**: Records operator validation decisions
- **Assessment Schema**: Documents garden-level impact across 8 forms of capital

## Resolver
Smart contracts that execute custom logic when attestations are created. Green Goods resolvers enforce permissions (only gardeners can submit, only operators can approve), emit events, and trigger Karma GAP integration for impact reporting.

## MDR (Media-Details-Review)
The three-step workflow for submitting work in the Green Goods PWA:
1. **Media**: Capture before/after photos or video
2. **Details**: Fill in task information, metrics, and feedback
3. **Review**: Preview submission and confirm

This pattern ensures high-quality documentation and reduces submission errors.

## TBA (Tokenbound Account)
A smart contract account bound to an NFT, following the ERC-6551 standard. Each Green Goods garden is a Tokenbound Account, allowing gardens to own assets, sign transactions, and interact with other contracts as autonomous entities. Learn more at [tokenbound.org](https://tokenbound.org).

## Hypercert
A semi-fungible token representing a claim of impact work. Hypercerts enable retroactive funding by allowing impact to be certified, tracked, and fractionally owned. Green Goods plans to aggregate approved work into Hypercerts for gardens. Learn more at [hypercerts.org](https://hypercerts.org).

## Impact Token
A token representing verified impact work that can be traded, funded, or used to unlock benefits. Green Goods uses Karma GAP attestations as the foundation for impact tokenization.

## Karma GAP (Grantee Accountability Protocol)
A standardized protocol for on-chain impact reporting across multiple chains. When operators approve work in Green Goods, the system automatically creates GAP project and impact attestations, enabling transparent impact tracking. Gardens become GAP projects automatically upon creation.

## Passkey
A cryptographic credential stored on your device (like Face ID or fingerprint) that enables passwordless authentication. Green Goods uses passkeys with Pimlico smart accounts to provide gardeners with a seamless, web2-like experience without managing private keys.

## Smart Account (Account Abstraction)
A smart contract-based wallet that enables gasless transactions, social recovery, and improved UX. Green Goods gardeners use Kernel smart accounts powered by Pimlico, allowing them to submit work without paying gas fees or managing seed phrases.

## PWA (Progressive Web App)
A web application that can be installed on mobile devices and work offline. The Green Goods client is a PWA, enabling gardeners to document work in the field even without internet connectivity. Work is queued locally and synced when back online.

## Indexer
A service that listens to blockchain events and indexes them into a queryable database. Green Goods uses Envio to index garden creation, work submissions, approvals, and attestations, exposing this data via a GraphQL API for fast queries.

## Eight Forms of Capital
A holistic framework for measuring wealth and impact beyond money:
1. **Living Capital**: Biodiversity, soil health, water quality
2. **Material Capital**: Physical resources and infrastructure
3. **Financial Capital**: Money and financial assets
4. **Social Capital**: Relationships and community trust
5. **Intellectual Capital**: Knowledge and skills
6. **Experiential Capital**: Lived wisdom and cultural practices
7. **Spiritual Capital**: Sense of meaning and purpose
8. **Cultural Capital**: Traditions and shared identity

Green Goods assessments track impact across all eight capitals.

## On-Chain
Data or transactions permanently recorded on a blockchain. Green Goods stores attestations on-chain for verifiability, while larger data (photos, metadata) is stored off-chain in IPFS and referenced by on-chain records.

## IPFS (InterPlanetary File System)
A distributed file storage system. Green Goods stores work photos, metadata, and action instructions in IPFS via Storacha, with content identifiers (CIDs) referenced in on-chain attestations.

## Base Sepolia
The default testnet for Green Goods development. Base Sepolia is an Ethereum Layer 2 testnet provided by Coinbase, offering low-cost transactions for testing.

## Arbitrum One
A production Ethereum Layer 2 network where Green Goods is deployed. Arbitrum offers lower gas fees and faster transactions than Ethereum mainnet while maintaining security.

## Celo
A carbon-negative blockchain focused on mobile-first financial tools and regenerative finance. Green Goods is deployed on Celo mainnet, aligning with the network's environmental mission.

## Community Garden
The root garden created automatically on deployment, open to all users. New gardeners are automatically added to the Community Garden upon signup, providing immediate access to actions and the ability to start documenting work.


# Green Goods Protocol v1 - Product Requirements Document

Release: Green Goods Protocol v1 (Beta Candidate)
Season: Q1 2026 (Transition from Alpha to Beta)
Network Deployment: Arbitrum One and Ethereum
Last Updated: January 17, 2026

---

## 1. Overview

### 1.1 One-liner

Green Goods is a Regenerative Compliance and Local-First Impact Reporting Platform that enables verifiable tracking of ecological actions, tokenization of impact via Hypercerts, and capital formation through Octant Vaults and Revnets.

### 1.2 Context

Traditional MRV is failing to scale. Manual audits cost $5,000+ per verification event, excluding grassroots projects from capital markets. Governments deploy historic capital but cannot prove results in disadvantaged communities. This creates a Verification Gap. Green Goods bridges it through Compliance-as-a-Service, connecting physical ecological labor with onchain capital.

### 1.3 Why Now

The Yield Economy Has Matured. Octant V2 enables endowment models where principal is preserved.

AI at the Edge. LLM costs dropped 90% in 2025, making Agri-Advisor agents viable at under $0.01 per interaction.

Greenpill Garden Season One. 8+ Gardens are ready to adopt the protocol.

### 1.4 The Regenerative Stack

Settlement Layer: Arbitrum One for low-fee execution.
Protocol Layer: Green Goods orchestrates Gardens, validates actions, routes yield.
Data Layer: EAS plus Hypercerts for proof of work and tradable certificates.
Capital Layer: Octant Vaults plus Revnets for yield and treasury management.
Application Layer: PWA plus AI Agent for user interfaces.

### 1.5 Competitive Positioning

Green Goods differentiates from Silvi (trees only, centralized, enterprise pricing), GainForest (requires satellite, high technical barrier), and Regen Network (Cosmos-based, methodology-heavy) through multi-domain coverage, Ethereum-native DeFi integration, accessible MDR methodology, and community governance via Fractal Gardens and Conviction Voting.

Key moats: Network effects from Greenpill chapters, switching costs from attestation history, data moat from accumulated actions, and community ownership through local tokens.

### 1.6 Owners

Product and Engineering Lead: Afolabi Aiyeloja
Design and QA Lead: Nansel Rimsah
Community Lead: Caue Tomaz

---

## 2. Goals and Success Metrics

### 2.1 Goals

Goal 1 Capital Formation: Octant Vaults create Local Endowments where yield purchases Hypercerts, establishing a Risk-Free Impact Floor. Revnets enable communities to manage treasuries with governance tokens.

Goal 2 Accessibility: Expand beyond browser to AI Agents via WhatsApp/SMS for Last Mile users regardless of technical literacy.

Goal 3 Governance: GreenWill badges and Hats Protocol create permission layer. Conviction Voting empowers reputation holders to allocate yield.

### 2.2 Success Metrics

North Star TVIV: Cumulative dollar value of Hypercerts minted, sold, or held. Target $50,000 by Q1 2026 end.

Primary Metrics from Arbitrum Grant: Vault TVL at least $12,000. Hypercerts Minted at least 12. Active Gardeners at least 150. Gardens Active at least 8. CIDS Compliance at least 80%. Karma GAP Updates at least 100. Verification Efficiency at least 90% within 72 hours. Conviction Participation at least 48%.

Guardrails: Redemption Rate between 80-90%. Rejection Rate under 15%. NPS at least 50.

---

## 3. Users and Use Cases

### 3.1 Primary Personas

Gardener: Field workers in bio-regions. Uses AI Agent for reporting. Success is logging work via text without managing a wallet.

Operator: Chapter administrator. Uses Admin Dashboard. Success is efficiently verifying submissions and minting Hypercerts.

Funder: Institutional donors or Octant stakers. Uses Vaults. Success is depositing assets and receiving automated impact reports.

Evaluator: Domain experts. Uses Admin Dashboard. Success is cryptographically certifying Impact Reports.

Community Member: Local residents. Uses Conviction Voting. Success is signaling priorities for yield allocation.

### 3.2 Jobs-to-be-Done

Gardener wants to text a photo to AI Agent so labor is logged without a smartphone app.

Operator wants to aggregate verified actions into Impact Reports to mint Hypercert bundles.

Funder wants to stake ETH in Octant Vault so yield acts as perpetual endowment.

Evaluator wants to review data and sign attestations verifying claims.

Community Member wants to signal priorities via Conviction Voting so yield flows to what matters.

### 3.3 Action Domains

Green Goods optimizes for five core domains from Greenpill research.

Domain 1 Solar Infrastructure (DePIN): Tech and Sun program in Nigeria. Solar hubs at universities providing electricity, Starlink, staking nodes, and co-learning spaces. Actions include site acquisition, container procurement, solar installation, node deployment, hub sessions, and workshops.

Domain 2 Waste Management (Environment): Cape Town, Ivory Coast, Koh Phangan, Rio Brasil. Beach cleanups to systematic waste systems. Actions include area assessment, cleanup events, waste sorting, recycling delivery, and composting.

Domain 3 Agroforestry (DeSci/Environment): AgroforestryDAO in Brasil for knowledge documentation. Jonathan in Uganda for educational planting where students become tree caretakers. Actions include planting, student assignment, monitoring, harvesting, and knowledge documentation.

Domain 4 Education (Education): Web3 workshops across chapters. Artizen Fund student events. Actions include workshop hosting, attendance verification, learning assessment, and certificate issuance.

Domain 5 Mutual Credit (DePIN/DeSci): Brasil commitment pooling pilot. Farmers verify productive capacity to unlock credit. Actions include farm registration, harvest documentation, and commitment fulfillment.

### 3.4 Schema Validation Plan

Validate schemas with actual users before launch. Solar domain with TAS operators. Waste domain across three chapters. Agroforestry with Brasil and Uganda teams. Education during actual workshops. Mutual credit with Brasil farmers.

Success criteria: 80% completion rate on first attempt. Under 5 minutes via PWA. Under 3 minutes via AI Agent. 85% AI parse accuracy.

---

## 4. Problem Statement

### 4.1 What is Broken

Verification Gap: Traditional MRV costs $5,000-15,000 per event. Photo uploads lack rigor for institutional capital.

Capital Volatility: Crypto-philanthropy relies on volatile tokens. When markets crash, projects die.

Accessibility Wall: Web3 tools require smartphone, wallet, and gas. This excludes vital ecological laborers.

Missing Feedback: Communities and experts excluded from verification, leading to greenwashing.

### 4.2 Insights from Pilots

Nigeria: WhatsApp submission preferred over PWA. 3x higher engagement with text versus app navigation.

Brasil: Portuguese localization showed 85% completion versus 40% with English-only.

User Research: Feeling paid matters as much as payment. GreenWill gamification increased submission 2.1x.

---

## 5. Scope

### 5.1 In Scope

Interfaces: PWA with offline and localization. Admin Dashboard. AI Agent beta.

Protocol: Karma GAP sync. Octant Vaults. Revnets. Hypercerts minting. Conviction Voting.

Identity: GreenWill badges via Unlock. Roles via Hats Protocol.

Verification: Operator tools. Evaluator certification. Community signaling.

### 5.2 Revnet Configuration

Fractal Gardens architecture with two tiers.

Level 1 Protocol Revnet ($GG): Issues governance token. Funds shared infrastructure. Receives 2.5-5% tribute from Gardens.

Level 2 Garden Revnets: Local tokens like $LAGOS, $BRAZIL. Governance rights and treasury claims. Routes tribute to Protocol.

Economics: Issuance creates price ceiling via arbitrage. Redemption at 80-90% creates price floor with 10-20% staying in treasury. Reserved rate 10-20% split between Garden and Protocol.

Octant-Backstopped Impact Floor: Funders deposit to Vault. Yield generated. Protocol buys Hypercerts. Floor rises. Creates minimum wage for ecological labor backed by staking rewards.

### 5.3 Out of Scope

DID system deferred. IoT integration Phase 2. Data marketplace Phase 3. Advanced reputation staking deferred.

### 5.4 Assumptions

A1: Onchain reporting more valuable than traditional. Validate via funder surveys.

A2: Yield sufficient for sustainability. Validate via yield-to-impact ratios.

A3: Hypercert marketplaces will develop. Validate via ecosystem liquidity.

A4: AI Agents parse accurately. Red flag if error exceeds 15%.

A5: Conviction Voting participation without financial incentives. Red flag if under 30%.

A6: Pimlico economically viable. Red flag if gas exceeds 5% of yield.

A7: Evaluators maintain integrity. Red flag if collusion patterns emerge.

---

## 6. Solution Overview

### 6.1 Experience Summary

For Gardeners: A WhatsApp contact that pays for work.
For Funders: A high-yield savings account that heals the planet.
For Evaluators: A data-rich platform for certifying truth.

### 6.2 Key Flows

Flow 1 AI-Driven Capture: Gardener sends photo to WhatsApp. AI identifies object and extracts metadata. Smart Account signs. Data anchored on IPFS and EAS.

Flow 2 Impact Report Minting: Operator aggregates actions. Evaluator reviews and certifies. Operator mints Hypercert.

Flow 3 Capital Formation: Funder stakes in Vault. Yield accrues. Protocol buys Hypercerts. Impact Floor rises.

Flow 4 Governance: Members vote via Conviction Voting. Yield allocated per signal strength.

---

## 7. Requirements

### 7.1 Functional Requirements

FR-P-001: AI Agent via Twilio/OpenAI for WhatsApp/SMS submissions.
FR-P-002: Admin Dashboard for Operators and Evaluators.
FR-P-003: Octant Vaults with ERC-4626 routing yield to Revnets.
FR-P-004: Hypercerts minting aggregating attestations into ERC-1155.
FR-P-005: Revnet configuration with 80-90% redemption, 10-20% reserved, 2.5-5% tribute.
FR-P-006: Conviction Voting for yield allocation.
FR-P-007: GreenWill badges via Unlock Protocol.
FR-P-008: Role management via Hats Protocol.
FR-P-009: Smart Account automation for AI Agent users.
FR-P-010: Karma GAP bi-directional sync.
FR-P-011: Passkey authentication via WebAuthn and Pimlico.

### 7.2 Non-Functional Requirements

NFR-001 Localization: English, Spanish, Portuguese at launch. Externalized strings. Locale-aware formatting.

NFR-002 Latency: AI Agent under 5 seconds. PWA load under 3 seconds on 3G. Dashboard queries under 2 seconds.

NFR-003 Auditability: All Evaluator actions onchain. Complete provenance trail.

NFR-004 Gas Abstraction: $0 for Gardeners via Pimlico. Alerts at 80% budget. Fallback mechanism.

NFR-005 Performance: Full offline capability. 500+ pending actions. Under 50MB storage. Under 500KB images.

NFR-006 Reliability: 99.5% uptime. Graceful degradation. Auto-retry with backoff. Circuit breakers.

NFR-007 Security: CREATE2 addresses. Passkeys on device only. Rate limiting. Hats enforcement. No admin keys.

NFR-008 Privacy: GPS obfuscated to 3 decimals. Encrypted PII on IPFS. GDPR deletion support. Anonymized analytics.

NFR-009 Accessibility: WCAG 2.1 AA. 44x44px touch targets. High contrast mode. Screen reader support.

NFR-010 Compatibility: Chrome 90+, Safari 15+, Firefox 90+, Samsung Internet 15+. iOS 14+, Android 10+.

---

## 8. Feature Breakdown

GG-FEAT-001 PWA Offline-First: Critical. In Progress. 3 weeks.
GG-FEAT-002 Passkey Auth: Critical. In Progress. 2 weeks.
GG-FEAT-003 AI Agent: High. Planned. 4 weeks.
GG-FEAT-004 Admin Dashboard v2: High. Planned. 3 weeks.
GG-FEAT-005 Hypercerts Minting: High. Planned. 4 weeks.
GG-FEAT-006 Octant Vault Integration: High. Planned. 4 weeks.
GG-FEAT-007 Revnet Configuration: Medium. Planned. 3 weeks.
GG-FEAT-008 Conviction Voting: Medium. Planned. 3 weeks.
GG-FEAT-009 GreenWill Badging: Medium. Planned. 2 weeks.
GG-FEAT-010 Hats Roles: Medium. Planned. 2 weeks.
GG-FEAT-011 Karma GAP Sync: High. In Progress. 2 weeks.
GG-FEAT-012 Localization: Medium. In Progress. 2 weeks.

---

## 9. Economic Model

### 9.1 Assumptions

ETH at $3,000. Arbitrum gas at 0.1 gwei. Pimlico fee $0.02 per transaction. Octant yield 4-8% APY. 150 Gardeners. 1,500 actions/month.

### 9.2 Vault Sustainability

Monthly costs: Gas $30. IPFS $1.50. AI $15. Infrastructure $100. Total $150.

TVL needed for infrastructure: $30,000 at 6% APY.

TVL needed for infrastructure plus $500/month Hypercert purchases: $130,000 at 6% APY.

Conclusion: $12,000 TVL target is starting point. Need $100,000-$200,000 for sustainability.

### 9.3 Gas Budget

$2,000 from grant sponsors 100,000 actions. At 1,500/month provides 66 months runway.

Yield-funded: $30/month needs $6,000 TVL at 6% APY. Achievable early.

### 9.4 Revnet Economics

Recommended configuration: 85% redemption, 15% reserved. Balances treasury health with Gardener returns.

### 9.5 Hypercert Pricing

Start with cost-plus pricing to establish floor. Migrate to market-driven as liquidity develops.

---

## 10. Localization Strategy

### 10.1 Language Tiers

Tier 1 at Launch: English, Portuguese (Brazilian), Spanish (Latin American).

Tier 2 for v1.5: French (West African), Swahili, Pidgin English.

Tier 3 for v2: Thai, Arabic.

### 10.2 Key Considerations

Pidgin handling: AI must parse "I don plant tree" as "I planted a tree." Many Nigerians code-switch.

Portuguese: Default to Brazilian forms. Recognize both Brazilian and European in parsing.

Regional: Currency, date formats, decimal separators per locale.

### 10.3 Translation Workflow

English as source. Professional translation for Tier 1 with native speaker review. Community translators for ongoing strings.

### 10.4 Success Metrics

Completion rates within 5% across languages. AI parse accuracy within 5% of English. 100% string coverage for Tier 1 at launch.

---

## 11. Privacy and Data Handling

### 11.1 Data Collected

Gardeners: Wallet address (onchain, immutable). GPS (IPFS, obfuscated). Photos (IPFS, public). Metadata (onchain/IPFS).

### 11.2 Key Risks and Mitigations

GPS reveals location: Obfuscated to 3 decimals (111m precision). Raw never stored onchain.

Photos contain PII: User guidance to avoid faces. Operator review before minting.

Blockchain immutable: Minimize onchain PII. Encryption key destruction for profile data. Privacy notice explains limitations.

AI processes conversations: Scoped prompts. No long-term storage. Opt-out available.

Caretaker data for minors: Names optional. No minor photos required. Parental consent process.

### 11.3 Compliance

GDPR: Consent basis. Privacy notice. DPAs with processors.

LGPD: Portuguese notice. Similar to GDPR.

POPIA: Similar to GDPR.

### 11.4 Data Rights

Access: Export via Profile settings.
Rectification: Update profile. Flag actions for correction.
Erasure: Encryption key destruction. IPFS unpinning. Blockchain limitations disclosed.
Portability: JSON export.

---

## 12. Dependencies

### 12.1 Technical

Arbitrum One. Ethereum. Twilio. OpenAI/Llama. Pimlico. Envio.

### 12.2 Protocol Partners

Octant. Hypercerts. Juicebox. Karma GAP. Unlock Protocol. Hats Protocol. Gardens Protocol.

### 12.3 Funding

Arbitrum Grant $25,000: M1 PRD/Designs $4,000. M2 Hypercerts $8,000. M3 DeFi $8,000. M4 Community $4,000. M5 Reporting $1,000.

---

## 13. QA and Rollout

### 13.1 QA Strategy

Unit tests with Jest/Foundry. Integration with Playwright. UAT with pilot Gardens. P0 devices: Android mid-range, iPhone SE. P1: Low-end Android, Desktop.

### 13.2 Rollout Phases

Phase 1 Internal Alpha (Weeks 1-2): Dev Guild 8 users. PWA core, Passkey. Gate: under 5% error rate.

Phase 2 Pilot Beta (Weeks 3-6): Nigeria and Brasil 50 users. Full PWA, AI Agent, Dashboard. Gate: NPS 50+.

Phase 3 Extended Beta (Weeks 7-10): 8 Gardens. Hypercerts, Vaults. Gate: $12k TVL, 12 Hypercerts.

Phase 4 GA (Weeks 11-12): Open enrollment. Full protocol.

### 13.3 Support

Primary: Telegram per Garden. Secondary: Discord. Escalation: GitHub.

P0 Critical: 1hr response, 4hr resolution.
P1 High: 4hr response, 24hr resolution.
P2 Medium: 24hr response, 1 week resolution.

---

## 14. Risks

### 14.1 Technical

AI Hallucination (High/Medium): Strict prompts. Operator review.
Passkey Friction (Medium/High): Email fallback.
Pimlico Downtime (Low/High): Local queue. Secondary bundler.
IPFS Failures (Medium/Medium): Storracha with Filecoin backup.
Smart Contract Vulnerability (Low/Critical): Audit program. Bug bounty.

### 14.2 Economic

Insufficient Yield (Medium/High): Break-even modeling. Diversified strategies.
Token Collapse (Medium/Medium): Cash-out tax preserves floor.
Hypercert Illiquidity (High/Medium): Protocol as buyer of first resort.

### 14.3 Governance

Evaluator Collusion (Medium/High): Reputation staking. Community flags.
Low Voting Participation (High/Medium): Low thresholds. Gamification.
Operator Abandonment (Medium/High): Multi-sig. Succession planning.

### 14.4 Regulatory

Evaluator Liability (Medium/High): Legal opinion. Indemnification.
Token as Security (Low/Critical): Governance plus utility structure.
GDPR (Medium/Medium): Deletion flows. Minimal PII.

### 14.5 Operational

Team Burnout (High/High): Scope management. Async-first.
Partner Dependencies (Medium/High): Fallback strategies.
Language Accuracy (High/Medium): Native speaker testing.

---

## 15. Open Questions

Q1: Evaluator liability framework? Owner: Legal. Due: Q1 2026.

Q2: AI Agent dialect support at launch? Owner: Product. Due: February 2026.

Q3: Signaling incentives without pay-to-complain? Owner: Community. Due: February 2026.

Q4: Minimum viable TVL? Owner: Finance. Due: January 2026.

Q5: Garden-customizable Revnet parameters? Owner: Product. Due: February 2026.

Q6: Dispute resolution for flagged Evaluators? Owner: Governance. Due: March 2026.

---

## 16. Appendix

### 16.1 Glossary

Garden: Hyper-local hub as Juicebox Revnet with token, treasury, governance.
Action: Discrete ecological work unit captured, verified, attested.
Hypercert: ERC-1155 impact certificate bundling verified Actions.
Revnet: Juicebox V4 project with programmatic issuance and redemption.
GreenWill: Reputation NFTs earned through verified actions.
Conviction Voting: Governance where voting power compounds with stake duration.
TVIV: Total Verified Impact Value. North Star metric.
Fractal Gardens: Two-tiered Revnet architecture.
Impact Floor: Minimum token price guaranteed by treasury backing.

### 16.2 References

Revnet Whitepaper: https://github.com/rev-net/whitepaper
Hypercerts: https://hypercerts.org/docs
Octant V2: https://docs.v2.octant.build
Karma GAP: https://www.karmahq.xyz
Juicebox V4: https://docs.juicebox.money/dev
Safe Passkeys: https://docs.safe.global/advanced/passkeys
Pimlico: https://docs.pimlico.io

### 16.3 Visual Assets Required

Regenerative Stack Diagram: Five horizontal layers with bidirectional value flows.

Fractal Gardens Diagram: Hub-and-spoke with Protocol Revnet center and Garden Revnets around perimeter showing tribute and subsidy flows.

User Flow Diagrams: Swimlane format for AI Capture, Report Minting, Capital Formation, and Governance flows.

Five-Sided Marketplace: Pentagon with personas at vertices showing relationships.

---

End of Document

Green Goods Protocol v1 PRD
January 17, 2026

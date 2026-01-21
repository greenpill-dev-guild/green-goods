# Green Goods Protocol v1 — Product Requirements Document

**Release:** Green Goods Protocol v1 (Beta Candidate)
**Season:** Q1 2026 (Transition from Alpha to Beta)
**Network Deployment:** Arbitrum One & Ethereum
**Last Updated:** January 16, 2026

---

## 1. Overview

### 1.1 One-liner

Green Goods is a **Regenerative Compliance** and **Local-First Impact Reporting Platform** that enables the verifiable tracking of ecological actions, the tokenization of impact via Hypercerts, and the formation of capital through yield-bearing Octant Vaults and revenue tokenization with Revnets.

### 1.2 Context

The global landscape for environmental finance is navigating a profound structural transformation, precipitated by a dual crisis of credibility in voluntary carbon markets (VCM) and an urgent, unmet demand for verifiable data in government-funded climate and ecological initiatives. The prevailing paradigms of "Monitoring, Reporting, and Verification" (MRV) are failing to scale, burdened by high-cost manual audits that exclude the vast majority of grassroots regenerative projects from accessing capital markets. Traditional certifiers rely on extractive consulting models where a single verification event can cost upwards of $5,000, rendering the model economically unviable for smallholder farmers, community gardens, and hyper-local ecological stewards.

Simultaneously, governments are deploying historic levels of capital but face immense legislative pressure to prove results in "disadvantaged communities" (DACs). This creates a "Verification Gap." Green Goods bridges this gap by pivoting to **Compliance-as-a-Service (CaaS)**, operationalizing the "Regenerative Stack" to connect physical ecological labor with onchain capital.

### 1.3 Why Now

Three converging forces make Q1 2026 the optimal launch window:

1. **The Yield Economy Has Matured:** Octant V2 and DeFi staking infrastructure now enable "endowment models" where principal is preserved and only yield is spent—a capability that wasn't viable 18 months ago.

2. **AI at the Edge:** LLM inference costs dropped 90% in 2025, making "Agri-Advisor" agents economically viable at <$0.01 per interaction, enabling the "billions" interface via WhatsApp/SMS.

3. **Greenpill Garden Season One:** The structured program where Greenpill Stewards build their Theory of Change provides an immediate cohort of 8+ Gardens ready to adopt the protocol.

### 1.4 Strategic Positioning: The Regenerative Stack

Green Goods functions as the **Application Layer** within a modular suite of protocols bridging physical ecological labor and onchain capital:

| Layer | Component | Function |
|-------|-----------|----------|
| Settlement | Arbitrum One | Low-fee, high-throughput execution for attestations and DeFi |
| Protocol | Green Goods | Orchestrates Gardens, validates actions, routes fees and yield |
| Data & Verification | EAS + Hypercerts | Atomic "proof of work" anchoring; tradable impact certificates |
| Capital Formation | Octant Vaults + Revnets | Yield generation and treasury/token management |
| Application | Green Goods PWA + AI Agent | User interface for Gardeners, Operators, and Funders |

### 1.5 Target Release

- **Release:** Green Goods Protocol v1 (Beta Candidate)
- **Season:** Q1 2026 (Transition from Alpha to Beta)
- **Network Deployment:** Arbitrum One & Ethereum

### 1.6 Owners

- **Product & Engineering Lead:** Afolabi Aiyeloja
- **Design & QA Lead:** Nansel Rimsah
- **Community Lead:** Caue Tomaz

---

## 2. Goals and Success Metrics

The architecture of Green Goods v1 is driven by three primary strategic objectives designed to bridge the "Verification Gap" and create a closed-loop regenerative economy.

### 2.1 Goals

**Goal 1: Capital Formation (High Sustainability)**

The economic goal is to enable **Capital Formation** rather than simple circulation. By utilizing **Octant Vaults**, the protocol creates "Local Endowments" where low-risk staking yields systematically purchase Hypercerts, establishing a "Risk-Free Impact Floor" for ecological labor. Simultaneously, the integration of **Juicebox Revnets** enables "The Growth" layer, allowing communities to grow revenue and manage treasuries where tokens represent governance rights and a claim on future success.

**Goal 2: Impact Reporting Accessibility (High Reach)**

The accessibility goal is to ensure the protocol is available to the "Last Mile" of users, regardless of technical literacy or connectivity. This involves expanding the interface beyond the browser to include **AI Agents** that interact via **WhatsApp and SMS**, allowing even the most rural Gardeners to interface with the protocol using natural language.

**Goal 3: Onchain Governance & Reputation (High Coordination)**

The governance goal is to implement a robust badging and reputation system built on **Unlock Protocol** (GreenWill) and **Hats Protocol**. These tools serve as the permission layer for the **Gardens** platform, ensuring governance is driven by those who create value. By using **Conviction Voting**, the protocol empowers reputation holders to signal distinct priorities for yield allocation and action prioritization.

### 2.2 Success Metrics

**North Star: Total Verified Impact Value (TVIV)**

- **Definition:** The cumulative dollar value of all Hypercerts minted, sold, or held within the protocol ecosystem
- **Calculation:** Sum of (Hypercert mint price + secondary sales + vault purchases)
- **Measurement Window:** Rolling 90-day aggregate
- **Target:** ≥$50,000 by end of Q1 2026

**Primary Metrics (Aligned with Arbitrum Grant Milestones):**

| Metric | Definition | Target | Source | Window |
|--------|------------|--------|--------|--------|
| **Vault TVL** | Total value of assets deposited in Octant Yield-Donating Vaults | ≥$12,000 | Arbitrum M3 | End Q1 2026 |
| **Hypercerts Minted** | Number of ERC-1155 impact certificates created from verified actions | ≥12 | Arbitrum M2 | End Q1 2026 |
| **Active Gardeners** | Unique wallet addresses submitting verified actions in 30-day window | ≥150 users | Arbitrum M4 | Rolling 30-day |
| **Gardens Active** | Number of distinct Gardens using Arbitrum for impact reporting | ≥8 | Arbitrum M2 | End Q1 2026 |
| **CIDS Compliance Rate** | Percentage of actions structured per Common Impact Data Standard | ≥80% | Arbitrum M4 | Per cohort |
| **Karma GAP Updates** | Number of verified actions pushed to Karma GAP as milestone updates | ≥100 | Arbitrum M4 | End Q1 2026 |
| **Verification Efficiency** | Percentage of submissions processed within 72 hours | ≥90% | Internal | Weekly |
| **Conviction Participation** | Percentage of token holders actively voting on yield allocation | ≥48% | Internal | Per epoch |
| **Reputation Density** | Active users holding GreenWill "Steward" or "Sprout" badge | ≥32 users | Internal | End Q1 2026 |

**Guardrails:**

- **Redemption Rate (Revnet):** The cash-out tax on Garden Tokens must remain between 80-90% to prevent treasury depletion
- **Data Integrity Score:** The rejection rate of submissions flagged by oracles must not exceed 15%
- **NPS Score:** Event and tool satisfaction must maintain ≥50 (per Arbitrum M4/M5)

---

## 3. Users and Use Cases

The product architecture serves a **5-sided marketplace**, ensuring checks and balances between labor, management, capital, verification, and community beneficiaries.

### 3.1 Primary Users / Personas

**Persona A: The Gardener (The Laborer)**

- **Profile:** Field workers in bio-regions (e.g., Nigeria, Brazil). May operate in low-connectivity zones with low-end devices.
- **Motivation:** Livelihood security and community improvement.
- **Key Interface:** **AI Agent (WhatsApp/SMS)** for reporting; PWA for deep management.
- **Definition of Success:** Successfully logging work via a text message or photo and receiving payment notification without managing a crypto wallet.

**Persona B: The Garden Operator (The Steward)**

- **Profile:** Local chapter administrator or NGO program manager.
- **Motivation:** Funding sustainability and coordinating local labor.
- **Key Interface:** **Admin Dashboard**.
- **Definition of Success:** Efficiently verifying queues of submissions, minting Hypercerts, and managing the Garden Treasury.

**Persona C: The Funder (The Capital Provider)**

- **Profile:** Institutional donors, Government Agencies (e.g., California Natural Resources Agency), or Octant stakers.
- **Motivation:** **Verified Impact (MRV)**, compliance with legal mandates, and capital efficiency.
- **Key Interface:** **Admin Funder Dashboard & Octant Vaults**.
- **Definition of Success:** Depositing assets into a vault and receiving an automated Karma GAP report showing yield utilization.

**Persona D: The Evaluator (The Verifier)**

- **Profile:** Domain experts (e.g., sustainability experts, material scientists) or specialized Oracles.
- **Motivation:** Ensuring integrity, preventing greenwashing, and maintaining professional reputation.
- **Key Interface:** **Admin Dashboard (Evaluator View)**.
- **Definition of Success:** Reviewing completed Impact Reports or Assessments and cryptographically certifying the quality of the data.

**Persona E: The Community Member (The Beneficiary)**

- **Profile:** Local residents living in the bioregion affected by the Garden's work.
- **Motivation:** Ensuring the work actually benefits the local ecosystem and holding the Garden accountable.
- **Key Interface:** **Public Signal Feed & Gardens Conviction Voting**.
- **Definition of Success:** Ability to "Signal" or "Attest" that the work exists and is healthy, and signaling prioritization for future actions.

### 3.2 Top Jobs-to-be-Done (JTBD)

**JTBD1: Low-Bandwidth Submission**
- **User:** Gardener
- **Context:** When I am in the field with no data plan...
- **Job:** I want to text a photo to the AI Agent...
- **Outcome:** So that my labor is logged even without a high-end smartphone.

**JTBD2: Impact Report Aggregation**
- **User:** Operator
- **Context:** When the quarter ends and reporting is due...
- **Job:** I want to aggregate all verified actions into a single Impact Report...
- **Outcome:** So that I can mint a Hypercert bundle and sell it to the Octant Vault.

**JTBD3: Principal-Preserving Funding**
- **User:** Funder
- **Context:** When I want to support a region without losing principal...
- **Job:** I want to stake ETH in an Octant Vault...
- **Outcome:** So that my yield acts as a perpetual endowment for the local community.

**JTBD4: Cryptographic Verification**
- **User:** Evaluator
- **Context:** When a Garden claims "Biodiversity Increase"...
- **Job:** I want to review the aggregated data and sensor logs...
- **Outcome:** So that I can cryptographically sign an attestation verifying the claim.

**JTBD5: Community Prioritization**
- **User:** Community Member
- **Context:** When a Garden proposes a new project...
- **Job:** I want to signal my priority via Conviction Voting...
- **Outcome:** So that yield flows to the actions that matter most to us.

### 3.3 Use Cases (Brief)

1. **PWA Impact Reporting:** An Operator uses the PWA to aggregate 500 individual tree planting actions into a "Q1 Reforestation Report." The system formats this data according to the Common Impact Data Standard (CIDS) for Karma GAP integration.

2. **Impact Reporting Certification:** An Evaluator receives the "Q1 Reforestation Report." They analyze the attached sensor data and satellite imagery. Satisfied with the quality, they sign the report using their **Hats Protocol** "Verifier" authority, certifying it for minting.

3. **Garden Revenue Tokenization:** A Garden mints a Hypercert based on the certified report. They list this Hypercert on the Revnet. The Octant Vault automatically purchases it using yield, and the revenue flows into the Garden's treasury, backing the value of the local Garden Token.

4. **Prioritization Signaling:** Community members stake their reputation (GreenWill Badges) on specific actions within the Garden's governance page, signaling that "Water Conservation" is a higher priority than "Planting" for the upcoming season.

---

## 4. Problem Statement

### 4.1 What's Broken Today

- **Verification Gap:** Traditional MRV is too expensive for small projects ($5,000-15,000 per event), while simple "photo uploads" lack scientific rigor and trust for institutional capital.

- **Capital Volatility:** Crypto-philanthropy often relies on volatile tokens or one-off grants. When the market crashes or donors churn, projects die.

- **Accessibility Wall:** Most web3 impact tools require a smartphone, a wallet, and ETH for gas. This excludes the poorest and most vital ecological laborers.

- **Missing Feedback Loops:** Beneficiaries (local communities) and Experts (Evaluators) are often excluded from the verification loop, leading to "paper parks" or greenwashing.

### 4.2 Why It Matters Now

- **Global South Adoption:** The environment for crypto and blockchain technology is becoming increasingly friendly and vital in the **Global South** (e.g., Nigeria with 87% smartphone adoption, Brazil with 79%). High mobile penetration combined with a need for stable financial rails makes these regions ideal adopters for a "Local-First" regenerative economy.

- **The Yield Economy:** The maturity of **Octant** and **DeFi** allows for "endowment models" where principal is preserved and only yield is spent.

- **AI at the Edge:** LLMs have become efficient enough to run "Agri-Advisor" agents that can democratize access to complex protocols via simple text.

### 4.3 Insights from Research and Pilots

**Pilot Program Learnings (Greenpill Garden Season One):**

- **Nigeria Solar Hubs:** Initial pilots with Tech & Sun demonstrate that WhatsApp-based submission is preferred over PWA for low-connectivity environments. Users reported 3x higher engagement when able to text photos vs. navigating app flows.

- **Brazil Agroforestry:** Portuguese localization pilot showed 85% completion rate for action submissions when using native language vs. 40% with English-only interface.

- **User Research Finding:** Gardeners in multiple regions expressed that "feeling paid" matters as much as actual payment. Real-time balance updates and "GreenWill points" gamification increased submission frequency by 2.1x.

**Industry Research:**

| Insight | Data Point | Source |
|---------|------------|--------|
| MRV Cost | $5,000-15,000 per verification event | Gold Standard Pricing |
| Green Goods Target | <$5 per verification through peer validation + AI | Internal modeling |
| Mobile Penetration | Nigeria 87%, Brazil 79% | World Bank 2025 |
| LLM Cost Reduction | 90% decrease in inference costs in 2025 | OpenAI/Anthropic pricing |

**Validation Evidence:**

| Hypothesis | Test | Result | Confidence |
|------------|------|--------|------------|
| Users will submit via WhatsApp | Nigeria pilot (N=50) | 78% preferred messaging | High |
| Passkey auth reduces abandonment | Onboarding A/B test | 3.2x completion rate | High |
| Conviction voting drives participation | Simulation with GreenWill holders | 52% active signaling | Medium |
| Yield-to-Hypercert purchase works | Testnet simulation | Successful atomic execution | Medium |

---

## 5. Scope

### 5.1 In Scope (This Release)

**Interfaces:**
- **PWA:** Offline-first web app with Localization support (Spanish/Portuguese)
- **Admin Dashboard:** UI for managing Gardens and creating impact reports
- **AI Agent (Beta):** WhatsApp/SMS bot for Gardener submissions

**Protocol Layer:**
- **Karma GAP:** Automated reporting pipelines with CIDS compliance
- **Octant Vaults:** Deployment of yield-bearing vaults for capital formation
- **Revnets:** Configuration of Juicebox Revnets for Garden Treasury management (see 5.1.1)
- **Hypercerts:** Minting logic for verified impact claims
- **Conviction Voting:** Module for yield allocation and action prioritization

**Identity & Reputation:**
- **Unlock Protocol:** Minting of GreenWill reputation badges (NFTs) based on user activity
- **Hats Protocol:** Management of on-chain roles (e.g., Operator, Evaluator) and permissions

**Verification:**
- **Operators:** Tools for initial data aggregation and verification
- **Evaluators:** Admin Dashboard view for certifying Impact Reports
- **Community Signaling:** Mechanism for beneficiaries to flag issues or upvote priorities

#### 5.1.1 Revnet Configuration (The Fractal Gardens Model)

Green Goods adopts a two-tiered "Fractal Gardens" architecture using Juicebox V4 Revnets:

**Level 1: Protocol Revnet ($GG Token)**
- Issues the core Green Goods governance token
- Funds shared infrastructure (servers, indexers, legal, development)
- Receives "tribute" from Level 2 Gardens (2.5-5% of incoming funds/tokens)

**Level 2: Garden Revnets (Local Tokens)**
- Each community operates its own Revnet (e.g., $LAGOS, $BRAZIL, $NIGERIA)
- Issues local tokens representing governance rights and treasury claims
- Routes tribute percentage to Level 1 Protocol

**Revnet Economic Mechanics:**

| Parameter | Configuration | Rationale |
|-----------|---------------|-----------|
| **Issuance (Price Ceiling)** | Dynamic based on contributions | Prevents price exceeding fair value through arbitrage |
| **Redemption Rate** | 80-90% | "Cash-out tax" where 10-20% remains in treasury, permanently increasing backing per remaining token |
| **Reserved Rate** | 10-20% | Reserved tokens split between Garden DAO treasury (50%) and Protocol treasury (50%) |
| **Tribute Mechanism** | 2.5-5% via JBSplits | Funds shared infrastructure from Garden success |

**The "Octant-Backstopped Impact Floor":**

This mechanism creates sustainable funding independent of speculation:

1. **Deposit:** Funders stake assets in Octant Vault
2. **Yield Generation:** Low-risk DeFi strategies generate returns
3. **Programmatic Buyback:** Yield automatically purchases Hypercerts from Gardens
4. **Floor Rising:** Each purchase increases backing per token, creating a "minimum wage" for ecological labor backed by Ethereum staking rewards

### 5.2 Out of Scope

- **Robust Identity System (DID):** A fully decentralized identity system backed by W3C DIDs is deferred to a future release; v1 relies on WebAuthn and standard maturation.
- **Global IoT Network:** Full integration with hardware sensors (Silvi, Local Network) is Phase 2.
- **Scope 3 Data Marketplace:** Insurance/Finance data sales are Phase 3.
- **GreenWill Advanced Reputation:** Complex reputation staking and slashing mechanics deferred.

### 5.3 Assumptions

**A1: Onchain impact reporting is more valuable than traditional reporting**
- **Validation:** Track funder preference in post-pilot surveys; compare funding secured by onchain-reporting Gardens vs. traditional reporting projects
- **Red Flag:** If traditional tooling improves via AI and the onchain value-add is not perceived as differentiated by Q2 2026

**A2: Projects can long-term earn enough yield to be sustainable**
- **Validation:** Calculate "yield-to-impact" ratio across pilot Vaults; model time-to-sustainability for different capital levels
- **Red Flag:** If funders perceive yield as "too passive" and prefer direct donation models

**A3: Impact certificate marketplaces will develop around Hypercerts**
- **Validation:** Monitor Hypercerts ecosystem liquidity; track secondary sales volume
- **Red Flag:** By Q3 2026, no impact marketplaces building liquidity around Hypercerts

**A4: AI Agents can accurately parse natural language impact submissions**
- **Validation:** Measure Agri-Advisor accuracy rate on image identification and metadata extraction
- **Red Flag:** If error rate exceeds 15%, requiring Operator intervention on majority of submissions

**A5: Community members will participate in Conviction Voting without direct financial incentives**
- **Validation:** Track participation rates across Gardens; correlate with GreenWill badge levels
- **Red Flag:** If voting participation drops below 30% after initial novelty period

**A6: Gasless transactions via Pimlico remain economically viable at scale**
- **Validation:** Monitor sponsorship costs per transaction; model break-even point
- **Red Flag:** If gas costs exceed 5% of yield generated per action

**A7: Evaluators will maintain integrity under reputation staking model**
- **Validation:** Track dispute rates and community flagging of Evaluator decisions
- **Red Flag:** If collusion patterns emerge in Gardens with concentrated Evaluator power

---

## 6. Solution Overview

### 6.1 Experience Summary

Green Goods v1 acts as a bridge. For the **Gardener**, it is a helpful WhatsApp contact that pays them for work. For the **Funder**, it is a high-yield savings account that heals the planet. For the **Evaluator**, it is a data-rich platform for certifying truth.

### 6.2 Core Workflow Pattern

| Stage | Description |
|-------|-------------|
| **Capture/Input** | Photos, metadata, GPS, voice notes via PWA or AI Agent |
| **Details/Structure** | CIDS-compliant action schema, attestation construction, Hypercert metadata |
| **Review/Confirm** | Operator approval queue, Evaluator certification, Hypercert minting |

### 6.3 Key User Flows

**Flow 1: AI-Driven Capture (High Access)**

- **Capture:** Gardener sends photo to WhatsApp Bot
- **Process:** AI Agent identifies object, cross-references with "Action Schema"
- **Sign:** Agent uses server-side Smart Account (signer controlled) to sign payload
- **Store:** Data anchored on IPFS (Storracha) and stored onchain with EAS

**Flow 2: Impact Report Minting & Evaluation (High Trust)**

- **Aggregate:** Operator selects verified actions in the PWA and clicks "Create Report"
- **Certify:** The Evaluator receives the report, reviews aggregated evidence, and attests to validity using their Hats Protocol authority
- **Mint:** The system allows the Operator to mint the Hypercert, referencing the Evaluator's certification attestation

**Flow 3: Capital Formation & Allocation (Sustainability)**

- **Deposit:** Funder stakes assets in a Garden's Octant Vault
- **Yield:** Yield accrues in the Vault
- **Buyback:** Protocol programmatically uses the allocated yield to buy verified Garden Hypercert shares, raising the "Impact Floor" price

**Flow 4: Governance & Signaling (High Coordination)**

- **Yield Allocation:** Garden members vote via Conviction Voting to determine the split of yield to send to Hypercerts
- **Action Prioritization:** Garden operators and gardeners signal which specific actions the Garden should prioritize

---

## 7. Requirements

### 7.1 Functional Requirements (PRD-level)

| ID | Requirement | Description |
|----|-------------|-------------|
| FR-P-001 | AI Agent Interface | Integration of LLM wrapper (Twilio/OpenAI) to parse natural language submissions via WhatsApp/SMS |
| FR-P-002 | Admin Dashboard | Comprehensive dashboard for Operators to manage submissions and for Evaluators to review and certify Impact Reports |
| FR-P-003 | Octant Vaults | ERC-4626 Vault contracts configured to route yield to specific Garden Revnets |
| FR-P-004 | Hypercerts Minting | Aggregation of approved attestations into ERC-1155 Hypercert tokens with IPFS-anchored metadata |
| FR-P-005 | Revnet Configuration | Deployment of Juicebox V4 Revnets with configurable redemption rates (80-90%), reserved rates (10-20%), and tribute routing (2.5-5%) |
| FR-P-006 | Conviction Voting | Implementation of Gardens Conviction Voting module for yield allocation and action prioritization |
| FR-P-007 | GreenWill Badging | Integration with Unlock Protocol to mint NFT badges based on user activity thresholds |
| FR-P-008 | Role Management | Integration with Hats Protocol to assign and manage on-chain permissions for Operators and Evaluators |
| FR-P-009 | Smart Account Automation | Backend infrastructure to manage Safe accounts for users interacting solely via AI Agents |
| FR-P-010 | Karma GAP Sync | Bi-directional sync between Green Goods actions and Karma GAP milestone updates |
| FR-P-011 | Passkey Authentication | WebAuthn-based biometric login with Safe Smart Account deployment via Pimlico |

### 7.2 Non-Functional Requirements

**NFR-001 (Localization):**
- The PWA must support dynamic localization with full support for English, Spanish, and Portuguese at launch
- All user-facing strings must be externalized; no hardcoded text
- Date/time/number formatting must respect locale settings

**NFR-002 (Latency):**
- AI Agent must respond to user texts within 5 seconds to maintain conversational flow
- PWA page load must complete within 3 seconds on 3G connection
- Admin Dashboard queries must return within 2 seconds for datasets <1000 records

**NFR-003 (Trust/Auditability):**
- All Evaluator actions must be on-chain and auditable
- Evaluator reputation (GreenWill) must be slashable if they verify fraudulent data
- Complete action provenance trail from submission → approval → Hypercert must be queryable

**NFR-004 (Cost/Gas Abstraction):**
- Gardeners must pay $0 gas via Pimlico sponsorship
- Protocol sponsorship budget must be monitored with alerts at 80% consumption
- Fallback mechanism required if Pimlico is unavailable

**NFR-005 (Performance):**
- PWA must function with full capability offline; sync on reconnection
- Service Worker cache must support 500+ pending actions before sync
- IndexedDB storage must not exceed 50MB per user session
- Image compression must reduce uploads to <500KB before IPFS pinning

**NFR-006 (Reliability):**
- System must maintain 99.5% uptime for core flows (submission, approval, minting)
- Graceful degradation required: if IPFS fails, queue locally; if Arbitrum congested, batch transactions
- Auto-retry with exponential backoff for all external service calls
- Circuit breaker pattern for Twilio/OpenAI dependencies

**NFR-007 (Security & Permissions):**
- All Smart Account deployments must use deterministic CREATE2 addresses
- Passkey credentials must never leave user device
- API endpoints must enforce rate limiting (100 req/min per wallet)
- Role-based access via Hats Protocol must be enforced at contract level
- No admin keys for contract upgrades in production (Diamond pattern with governance only)

**NFR-008 (Privacy & Data Handling):**
- GPS coordinates must be obfuscated to 3 decimal places (111m precision) for public display
- User PII (name, bio) stored on IPFS with encryption; only wallet address on-chain
- GDPR-compliant data deletion must be supported for EU users
- Analytics must use anonymized wallet hashes, not raw addresses

**NFR-009 (Accessibility):**
- PWA must meet WCAG 2.1 AA standards
- Touch targets must be minimum 44x44px for mobile use
- High contrast mode must be available for outdoor/bright light conditions
- Screen reader compatibility required for all core flows

**NFR-010 (Compatibility):**
- PWA must function on: Chrome 90+, Safari 15+, Firefox 90+, Samsung Internet 15+
- Mobile: iOS 14+, Android 10+
- Minimum device: 2GB RAM, 16GB storage
- Offline mode must work on devices with no active data plan

---

## 8. Feature Breakdown

| Feature ID | Feature Name | Priority | Status | Est. Effort | Dependencies | Notes |
|------------|--------------|----------|--------|-------------|--------------|-------|
| GG-FEAT-001 | PWA Offline-First Architecture | Critical | In Progress | 3 weeks | IndexedDB, Service Workers | Core to "Last Mile" access |
| GG-FEAT-002 | Passkey Authentication | Critical | In Progress | 2 weeks | WebAuthn, Safe, Pimlico | Removes Privy dependency |
| GG-FEAT-003 | AI Agent (WhatsApp/SMS) | High | Planned | 4 weeks | Twilio, OpenAI/Llama | "Billions" interface |
| GG-FEAT-004 | Admin Dashboard v2 | High | Planned | 3 weeks | React, Envio | Operator verification queue |
| GG-FEAT-005 | Hypercerts Minting | High | Planned | 4 weeks | ERC-1155, IPFS | Aggregation + atomic mint |
| GG-FEAT-006 | Octant Vault Integration | High | Planned | 4 weeks | ERC-4626, DeFi strategies | Yield-bearing deposits |
| GG-FEAT-007 | Revnet Configuration | Medium | Planned | 3 weeks | Juicebox V4 | Garden treasury management |
| GG-FEAT-008 | Conviction Voting Module | Medium | Planned | 3 weeks | Gardens Protocol | Yield allocation governance |
| GG-FEAT-009 | GreenWill Badging | Medium | Planned | 2 weeks | Unlock Protocol | Reputation NFTs |
| GG-FEAT-010 | Hats Protocol Roles | Medium | Planned | 2 weeks | Hats Protocol | Operator/Evaluator permissions |
| GG-FEAT-011 | Karma GAP Sync | High | In Progress | 2 weeks | EAS, Karma API | CIDS-compliant reporting |
| GG-FEAT-012 | Localization (ES/PT) | Medium | In Progress | 2 weeks | i18n framework | Brazilian & LatAm access |
| GG-FEAT-013 | Report Generator | Medium | Planned | 2 weeks | PDF/JSON export | Grant compliance automation |
| GG-FEAT-014 | Silvi Integration | Low | Deferred | 3 weeks | Silvi API | Tree species verification |
| GG-FEAT-015 | IoT Sensor Bridge | Low | Deferred | 4 weeks | Local Network/Orbit | Environmental state proof |

**Feature Spec Template:**

Each High/Critical feature should have a dedicated Feature Spec following the template structure:
1. Feature Overview
2. Feature Map (user actions, integration points)
3. User Experience (flows per action)
4. UI Design & Screens
5. Data & Integrations
6. Requirements (by action, cross-cutting)
7. Non-Functional Requirements
8. Analytics & Telemetry
9. QA Plan
10. Risks & Mitigations
11. Open Questions

---

## 9. Dependencies and Partnerships

**Technical Dependencies:**
- Arbitrum One (L2 Settlement)
- Ethereum (L1 for Octant)
- Twilio (SMS/WhatsApp)
- OpenAI/Llama (LLM)
- Pimlico (Gasless Transactions)
- Envio (Blockchain Indexer)

**Protocol Partners:**
- Octant (Yield Source)
- Hypercerts (Impact Certificate)
- Juicebox (Revnet Infrastructure)
- Karma GAP (Reporting)
- Unlock Protocol (Reputation)
- Hats Protocol (Permissions)
- Gardens Protocol (Conviction Voting)

**Funding & Compliance:**
- Arbitrum New Protocols and Ideas Grant ($25,000 USD)
  - Milestone 1 (Month 1): PRD v2, Designs — $4,000
  - Milestone 2 (Months 1-2): Hypercerts Integration — $8,000
  - Milestone 3 (Months 2-3): DeFi Integration — $8,000
  - Milestone 4 (Months 1-2): Community Activations — $4,000
  - Milestone 5 (Month 3): Final Reporting — $1,000

---

## 10. QA, Rollout, and Ops

### 10.1 QA Strategy

**Test Approach:**
- **Unit Tests:** Jest for frontend components, Foundry for Solidity contracts
- **Integration Tests:** End-to-end flows using Playwright
- **UAT:** Structured testing with 5 Gardeners, 3 Operators per pilot Garden
- **Pilot Program:** Live testing with Greenpill Nigeria, Brazil, and Cape Town chapters

**Device/Platform Coverage:**

| Priority | Devices | OS | Browsers |
|----------|---------|-----|----------|
| P0 | Android mid-range (Samsung A-series) | Android 11+ | Chrome, Samsung Internet |
| P0 | iPhone SE 2020+ | iOS 15+ | Safari |
| P1 | Low-end Android (<2GB RAM) | Android 10+ | Chrome |
| P1 | Desktop | Windows 10+, macOS 12+ | Chrome, Firefox |

**Acceptance Gates:**
- All P0 devices must pass happy-path flows
- Offline → sync flow must complete without data loss
- Gas sponsorship must succeed for all test transactions
- Hypercert minting must produce valid ERC-1155 tokens
- Karma GAP sync must produce correctly-structured attestations

### 10.2 Rollout Plan

**Release Method:** Staged rollout with feature flags

**Phase 1: Internal Alpha (Week 1-2)**
- Cohort: Greenpill Dev Guild core team (8 users)
- Features: PWA core, Passkey auth, basic submission flow
- Monitoring: Error rates, completion funnels, latency metrics
- Gate: <5% error rate on submission flow

**Phase 2: Pilot Beta (Week 3-6)**
- Cohort: Greenpill Nigeria (25 users), Greenpill Brazil (25 users)
- Features: Full PWA, AI Agent (WhatsApp), Admin Dashboard
- Monitoring: NPS surveys, session recordings, support tickets
- Gate: NPS ≥50, <10% support ticket rate

**Phase 3: Extended Beta (Week 7-10)**
- Cohort: 8 Gardens total (per Arbitrum milestone)
- Features: Hypercerts minting, Octant Vault integration
- Monitoring: TVL growth, Hypercert creation rate, yield routing
- Gate: ≥$12k TVL, ≥12 Hypercerts minted

**Phase 4: General Availability (Week 11-12)**
- Cohort: Open enrollment for Greenpill Network chapters
- Features: Full protocol with Conviction Voting

**Monitoring Signals (First 72 Hours):**
- Error rate by flow (submission, approval, minting)
- Latency percentiles (p50, p95, p99)
- Gas sponsorship consumption rate
- User session length and completion funnels
- Support channel volume (Discord, Telegram)

**Rollback Plan:**
- Feature flags can disable any new feature within 5 minutes
- Contract upgrades via Diamond pattern require 24-hour timelock
- Database migrations must include rollback scripts
- IPFS pins are immutable; metadata corrections require new CIDs

### 10.3 Support Plan

**Support Channels:**
- **Primary:** Telegram group per Garden (Gardener support)
- **Secondary:** Discord #green-goods-support (technical issues)
- **Escalation:** GitHub Issues (bugs with reproduction steps)

**Severity Definitions:**

| Severity | Definition | Response SLA | Resolution SLA |
|----------|------------|--------------|----------------|
| P0 (Critical) | Protocol down, funds at risk, data loss | 1 hour | 4 hours |
| P1 (High) | Core flow blocked for >10% users | 4 hours | 24 hours |
| P2 (Medium) | Feature degraded but workaround exists | 24 hours | 1 week |
| P3 (Low) | Cosmetic, minor inconvenience | 1 week | Next release |

### 10.4 Analytics Plan

**Events to Instrument:**

| Event | Properties | Purpose |
|-------|------------|---------|
| session_start | device_type, os, browser, locale | Usage patterns |
| passkey_created | success, error_code | Auth funnel |
| action_submitted | garden_id, action_type, offline_queued | Submission funnel |
| action_approved | garden_id, action_type, evaluator_id | Verification flow |
| hypercert_minted | garden_id, actions_bundled, value | Impact tokenization |
| vault_deposit | amount, asset, garden_allocation | Capital formation |
| conviction_vote | garden_id, stake_amount, direction | Governance participation |
| ai_agent_interaction | channel, intent_parsed, success | Agent effectiveness |

**Dashboards:**
- Executive Dashboard: TVIV, TVL, Active Gardeners, Hypercerts Minted
- Garden Health: Per-garden metrics, verification queue depth, yield allocation
- Funnel Analysis: Onboarding completion, submission-to-approval conversion
- Technical Health: Error rates, latency, gas consumption

**Review Cadence:**
- Daily: Error rates, critical funnel metrics
- Weekly: Full dashboard review with team
- Monthly: Cohort analysis, NPS review, milestone progress

---

## 11. Risks and Mitigations

### Technical Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-T1 | AI Hallucination | High | Medium | Agent prompts include strict bounds; Agent stages data for Operator review, never finalizes directly |
| R-T2 | Passkey Adoption Friction | Medium | High | Fallback to email magic link for devices without biometric support |
| R-T3 | Pimlico Downtime | Low | High | Queue transactions locally; implement secondary bundler fallback |
| R-T4 | IPFS Pinning Failures | Medium | Medium | Use Storracha with Filecoin backup; retry logic with exponential backoff |
| R-T5 | Smart Contract Vulnerability | Low | Critical | Apply for Arbitrum audit program; formal verification of core flows; bug bounty |
| R-T6 | Envio Indexer Lag | Medium | Medium | Optimistic UI updates; background sync status indicators |

### Economic Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-E1 | Insufficient Yield for Sustainability | Medium | High | Model break-even scenarios pre-launch; diversify vault strategies |
| R-E2 | Revnet Token Price Collapse | Medium | Medium | Cash-out tax (80-90%) preserves treasury floor |
| R-E3 | Hypercert Illiquidity | High | Medium | Protocol acts as buyer of first resort via Octant yield |
| R-E4 | Gas Cost Spike on Arbitrum | Low | Medium | Transaction batching; L3 migration path |

### Governance & Social Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-G1 | Evaluator Collusion | Medium | High | Evaluators must stake reputation; Community can flag decisions |
| R-G2 | Low Conviction Voting Participation | High | Medium | Implement low threshold for conviction to take effect; gamify with badges |
| R-G3 | Garden Operator Abandonment | Medium | High | Multi-sig requirement; succession planning in onboarding |
| R-G4 | Community "Pay-to-Complain" Dynamics | Medium | Medium | Signal staking requires reputation (GreenWill) not just tokens |

### Regulatory & Legal Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-L1 | Evaluator Liability for False Verification | Medium | High | Pursue legal opinion before beta; indemnification in Terms of Service |
| R-L2 | Token Classification as Security | Low | Critical | Structure tokens as governance + utility; engage securities counsel |
| R-L3 | GDPR Compliance for EU Users | Medium | Medium | Implement data deletion flows; minimize on-chain PII |

### Operational Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-O1 | Team Burnout / Capacity Constraints | High | High | Scope management; clear "No" list; async-first operations |
| R-O2 | Dependency on Partner Protocols | Medium | High | Document fallback strategies; maintain alternative provider relationships |
| R-O3 | Dialect/Language Accuracy in AI Agent | High | Medium | Pre-launch testing with native speakers; iterative prompt refinement |

---

## 12. Open Questions

| ID | Question | Owner | Due Date |
|----|----------|-------|----------|
| Q1 | What is the legal framework for "Evaluator" liability if they verify false data? | Legal Lead | Q1 2026 |
| Q2 | Can the WhatsApp Agent support dialects (e.g., Pidgin, Portuguese) effectively at launch? | Product Lead | February 2026 |
| Q3 | How do we incentivize "Community Members" to signal without creating a "pay-to-complain" market? | Community Lead | February 2026 |
| Q4 | What is the minimum viable vault TVL for sustainable yield generation? | Finance Lead | January 2026 |
| Q5 | Should Gardens have the ability to customize their Revnet parameters (redemption rate, reserved rate)? | Product Lead | February 2026 |
| Q6 | How do we handle disputes when Community Members flag Evaluator decisions? | Governance Lead | March 2026 |

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| **Garden** | A hyper-local hub of community and environmental action, represented as a Juicebox Revnet with its own token, treasury, and governance |
| **Assessment** | A quarterly or seasonal goal set by Garden Operators that maps to Karma GAP Milestones |
| **Action** | A discrete unit of ecological work (e.g., planting a tree, cleaning a beach) that is captured, verified, and attested |
| **Work** | The aggregate of Actions submitted by a Gardener, awaiting approval |
| **Work Approval** | The Operator/Evaluator review process that converts submitted Work into verified Attestations |
| **Report** | An aggregated bundle of approved Actions formatted for grant compliance or Hypercert minting |
| **MDR** | Monitoring, Data, Reporting — the protocol's internal term for the action capture → attestation → reporting pipeline |
| **Hypercert** | An ERC-1155 impact certificate that bundles verified Actions into a tradable asset |
| **Revnet** | A Juicebox V4 project with programmatic issuance, redemption, and revenue routing |
| **GreenWill** | Reputation tokens (Unlock Protocol NFTs) earned through verified regenerative actions |
| **Conviction Voting** | A continuous governance mechanism where voting power compounds over time based on stake duration |
| **CIDS** | Common Impact Data Standard — a structured format for describing impact work |
| **TVIV** | Total Verified Impact Value — the North Star metric for protocol health |
| **Fractal Gardens** | The two-tiered Revnet architecture connecting local Gardens to the Protocol treasury |

### References

| Resource | Link | Purpose |
|----------|------|---------|
| Arbitrum Grant Application | Internal | Success metrics, milestones, budget |
| Revnet Whitepaper | https://github.com/rev-net/whitepaper | Economic mechanics reference |
| Hypercerts Documentation | https://hypercerts.org/docs | Impact certificate standard |
| Octant V2 Docs | https://docs.v2.octant.build | Yield vault architecture |
| Karma GAP Documentation | https://www.karmahq.xyz | Grantee accountability protocol |
| Juicebox V4 Docs | https://docs.juicebox.money/dev | Revnet implementation |
| CIDS Specification | https://commonapproach.org/cids | Impact data standard |
| Safe + Passkeys | https://docs.safe.global/advanced/passkeys | Authentication architecture |
| Pimlico Documentation | https://docs.pimlico.io | ERC-4337 bundler/paymaster |

### Related Documents

| Document | Description |
|----------|-------------|
| Miro Board | Diagrams, ideation, visual documentation |
| Figma Designs | UI screens and user flows |
| GitHub Repository | https://github.com/greenpill-dev-guild/community-host |
| Project Board | Sprint tracking, user stories |
| Greenpill Garden Strategy | Theory of Change, strategic context |
| Revnet Model for Vrbs DAO | Fractal Gardens architecture detail |

---

*Green Goods Protocol v1 PRD — Revised January 16, 2026*

# Green Goods Protocol v1 - Product Requirements Document

Release: Green Goods Protocol v1 (Beta Candidate)
Season: Q1 2026 (Transition from Alpha to Beta)
Network Deployment: Arbitrum One and Ethereum
Last Updated: January 17, 2026

---

## 1. Overview

### 1.1 One-liner

Green Goods is a Regenerative Compliance and Local-First Impact Reporting Platform that enables the verifiable tracking of ecological actions, the tokenization of impact via Hypercerts, and the formation of capital through yield-bearing Octant Vaults and revenue tokenization with Revnets.

### 1.2 Context

The global landscape for environmental finance is navigating a profound structural transformation, precipitated by a dual crisis of credibility in voluntary carbon markets and an urgent, unmet demand for verifiable data in government-funded climate and ecological initiatives. The prevailing paradigms of Monitoring, Reporting, and Verification (MRV) are failing to scale, burdened by high-cost manual audits that exclude the vast majority of grassroots regenerative projects from accessing capital markets. Traditional certifiers rely on extractive consulting models where a single verification event can cost upwards of $5,000, rendering the model economically unviable for smallholder farmers, community gardens, and hyper-local ecological stewards.

Simultaneously, governments are deploying historic levels of capital but face immense legislative pressure to prove results in disadvantaged communities. This creates a Verification Gap. Green Goods bridges this gap by pivoting to Compliance-as-a-Service, operationalizing the Regenerative Stack to connect physical ecological labor with onchain capital.

### 1.3 Why Now

Three converging forces make Q1 2026 the optimal launch window.

The Yield Economy Has Matured. Octant V2 and DeFi staking infrastructure now enable endowment models where principal is preserved and only yield is spent. This capability was not viable 18 months ago.

AI at the Edge. LLM inference costs dropped 90% in 2025, making Agri-Advisor agents economically viable at less than $0.01 per interaction, enabling the billions interface via WhatsApp and SMS.

Greenpill Garden Season One. The structured program where Greenpill Stewards build their Theory of Change provides an immediate cohort of 8+ Gardens ready to adopt the protocol.

### 1.4 Strategic Positioning: The Regenerative Stack

Green Goods functions as the Application Layer within a modular suite of protocols bridging physical ecological labor and onchain capital.

Settlement Layer: Arbitrum One provides low-fee, high-throughput execution for attestations and DeFi.

Protocol Layer: Green Goods orchestrates Gardens, validates actions, routes fees and yield.

Data and Verification Layer: EAS plus Hypercerts provide atomic proof of work anchoring and tradable impact certificates.

Capital Formation Layer: Octant Vaults plus Revnets handle yield generation and treasury/token management.

Application Layer: Green Goods PWA plus AI Agent serve as the user interface for Gardeners, Operators, and Funders.

### 1.5 Target Release

Release: Green Goods Protocol v1 (Beta Candidate)
Season: Q1 2026 (Transition from Alpha to Beta)
Network Deployment: Arbitrum One and Ethereum

### 1.6 Owners

Product and Engineering Lead: Afolabi Aiyeloja
Design and QA Lead: Nansel Rimsah
Community Lead: Caue Tomaz

---

## 2. Goals and Success Metrics

The architecture of Green Goods v1 is driven by three primary strategic objectives designed to bridge the Verification Gap and create a closed-loop regenerative economy.

### 2.1 Goals

Goal 1: Capital Formation (High Sustainability)

The economic goal is to enable Capital Formation rather than simple circulation. By utilizing Octant Vaults, the protocol creates Local Endowments where low-risk staking yields systematically purchase Hypercerts, establishing a Risk-Free Impact Floor for ecological labor. Simultaneously, the integration of Juicebox Revnets enables The Growth layer, allowing communities to grow revenue and manage treasuries where tokens represent governance rights and a claim on future success.

Goal 2: Impact Reporting Accessibility (High Reach)

The accessibility goal is to ensure the protocol is available to the Last Mile of users, regardless of technical literacy or connectivity. This involves expanding the interface beyond the browser to include AI Agents that interact via WhatsApp and SMS, allowing even the most rural Gardeners to interface with the protocol using natural language.

Goal 3: Onchain Governance and Reputation (High Coordination)

The governance goal is to implement a robust badging and reputation system built on Unlock Protocol (GreenWill) and Hats Protocol. These tools serve as the permission layer for the Gardens platform, ensuring governance is driven by those who create value. By using Conviction Voting, the protocol empowers reputation holders to signal distinct priorities for yield allocation and action prioritization.

### 2.2 Success Metrics

North Star: Total Verified Impact Value (TVIV)

Definition: The cumulative dollar value of all Hypercerts minted, sold, or held within the protocol ecosystem.
Calculation: Sum of Hypercert mint price plus secondary sales plus vault purchases.
Measurement Window: Rolling 90-day aggregate.
Target: At least $50,000 by end of Q1 2026.

Primary Metrics (Aligned with Arbitrum Grant Milestones)

Vault TVL: Total value of assets deposited in Octant Yield-Donating Vaults. Target is at least $12,000 by end of Q1 2026. Source is Arbitrum M3.

Hypercerts Minted: Number of ERC-1155 impact certificates created from verified actions. Target is at least 12 by end of Q1 2026. Source is Arbitrum M2.

Active Gardeners: Unique wallet addresses submitting verified actions in 30-day window. Target is at least 150 users on a rolling 30-day basis. Source is Arbitrum M4.

Gardens Active: Number of distinct Gardens using Arbitrum for impact reporting. Target is at least 8 by end of Q1 2026. Source is Arbitrum M2.

CIDS Compliance Rate: Percentage of actions structured per Common Impact Data Standard. Target is at least 80% per cohort. Source is Arbitrum M4.

Karma GAP Updates: Number of verified actions pushed to Karma GAP as milestone updates. Target is at least 100 by end of Q1 2026. Source is Arbitrum M4.

Verification Efficiency: Percentage of submissions processed within 72 hours. Target is at least 90% measured weekly. Source is internal.

Conviction Participation: Percentage of token holders actively voting on yield allocation. Target is at least 48% per epoch. Source is internal.

Reputation Density: Active users holding GreenWill Steward or Sprout badge. Target is at least 32 users by end of Q1 2026. Source is internal.

Guardrails

Redemption Rate (Revnet): The cash-out tax on Garden Tokens must remain between 80-90% to prevent treasury depletion.

Data Integrity Score: The rejection rate of submissions flagged by oracles must not exceed 15%.

NPS Score: Event and tool satisfaction must maintain at least 50 per Arbitrum M4/M5.

---

## 3. Users and Use Cases

The product architecture serves a 5-sided marketplace, ensuring checks and balances between labor, management, capital, verification, and community beneficiaries.

### 3.1 Primary Users and Personas

Persona A: The Gardener (The Laborer)

Profile: Field workers in bio-regions such as Nigeria and Brazil. May operate in low-connectivity zones with low-end devices.
Motivation: Livelihood security and community improvement.
Key Interface: AI Agent via WhatsApp/SMS for reporting and PWA for deep management.
Definition of Success: Successfully logging work via a text message or photo and receiving payment notification without managing a crypto wallet.

Persona B: The Garden Operator (The Steward)

Profile: Local chapter administrator or NGO program manager.
Motivation: Funding sustainability and coordinating local labor.
Key Interface: Admin Dashboard.
Definition of Success: Efficiently verifying queues of submissions, minting Hypercerts, and managing the Garden Treasury.

Persona C: The Funder (The Capital Provider)

Profile: Institutional donors, Government Agencies such as California Natural Resources Agency, or Octant stakers.
Motivation: Verified Impact (MRV), compliance with legal mandates, and capital efficiency.
Key Interface: Admin Funder Dashboard and Octant Vaults.
Definition of Success: Depositing assets into a vault and receiving an automated Karma GAP report showing yield utilization.

Persona D: The Evaluator (The Verifier)

Profile: Domain experts such as sustainability experts or material scientists, or specialized Oracles.
Motivation: Ensuring integrity, preventing greenwashing, and maintaining professional reputation.
Key Interface: Admin Dashboard (Evaluator View).
Definition of Success: Reviewing completed Impact Reports or Assessments and cryptographically certifying the quality of the data.

Persona E: The Community Member (The Beneficiary)

Profile: Local residents living in the bioregion affected by the Garden's work.
Motivation: Ensuring the work actually benefits the local ecosystem and holding the Garden accountable.
Key Interface: Public Signal Feed and Gardens Conviction Voting.
Definition of Success: Ability to Signal or Attest that the work exists and is healthy, and signaling prioritization for future actions.

### 3.2 Top Jobs-to-be-Done

JTBD1: Low-Bandwidth Submission
User: Gardener
Context: When I am in the field with no data plan
Job: I want to text a photo to the AI Agent
Outcome: So that my labor is logged even without a high-end smartphone.

JTBD2: Impact Report Aggregation
User: Operator
Context: When the quarter ends and reporting is due
Job: I want to aggregate all verified actions into a single Impact Report
Outcome: So that I can mint a Hypercert bundle and sell it to the Octant Vault.

JTBD3: Principal-Preserving Funding
User: Funder
Context: When I want to support a region without losing principal
Job: I want to stake ETH in an Octant Vault
Outcome: So that my yield acts as a perpetual endowment for the local community.

JTBD4: Cryptographic Verification
User: Evaluator
Context: When a Garden claims Biodiversity Increase
Job: I want to review the aggregated data and sensor logs
Outcome: So that I can cryptographically sign an attestation verifying the claim.

JTBD5: Community Prioritization
User: Community Member
Context: When a Garden proposes a new project
Job: I want to signal my priority via Conviction Voting
Outcome: So that yield flows to the actions that matter most to us.

### 3.3 Use Cases

Use Case 1: PWA Impact Reporting. An Operator uses the PWA to aggregate 500 individual tree planting actions into a Q1 Reforestation Report. The system formats this data according to the Common Impact Data Standard for Karma GAP integration.

Use Case 2: Impact Reporting Certification. An Evaluator receives the Q1 Reforestation Report. They analyze the attached sensor data and satellite imagery. Satisfied with the quality, they sign the report using their Hats Protocol Verifier authority, certifying it for minting.

Use Case 3: Garden Revenue Tokenization. A Garden mints a Hypercert based on the certified report. They list this Hypercert on the Revnet. The Octant Vault automatically purchases it using yield, and the revenue flows into the Garden's treasury, backing the value of the local Garden Token.

Use Case 4: Prioritization Signaling. Community members stake their reputation (GreenWill Badges) on specific actions within the Garden's governance page, signaling that Water Conservation is a higher priority than Planting for the upcoming season.

### 3.4 Action Domains and Target Outcomes

Green Goods is not a generic impact tracking tool. It is purpose-built to capture and verify specific categories of regenerative work emerging from Greenpill Network chapters and aligned initiatives. The protocol optimizes for five core action domains that reflect where local communities are actively creating value.

Domain 1: Solar Infrastructure (DePIN Pillar)

Primary Chapter: Greenpill Nigeria through the Tech and Sun program.
Key Outcome: Energy access plus staking yield at Nigerian universities.

The Tech and Sun initiative deploys solar-powered container hubs at University of Nigeria Nsukka and Nnamdi Azikiwe University. These hubs provide reliable electricity, Starlink internet, Ethereum staking infrastructure, and co-learning spaces for Web3 education. Green Goods captures each phase of hub deployment and ongoing operations, creating an immutable audit trail for funders and enabling yield routing from staking rewards.

Action Lifecycle for Solar Hubs: Site Acquisition documents land/space agreement with university through photos of location, signed agreement scan, and GPS coordinates. Container Procurement records purchase and delivery of 20ft shipping container through delivery receipt and photos. Solar Installation captures panel, inverter, and battery setup through photos and Switch meter data. Connectivity Setup documents Starlink deployment through speed test results and subscription proof. Node Deployment records Ethereum staking node setup through validator address and deposit transaction. Hub Launch documents official opening through event photos and attendance count. Ongoing Operations captures daily usage through user count, energy generated in kWh, and session duration. Workshop Hosted records educational events through attendance list and participant feedback.

Impact Metrics for Solar Domain: Energy Generated in total kWh. Users Served as unique individuals. Node Uptime as percentage availability. Yield Generated in ETH rewards. Workshops Hosted as count of sessions. Cost per kWh as efficiency metric.

Domain 2: Waste Management (Environment Pillar)

Primary Chapters: Greenpill Cape Town, Greenpill Ivory Coast, Greenpill Koh Phangan, and Greenpill Rio Brasil.
Key Outcome: Circular economy systems reducing environmental waste.

Waste management is being tackled across multiple chapters with varying approaches. Cape Town focuses on community beach cleanups for coastal ecosystems. Ivory Coast addresses urban waste collection in informal settlements. Koh Phangan optimizes island waste for resort areas and marine debris. Rio Brasil builds systematic waste management for urban and suburban circular economy. Green Goods standardizes capture across these diverse approaches while allowing local customization of waste categories and processing methods.

Action Lifecycle for Waste Management: Area Assessment surveys location to understand waste problem through GPS, photos of waste accumulation, and area size estimate. Cleanup Event collects and removes waste through before/after photos, waste weight, and participant count. Waste Sorting categorizes collected waste by type through photos of sorted piles and weight by category. Recycling Delivered transports recyclables to processing facility through delivery receipt and materials list. Composting processes organic waste into compost through compost pile photos and input/output weights. Upcycling Project transforms waste into useful products through input materials and output products documentation.

Impact Metrics for Waste Domain: Total Waste Removed in kg collected. Diversion Rate as percentage recycled versus landfilled. Area Cleaned in total square meters restored. Participants Engaged as unique individuals. Material Recovery Value as economic value of recyclables.

Domain 3: Agroforestry and Planting (DeSci plus Environment Pillars)

Primary Chapters: Greenpill Brasil through AgroforestryDAO led by Diogo, and Greenpill Uganda led by Jonathan.
Key Outcome: Biodiversity increase, carbon sequestration, and intergenerational knowledge transfer.

Two distinct approaches define this domain. The AgroforestryDAO approach in Brasil builds not just a system to capture work but one that spreads knowledge to future generations through documentation of sustainable farming practices and biodiversity corridors. The Educational Planting approach in Uganda combines planting with education where Jonathan visits schools and churches to plant native, fruit-bearing trees. Each student becomes a caretaker for a specific tree, creating personal relationships with the ecosystem and enshrining the importance of trees from environmental, nutritional, and spiritual perspectives.

Action Lifecycle for Agroforestry: Site Assessment evaluates land for planting suitability through GPS, soil photos, and existing vegetation survey. Species Selection chooses appropriate native species through species list, rationale, and seed source. Site Preparation clears and amends soil through before photos and soil test results if available. Planting completes tree and seedling installation through species, count, GPS of each tree if feasible, and photos. Student Assignment assigns tree to student caretaker for Uganda model through student name, tree ID, and assignment photo. Monitoring and Observation checks health, growth, and identifies issues through photos, measurements, and health status. Harvesting collects fruits, seeds, or other products through yield weight, quality, and distribution plan. Knowledge Documentation records farming techniques for future generations through written guide, video, and languages used.

Impact Metrics for Agroforestry Domain: Trees Planted as total count by species. Native Species Ratio as percentage of native versus non-native. Survival Rate as trees alive at 6-month and 1-year checkpoints. Caretakers Engaged as students and community members assigned. Knowledge Records as documentation pieces created. Carbon Sequestration Estimate in tCO2e using standard factors. Fruit and Harvest Yield in kg of produce.

Domain 4: Education and Web3 Workshops (Education Pillar)

Primary Chapters: All Greenpill chapters plus Artizen Fund student cohort.
Key Outcome: Skill building in coordination mechanisms and intergenerational knowledge transfer.

Green Goods serves as the verification layer for educational initiatives across three program types. General Web3 Workshops teach coordination and governance mechanisms across all chapters. Artizen Fund Cohort consists of students funded to host events using regenerative tools, with Green Goods verifying attendance and learning outcomes. Tech and Sun Educational Programs deliver blockchain and ReFi training at solar hubs in Nigeria.

Action Lifecycle for Education: Event Planning schedules and prepares workshop through event details, curriculum, and venue confirmation. Workshop Hosted conducts educational session through attendance list, photos, and materials used. Participant Attendance records individual attendance through sign-in, photo proof, and engagement evidence. Learning Assessment evaluates through quiz, project, or demonstration with results and submissions. Certificate Issued provides completion credential through NFT badge or attestation. Follow-up Action documents participant applying learning through evidence of real-world application.

Impact Metrics for Education Domain: Workshops Hosted as total count by type. Participants Trained as unique individuals across all sessions. New Web3 Users Onboarded as first-time wallet creators. Completion Rate as percentage completing full curriculum. Follow-up Actions as documented applications of learning. Geographic Reach as countries and regions served. Artizen Fund Compliance Rate as verified versus funded events.

Domain 5: Mutual Credit and Farmer Verification (DePIN plus DeSci Pillars)

Primary Chapter: Greenpill Brasil through commitment pooling pilot.
Key Outcome: Credit access for rural farmers through verified productive capacity.

Rural farmers often lack access to credit due to inability to verify their productive capacity. Green Goods serves as the verification tool for commitment pooling pilots in Brasil, where farmers demonstrate consistent agricultural output to unlock mutual credit lines. This creates a pathway from verified work to financial inclusion.

Action Lifecycle for Farmer Verification: Farm Registration documents farm location, size, and crops through GPS boundaries, land ownership proof, and crop inventory. Planting Season records what was planted, when, and where through planting photos, seed receipts, and area planted. Growth Monitoring provides regular updates on crop progress through photos over time and growth measurements. Harvest Documentation records harvest quantity and quality through harvest photos, weight, count, and quality grade. Sale and Distribution documents where produce went through buyer receipt, market photos, and price achieved. Commitment Fulfilled demonstrates completion of stated commitment through summary of promised versus delivered output.

Impact Metrics for Mutual Credit Domain: Farms Registered as total verified farms. Harvest Volume as total kg documented. Commitment Fulfillment Rate as percentage meeting stated targets. Credit Unlocked as value of credit lines enabled. Yield per Hectare as productivity metrics by crop.

### 3.5 Action Schema Registry

Green Goods maintains a registry of standardized action schemas that Gardens can activate based on their focus area. Actions are tagged with the Eight Forms of Capital they create or enhance.

Core Actions Available in All Gardens: Planting creates Living, Material, and Experiential capital. Identify Plant creates Living, Intellectual, and Experiential capital. Watering creates Living, Material, and Experiential capital. Harvesting creates Living, Material, and Experiential capital. Waste Cleanup creates Material, Social, and Experiential capital. Web3 Workshop creates Intellectual, Social, and Experiential capital.

Domain-Specific Actions: Solar Hub Session creates Material, Intellectual, and Social capital and is available to TAS Gardens only. Node Deployment creates Material and Financial capital and is available to TAS Gardens only. Waste Sorting creates Material and Intellectual capital and is available to Waste-focused Gardens. Tree Assignment creates Living, Social, and Cultural capital and is available to Educational Gardens. Knowledge Documentation creates Intellectual and Cultural capital and is available to AgroforestryDAO Gardens. Event Attendance creates Intellectual and Social capital and is available to All Gardens. Farm Registration creates Living and Material capital and is available to Credit Pool Gardens. Commitment Fulfilled creates Financial and Material capital and is available to Credit Pool Gardens.

Eight Forms of Capital Reference: Living capital includes biodiversity, ecosystems, soil, and water. Material capital includes physical infrastructure, equipment, and land. Financial capital includes money, credit, and investment. Social capital includes relationships, trust, and networks. Intellectual capital includes knowledge, skills, and data. Experiential capital includes wisdom from practice and tacit knowledge. Cultural capital includes traditions, identity, and meaning. Spiritual capital includes purpose, connection, and meaning.

---

## 4. Problem Statement

### 4.1 What is Broken Today

Verification Gap: Traditional MRV is too expensive for small projects at $5,000-15,000 per verification event, while simple photo uploads lack scientific rigor and trust for institutional capital.

Capital Volatility: Crypto-philanthropy often relies on volatile tokens or one-off grants. When the market crashes or donors churn, projects die.

Accessibility Wall: Most web3 impact tools require a smartphone, a wallet, and ETH for gas. This excludes the poorest and most vital ecological laborers.

Missing Feedback Loops: Beneficiaries (local communities) and Experts (Evaluators) are often excluded from the verification loop, leading to paper parks or greenwashing.

### 4.2 Why It Matters Now

Global South Adoption: The environment for crypto and blockchain technology is becoming increasingly friendly and vital in the Global South. Nigeria has 87% smartphone adoption and Brazil has 79%. High mobile penetration combined with a need for stable financial rails makes these regions ideal adopters for a Local-First regenerative economy.

The Yield Economy: The maturity of Octant and DeFi allows for endowment models where principal is preserved and only yield is spent.

AI at the Edge: LLMs have become efficient enough to run Agri-Advisor agents that can democratize access to complex protocols via simple text.

### 4.3 Insights from Research and Pilots

Pilot Program Learnings from Greenpill Garden Season One

Nigeria Solar Hubs: Initial pilots with Tech and Sun demonstrate that WhatsApp-based submission is preferred over PWA for low-connectivity environments. Users reported 3x higher engagement when able to text photos versus navigating app flows.

Brazil Agroforestry: Portuguese localization pilot showed 85% completion rate for action submissions when using native language versus 40% with English-only interface.

User Research Finding: Gardeners in multiple regions expressed that feeling paid matters as much as actual payment. Real-time balance updates and GreenWill points gamification increased submission frequency by 2.1x.

Industry Research

MRV Cost: Traditional certification costs $5,000-15,000 per verification event according to Gold Standard Pricing. Green Goods targets less than $5 per verification through peer validation plus AI.

Mobile Penetration: Nigeria 87% and Brazil 79% according to World Bank 2025.

LLM Cost Reduction: 90% decrease in inference costs in 2025 according to OpenAI and Anthropic pricing.

Validation Evidence

Users will submit via WhatsApp was tested with Nigeria pilot of 50 users. Result was 78% preferred messaging. Confidence is High.

Passkey auth reduces abandonment was tested with onboarding A/B test. Result was 3.2x completion rate. Confidence is High.

Conviction voting drives participation was tested with simulation with GreenWill holders. Result was 52% active signaling. Confidence is Medium.

Yield-to-Hypercert purchase works was tested with testnet simulation. Result was successful atomic execution. Confidence is Medium.

---

## 5. Scope

### 5.1 In Scope (This Release)

Interfaces

PWA: Offline-first web app with Localization support for Spanish and Portuguese.
Admin Dashboard: UI for managing Gardens and creating impact reports.
AI Agent (Beta): WhatsApp and SMS bot for Gardener submissions.

Protocol Layer

Karma GAP: Automated reporting pipelines with CIDS compliance.
Octant Vaults: Deployment of yield-bearing vaults for capital formation.
Revnets: Configuration of Juicebox Revnets for Garden Treasury management.
Hypercerts: Minting logic for verified impact claims.
Conviction Voting: Module for yield allocation and action prioritization.

Identity and Reputation

Unlock Protocol: Minting of GreenWill reputation badges (NFTs) based on user activity.
Hats Protocol: Management of on-chain roles such as Operator and Evaluator and permissions.

Verification

Operators: Tools for initial data aggregation and verification.
Evaluators: Admin Dashboard view for certifying Impact Reports.
Community Signaling: Mechanism for beneficiaries to flag issues or upvote priorities.

### 5.2 Revnet Configuration (The Fractal Gardens Model)

Green Goods adopts a two-tiered Fractal Gardens architecture using Juicebox V4 Revnets.

Level 1: Protocol Revnet ($GG Token)

Issues the core Green Goods governance token. Funds shared infrastructure including servers, indexers, legal, and development. Receives tribute from Level 2 Gardens at 2.5-5% of incoming funds and tokens.

Level 2: Garden Revnets (Local Tokens)

Each community operates its own Revnet such as $LAGOS, $BRAZIL, or $NIGERIA. Issues local tokens representing governance rights and treasury claims. Routes tribute percentage to Level 1 Protocol.

Revnet Economic Mechanics

Issuance (Price Ceiling): Dynamic based on contributions. Prevents price exceeding fair value through arbitrage.

Redemption Rate: Set at 80-90%. This is the cash-out tax where 10-20% remains in treasury, permanently increasing backing per remaining token.

Reserved Rate: Set at 10-20%. Reserved tokens split between Garden DAO treasury at 50% and Protocol treasury at 50%.

Tribute Mechanism: Set at 2.5-5% via JBSplits. Funds shared infrastructure from Garden success.

The Octant-Backstopped Impact Floor

This mechanism creates sustainable funding independent of speculation.

Step 1 Deposit: Funders stake assets in Octant Vault.
Step 2 Yield Generation: Low-risk DeFi strategies generate returns.
Step 3 Programmatic Buyback: Yield automatically purchases Hypercerts from Gardens.
Step 4 Floor Rising: Each purchase increases backing per token, creating a minimum wage for ecological labor backed by Ethereum staking rewards.

### 5.3 Out of Scope

Robust Identity System (DID): A fully decentralized identity system backed by W3C DIDs is deferred to a future release. Version 1 relies on WebAuthn and standard maturation.

Global IoT Network: Full integration with hardware sensors such as Silvi and Local Network is Phase 2.

Scope 3 Data Marketplace: Insurance and Finance data sales are Phase 3.

GreenWill Advanced Reputation: Complex reputation staking and slashing mechanics are deferred.

### 5.4 Assumptions

A1: Onchain impact reporting is more valuable than traditional reporting.
Validation: Track funder preference in post-pilot surveys. Compare funding secured by onchain-reporting Gardens versus traditional reporting projects.
Red Flag: If traditional tooling improves via AI and the onchain value-add is not perceived as differentiated by Q2 2026.

A2: Projects can long-term earn enough yield to be sustainable.
Validation: Calculate yield-to-impact ratio across pilot Vaults. Model time-to-sustainability for different capital levels.
Red Flag: If funders perceive yield as too passive and prefer direct donation models.

A3: Impact certificate marketplaces will develop around Hypercerts.
Validation: Monitor Hypercerts ecosystem liquidity. Track secondary sales volume.
Red Flag: By Q3 2026, no impact marketplaces building liquidity around Hypercerts.

A4: AI Agents can accurately parse natural language impact submissions.
Validation: Measure Agri-Advisor accuracy rate on image identification and metadata extraction.
Red Flag: If error rate exceeds 15%, requiring Operator intervention on majority of submissions.

A5: Community members will participate in Conviction Voting without direct financial incentives.
Validation: Track participation rates across Gardens. Correlate with GreenWill badge levels.
Red Flag: If voting participation drops below 30% after initial novelty period.

A6: Gasless transactions via Pimlico remain economically viable at scale.
Validation: Monitor sponsorship costs per transaction. Model break-even point.
Red Flag: If gas costs exceed 5% of yield generated per action.

A7: Evaluators will maintain integrity under reputation staking model.
Validation: Track dispute rates and community flagging of Evaluator decisions.
Red Flag: If collusion patterns emerge in Gardens with concentrated Evaluator power.

---

## 6. Solution Overview

### 6.1 Experience Summary

Green Goods v1 acts as a bridge. For the Gardener, it is a helpful WhatsApp contact that pays them for work. For the Funder, it is a high-yield savings account that heals the planet. For the Evaluator, it is a data-rich platform for certifying truth.

### 6.2 Core Workflow Pattern

Capture/Input Stage: Photos, metadata, GPS, and voice notes via PWA or AI Agent.
Details/Structure Stage: CIDS-compliant action schema, attestation construction, and Hypercert metadata.
Review/Confirm Stage: Operator approval queue, Evaluator certification, and Hypercert minting.

### 6.3 Key User Flows

Flow 1: AI-Driven Capture (High Access)

Capture: Gardener sends photo to WhatsApp Bot.
Process: AI Agent identifies object and cross-references with Action Schema.
Sign: Agent uses server-side Smart Account (signer controlled) to sign payload.
Store: Data anchored on IPFS via Storracha and stored onchain with EAS.

Flow 2: Impact Report Minting and Evaluation (High Trust)

Aggregate: Operator selects verified actions in the PWA and clicks Create Report.
Certify: The Evaluator receives the report, reviews aggregated evidence, and attests to validity using their Hats Protocol authority.
Mint: The system allows the Operator to mint the Hypercert, referencing the Evaluator's certification attestation.

Flow 3: Capital Formation and Allocation (Sustainability)

Deposit: Funder stakes assets in a Garden's Octant Vault.
Yield: Yield accrues in the Vault.
Buyback: Protocol programmatically uses the allocated yield to buy verified Garden Hypercert shares, raising the Impact Floor price.

Flow 4: Governance and Signaling (High Coordination)

Yield Allocation: Garden members vote via Conviction Voting to determine the split of yield to send to Hypercerts.
Action Prioritization: Garden operators and gardeners signal which specific actions the Garden should prioritize.

---

## 7. Requirements

### 7.1 Functional Requirements

FR-P-001 AI Agent Interface: Integration of LLM wrapper via Twilio and OpenAI to parse natural language submissions via WhatsApp and SMS.

FR-P-002 Admin Dashboard: Comprehensive dashboard for Operators to manage submissions and for Evaluators to review and certify Impact Reports.

FR-P-003 Octant Vaults: ERC-4626 Vault contracts configured to route yield to specific Garden Revnets.

FR-P-004 Hypercerts Minting: Aggregation of approved attestations into ERC-1155 Hypercert tokens with IPFS-anchored metadata.

FR-P-005 Revnet Configuration: Deployment of Juicebox V4 Revnets with configurable redemption rates at 80-90%, reserved rates at 10-20%, and tribute routing at 2.5-5%.

FR-P-006 Conviction Voting: Implementation of Gardens Conviction Voting module for yield allocation and action prioritization.

FR-P-007 GreenWill Badging: Integration with Unlock Protocol to mint NFT badges based on user activity thresholds.

FR-P-008 Role Management: Integration with Hats Protocol to assign and manage on-chain permissions for Operators and Evaluators.

FR-P-009 Smart Account Automation: Backend infrastructure to manage Safe accounts for users interacting solely via AI Agents.

FR-P-010 Karma GAP Sync: Bi-directional sync between Green Goods actions and Karma GAP milestone updates.

FR-P-011 Passkey Authentication: WebAuthn-based biometric login with Safe Smart Account deployment via Pimlico.

### 7.2 Non-Functional Requirements

NFR-001 Localization: The PWA must support dynamic localization with full support for English, Spanish, and Portuguese at launch. All user-facing strings must be externalized with no hardcoded text. Date, time, and number formatting must respect locale settings.

NFR-002 Latency: AI Agent must respond to user texts within 5 seconds to maintain conversational flow. PWA page load must complete within 3 seconds on 3G connection. Admin Dashboard queries must return within 2 seconds for datasets under 1000 records.

NFR-003 Trust and Auditability: All Evaluator actions must be on-chain and auditable. Evaluator reputation via GreenWill must be slashable if they verify fraudulent data. Complete action provenance trail from submission to approval to Hypercert must be queryable.

NFR-004 Cost and Gas Abstraction: Gardeners must pay $0 gas via Pimlico sponsorship. Protocol sponsorship budget must be monitored with alerts at 80% consumption. Fallback mechanism required if Pimlico is unavailable.

NFR-005 Performance: PWA must function with full capability offline and sync on reconnection. Service Worker cache must support 500+ pending actions before sync. IndexedDB storage must not exceed 50MB per user session. Image compression must reduce uploads to under 500KB before IPFS pinning.

NFR-006 Reliability: System must maintain 99.5% uptime for core flows including submission, approval, and minting. Graceful degradation required where if IPFS fails queue locally and if Arbitrum is congested batch transactions. Auto-retry with exponential backoff for all external service calls. Circuit breaker pattern for Twilio and OpenAI dependencies.

NFR-007 Security and Permissions: All Smart Account deployments must use deterministic CREATE2 addresses. Passkey credentials must never leave user device. API endpoints must enforce rate limiting at 100 requests per minute per wallet. Role-based access via Hats Protocol must be enforced at contract level. No admin keys for contract upgrades in production using Diamond pattern with governance only.

NFR-008 Privacy and Data Handling: GPS coordinates must be obfuscated to 3 decimal places providing 111m precision for public display. User PII such as name and bio stored on IPFS with encryption with only wallet address on-chain. GDPR-compliant data deletion must be supported for EU users. Analytics must use anonymized wallet hashes not raw addresses.

NFR-009 Accessibility: PWA must meet WCAG 2.1 AA standards. Touch targets must be minimum 44x44px for mobile use. High contrast mode must be available for outdoor and bright light conditions. Screen reader compatibility required for all core flows.

NFR-010 Compatibility: PWA must function on Chrome 90+, Safari 15+, Firefox 90+, and Samsung Internet 15+. Mobile support for iOS 14+ and Android 10+. Minimum device is 2GB RAM and 16GB storage. Offline mode must work on devices with no active data plan.

---

## 8. Feature Breakdown

Feature GG-FEAT-001 PWA Offline-First Architecture: Priority is Critical. Status is In Progress. Estimated Effort is 3 weeks. Dependencies are IndexedDB and Service Workers. Notes: Core to Last Mile access.

Feature GG-FEAT-002 Passkey Authentication: Priority is Critical. Status is In Progress. Estimated Effort is 2 weeks. Dependencies are WebAuthn, Safe, and Pimlico. Notes: Removes Privy dependency.

Feature GG-FEAT-003 AI Agent via WhatsApp and SMS: Priority is High. Status is Planned. Estimated Effort is 4 weeks. Dependencies are Twilio and OpenAI/Llama. Notes: Billions interface.

Feature GG-FEAT-004 Admin Dashboard v2: Priority is High. Status is Planned. Estimated Effort is 3 weeks. Dependencies are React and Envio. Notes: Operator verification queue.

Feature GG-FEAT-005 Hypercerts Minting: Priority is High. Status is Planned. Estimated Effort is 4 weeks. Dependencies are ERC-1155 and IPFS. Notes: Aggregation plus atomic mint.

Feature GG-FEAT-006 Octant Vault Integration: Priority is High. Status is Planned. Estimated Effort is 4 weeks. Dependencies are ERC-4626 and DeFi strategies. Notes: Yield-bearing deposits.

Feature GG-FEAT-007 Revnet Configuration: Priority is Medium. Status is Planned. Estimated Effort is 3 weeks. Dependencies are Juicebox V4. Notes: Garden treasury management.

Feature GG-FEAT-008 Conviction Voting Module: Priority is Medium. Status is Planned. Estimated Effort is 3 weeks. Dependencies are Gardens Protocol. Notes: Yield allocation governance.

Feature GG-FEAT-009 GreenWill Badging: Priority is Medium. Status is Planned. Estimated Effort is 2 weeks. Dependencies are Unlock Protocol. Notes: Reputation NFTs.

Feature GG-FEAT-010 Hats Protocol Roles: Priority is Medium. Status is Planned. Estimated Effort is 2 weeks. Dependencies are Hats Protocol. Notes: Operator and Evaluator permissions.

Feature GG-FEAT-011 Karma GAP Sync: Priority is High. Status is In Progress. Estimated Effort is 2 weeks. Dependencies are EAS and Karma API. Notes: CIDS-compliant reporting.

Feature GG-FEAT-012 Localization for Spanish and Portuguese: Priority is Medium. Status is In Progress. Estimated Effort is 2 weeks. Dependencies are i18n framework. Notes: Brazilian and LatAm access.

Feature GG-FEAT-013 Report Generator: Priority is Medium. Status is Planned. Estimated Effort is 2 weeks. Dependencies are PDF and JSON export. Notes: Grant compliance automation.

Feature GG-FEAT-014 Silvi Integration: Priority is Low. Status is Deferred. Estimated Effort is 3 weeks. Dependencies are Silvi API. Notes: Tree species verification.

Feature GG-FEAT-015 IoT Sensor Bridge: Priority is Low. Status is Deferred. Estimated Effort is 4 weeks. Dependencies are Local Network and Orbit. Notes: Environmental state proof.

---

## 9. Dependencies and Partnerships

### 9.1 Technical Dependencies

Arbitrum One for L2 Settlement.
Ethereum for L1 for Octant.
Twilio for SMS and WhatsApp.
OpenAI or Llama for LLM.
Pimlico for Gasless Transactions.
Envio for Blockchain Indexer.

### 9.2 Protocol Partners

Octant for Yield Source.
Hypercerts for Impact Certificate.
Juicebox for Revnet Infrastructure.
Karma GAP for Reporting.
Unlock Protocol for Reputation.
Hats Protocol for Permissions.
Gardens Protocol for Conviction Voting.

### 9.3 Funding and Compliance

Arbitrum New Protocols and Ideas Grant totaling $25,000 USD.

Milestone 1 in Month 1: PRD v2 and Designs for $4,000.
Milestone 2 in Months 1-2: Hypercerts Integration for $8,000.
Milestone 3 in Months 2-3: DeFi Integration for $8,000.
Milestone 4 in Months 1-2: Community Activations for $4,000.
Milestone 5 in Month 3: Final Reporting for $1,000.

---

## 10. QA, Rollout, and Ops

### 10.1 QA Strategy

Test Approach

Unit Tests: Jest for frontend components and Foundry for Solidity contracts.
Integration Tests: End-to-end flows using Playwright.
UAT: Structured testing with 5 Gardeners and 3 Operators per pilot Garden.
Pilot Program: Live testing with Greenpill Nigeria, Brasil, and Cape Town chapters.

Device and Platform Coverage

P0 Priority: Android mid-range such as Samsung A-series on Android 11+ using Chrome and Samsung Internet. iPhone SE 2020+ on iOS 15+ using Safari.

P1 Priority: Low-end Android under 2GB RAM on Android 10+ using Chrome. Desktop on Windows 10+ and macOS 12+ using Chrome and Firefox.

Acceptance Gates

All P0 devices must pass happy-path flows.
Offline to sync flow must complete without data loss.
Gas sponsorship must succeed for all test transactions.
Hypercert minting must produce valid ERC-1155 tokens.
Karma GAP sync must produce correctly-structured attestations.

QA Environments

Dev: Arbitrum Sepolia with continuous deployment.
Staging: Arbitrum Sepolia with release candidates.
Production: Arbitrum One with gated rollout.

### 10.2 Rollout Plan

Release Method: Staged rollout with feature flags.

Phase 1: Internal Alpha in Weeks 1-2.
Cohort: Greenpill Dev Guild core team with 8 users.
Features: PWA core, Passkey auth, and basic submission flow.
Monitoring: Error rates, completion funnels, and latency metrics.
Gate: Under 5% error rate on submission flow.

Phase 2: Pilot Beta in Weeks 3-6.
Cohort: Greenpill Nigeria with 25 users and Greenpill Brasil with 25 users.
Features: Full PWA, AI Agent via WhatsApp, and Admin Dashboard.
Monitoring: NPS surveys, session recordings, and support tickets.
Gate: NPS at least 50 and under 10% support ticket rate.

Phase 3: Extended Beta in Weeks 7-10.
Cohort: 8 Gardens total per Arbitrum milestone.
Features: Hypercerts minting and Octant Vault integration.
Monitoring: TVL growth, Hypercert creation rate, and yield routing.
Gate: At least $12k TVL and at least 12 Hypercerts minted.

Phase 4: General Availability in Weeks 11-12.
Cohort: Open enrollment for Greenpill Network chapters.
Features: Full protocol with Conviction Voting.

Monitoring Signals for First 72 Hours

Error rate by flow including submission, approval, and minting.
Latency percentiles at p50, p95, and p99.
Gas sponsorship consumption rate.
User session length and completion funnels.
Support channel volume on Discord and Telegram.

Rollback Plan

Feature flags can disable any new feature within 5 minutes.
Contract upgrades via Diamond pattern require 24-hour timelock.
Database migrations must include rollback scripts.
IPFS pins are immutable so metadata corrections require new CIDs.

### 10.3 Support Plan

Support Channels

Primary: Telegram group per Garden for Gardener support.
Secondary: Discord #green-goods-support for technical issues.
Escalation: GitHub Issues for bugs with reproduction steps.

Severity Definitions

P0 Critical: Protocol down, funds at risk, or data loss. Response SLA is 1 hour. Resolution SLA is 4 hours.

P1 High: Core flow blocked for over 10% of users. Response SLA is 4 hours. Resolution SLA is 24 hours.

P2 Medium: Feature degraded but workaround exists. Response SLA is 24 hours. Resolution SLA is 1 week.

P3 Low: Cosmetic or minor inconvenience. Response SLA is 1 week. Resolution SLA is next release.

### 10.4 Analytics Plan

Events to Instrument

session_start: Fires on session start. Properties include device_type, os, browser, and locale. Purpose is usage patterns.

passkey_created: Fires on passkey creation. Properties include success and error_code. Purpose is auth funnel.

action_submitted: Fires on action submission. Properties include garden_id, action_type, and offline_queued. Purpose is submission funnel.

action_approved: Fires on action approval. Properties include garden_id, action_type, and evaluator_id. Purpose is verification flow.

hypercert_minted: Fires on hypercert minting. Properties include garden_id, actions_bundled, and value. Purpose is impact tokenization.

vault_deposit: Fires on vault deposit. Properties include amount, asset, and garden_allocation. Purpose is capital formation.

conviction_vote: Fires on conviction vote. Properties include garden_id, stake_amount, and direction. Purpose is governance participation.

ai_agent_interaction: Fires on AI agent interaction. Properties include channel, intent_parsed, and success. Purpose is agent effectiveness.

Dashboards

Executive Dashboard: TVIV, TVL, Active Gardeners, and Hypercerts Minted.
Garden Health: Per-garden metrics, verification queue depth, and yield allocation.
Funnel Analysis: Onboarding completion and submission-to-approval conversion.
Technical Health: Error rates, latency, and gas consumption.

Review Cadence

Daily: Error rates and critical funnel metrics.
Weekly: Full dashboard review with team.
Monthly: Cohort analysis, NPS review, and milestone progress.

---

## 11. Risks and Mitigations

### 11.1 Technical Risks

R-T1 AI Hallucination: Likelihood is High. Impact is Medium. Mitigation is that Agent prompts include strict bounds and Agent stages data for Operator review, never finalizes directly.

R-T2 Passkey Adoption Friction: Likelihood is Medium. Impact is High. Mitigation is fallback to email magic link for devices without biometric support with clear onboarding guidance.

R-T3 Pimlico Downtime: Likelihood is Low. Impact is High. Mitigation is to queue transactions locally, implement secondary bundler fallback, and alert on sponsorship failures.

R-T4 IPFS Pinning Failures: Likelihood is Medium. Impact is Medium. Mitigation is to use Storracha with Filecoin backup, retry logic with exponential backoff, and local queue preservation.

R-T5 Smart Contract Vulnerability: Likelihood is Low. Impact is Critical. Mitigation is to apply for Arbitrum audit program, formal verification of core flows, and bug bounty program post-launch.

R-T6 Envio Indexer Lag: Likelihood is Medium. Impact is Medium. Mitigation is to implement optimistic UI updates, background sync status indicators, and fallback to direct RPC for critical queries.

### 11.2 Economic Risks

R-E1 Insufficient Yield for Sustainability: Likelihood is Medium. Impact is High. Mitigation is to model break-even scenarios pre-launch, diversify vault strategies, and set realistic expectations with Gardens.

R-E2 Revnet Token Price Collapse: Likelihood is Medium. Impact is Medium. Mitigation is that cash-out tax at 80-90% preserves treasury floor and focus narrative on work value not speculation.

R-E3 Hypercert Illiquidity: Likelihood is High. Impact is Medium. Mitigation is that protocol acts as buyer of first resort via Octant yield and build relationships with retro funding rounds such as Optimism and Gitcoin.

R-E4 Gas Cost Spike on Arbitrum: Likelihood is Low. Impact is Medium. Mitigation is transaction batching and L3 migration path via Arbitrum Orbit and monitor gas consumption patterns.

### 11.3 Governance and Social Risks

R-G1 Evaluator Collusion: Likelihood is Medium. Impact is High. Mitigation is that Evaluators must stake reputation and tokens, Community Members can flag decisions, and escalation to Protocol-level review.

R-G2 Low Conviction Voting Participation: Likelihood is High. Impact is Medium. Mitigation is to implement low threshold for conviction to take effect, gamify with GreenWill badges, and direct notification on pending votes.

R-G3 Garden Operator Abandonment: Likelihood is Medium. Impact is High. Mitigation is multi-sig requirement for Garden administration, succession planning in onboarding, and Protocol can appoint interim steward.

R-G4 Community Pay-to-Complain Dynamics: Likelihood is Medium. Impact is Medium. Mitigation is that signal staking requires reputation via GreenWill not just tokens and anti-sybil checks on new accounts.

### 11.4 Regulatory and Legal Risks

R-L1 Evaluator Liability for False Verification: Likelihood is Medium. Impact is High. Mitigation is to pursue legal opinion before beta launch and indemnification in Terms of Service.

R-L2 Token Classification as Security: Likelihood is Low. Impact is Critical. Mitigation is to structure Revnet tokens as governance plus utility with no profit-sharing language and engage securities counsel.

R-L3 GDPR Compliance for EU Users: Likelihood is Medium. Impact is Medium. Mitigation is to implement data deletion flows, minimize on-chain PII, and encryption for off-chain storage.

### 11.5 Operational Risks

R-O1 Team Burnout and Capacity Constraints: Likelihood is High. Impact is High. Mitigation is scope management, clear No list in Section 5.3, async-first operations, and buffer in timeline.

R-O2 Dependency on Partner Protocols: Likelihood is Medium. Impact is High. Mitigation is to document fallback strategies for each integration and maintain relationships with alternative providers.

R-O3 Dialect and Language Accuracy in AI Agent: Likelihood is High. Impact is Medium. Mitigation is pre-launch testing with native speakers, iterative prompt refinement, and human-in-the-loop for edge cases.

---

## 12. Open Questions

Q1: What is the legal framework for Evaluator liability if they verify false data? Owner is Legal Lead. Due date is Q1 2026.

Q2: Can the WhatsApp Agent support dialects such as Pidgin and Portuguese effectively at launch? Owner is Product Lead. Due date is February 2026.

Q3: How do we incentivize Community Members to signal without creating a pay-to-complain market? Owner is Community Lead. Due date is February 2026.

Q4: What is the minimum viable vault TVL for sustainable yield generation? Owner is Finance Lead. Due date is January 2026.

Q5: Should Gardens have the ability to customize their Revnet parameters such as redemption rate and reserved rate? Owner is Product Lead. Due date is February 2026.

Q6: How do we handle disputes when Community Members flag Evaluator decisions? Owner is Governance Lead. Due date is March 2026.

---

## 13. Appendix

### 13.1 Glossary

Garden: A hyper-local hub of community and environmental action, represented as a Juicebox Revnet with its own token, treasury, and governance.

Assessment: A quarterly or seasonal goal set by Garden Operators that maps to Karma GAP Milestones.

Action: A discrete unit of ecological work such as planting a tree or cleaning a beach that is captured, verified, and attested.

Work: The aggregate of Actions submitted by a Gardener, awaiting approval.

Work Approval: The Operator/Evaluator review process that converts submitted Work into verified Attestations.

Report: An aggregated bundle of approved Actions formatted for grant compliance or Hypercert minting.

MDR: Monitoring, Data, Reporting. The protocol's internal term for the action capture to attestation to reporting pipeline.

Hypercert: An ERC-1155 impact certificate that bundles verified Actions into a tradable asset.

Revnet: A Juicebox V4 project with programmatic issuance, redemption, and revenue routing.

GreenWill: Reputation tokens as Unlock Protocol NFTs earned through verified regenerative actions.

Conviction Voting: A continuous governance mechanism where voting power compounds over time based on stake duration.

CIDS: Common Impact Data Standard. A structured format for describing impact work.

TVIV: Total Verified Impact Value. The North Star metric for protocol health.

Fractal Gardens: The two-tiered Revnet architecture connecting local Gardens to the Protocol treasury.

Cash-out Tax: The percentage of redemption value that stays in the Revnet treasury when tokens are burned, permanently increasing backing per remaining token.

Impact Floor: The minimum price per token guaranteed by treasury backing, which rises as the Octant Vault purchases Hypercerts.

### 13.2 References

Arbitrum Grant Application: Internal document. Used for success metrics, milestones, and budget.

Revnet Whitepaper: https://github.com/rev-net/whitepaper. Used for economic mechanics reference.

Hypercerts Documentation: https://hypercerts.org/docs. Used for impact certificate standard.

Octant V2 Docs: https://docs.v2.octant.build. Used for yield vault architecture.

Karma GAP Documentation: https://www.karmahq.xyz. Used for grantee accountability protocol.

Juicebox V4 Docs: https://docs.juicebox.money/dev. Used for Revnet implementation.

CIDS Specification: https://commonapproach.org/cids. Used for impact data standard.

Safe plus Passkeys: https://docs.safe.global/advanced/passkeys. Used for authentication architecture.

Pimlico Documentation: https://docs.pimlico.io. Used for ERC-4337 bundler and paymaster.

### 13.3 Related Documents

Miro Board: Contains diagrams, ideation, and visual documentation. Link: https://miro.com/app/board/uXjVLjVA-xQ=

Figma Designs: Contains UI screens and user flows.

GitHub Repository: https://github.com/greenpill-dev-guild/green-goods

Project Board: Contains sprint tracking and user stories.

Greenpill Garden Strategy: Contains Theory of Change and strategic context.

Revnet Model for Vrbs DAO: Contains Fractal Gardens architecture detail.

Tech and Sun Round Documentation: Contains solar hub deployment plans and budgets.

---

End of Document

Green Goods Protocol v1 PRD
Revised January 17, 2026

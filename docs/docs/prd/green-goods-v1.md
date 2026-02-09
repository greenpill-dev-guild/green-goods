---
title: Green Goods v1 PRD
sidebar_label: Green Goods v1
description: Product Requirements Document for Green Goods v1 - Regenerative Compliance and Local First Impact Reporting Platform
---

# Green Goods v1 PRD

## Overview

### 1.1 One-liner

Green Goods is a Regenerative Compliance and Local First Impact Reporting Platform that enables verifiable tracking of ecological actions, tokenization of impact via Hypercerts, and capital formation through Octant Vaults and Revnets.

## 1.2 Context

The global landscape for environmental finance is currently navigating a profound structural transformation, precipitated by a dual crisis of credibility in voluntary carbon markets (VCM) and an urgent, unmet demand for verifiable data in government funded climate and ecological initiatives. The prevailing paradigms of "Monitoring, Reporting, and Verification" (MRV) are failing to scale, burdened by high-cost manual audits that exclude the vast majority of grassroots regenerative projects from accessing capital markets. Traditional certifiers rely on extractive consulting models where a single verification event can cost upwards of $5,000, rendering the model economically unviable for smallholder farmers, community gardens, and hyper-local ecological stewards.

Simultaneously, governments are deploying historic levels of capital but face immense legislative pressure to prove results in "disadvantaged communities" (DACs). This creates a "Verification Gap." Green Goods bridges this gap by pivoting to **Compliance-as-a-Service (CaaS)**, operationalizing the "Regenerative Stack" to connect physical ecological labor with onchain capital.

## 1.3 Why Now

- **The Yield Economy Has Matured**: Octant V2 enables endowment models where principal is preserved.

- **AI at the Edge**: LLM costs dropped 90% in 2025, making Agri-Advisor agents viable at under $0.01 per interaction.

- **Greenpill Garden Season One**: 8+ Gardens are ready to adopt the protocol.

## 1.4 Competitive Positioning

Green Goods differentiates from Silvi (trees only, centralized, enterprise pricing), GainForest (requires satellite, high technical barrier), and Regen Network (Cosmos-based, methodology-heavy) through multi-domain coverage, Ethereum-native DeFi integration, accessible MDR methodology, and community governance via Fractal Gardens and Conviction Voting.

**Key moats**: Network effects from Greenpill chapters, switching costs from attestation history, data moat from accumulated actions, and community ownership through local tokens.

## 1.5 Target Release / Season

- **Release**: Green Goods Protocol v1 (Beta Candidate)

- **Season**: Q1 2026 (Transition from Alpha to Beta).

- **Network Deployment**: Arbitrum One & Ethereum

## 1.6 Owners

- **Product & Engineering Lead**: Afolabi Aiyeloja

- **Design & QA Lead**: Nansel Rimsah

---

# Goals and Success Goals

The architecture of Green Goods v1 is driven by three primary strategic objectives designed to bridge the "Verification Gap" and create a closed-loop regenerative economy. These goals move beyond simple metrics of usage to encompass the structural integrity of the "Regenerative Stack".

## 2.1 Goals

[](https://cdn.charmverse.io/user-content/5e36d65b-e9d7-4667-b1c7-f551832414e3/3a974001-7dfc-4456-85ea-49fa4de502f9/Gemini_Generated_Image_dliwy8dliwy8dliw.png)

### Goal 1: Capital Formation (High Sustainability)

The economic goal is to enable **Capital Formation** rather than simple circulation. By utilizing **Octant Vaults**, the protocol creates "Local Endowments" where low-risk staking yields **systematically purchase Hypercerts**, establishing a "Risk-Free Impact Floor" for ecological labor. Simultaneously, the integration of **Juicebox Revnets** enables "The Growth" layer, allowing communities to grow revenue and manage treasuries where tokens represent governance rights and a claim on future success, rather than just donation receipts.

### Goal 2: Impact Reporting Accessibility (High Reach)

The accessibility goal is to ensure the protocol is available to the "Last Mile" of users, regardless of technical literacy or connectivity. This involves expanding the interface beyond the browser to include **AI Agents** that interact via **WhatsApp and SMS**. This allows even the most rural Gardeners to interface with the protocol using natural language to log work, query earnings, and receive alerts. We also plan to address the ease of aggregating impact into a single asset and make it simple and friendly for individuals to mint **Hypecerts** for impact certification.

### Goal 3: Onchain Governance & Reputation (High Coordination)

The governance goal is to implement a robust badging and reputation system built on **Unlock Protocol** (GreenWill) and **Hats Protocol**. These tools serve as the permission layer for the **Gardens** platform, ensuring that governance is driven by those who create value. By using **Conviction Voting**, the protocol empowers reputation holders to signal distinct priorities: deciding on hypercert yield allocation and prioritizing specific garden actions.

## 2.2 Success Metrics

- **Total Verified Impact Value (TVIV)**

  - **Definition**: The cumulative dollar value of all Hypercerts minted, sold, or held within the protocol ecosystem

  - **Target**: At least $40,000 by end of Q1 2026

- **Vault TVL**

  - **Definition:** The cumulative dollar value of all Hypercerts minted, sold, or held within the protocol ecosystem

  - **Target**: $20,000

- **Active Gardeners**

  - **Definition:** Unique wallet addresses (including Smart Accounts via AI Agent) submitting verified actions

  - **Target**: 48 Wallets

- **Reputation Density**

  - **Definition:** Number of active users holding a GreenWill "Steward" or "Sprout" badge via Unlock Protocol

  - **Target**: >32 Users

- **Verification Efficiency**

  - **Definition:** Percentage of submitted actions processed (Approved/Rejected) by Evaluators/Operators within 72 hours

  - **Target**: >90%

- **Conviction Participation**

  - **Definition:** Percentage of token holders actively signaling/voting on yield allocation via Conviction Voting

  - **Target**: >48%

- **Hypercerts Minted**

  - Number of ERC-1155 impact certificates created from verified actions

  - Target is at least 12 by end of Q1 2026

- **Active Gardeners**

  - Unique wallet addresses submitting verified actions in 30-day window

  - Target is at least 150 users on a rolling 30-day basis

- **Gardens Active**

  - Number of distinct Gardens using Arbitrum for impact reporting

  - Target is at least 8 by end of Q1 2026

- **CIDS Compliance Rate**

  - Percentage of actions structured per Common Impact Data Standard

  - Target is at least 80% per cohort

- **Karma GAP Updates**

  - Number of verified actions pushed to Karma GAP as milestone updates

  - Target is at least 100 by end of Q1 2026

### Guardrails 

- **Redemption Rate (Revnet):** The cash-out tax on Garden Tokens must remain between **80-90%** to prevent treasury depletion.

- **Data Integrity Score:** The rejection rate of submissions flagged by IoT/Silvi oracles must not exceed **15%**.

---

# 3) Users and Use Cases

The product architecture serves a **5-sided marketplace**, ensuring checks and balances between labor, management, capital, verification, and community beneficiaries.

## 3.1 Primary Users / Personas

[](https://s3.amazonaws.com/charm.public/user-content/5e36d65b-e9d7-4667-b1c7-f551832414e3/e9904358-6280-4a05-ab3d-055fb420fa50/4d057d7e-8c1c-470a-9c41-d2aa9159b084.png)

### Persona A: The Gardener (The Laborer)

- **Profile:** Field workers in bio-regions (e.g., Nigeria, Brazil). May operate in low-connectivity zones.

- **Motivation:** Livelihood security and community improvement.

- **Key Interface:** **AI Agent (WhatsApp/SMS)** for reporting; PWA for deep management.

- **Definition of Success:** Successfully logging work via a text message or photo and receiving payment notification without managing a crypto wallet.

### Persona B: The Garden Operator (The Steward)

- **Profile:** Local chapter administrator or NGO program manager.

- **Motivation:** Funding sustainability and coordinating local labor.

- **Key Interface:** **Admin Dashboard**.

- **Definition of Success:** Efficiently verifying queues of submissions, minting Hypercerts, and managing the Garden Treasury.

### Persona C: The Evaluator (The Verifier)

- **Profile:** Domain experts (e.g., sustainability experts, material scientists) or specialized Oracles.

- **Motivation:** Ensuring integrity, preventing greenwashing, and maintaining professional reputation.

- **Key Interface:** **Admin Dashboard (Evaluator View)**.

- **Definition of Success:** Reviewing completed Impact Reports or Assessments and cryptographically certifying the quality of the data.

### Persona D: The Funder (The Capital Provider)

- **Profile:** Institutional donors, Government Agencies (e.g., California Natural Resources Agency), or Octant stakers.

- **Motivation:** **Verified Impact (MRV)**, compliance with legal mandates, and capital efficiency.

- **Key Interface: Admin Funder Dashboard & Octant Vaults**.

- **Definition of Success:** Depositing assets into a vault and receiving an automated Karma GAP report showing yield utilization.

### Persona E: The Community Member (The Beneficiary)

- **Profile:** Local residents living in the bioregion affected by the Garden's work.

- **Motivation:** Ensuring the work actually benefits the local ecosystem and holding the Garden accountable.

- **Key Interface:** **Public Signal Feed &** **Gardens Conviction Voting**.

- **Definition of Success:** Ability to "Signal" or "Attest" that the work exists and is healthy, providing a "Proof of State" from the ground up, and signaling prioritization for future actions.

## 3.2 Top Jobs-to-be-Done (JTBD)

- **JTBD1: Low Bandwidth Submission**

  - **User**: Gardener

  - **Context**: When I am in the field with no data plan...

  - **Job**: I want to text a photo to the AI Agent...

  - **Outcome**: So that my labor is logged even without a high end smartphone.

- **JTBD2: Impact Report Aggregation**

  - **User**: Operator

  - **Context**: When the quarter ends and reporting is due...

  - **Job**: I want to aggregate all verified actions into a single Impact Report...

  - **Outcome**: So that I can mint a Hypercert bundle and sell it to the Octant Vault.

- **JTBD3: Principal Preserving Funding**

  - **User**: Funder

  - **Context**: When I want to support a region without losing principal...

  - **Job**: I want to stake ETH in an Octant Vault...

  - **Outcome**: So that my yield acts as a perpetual endowment for the local community.

- **JTBD4: Impact Evaluation**

  - **User**: Evaluator

  - **Context**: When a Garden claims "Biodiversity Increase"...

  - **Job**: I want to review the aggregated data and sensor logs...

  - **Outcome**: So that I can cryptographically sign an attestation verifying the claim

- **JTBD5: Community Prioritization**

  - **User**: Community Member

  - **Context**: When a Garden proposes a new project...

  - **Job**: I want to signal my priority via Conviction Voting...

  - **Outcome**: So that yield flows to the actions that matter most to us (e.g., Planting "Mangroves" vs. "Fruit Trees").

## 3.3 Use Cases (Brief)

1. **PWA Impact Reporting:** An Operator uses the PWA to aggregate 500 individual tree planting actions into a "Q1 Reforestation Report." The system formats this data according to the Common Impact Data Standard (CIDS) for Karma GAP integration.

2. **Impact Reporting Certification:** An Evaluator receives the "Q1 Reforestation Report." They analyze the attached Silvi sensor data and satellite imagery. Satisfied with the quality, they sign the report using their **Hats Protocol** "Verifier" authority, certifying it for minting.

3. **Garden Revenue Tokenization:** A Garden mints a Hypercert based on the certified report. They list this Hypercert on the Revnet. The Octant Vault automatically purchases it using yield, and the revenue flows into the Garden's treasury, backing the value of the local Garden Token ($GG-Local).

4. **Prioritization Signaling:** Community members stake their reputation (GreenWill Badges) on specific actions within the Garden's governance page, signaling that "Water Conservation" is a higher priority than "Planting" for the upcoming season.

### 3.4 Action Domains and Target Outcomes

Green Goods is not a generic impact tracking tool. It is purpose-built to capture and verify specific categories of regenerative work emerging from Greenpill Network chapters and aligned initiatives. The protocol optimizes for **five core action domains** that reflect where local communities are actively creating value.

[](https://cdn.charmverse.io/user-content/5e36d65b-e9d7-4667-b1c7-f551832414e3/24b1f4f0-bd3e-407b-996b-cdff4f164ddc/Gemini_Generated_Image_m1ye82m1ye82m1ye.png)

### Domain 1: Solar Infrastructure (DePIN Pillar)

- **Primary Chapter**: Greenpill Nigeria through the Tech and Sun program.

- **Key Outcome**: Energy access plus staking yield at Nigerian universities.

The Tech and Sun initiative deploys solar-powered container hubs at University of Nigeria Nsukka and Nnamdi Azikiwe University. These hubs provide reliable electricity, Starlink internet, Ethereum staking infrastructure, and co-learning spaces for Web3 education. Green Goods captures each phase of hub deployment and ongoing operations, creating an immutable audit trail for funders and enabling yield routing from staking rewards.

**Action Lifecycle for Solar Hubs**

1. Site Acquisition documents land/space agreement with university through photos of location, signed agreement scan, and GPS coordinates.

2. Container Procurement records purchase and delivery of 20ft shipping container through delivery receipt and photos.

3. Solar Installation captures panel, inverter, and battery setup through photos and Switch meter data.

4. Connectivity Setup documents Starlink deployment through speed test results and subscription proof.

5. Node Deployment records Ethereum staking node setup through validator address and deposit transaction.

6. Hub Launch documents official opening through event photos and attendance count.

7. Ongoing Operations captures daily usage through user count, energy generated in kWh, and session duration.

8. Workshop Hosted records educational events through attendance list and participant feedback.

**Impact Metrics for Solar Domain**

- Energy Generated in total kWh

- Users Served as unique individuals

- Node Uptime as percentage availability

- Yield Generated in ETH rewards

- Workshops Hosted as count of sessions

- Cost per kWh as efficiency metric.

### Domain 2: Waste Management (Environment Pillar)

- **Primary Chapters**: Greenpill Cape Town, Greenpill Ivory Coast, Greenpill Koh Phangan, and Greenpill Rio Brasil.

- **Key Outcome**: Circular economy systems reducing environmental waste.

Waste management is being tackled across multiple chapters with varying approaches. Cape Town focuses on community beach cleanups for coastal ecosystems. Ivory Coast addresses urban waste collection in informal settlements. Koh Phangan optimizes island waste for resort areas and marine debris. Rio Brasil builds systematic waste management for urban and suburban circular economy. Green Goods standardizes capture across these diverse approaches while allowing local customization of waste categories and processing methods. 

**Action Lifecycle for Waste Management**

1. Area Assessment surveys location to understand waste problem through GPS, photos of waste accumulation, and area size estimate.

2. Cleanup Event collects and removes waste through before/after photos, waste weight, and participant count.

3. Waste Sorting categorizes collected waste by type through photos of sorted piles and weight by category.

4. Recycling Delivered transports recyclables to processing facility through delivery receipt and materials list.

5. Composting processes organic waste into compost through compost pile photos and input/output weights.

6. Upcycling Project transforms waste into useful products through input materials and output products documentation.

**Impact Metrics for Waste Domain**: Total Waste Removed in kg collected. Diversion Rate as percentage recycled versus landfilled. Area Cleaned in total square meters restored. Participants Engaged as unique individuals. Material Recovery Value as economic value of recyclables.

### Domain 3: Agroforestry and Planting (DeSci plus Environment Pillars)

- **Primary Chapters**: Greenpill Brasil through AgroforestryDAO led by Diogo, and Greenpill Uganda led by Jonathan.

- **Key Outcome**: Biodiversity increase, carbon sequestration, and intergenerational knowledge transfer.

Two distinct approaches define this domain. The AgroforestryDAO approach in Brasil builds not just a system to capture work but one that spreads knowledge to future generations through documentation of sustainable farming practices and biodiversity corridors. The Educational Planting approach in Uganda combines planting with education where Jonathan visits schools and churches to plant native, fruit-bearing trees. Each student becomes a caretaker for a specific tree, creating personal relationships with the ecosystem and enshrining the importance of trees from environmental, nutritional, and spiritual perspectives.

**Action Lifecycle for Agroforestry**

1. Site Assessment evaluates land for planting suitability through GPS, soil photos, and existing vegetation survey.

2. Species Selection chooses appropriate native species through species list, rationale, and seed source.

3. Site Preparation clears and amends soil through before photos and soil test results if available.

4. Planting completes tree and seedling installation through species, count, GPS of each tree if feasible, and photos.

5. Student Assignment assigns tree to student caretaker for Uganda model through student name, tree ID, and assignment photo.

6. Monitoring and Observation checks health, growth, and identifies issues through photos, measurements, and health status.

7. Harvesting collects fruits, seeds, or other products through yield weight, quality, and distribution plan.

8. Knowledge Documentation records farming techniques for future generations through written guide, video, and languages used.

**Impact Metrics for Agroforestry Domain**

- Trees Planted as total count by species

- Native Species Ratio as percentage of native versus non-native

- Survival Rate as trees alive at 6-month and 1-year checkpoints

- Caretakers Engaged as students and community members assigned

- Knowledge Records as documentation pieces created

- Carbon Sequestration Estimate in tCO2e using standard factors

- Fruit and Harvest Yield in kg of produce.

### Domain 4: Education and Web3 Workshops (Education Pillar)

- **Primary Chapters**: All Greenpill chapters plus Artizen Fund student cohort.

- **Key Outcome**: Skill building in coordination mechanisms and intergenerational knowledge transfer.

Green Goods serves as the verification layer for educational initiatives across three program types. General Web3 Workshops teach coordination and governance mechanisms across all chapters. Artizen Fund Cohort consists of students funded to host events using regenerative tools, with Green Goods verifying attendance and learning outcomes. Tech and Sun Educational Programs deliver blockchain and ReFi training at solar hubs in Nigeria.

**Action Lifecycle for Education**:

1. Event Planning schedules and prepares workshop through event details, curriculum, and venue confirmation.

2. Workshop Hosted conducts educational session through attendance list, photos, and materials used.

3. Participant Attendance records individual attendance through sign-in, photo proof, and engagement evidence.

4. Learning Assessment evaluates through quiz, project, or demonstration with results and submissions.

5. Certificate Issued provides completion credential through NFT badge or attestation. Follow-up

6. Action documents participant applying learning through evidence of real-world application.

**Impact Metrics for Education Domain**

- Workshops Hosted as total count by type

- Participants Trained as unique individuals across all sessions

- New Web3 Users Onboarded as first-time wallet creators

- Completion Rate as percentage completing full curriculum

- Follow-up Actions as documented applications of learning

- Geographic Reach as countries and regions served

- Artizen Fund Compliance Rate as verified versus funded events

### Domain 5: Mutual Credit and Farmer Verification (DePIN plus DeSci Pillars)

- **Primary Chapter**: Greenpill Brasil through commitment pooling pilot.

- **Key Outcome**: Credit access for rural farmers through verified productive capacity.

Rural farmers often lack access to credit due to inability to verify their productive capacity. Green Goods serves as the verification tool for commitment pooling pilots in Brasil, where farmers demonstrate consistent agricultural output to unlock mutual credit lines. This creates a pathway from verified work to financial inclusion.

**Action Lifecycle for Farmer Verification**

1. Farm Registration documents farm location, size, and crops through GPS boundaries, land ownership proof, and crop inventory.

2. Planting Season records what was planted, when, and where through planting photos, seed receipts, and area planted.

3. Growth Monitoring provides regular updates on crop progress through photos over time and growth measurements.

4. Harvest Documentation records harvest quantity and quality through harvest photos, weight, count, and quality grade.

5. Sale and Distribution documents where produce went through buyer receipt, market photos, and price achieved.

6. Commitment Fulfilled demonstrates completion of stated commitment through summary of promised versus delivered output.

**Impact Metrics for Mutual Credit Domain**

- Farms Registered as total verified farms

- Harvest Volume as total kg documented

- Commitment Fulfillment Rate as percentage meeting stated targets

- Credit Unlocked as value of credit lines enabled

- Yield per Hectare as productivity metrics by crop

## 3.5 Action Schema Registry

Green Goods maintains a registry of standardized action schemas that Gardens can activate based on their focus area. Actions are tagged with the Eight Forms of Capital they create or enhance.

**Core Actions Available in All Gardens**

- Planting creates Living, Material, and Experiential capital.

- Identify Plant creates Living, Intellectual, and Experiential capital.

- Watering creates Living, Material, and Experiential capital.

- Harvesting creates Living, Material, and Experiential capital.

- Waste Cleanup creates Material, Social, and Experiential capital.

- Web3 Workshop creates Intellectual, Social, and Experiential capital.

- Event Attendance creates Intellectual and Social capital and is available to All Gardens. 

**Domain-Specific Actions**

- Solar Hub Session creates Material, Intellectual, and Social capital and is available to TAS Gardens only.

- Node Deployment creates Material and Financial capital and is available to TAS Gardens only. Waste Sorting creates Material and Intellectual capital and is available to Waste-focused Gardens.

- Tree Assignment creates Living, Social, and Cultural capital and is available to Educational Gardens.

- Knowledge Documentation creates Intellectual and Cultural capital and is available to AgroforestryDAO Gardens.

- Farm Registration creates Living and Material capital and is available to Credit Pool Gardens.

- Commitment Fulfilled creates Financial and Material capital and is available to Credit Pool Gardens.

**Eight Forms of Capital Reference**

- **Living** capital includes biodiversity, ecosystems, soil, and water.

- **Material** capital includes physical infrastructure, equipment, and land.

- **Financial** capital includes money, credit, and investment.

- **Social** capital includes relationships, trust, and networks.

- **Intellectual** capital includes knowledge, skills, and data.

- **Experiential** capital includes wisdom from practice and tacit knowledge.

- **Cultural** capital includes traditions, identity, and meaning.

- **Spiritual** capital includes purpose, connection, and meaning.

## 3.6 Schema Validation Plan

Before launch, all action schemas must be validated with actual users in each domain to confirm that fields capture necessary data without creating friction, identify missing fields that domain experts require, test AI Agent parsing accuracy, and measure completion rates.

- **Solar Domain Validation**: Participants are 3-5 Tech and Sun operators from Nigeria including Anthony Amio and Mmeri Anosike plus university coordinators. Duration is 90 minutes per session with 2 sessions planned. Validation criteria include completing submission in under 5 minutes via PWA, AI Agent correctly parsing session type and user count and energy reading, and Switch smart meter readings being easily captured. Fields to validate include sessionType options, energyGenerated capture method, and nodeUptime format.

- **Waste Domain Validation**: Participants are 2-3 members from each of Cape Town, Koh Phangan, and Rio Brasil chapters for 6-9 total. Duration is 60 minutes per session with 3 sessions. Validation criteria include logging while doing physical cleanup work with one-handed operation, waste type selection covering all local materials, and weight estimation feasibility without scales. Fields to validate include wasteSelection options for fishing nets and e-waste, estimatedWeight with potential bag count alternative, and disposalMethod for local options.

- **Agroforestry Domain Validation**: Participants are Diogo and 2-3 AgroforestryDAO members in Brasil plus Jonathan and 2-3 team members in Uganda. Duration is 90 minutes per session with 2 sessions. Brasil session focuses on Knowledge Documentation schema and Portuguese language support. Uganda session focuses on Planting schema with Student Assignment extension during actual school planting event. Fields to validate include plantSelection for species database needs, caretakerName for privacy concerns, and seedSource for local options.

- **Education Domain Validation**: Participants are 3-5 workshop facilitators plus 2 Artizen Fund cohort members. Duration is 45 minutes per session with 3 sessions conducted during actual workshop events. Validation criteria include logging attendance without disrupting workshop flow and capturing meaningful learning outcomes. Fields to validate include topics options and learningOutcome format.

- **Mutual Credit Domain Validation**: Participants are 3-5 farmers from Brasil commitment pooling pilot. Duration is 60 minutes per session with 2 sessions. Validation criteria include farmers with limited tech literacy completing harvest logging and quality grading being understandable. Fields to validate include qualityGrade definitions and commitmentPoolId linking and estimatedValue for local currency.

---

# 4) Problem Statement

**Guidance:** Describe the current state, what’s failing, and evidence.

## 4.1 What’s broken today

  - **Verification Gap:** Traditional MRV is too expensive for small projects at $5,000-15,000 per verification event, while simple photo uploads lack scientific rigor and trust for institutional capital.

  - **Capital Volatility:** Crypto-philanthropy often relies on volatile tokens or one-off grants. When the market crashes or donors churn, projects die.

  - **Accessibility Wall:** Most web3 impact tools require a smartphone, a wallet, and ETH for gas. This excludes the poorest and most vital ecological laborers.

  - **Missing Feedback Loops:** Beneficiaries (local communities) and Experts (Evaluators) are often excluded from the verification loop, leading to "paper parks" or greenwashing.

## 4.2 Why it matters now

  - **Global South Adoption:** The environment for crypto and blockchain technology is becoming increasingly friendly and vital in the **Global South** (e.g., Nigeria, Brazil). High mobile penetration combined with a need for stable financial rails makes these regions ideal adopters for a "Local-First" regenerative economy.

  - **The Yield Economy:** The maturity of **Octant** and **DeFi** allows for "endowment models" where principal is preserved and only yield is spent.

  - **AI at the Edge:** LLMs have become efficient enough to run "Agri-Advisor" agents that can democratize access to complex protocols via simple text.

### 4.3 Insights from research/pilots:

  - ...

  - ...

---

# 5) Scope

## 5.1 In Scope (This Release)

### Interfaces

- **PWA**: Offline-first web app with Localization support (Spanish/Portuguese).

- **Admin Dashboard**: UI for managing Gardens and creating impact reports

- **AI Agent (Beta)**: WhatsApp/SMS bot for Gardener submissions.

### Protocol Layer

- **Karma GAP**: Automated reporting pipelines.

- **Octant Vaults**: Deployment of yield-bearing vaults for capital formation.

- **Revnets**: Configuration of Juicebox Revnets for Garden Treasury management.

- **Hypercerts**: Minting logic for verified impact claims.

- **Conviction Voting**: Module for yield allocation and action prioritization.

### Identity & Reputation

- **Unlock Protocol**: Minting of GreenWill reputation badges (NFTs) based on user activity.

- **Hats Protocol**: Management of on-chain roles (e.g., Operator, Evaluator) and permissions.

### **Verification**

- **Operators**: Tools for initial data aggregation and verification.

- **Evaluators**: Admin Dashboard view for certifying Impact Reports.

- **Community Signaling**: Mechanism for beneficiaries to flag issues or upvote priorities.

## 5.2 Revnet Configuration (The Fractal Gardens Model)

Green Goods adopts a two-tiered Fractal Gardens architecture using Juicebox V4 Revnets.

[](https://cdn.charmverse.io/user-content/5e36d65b-e9d7-4667-b1c7-f551832414e3/a3838757-0d58-416a-8a40-65c1e3deada3/Gemini_Generated_Image_atbpr9atbpr9atbp.png)
 

### Level 1: Protocol Revnet ($GG Token)

Issues the core Green Goods governance token. Funds shared infrastructure including servers, indexers, legal, and development. Receives tribute from Level 2 Gardens at 2.5-5% of incoming funds and tokens.

### Level 2: Garden Revnets (Local Tokens)

Each community operates its own Revnet such as $LAGOS, $BRAZIL, or $NIGERIA. Issues local tokens representing governance rights and treasury claims. Routes tribute percentage to Level 1 Protocol.

## 5.3 The Octant-Backstopped Impact Floor

This mechanism creates sustainable funding independent of speculation.

[](https://cdn.charmverse.io/user-content/5e36d65b-e9d7-4667-b1c7-f551832414e3/e782665b-ba95-4699-8234-b0adb6441804/Gemini_Generated_Image_5fsdg35fsdg35fsd.png)

- **Step 1 Deposit**: Funders stake assets in Octant Vault.

- **Step 2 Yield Generation**: Low-risk DeFi strategies generate returns.

- **Step 3 Programmatic Buyback**: Yield automatically purchases Hypercerts from Gardens. **Step 4 Floor Rising**: Each purchase increases backing per token, creating a minimum wage for ecological labor backed by Ethereum staking rewards.

## 5.2 Out of Scope

- **Robust Identity System (DID):** A fully decentralized identity system backed by W3C DIDs is deferred to a future release; v1 relies on WebAuthn and standard maturation.

- **Global IoT Network:** Full integration with hardware sensors.

- **Scope 3 Data Marketplace:** Insurance/Finance data sales are Phase 3.

## 5.3 Assumptions

- **A1: Onchain impact reporting is more valuable than traditional reporting.**

  - **Validation**: Track funder preference in post-pilot surveys. Compare funding secured by onchain-reporting Gardens versus traditional reporting projects.

  - **Red Flag**: If traditional tooling improves via AI and the onchain value-add is not perceived as differentiated by Q2 2026.

- **A2: Projects can long-term earn enough yield to be sustainable.**

  - **Validation**: Calculate yield-to-impact ratio across pilot Vaults. Model time-to-sustainability for different capital levels.

  - **Red Flag**: If funders perceive yield as too passive and prefer direct donation models.

- **A3: Impact certificate marketplaces will develop around Hypercerts.**

  - **Validation**: Monitor Hypercerts ecosystem liquidity. Track secondary sales volume.

  - **Red Flag**: By Q3 2026, no impact marketplaces building liquidity around Hypercerts.

- **A4: AI Agents can accurately parse natural language impact submissions.**

  - **Validation**: Measure Agri-Advisor accuracy rate on image identification and metadata extraction.

  - **Red Flag**: If error rate exceeds 15%, requiring Operator intervention on majority of submissions.

- **A5: Community members will participate in Conviction Voting without direct financial incentives.**

  - **Validation**: Track participation rates across Gardens. Correlate with GreenWill badge levels.

  - **Red Flag**: If voting participation drops below 30% after initial novelty period.

- **A6: Gasless transactions via Pimlico remain economically viable at scale.**

  - **Validation**: Monitor sponsorship costs per transaction. Model break-even point.

  - Red Flag: If gas costs exceed 5% of yield generated per action.

- **A7: Evaluators will maintain integrity under reputation staking model.**

  - **Validation**: Track dispute rates and community flagging of Evaluator decisions.

  - **Red Flag**: If collusion patterns emerge in Gardens with concentrated Evaluator power.

---

# 6) Solution Overview

## 6.1 Experience Summary

Green Goods v1 acts as a bridge. For the **Gardener**, it is a helpful WhatsApp contact that pays them for work. For the **Funder**, it is a high-yield savings account that heals the planet. For the **Evaluator**, it is a data-rich platform for certifying truth.

## 6.2 Core Workflow Pattern

- **Capture/Input:** Photos, metadata, GPS, and voice notes via PWA or AI Agent.

- **Details/Structure:** CIDS-compliant action schema, attestation construction, and Hypercert metadata.

- **Review/Confirm: **Operator approval queue, Evaluator certification, and Hypercert minting.

## 6.3 Key User Flows (high level)

### 

### Flow 1: AI Agent Impact Reporting (High Accessibility)

[](https://cdn.charmverse.io/user-content/5e36d65b-e9d7-4667-b1c7-f551832414e3/e6edc3da-d3a0-4398-806f-e84d1654ffdd/Gemini_Generated_Image_yeoaihyeoaihyeoa.png)

- **Capture:** Gardener sends photo to WhatsApp Bot.

- **Process:** AI Agent identifies object, cross-references with "Action Schema."

- **Sign:** Agent uses server-side Smart Account (signer controlled) to sign payload.

- **Store:** Data anchored on IPFS (Storracha) and stored onchain with EAS.

### Flow 2: Impact Report Minting & Evaluation (High Trust)

[](https://cdn.charmverse.io/user-content/5e36d65b-e9d7-4667-b1c7-f551832414e3/69764cb4-8825-4ff0-887b-a2ddde181ea4/Gemini_Generated_Image_z4g9b8z4g9b8z4g9.png)

- **Aggregate:** Operator selects 20 verified "Tree Planting" actions in the PWA and clicks "Create Report."

- **Certify:** The **Evaluator** receives the report. They review the aggregated evidence (data + Photos). They attest to the validity of the report using their **Hats Protocol** authority.

- **Mint:** The system now allows the Operator to mint the **Hypercert**, which references the Evaluator's certification attestation.

### Flow 3: Capital Formation & Allocation (Sustainability)

[](https://cdn.charmverse.io/user-content/5e36d65b-e9d7-4667-b1c7-f551832414e3/60307bb9-a708-42de-acb3-09356343fed9/Gemini_Generated_Image_784vai784vai784v.png)

- **Deposit:** Funder stakes assets in a Garden's Octant Vault.

- **Yield:** Yield accrues in the Vault.

- **Buyback:** Protocol programmatically uses the allocated yield to buy verified Garden Hypercerts shares, raising the "Impact Floor" price.

### Flow 4: Governance & Signaling (High Coordination)

[](https://cdn.charmverse.io/user-content/5e36d65b-e9d7-4667-b1c7-f551832414e3/142b96f7-5fc2-4bea-b849-1090ab97f1a8/Gemini_Generated_Image_j5dwmoj5dwmoj5dw.png)

- **Yield Allocation:** Garden members (operator, gardener, community member) vote via Conviction Voting to determine the split of yield to send to hypercerts.

- **Action Prioritization:** Garden operators and gardeners signal which specific _actions_ (e.g., "Waste Cleanup") the Garden should prioritize. This signal directs the Operator's focus for the next cycle.

---

# 7) Requirements

### 7.1 Functional Requirements (PRD-level)

- **FR-P-001 (AI Agent Interface): **Integration of LLM wrapper (e.g., Twilio/OpenAI) to parse natural language submissions via WhatsApp/SMS.

- **FR-P-002 (Admin Dashboard): **A comprehensive dashboard for Operators to manage submissions and for Evaluators to review and certify Impact Reports.

- **FR-P-003 (Octant Vaults): **ERC-4626 Vault contracts configured to route yield to specific Garden Revnets.

- **FR-P-004 (Hypercerts Minting):**

- **FR-P-005 (Revnet Configuration): **Deployment of Juicebox V4 Revnets with configurable redemption rates (80-90%) and reserved rates.

- **FR-P-006 (Conviction Voting): **Implementation of the Gardens Conviction Voting module for yield allocation and signaling action priorities.

- **FR-P-007 (GreenWill Badging): **Integration with Unlock Protocol to mint NFT badges based on user activity thresholds.

- **FR-P-008 (Role Management): **Integration with Hats Protocol to assign and manage on-chain permissions for Operators and Evaluators.

- **FR-P-009 (Smart Account Automation): **Backend infrastructure to manage Safe accounts for users interacting solely via AI Agents.

- **FR-P-010 Karma GAP Sync**: Bi-directional sync between Green Goods actions and Karma GAP milestone updates.

- **FR-P-011 Passkey Authentication**: WebAuthn-based biometric login with Safe Smart Account deployment via Pimlico.

### 7.2 Non-Functional Requirements

- **NFR-001 (Localization):** The PWA must support dynamic localization, launching with full support for **English, Spanish, and Portuguese**. All user-facing strings must be externalized with no hardcoded text. Date, time, and number formatting must respect locale settings.

- **NFR-002 (Latency):** AI Agent must respond to user texts within **5 seconds** to maintain conversational flow. PWA page load must complete within 3 seconds on 3G connection. Admin Dashboard queries must return within 2 seconds for datasets under 1000 records.

- **NFR-003 (Trust): **All Evaluator actions must be on-chain and auditable. Evaluator reputation via GreenWill must be slashable if they verify fraudulent data. Complete action provenance trail from submission to approval to Hypercert must be queryable.

- **NFR-004 (Cost):** Gardeners must pay $0 gas via Pimlico sponsorship. Protocol sponsorship budget must be monitored with alerts at 80% consumption. Fallback mechanism required if Pimlico is unavailable.

- **NFR-005 Performance**: PWA must function with full capability offline and sync on reconnection. Service Worker cache must support 500+ pending actions before sync. IndexedDB storage must not exceed 50MB per user session. Image compression must reduce uploads to under 500KB before IPFS pinning.

- **NFR-006 Reliability**: System must maintain 99.5% uptime for core flows including submission, approval, and minting. Graceful degradation required where if IPFS fails queue locally and if Arbitrum is congested batch transactions. Auto-retry with exponential backoff for all external service calls. Circuit breaker pattern for Twilio and OpenAI dependencies.

- **NFR-007 Security and Permissions**: All Smart Account deployments must use deterministic CREATE2 addresses. Passkey credentials must never leave user device. API endpoints must enforce rate limiting at 100 requests per minute per wallet. Role-based access via Hats Protocol must be enforced at contract level. No admin keys for contract upgrades in production using Diamond pattern with governance only.

- **NFR-008 Privacy and Data Handling**: GPS coordinates must be obfuscated to 3 decimal places providing 111m precision for public display. User PII such as name and bio stored on IPFS with encryption with only wallet address on-chain. GDPR-compliant data deletion must be supported for EU users. Analytics must use anonymized wallet hashes not raw addresses.

- **NFR-009 Accessibility**: PWA must meet WCAG 2.1 AA standards. Touch targets must be minimum 44x44px for mobile use. High contrast mode must be available for outdoor and bright light conditions. Screen reader compatibility required for all core flows.

- **NFR-010 Compatibility**: PWA must function on Chrome 90+, Safari 15+, Firefox 90+, and Samsung Internet 15+. Mobile support for iOS 14+ and Android 10+. Minimum device is 2GB RAM and 16GB storage. Offline mode must work on devices with no active data plan.


---

# 8) Feature Breakdown

- **Feature GG-FEAT-001 PWA Offline-First Architecture**

  - Priority is Critical

  - Status is In Progress

  - Estimated Effort is 3 weeks

  - Dependencies are IndexedDB and Service Workers

  - Notes: Core to Last Mile access

- **Feature GG-FEAT-002 Passkey Authentication**

  - Priority is Critical

  - Status is In Progress

  - Estimated Effort is 2 weeks

  - Dependencies are WebAuthn, Safe, and Pimlico

  - Notes: Removes Privy dependency

- **Feature GG-FEAT-003 AI Agent via WhatsApp and SMS**

  - Priority is High

  - Status is Planned

  - Estimated Effort is 4 weeks

  - Dependencies are Twilio and OpenAI/Llama

  - Notes: Billions interface

- **Feature GG-FEAT-004 Admin Dashboard v2**

  - Priority is High

  - Status is Planned

  - Estimated Effort is 3 weeks

  - Dependencies are React and Envio

  - Notes: Operator verification queue

- **Feature GG-FEAT-005 Hypercerts Minting**

  - Priority is High

  - Status is Planned

  - Estimated Effort is 4 weeks

  - Dependencies are ERC-1155 and IPFS

  - Notes: Aggregation plus atomic mint

- **Feature GG-FEAT-006 Octant Vault Integration**

  - Priority is High

  - Status is Planned

  - Estimated Effort is 4 weeks

  - Dependencies are ERC-4626 and DeFi strategies

  - Notes: Yield-bearing deposits

- **Feature GG-FEAT-007 Revnet Configuration**

  - Priority is Medium

  - Status is Planned

  - Estimated Effort is 3 weeks

  - Dependencies are Juicebox V4

  - Notes: Garden treasury management

- **Feature GG-FEAT-008 Conviction Voting Module**:

  - Priority is Medium

  - Status is Planned

  - Estimated Effort is 3 weeks

  - Dependencies are Gardens Protocol

  - Notes: Yield allocation governance

- **Feature GG-FEAT-009 GreenWill Badging**

  - Priority is Medium

  - Status is Planned

  - Estimated Effort is 2 weeks

  - Dependencies are Unlock Protocol

  - Notes: Reputation NFTs

- **Feature GG-FEAT-010 Hats Protocol Roles**

  - Priority is Medium

  - Status is Planned

  - Estimated Effort is 2 weeks

  - Dependencies are Hats Protocol

  - Notes: Operator and Evaluator permissions

- **Feature GG-FEAT-011 Karma GAP Sync**

  - Priority is High

  - Status is In Progress

  - Estimated Effort is 2 weeks

  - Dependencies are EAS and Karma API

  - Notes: CIDS-compliant reporting

- **Feature GG-FEAT-012 Localization for Spanish and Portuguese**

  - Priority is Medium

  - Status is In Progress

  - Estimated Effort is 2 weeks

  - Dependencies are i18n framework

  - Notes: Brazilian and LatAm access

- **Feature GG-FEAT-013 Report Generator**

  - Priority is Medium

  - Status is Planned

  - Estimated Effort is 2 weeks

  - Dependencies are PDF and JSON export

  - Notes: Grant compliance automation.

---

# 9) Economic Model and Sustainability

This section provides financial modeling for Green Goods sustainability including vault economics, gas costs, and break-even analysis.

### 9.1 Model Assumptions

- **Token and Network Assumptions**: ETH price at $3,000 USD as conservative baseline. Arbitrum gas price at 0.1 gwei average. Pimlico bundler fee at $0.02 per transaction.

- **Yield Assumptions**: Octant Vault base yield at 4% APY from ETH staking via Lido. Enhanced yield with DeFi strategies at 6-8% APY. Yield distribution at 80% to Hypercert purchases and 20% to protocol operations.

- **Activity Assumptions per Arbitrum grant targets**: Active Gardeners at 150 by end of Q1 2026. Actions per Gardener per month at 10 average. Total actions per month at 1,500. Actions per Hypercert bundle at 50 average. Hypercerts minted per month at 30.

### 9.2 Vault TVL Sustainability Analysis

- **Monthly Operating Costs**: Pimlico gas sponsorship at 1,500 actions times $0.02 equals $30. IPFS pinning via Storracha at 1,500 images times $0.001 equals $1.50. AI Agent API costs at 1,500 interactions times $0.01 equals $15. Indexer and infrastructure at $100 per month. Total monthly infrastructure is approximately $150.

- **Monthly Yield Required to Cover Infrastructure**: At 4% APY need $45,000 TVL. At 6% APY need $30,000 TVL. At 8% APY need $22,500 TVL

- **Monthly Yield Required to Cover Infrastructure Plus Hypercert Purchases**: Target is to purchase $500 per month in Hypercerts to build market. Total monthly need is $650. At 4% APY need $195,000 TVL. At 6% APY need $130,000 TVL. At 8% APY need $97,500 TVL.

**Conclusion**: The Arbitrum grant target of $20,000 TVL is a starting point but not sustainable long-term. The protocol needs to grow to approximately $100,000-$200,000 TVL for self-sustaining operations with meaningful Hypercert purchasing power.

### 9.3 Gas Sponsorship Budget Analysis

- **Pimlico Sponsorship Budget with $2,000 allocated from Arbitrum grant**: Actions sponsored equals $2,000 divided by $0.02 equals 100,000 actions. At 1,500 actions per month provides 66 months of runway. At 5,000 actions per month provides 20 months of runway. At 10,000 actions per month provides 10 months of runway.

- **Yield-Funded Sponsorship**: Monthly gas need at 1,500 actions is $30. Required TVL at 6% APY is $6,000. This is achievable with minimal vault deposits.

- **High Growth Scenario at 10x activity**: Monthly gas need at 15,000 actions is $300. Required TVL at 6% APY is $60,000.

**Recommendation**: Implement gas budget monitoring with alerts at 50%, 75%, and 90% consumption. Plan transition from grant-funded to yield-funded sponsorship by Month 6.

### 9.4 Revnet Token Economics Simulation

**Simulation Parameters**: Initial treasury at 10 ETH or $30,000. Monthly inflows at 2 ETH from new contributions plus 0.5 ETH from yield. Monthly redemptions at 10% of circulating tokens.

- **Configuration A with 80% redemption and 10% reserved**: Month 12 treasury at 18.5 ETH. Token backing ratio at 1.15x initial. Tokens in circulation at 85% of peak. Assessment is healthy growth with moderate holder returns.

- **Configuration B with 85% redemption and 15% reserved**: Month 12 treasury at 22.3 ETH. Token backing ratio at 1.28x initial. Tokens in circulation at 78% of peak. Assessment is stronger treasury with balanced holder returns.

- **Configuration C with 90% redemption and 20% reserved**: Month 12 treasury at 26.1 ETH. Token backing ratio at 1.42x initial. Tokens in circulation at 71% of peak. Assessment is maximum treasury growth with lower short-term holder returns.

**Recommendation**: Start with Configuration B at 85% redemption and 15% reserved as the default. This balances treasury health with reasonable returns for Gardeners who need to cash out for real-world expenses.

### 9.5 Hypercert Pricing Model

- **Approach A Cost-Plus Pricing**: Calculate cost to produce verified actions including labor, tools, and materials. Add margin for Garden sustainability at 20-30%. Example is 50 tree plantings at $2 cost each equals $100 base plus 25% equals $125 Hypercert price.

- **Approach B Impact-Based Pricing**: Calculate estimated impact value for carbon, biodiversity, and social factors. Use standard impact factors from Gold Standard or Verra. Example is 50 trees times 0.5 tCO2e per tree times $15 per tCO2e equals $375 Hypercert price.

- **Approach C Market-Driven Pricing**: Let Gardens list Hypercerts at their desired price. Octant Vault purchases at market clearing price. Price discovery through supply and demand. Recommendation: Use Approach A Cost-Plus for initial pricing to establish floor with Approach C Market-Driven as the long-term model once liquidity develops.

### 9.6 Break-Even Analysis Summary

- **Protocol Break-Even for infrastructure costs covered by yield**: Target is $30,000 TVL at 6% APY. Timeline is Month 6 of beta program.

- **Gardener Break-Even for redemption value exceeding effort**: Token value must exceed local minimum wage equivalent. If Gardener submits 20 actions per month and can redeem for $50, this beats minimum wage in Nigeria at $70 per month but not Brasil at $260 per month at early scale. Implication is early Gardeners are motivated by GreenWill reputation and future upside rather than immediate income.

- **Garden Break-Even for treasury growth exceeding outflows**: Monthly inflows from contributions plus yield must exceed monthly redemptions. With 85% redemption rate and 10% monthly redemption, need 15% monthly treasury growth. Implication is Gardens must actively attract new funders or reduce redemption frequency.

### 9.7 Financial Dashboard Metrics

- **Vault Metrics**: Total TVL across all vaults in USD and ETH. Monthly yield generated. Yield allocation breakdown for Hypercert purchases versus operations.

- **Treasury Metrics**: Protocol Revnet treasury balance. Garden Revnet treasury balances aggregate and per-garden. Token backing ratio as treasury divided by circulating supply. Monthly redemption volume.

- **Cost Metrics**: Gas sponsorship burn rate. Monthly infrastructure costs. Cost per verified action.

- **Revenue Metrics**: Hypercerts sold as count and value. Tribute received from Gardens. Protocol fee revenue if applicable.

---

# 10) Localization Strategy

This section details the approach to supporting multiple languages and regional variations.

### 10.1 Language Support Tiers

- **Tier 1 Languages with Full Support at Launch**: English US as default language. Portuguese Brazilian for Greenpill Brasil and AgroforestryDAO. Spanish Latin American for broader LatAm expansion.

- **Tier 2 Languages Planned for v1**: French West African for Ivory Coast chapter. Swahili for East African expansion including Uganda. Pidgin English for Nigeria which is critical for TAS adoption.

- **Tier 3 Languages on Roadmap for v2**: Thai for Koh Phangan chapter. Arabic for future MENA expansion.

### 10.Localization Components

- **PWA Localization**: All user-facing text stored in JSON locale files with no hardcoded strings. Locale files structured as locales/en-US/common.json for shared strings, locales/en-US/actions.json for action schema labels, locales/pt-BR/common.json for Brazilian Portuguese, and locales/es-419/common.json for Latin American Spanish. Date and time formatting uses Intl.DateTimeFormat with user locale. Number formatting uses Intl.NumberFormat respecting locale decimal separator.

- **AI Agent Localization**: Language detection from first message with option to ask user preference if ambiguous. Separate prompt templates per language to handle greeting patterns, date formats, local plant and crop names, and regional slang.

- **Pidgin English Handling for Nigeria**: Many Nigerians code-switch between English and Pidgin so AI Agent must handle mixed messages. Examples include "I don plant tree" parsing as "I planted a tree" and "Wetin you wan do?" parsing as "What do you want to do?" Build Pidgin-specific prompt layer tested with Nigerian users. UI defaults to English with option for Pidgin since some users prefer English UI but Pidgin conversation.

- **Portuguese Handling for Brasil**: Brazilian Portuguese has significant vocabulary differences from European Portuguese. Use "voce" form for Brazilian locale. Recognize both Brazilian and European forms in AI parsing but default to Brazilian.

- **Action Schema Localization**: Every schema field has label translations. Example for plantSelection field is "Plant Species/Name" in English, "Especie/Nome da Planta" in Portuguese, and "Especie/Nombre de la Planta" in Spanish. All select options have translations. Placeholder text localized with culturally relevant examples such as "e.g., Mango, Avocado, Oak" in English becoming "ex., Manga, Abacate, Ipe" in Portuguese.

### 10.3 Regional Considerations

- **Nigeria**: Currency display in Naira NGN with symbol. Date format DD/MM/YYYY. Time in 12-hour with AM/PM. Default to English with Pidgin option.

- **Brasil**: Currency display in Real BRL with R$ symbol. Date format DD/MM/YYYY. Decimal separator is comma as in 1.000,50. Focus on Southeast dialect for Sao Paulo and Rio.

- **Latin America**: Multiple currencies requiring per-country handling. Date format varies by country. Use neutral Latin American Spanish es-419 over Spain Spanish es-ES.

### 10.4 Translation Workflow

- **Initial Translation**: English US is source language for all translations. Professional translation for Tier 1 languages with review by native-speaking community members. Translation partners include Diogo and AgroforestryDAO team for Portuguese and Greenpill LatAm network for Spanish.

- **Ongoing Translation**: Developer adds string to en-US locale file. String flagged as needs translation in other locales. Weekly translation batch sent to community translators. Translations reviewed by second native speaker. Merged and deployed.

- **Quality Assurance**: Native speaker review from target region such as Brazilian for pt-BR not Portuguese. Contextual testing with translators seeing strings in context. Back-translation check for critical strings.

### 10.5 Right-to-Left Roadmap

- **Current Status**: No RTL support in v1.

- **Technical Preparation**: CSS using logical properties such as margin-inline-start instead of margin-left. Bidirectional text handling in components. RTL-aware icon placement.

- **Timeline**: RTL support planned for v2 when Arabic expansion prioritized.

### 10.6 Localization Success Metrics

- **Adoption by Language**: Track active users by locale setting.

- **Completion Rates by Language**: Compare action submission completion rates across languages. If Portuguese completion is lower than English, investigate friction.

- **AI Agent Accuracy by Language**: Track parse success rate per language. Target is within 5% of English baseline.

- **Translation Coverage**: Percentage of strings translated per language. Target is 100% for Tier 1 at launch.

---

# 11) Privacy and Data Handling

This section assesses privacy risks and documents data handling practices.

### 11.1 Data Inventory

- **Data Collected from Gardeners**: Wallet Address collected upon passkey creation and stored onchain, cannot be deleted, used for identification. GPS Coordinates collected with each action and stored on IPFS with obfuscation to 3 decimal places, used for location verification. Photos and Media collected with submissions and stored on IPFS via Storracha, used for verification evidence. Timestamps collected automatically and stored onchain in attestations. Action Metadata collected per schema and stored on IPFS and onchain. Device Information collected for analytics in anonymized form. Optional Profile Data for name and bio stored on IPFS with encryption.

- **Data Collected from Operators and Evaluators**: Wallet Address same as Gardeners. Hats Protocol Role stored onchain for permissions. Verification Decisions stored onchain for audit trail.

- **Data Collected from Funders**: Wallet Address same as Gardeners. Deposit Amounts stored onchain for treasury management. Conviction Votes stored onchain for yield allocation.

### 11.2 Data Flow and Residency

- **Action Submission Flow**: Step 1 Gardener captures photo on device with low privacy risk. Step 2 Gardener adds metadata with medium risk from GPS. Step 3 User submits via PWA or AI Agent encrypted in transit with low risk. Step 4 Backend processes in server memory ephemeral with medium risk. Step 5 Image uploaded to IPFS distributed and immutable with high risk. Step 6 Attestation created on Arbitrum permanent and public with high risk. Step 7 Envio indexes attestation with medium risk from centralized copy.

- **Data Residency**: Onchain Data on Arbitrum includes attestations, wallet addresses, and transaction records and is immutable with global distribution. IPFS Data on Storracha includes images, metadata JSON, and profile data and is immutable once pinned with global distribution. Backend Data is ephemeral including processing logs and session data deleted after processing. Analytics Data is anonymized in analytics provider region.

### 11.3 Privacy Risks and Mitigations

- **Risk GPS Location Reveals Sensitive Information**: Precise coordinates could reveal home locations or sensitive sites. Likelihood is High. Impact is Medium. Risk Level is High. Mitigations include GPS obfuscated to 3 decimal places providing approximately 111 meter precision before IPFS storage, raw GPS never stored onchain, users informed during onboarding, and future option to disable GPS for privacy-sensitive users. Residual Risk is that 111m precision still identifies general area but is acceptable for environmental verification.

- **Risk Photos Contain Identifiable Information**: Photos may contain faces, license plates, or property features. Likelihood is Medium. Impact is High. Risk Level is High. Mitigations include future AI face detection prompting user to retake, Operator review flagging PII before Hypercert minting, user guidance to avoid including faces, and clear notice that IPFS photos are public. Residual Risk is that users have responsibility with guidance provided.

- **Risk Blockchain Data Is Immutable**: Once onchain, data cannot be deleted, conflicting with GDPR right to erasure. Likelihood is Certain. Impact is High. Risk Level is High. Mitigations include minimizing onchain PII with only wallet address stored, profile data on IPFS with encryption where key destruction renders data unreadable, attestations reference IPFS CIDs where unpinning empties the shell, privacy notice clearly explaining immutability during signup, and GDPR interpretation that wallet address may not be personal data if not linked to real identity. Residual Risk is wallet address is pseudonymous but potentially linkable in legal gray area.

- **Risk AI Agent Processes Sensitive Conversations**: WhatsApp/SMS messages may contain unintended personal information. Likelihood is Medium. Impact is Medium. Risk Level is Medium. Mitigations include AI prompts scoped to action reporting with personal queries redirected, message content not stored long-term, WhatsApp Business API compliance, and opt-out available to use PWA only. Residual Risk is conversational interfaces may elicit more disclosure than forms.

- **Risk Third-Party Service Data Exposure**: Data shared with Twilio, OpenAI, Pimlico, and Storracha creates exposure. Likelihood is Low. Impact is High. Risk Level is Medium. Mitigations include Data Processing Agreements with all processors, minimizing data shared, reviewing third-party policies, and noting that Twilio and OpenAI have SOC 2 compliance. Residual Risk is third-party policies may change requiring ongoing monitoring.

- **Risk Caretaker Data in Educational Planting**: Uganda model assigns trees to students and may collect student names. Likelihood is Medium. Impact is High for minors data. Risk Level is High. Mitigations include student names as optional field allowing pseudonyms, no photos of minors required, school administrator as adult Operator, parental consent process for any minor data, and using student ID codes instead of names. Residual Risk is children's privacy requires extra care with default to minimal collection.

### 11.4 Data Subject Rights Implementation

- **Right to Access**: Users can export all data via Profile settings including submitted actions, attestations, and profile data.

- **Right to Rectification**: Users can update profile data. Action data can be flagged for Operator correction via new attestation with correction reference where original is not deleted.

- **Right to Erasure**: Profile data addressed by destroying encryption key rendering IPFS data unreadable. Onchain attestations cannot delete but content references become empty if IPFS unpinned. Analytics data addressed via deletion request to provider. Limitation is full erasure not possible for blockchain data with users informed before signup.

- **Right to Portability**: Data export in machine-readable JSON format including action history, attestation references, and profile data.

### 11.5 Compliance Requirements

- **GDPR Compliance**: Lawful basis is consent explicit during signup. Privacy notice required and to be drafted. Data Processing Agreements required with all processors. Data Protection Officer not required under 250 employees threshold. Data breach notification process to be documented. Cross-border transfers addressed via Standard Contractual Clauses.

- **LGPD Compliance for Brasil**: Similar requirements to GDPR. Portuguese language privacy notice required.

- **POPIA Compliance for South Africa**: Similar requirements to GDPR. Local registration may be required.

### 11.6 Privacy Documentation Required

- **Privacy Notice**: User-facing document explaining data collection, use, and rights required before launch.

- **Cookie Policy**: Required if any cookies used and PWA may use local storage.

- **Data Processing Agreements**: Contracts with Twilio, OpenAI, Pimlico, Storracha, and Envio.

- **Data Retention Policy**: Internal document specifying retention periods.

- **Data Breach Response Plan**: Internal procedure for handling security incidents.

---

# 12) Dependencies and Partnerships

### 12.1 Technical Dependencies

- Arbitrum One for L2 Settlement

- Ethereum for L1 for Octant

- Twilio for SMS and WhatsApp

- OpenAI or Llama for LLM

- Pimlico for Gasless Transactions

- Envio for Blockchain Indexer.


### 12.2 Protocol Partners

- Octant for Yield Source.

- Hypercerts for Impact Certificate.

- Juicebox for Revnet Infrastructure.

- Karma GAP for Reporting.

- Unlock Protocol for Reputation.

- Hats Protocol for Permissions

- Gardens Protocol for Conviction Voting.

### 12.3 Funding and Compliance

- Arbitrum New Protocols and Ideas Grant totaling $25,000 USD.

  - Milestone 1 in Month 1: PRD v2 and Designs for $4,000

  - Milestone 2 in Months 1-2: Hypercerts Integration for $8,000

  - Milestone 3 in Months 2-3: DeFi Integration for $8,000

  - Milestone 4 in Months 1-2: Community Activations for $4,000

  - Milestone 5 in Month 3: Final Reporting for $1,000.

- Celo Builders Fund X Unlock Protocol (TBD)

---

# 13) QA, Rollout, and Ops

### 13.1 QA Strategy

**Test Approach**

- **Unit Tests**: Jest for frontend components and Foundry for Solidity contracts.

- **Integration Tests**: End-to-end flows using Playwright. UAT: Structured testing with 5 Gardeners and 3 Operators per pilot Garden.

- **Pilot Program**: Live testing with Greenpill Nigeria, Brasil, and Cape Town chapters.

**Device and Platform Coverage**

- **P0 Priority**

  - Android mid-range such as Samsung A-series on Android 11+ using Chrome and Samsung Internet

  - iPhone SE 2020+ on iOS 15+ using Safari

- **P1 Priority**

  - Low-end Android under 2GB RAM on Android 10+ using Chrome

  - Desktop on Windows 10+ and macOS 12+ using Chrome and Firefox

**Acceptance Gates**

All P0 devices must pass happy-path flows. Offline to sync flow must complete without data loss. Gas sponsorship must succeed for all test transactions. Hypercert minting must produce valid ERC-1155 tokens. Karma GAP sync must produce correctly-structured attestations.

**QA Environments**

Dev: Arbitrum Sepolia with continuous deployment. Staging: Arbitrum Sepolia with release candidates. Production: Arbitrum One with gated rollout.

### 13.2 Rollout Plan

- **Phase 1**: Internal Alpha in Weeks 1-2. Cohort: Greenpill Dev Guild core team with 8 users. Features: PWA core, Passkey auth, and basic submission flow. Monitoring: Error rates, completion funnels, and latency metrics. Gate: Under 5% error rate on submission flow.

- **Phase 2**: Pilot Beta in Weeks 3-6. Cohort: Greenpill Nigeria with 25 users and Greenpill Brasil with 25 users. Features: Full PWA, AI Agent via WhatsApp, and Admin Dashboard. Monitoring: NPS surveys, session recordings, and support tickets. Gate: NPS at least 50 and under 10% support ticket rate.

- **Phase 3**: Extended Beta in Weeks 7-10. Cohort: 8 Gardens total per Arbitrum milestone. Features: Hypercerts minting and Octant Vault integration. Monitoring: TVL growth, Hypercert creation rate, and yield routing. Gate: At least $12k TVL and at least 12 Hypercerts minted.

- **Phase 4**: General Availability in Weeks 11-12. Cohort: Open enrollment for Greenpill Network chapters. Features: Full protocol with Conviction Voting.

**Monitoring Signals for First 72 Hours**

Error rate by flow including submission, approval, and minting. Latency percentiles at p50, p95, and p99. Gas sponsorship consumption rate. User session length and completion funnels. Support channel volume on Discord and Telegram

**Rollback Plan**

Feature flags can disable any new feature within 5 minutes. Contract upgrades via Diamond pattern require 24-hour timelock. Database migrations must include rollback scripts. IPFS pins are immutable so metadata corrections require new CIDs.

### 13.3 Support Plan

- **Primary**: Telegram group per Garden for Gardener suppor

- **Secondary**: Discord #green-goods-support for technical issues

- **Escalation**: GitHub Issues for bugs with reproduction steps

**Severity Definitions**

- **P0 Critical**: Protocol down, funds at risk, or data loss. Response SLA is 4 hour. Resolution SLA is 4 hours.

- **P1 High**: Core flow blocked for over 10% of users. Response SLA is 12 hours. Resolution SLA is 24 hours.

- **P2 Medium**: Feature degraded but workaround exists. Response SLA is 72 hours. Resolution SLA is 1 week.

- **P3 Low**: Cosmetic or minor inconvenience. Response SLA is 2 week. Resolution SLA is next release.

### 13.4 Analytics Plan

- **session_start**: Fires on session start. Properties include device_type, os, browser, and locale. Purpose is usage patterns

- **passkey_created**: Fires on passkey creation. Properties include success and error_code. Purpose is auth funnel

- **action_submitted**: Fires on action submission. Properties include garden_id, action_type, and offline_queued. Purpose is submission funnel

- **action_approved**: Fires on action approval. Properties include garden_id, action_type, and evaluator_id. Purpose is verification flow

- **hypercert_minted**: Fires on hypercert minting. Properties include garden_id, actions_bundled, and value. Purpose is impact tokenization

- **vault_deposit**: Fires on vault deposit. Properties include amount, asset, and garden_allocation. Purpose is capital formation

- **conviction_vote**: Fires on conviction vote. Properties include garden_id, stake_amount, and direction. Purpose is governance participation

- **ai_agent_interaction**: Fires on AI agent interaction. Properties include channel, intent_parsed, and success. Purpose is agent effectiveness.

**Dashboards**

- **Executive Dashboard**: TVIV, TVL, Active Gardeners, and Hypercerts Minted

- **Garden Health**: Per-garden metrics, verification queue depth, and yield allocation

- **Funnel Analysis**: Onboarding completion and submission-to-approval conversion

- **Technical Health**: Error rates, latency, and gas consumption

**Review Cadence**

- **Daily**: Error rates and critical funnel metrics

- **Weekly**: Full dashboard review with team

- **Monthly**: Cohort analysis, NPS review, and milestone progress

---

# 14) Risks and Mitigations

### 14.1 Technical Risks

- **R-T1 AI Hallucination**: Likelihood is High. Impact is Medium. Mitigation is that Agent prompts include strict bounds and Agent stages data for Operator review, never finalizes directly.

- **R-T2 Passkey Adoption Friction**: Likelihood is Medium. Impact is High. Mitigation is fallback to email magic link for devices without biometric support with clear onboarding guidance.

- **R-T3 Pimlico Downtime**: Likelihood is Low. Impact is High. Mitigation is to queue transactions locally, implement secondary bundler fallback, and alert on sponsorship failures.

- **R-T4 IPFS Pinning Failures**: Likelihood is Medium. Impact is Medium. Mitigation is to use Storracha with Filecoin backup, retry logic with exponential backoff, and local queue preservation.

- **R-T5 Smart Contract Vulnerability**: Likelihood is Low. Impact is Critical. Mitigation is to apply for Arbitrum audit program, formal verification of core flows, and bug bounty program post-launch.

- **R-T6 Envio Indexer Lag**: Likelihood is Medium. Impact is Medium. Mitigation is to implement optimistic UI updates, background sync status indicators, and fallback to direct RPC for critical queries.

### 14.2 Economic Risks

- **R-E1 Insufficient Yield for Sustainability**: Likelihood is Medium. Impact is High. Mitigation is to model break-even scenarios pre-launch, diversify vault strategies, and set realistic expectations with Gardens.

- **R-E2 Revnet Token Price Collapse**: Likelihood is Medium. Impact is Medium. Mitigation is that cash-out tax at 80-90% preserves treasury floor and focus narrative on work value not speculation.

- **R-E3 Hypercert Illiquidity**: Likelihood is High. Impact is Medium. Mitigation is that protocol acts as buyer of first resort via Octant yield and build relationships with retro funding rounds such as Optimism and Gitcoin.

- **R-E4 Gas Cost Spike on Arbitrum**: Likelihood is Low. Impact is Medium. Mitigation is transaction batching and L3 migration path via Arbitrum Orbit and monitor gas consumption patterns.

### 14.3 Governance and Social Risks

- **R-G1 Evaluator Collusion**: Likelihood is Medium. Impact is High. Mitigation is that Evaluators must stake reputation and tokens, Community Members can flag decisions, and escalation to Protocol-level review.

- **R-G2 Low Conviction Voting Participation**: Likelihood is High. Impact is Medium. Mitigation is to implement low threshold for conviction to take effect, gamify with GreenWill badges, and direct notification on pending votes.

- **R-G3 Garden Operator Abandonment**: Likelihood is Medium. Impact is High. Mitigation is multi-sig requirement for Garden administration, succession planning in onboarding, and Protocol can appoint interim steward.

- **R-G4 Community Pay-to-Complain Dynamics**: Likelihood is Medium. Impact is Medium. Mitigation is that signal staking requires reputation via GreenWill not just tokens and anti-sybil checks on new accounts.

### 14.4 Regulatory and Legal Risks

- **R-L1 Evaluator Liability for False Verification**: Likelihood is Medium. Impact is High. Mitigation is to pursue legal opinion before beta launch and indemnification in Terms of Service.

- **R-L2 Token Classification as Security**: Likelihood is Low. Impact is Critical. Mitigation is to structure Revnet tokens as governance plus utility with no profit-sharing language and engage securities counsel.

- **R-L3 GDPR Compliance for EU Users**: Likelihood is Medium. Impact is Medium. Mitigation is to implement data deletion flows, minimize on-chain PII, and encryption for off-chain storage.

### 14.5 Operational Risks

- **R-O1 Team Burnout and Capacity Constraints**: Likelihood is High. Impact is High. Mitigation is scope management, clear No list in Section 5.3, async-first operations, and buffer in timeline.

- **R-O2 Dependency on Partner Protocols**: Likelihood is Medium. Impact is High. Mitigation is to document fallback strategies for each integration and maintain relationships with alternative providers.

- **R-O3 Dialect and Language Accuracy in AI Agent**: Likelihood is High. Impact is Medium. Mitigation is pre-launch testing with native speakers, iterative prompt refinement, and human-in-the-loop for edge cases.

---

# 15) Open Questions

- **Q1:** What is the legal framework for "Evaluator" liability if they verify false data?

  - **Owner**: Legal Lead

  - **By**: Q1 2026

- **Q2:** Can the WhatsApp Agent support dialects (e.g., Pidgin, Portuguese) effectively at launch?

  - **Owner**: Product Lead

  - **By**: February 2026

- **Q3:** How do we incentivize "Community Members" to signal without creating a "pay-to-complain" market?

  - **Owner**: Community Lead

  - **By**: Feb 2026

- **Q4**: What is the minimum viable vault TVL for sustainable yield generation?

  - Owner is Finance Lead.

  - Due date is January 2026.

- **Q5**: Should Gardens have the ability to customize their Revnet parameters such as redemption rate and reserved rate?

  - Owner is Product Lead.

  - Due date is February 2026.

- **Q6**: How do we handle disputes when Community Members flag Evaluator decisions?

  - Owner is Governance Lead.

  - Due date is March 2026.

---

# 16) Appendix

### 16.1 Glossary

- **Garden**: A hyper-local hub of community and environmental action, represented as a Juicebox Revnet with its own token, treasury, and governance.

- **Assessment**: A quarterly or seasonal goal set by Garden Operators that maps to Karma GAP Milestones.

- **Action**: A discrete unit of ecological work such as planting a tree or cleaning a beach that is captured, verified, and attested.

- **Work**: The aggregate of Actions submitted by a Gardener, awaiting approval.

- **Work Approval**: The Operator/Evaluator review process that converts submitted Work into verified Attestations.

- **Report**: An aggregated bundle of approved Actions formatted for grant compliance or Hypercert minting.

- **MDR**: Monitoring, Data, Reporting. The protocol's internal term for the action capture to attestation to reporting pipeline.

- **Hypercert**: An ERC-1155 impact certificate that bundles verified Actions into a tradable asset.

- **Revnet**: A Juicebox V4 project with programmatic issuance, redemption, and revenue routing.

- **GreenWill**: Reputation tokens as Unlock Protocol NFTs earned through verified regenerative actions.

- **Conviction Voting**: A continuous governance mechanism where voting power compounds over time based on stake duration.

- **CIDS**: Common Impact Data Standard. A structured format for describing impact work.

- **TVIV**: Total Verified Impact Value. The North Star metric for protocol health.

- **YTI**: Yield To Impact

- **YTIC**: Yield To Impact Curve

- **Fractal Gardens**: The two-tiered Revnet architecture connecting local Gardens to the Protocol treasury.

- **Cash-out Tax**: The percentage of redemption value that stays in the Revnet treasury when tokens are burned, permanently increasing backing per remaining token.

- **Impact Floor**: The minimum price per token guaranteed by treasury backing, which rises as the Octant Vault purchases Hypercerts.

### 16.2 References Glossary

- **Arbitrum Grant Application**: Internal document. Used for success metrics, milestones, and budget.

- **Revnet Whitepaper**: https://github.com/rev-net/whitepaper. Used for economic mechanics reference.

- **Hypercerts Documentation**: https://hypercerts.org/docs. Used for impact certificate standard.

- **Octant V2 Docs**: https://docs.v2.octant.build. Used for yield vault architecture.

- **Karma GAP Documentation**: https://www.karmahq.xyz. Used for grantee accountability protocol.

- **Juicebox V4 Docs**: https://docs.juicebox.money/dev. Used for Revnet implementation.

- **CIDS Specification**: https://commonapproach.org/cids. Used for impact data standard.

- **Safe plus Passkeys**: https://docs.safe.global/advanced/passkeys. Used for authentication architecture.

- **Pimlico Documentation**: https://docs.pimlico.io. Used for ERC-4337 bundler and paymaster.

### 16.3 Related Documents

- **Miro Board**: Contains diagrams, ideation, and visual documentation. Link: https://miro.com/app/board/uXjVLjVA-xQ=

- **Figma Designs**: Contains UI screens and user flows.

- **GitHub Repository**: https://github.com/greenpill-dev-guild/green-goods

- **Project Board**: Contains sprint tracking and user stories.

- **Greenpill Garden Strategy**: Contains Theory of Change and strategic context.

- **Revnet Model for Vrbs DAO**: Contains Fractal Gardens architecture detail.

- **Tech and Sun Round Documentation**: Contains solar hub deployment plans and budgets.
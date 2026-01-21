# Green Goods v1 PRD Addendum

This addendum covers six supplementary sections to strengthen the PRD: Visual Assets, Schema Validation, Economic Model, Competitive Analysis, Localization Strategy, and Privacy Impact Assessment.

---

## Addendum A: Visual Assets and Diagrams

This section provides specifications for visual assets that should accompany the PRD. Each diagram includes a text description that can be handed to a designer or used to create diagrams in tools like Figma, Miro, or Excalidraw.

### A.1 The Regenerative Stack Architecture Diagram

Purpose: Show how Green Goods fits within the broader protocol ecosystem and how value flows between layers.

Layout: Vertical stack with five horizontal layers. Each layer spans the full width. Arrows connect layers showing data and value flow.

Layer 1 (Bottom) - Settlement Layer
Label: Settlement
Components: Arbitrum One logo, Ethereum logo
Description text: Low-fee, high-throughput execution
Color: Dark blue or purple

Layer 2 - Capital Formation Layer
Label: Capital Formation
Components: Octant Vaults icon, Juicebox Revnets icon
Description text: Yield generation and treasury management
Color: Green
Arrows: Bidirectional arrow to Layer 3 labeled "Yield flows up, Hypercerts flow down"

Layer 3 - Data and Verification Layer
Label: Data and Verification
Components: EAS logo, Hypercerts logo, IPFS icon
Description text: Atomic proof of work and tradable impact certificates
Color: Teal
Arrows: Bidirectional arrow to Layer 4 labeled "Attestations anchored, Reports aggregated"

Layer 4 - Protocol Layer
Label: Protocol Orchestration
Components: Green Goods logo (central), Karma GAP logo, Gardens Protocol logo
Description text: Coordinates Gardens, validates actions, routes fees
Color: Light green
Arrows: Bidirectional arrow to Layer 5 labeled "Actions submitted, Rewards distributed"

Layer 5 (Top) - Application Layer
Label: User Interfaces
Components: PWA icon, WhatsApp icon, Admin Dashboard icon
Description text: Gardeners, Operators, and Funders interact here
Color: White or light gray

Additional elements: On the right side, show the five user personas (Gardener, Operator, Funder, Evaluator, Community Member) with dotted lines connecting them to their primary interaction layers.

### A.2 The Fractal Gardens Model Diagram

Purpose: Illustrate the two-tier Revnet architecture showing how local Gardens connect to the Protocol treasury.

Layout: Hub and spoke with the Protocol Revnet in the center and Garden Revnets around the perimeter.

Center element - Protocol Revnet
Shape: Large hexagon
Label: Green Goods Protocol Revnet
Token symbol: $GG
Contents: "Shared Infrastructure" with sub-items Servers, Indexers, Legal, Development
Color: Dark green

Surrounding elements - Garden Revnets (show 6 around the center)
Shape: Smaller hexagons
Labels: Nigeria Garden ($LAGOS), Brasil Garden ($BRAZIL), Cape Town Garden ($CPT), Uganda Garden ($UGA), Thailand Garden ($KPG), DevConnect Garden ($DEV)
Color: Light green with unique accent color per garden

Connecting arrows - Tribute flows
Direction: From each Garden hexagon toward center Protocol hexagon
Label on arrows: "2.5-5% Tribute via JBSplits"
Style: Dashed lines with arrow heads

Connecting arrows - Subsidy flows
Direction: From center Protocol hexagon toward Garden hexagons
Label on arrows: "Infrastructure subsidies and token purchases"
Style: Solid lines with arrow heads

Bottom section - Economic mechanics callout boxes
Box 1: "Issuance (Price Ceiling)" with text "New tokens minted when capital contributed"
Box 2: "Redemption (Price Floor)" with text "80-90% of backing returned on burn, 10-20% stays in treasury"
Box 3: "Impact Floor Rising" with text "Octant yield purchases Hypercerts, increasing token backing"

### A.3 User Flow Diagrams

#### A.3.1 Flow 1: AI-Driven Capture

Purpose: Show the journey of a Gardener submitting work via WhatsApp.

Layout: Horizontal swimlane diagram with four lanes (Gardener, AI Agent, Backend, Blockchain).

Swimlane 1 - Gardener
Step 1: Gardener takes photo of planted tree
Step 2: Gardener sends photo to WhatsApp with message "Planted mango tree today"
Step 8: Gardener receives confirmation "Your planting has been recorded! You earned 10 GreenWill points."

Swimlane 2 - AI Agent
Step 3: AI Agent receives message and image
Step 4: AI Agent identifies object (tree species: Mangifera indica), extracts metadata (GPS from EXIF, timestamp)
Step 5: AI Agent constructs action payload matching Planting schema
Step 7: AI Agent formats confirmation message

Swimlane 3 - Backend
Step 6a: Backend validates payload against schema
Step 6b: Backend compresses image and uploads to IPFS via Storracha
Step 6c: Backend constructs EAS attestation

Swimlane 4 - Blockchain
Step 6d: Smart Account signs attestation via Pimlico (gasless)
Step 6e: Attestation anchored on Arbitrum
Step 6f: Envio indexer picks up event

Visual style: Use icons for each actor. Show clock icon between steps to indicate timing (target: under 5 seconds for AI response).

#### A.3.2 Flow 2: Impact Report Minting and Evaluation

Purpose: Show how an Operator aggregates actions into a Hypercert with Evaluator certification.

Layout: Horizontal swimlane diagram with four lanes (Operator, Evaluator, System, Blockchain).

Swimlane 1 - Operator
Step 1: Operator opens Admin Dashboard
Step 2: Operator filters to "Approved" actions for Q1 2026
Step 3: Operator selects 150 planting actions
Step 4: Operator clicks "Create Impact Report"
Step 7: Operator receives notification "Report certified by Evaluator"
Step 8: Operator clicks "Mint Hypercert"
Step 11: Operator sees Hypercert in Garden treasury

Swimlane 2 - Evaluator
Step 5: Evaluator receives report in queue
Step 6a: Evaluator reviews aggregated evidence (photos, GPS clusters, timestamps)
Step 6b: Evaluator checks CIDS compliance
Step 6c: Evaluator signs certification attestation using Hats Protocol authority

Swimlane 3 - System
Step 4a: System aggregates action metadata into CIDS-compliant format
Step 4b: System calculates impact metrics (trees planted, estimated carbon, area covered)
Step 4c: System generates report preview
Step 9: System constructs Hypercert metadata (ERC-1155)
Step 10a: System uploads metadata to IPFS

Swimlane 4 - Blockchain
Step 6d: Certification attestation anchored on Arbitrum
Step 10b: Hypercert minted on Arbitrum
Step 10c: Hypercert registered with Garden Revnet

#### A.3.3 Flow 3: Capital Formation and Allocation

Purpose: Show how Funder deposits create yield that purchases Hypercerts.

Layout: Circular flow diagram showing the closed loop.

Node 1 - Funder
Action: Deposits ETH into Octant Vault
Output arrow: "ETH principal" flowing to Node 2

Node 2 - Octant Vault
Action: Deploys to low-risk DeFi strategies (staking, lending)
Output arrow: "Yield accrues" flowing to Node 3
Note: "Principal preserved, only yield spent"

Node 3 - Yield Pool
Action: Accumulates yield for distribution
Output arrow: "Yield allocated per Conviction Vote" flowing to Node 4

Node 4 - Hypercert Marketplace
Action: Protocol purchases verified Hypercerts from Gardens
Output arrow: "ETH payment" flowing to Node 5
Output arrow: "Hypercert ownership" flowing back to Node 2 (Vault now owns impact claims)

Node 5 - Garden Treasury (Revnet)
Action: Receives ETH, backing increases
Output arrow: "Token value increases" flowing to Node 6

Node 6 - Gardeners
Action: Gardeners can redeem tokens at higher floor price
Output arrow: "Verified work" flowing back to Node 4 (completing the loop)

Center callout: "The Octant-Backstopped Impact Floor: Each yield cycle raises the minimum price for ecological labor"

#### A.3.4 Flow 4: Governance and Signaling

Purpose: Show how Conviction Voting allocates yield to priorities.

Layout: Funnel diagram with voting inputs narrowing to allocation outputs.

Top section - Inputs
Show multiple Community Members with GreenWill badges
Each member has a "stake" amount they are committing
Arrows flow into voting pool

Middle section - Conviction Accumulation
Show time axis (days/weeks)
Conviction formula displayed: "Conviction = Stake x Time"
Visual showing conviction growing over time for different proposals
Note: "Longer commitment = stronger signal"

Bottom section - Allocation Outputs
Show three proposal options:
Proposal A: "Allocate 60% yield to Agroforestry Hypercerts" with conviction bar at 45%
Proposal B: "Allocate 30% yield to Waste Management Hypercerts" with conviction bar at 35%
Proposal C: "Allocate 10% yield to Education Hypercerts" with conviction bar at 20%

Output arrows showing yield flowing to each category proportionally

### A.4 Action Domain Lifecycle Diagrams

Create one lifecycle diagram per domain showing the journey from first action to Hypercert.

Template for each domain:

Phase 1 - Setup (left side)
Icon: Clipboard or map pin
Actions: Site registration, baseline assessment
Output: Garden configured with domain-specific schemas

Phase 2 - Capture (center-left)
Icon: Camera or phone
Actions: Gardeners submit work via PWA or AI Agent
Output: Raw submissions in queue

Phase 3 - Verification (center)
Icon: Checkmark or magnifying glass
Actions: Operator reviews, approves/rejects
Output: Verified attestations

Phase 4 - Aggregation (center-right)
Icon: Stack or bundle
Actions: Operator bundles into Impact Report
Output: CIDS-compliant report

Phase 5 - Certification (right)
Icon: Certificate or stamp
Actions: Evaluator reviews and certifies
Output: Certified report

Phase 6 - Tokenization (far right)
Icon: Token or NFT
Actions: Hypercert minted
Output: Tradable impact certificate

Show domain-specific examples along the bottom:
Solar Domain: Site secured, Hub session logged, Energy report, Evaluator certifies kWh, Hypercert minted
Waste Domain: Area assessed, Cleanup completed, Waste report with kg by type, Evaluator certifies diversion, Hypercert minted
Agroforestry Domain: Site prepared, Trees planted, Growth report, Evaluator certifies survival rate, Hypercert minted

### A.5 Five-Sided Marketplace Diagram

Purpose: Show the relationships and value flows between all five personas.

Layout: Pentagon with each persona at a vertex. Lines connect all vertices showing relationships.

Vertex positions (clockwise from top):
Top: Funder
Top-right: Evaluator
Bottom-right: Community Member
Bottom-left: Gardener
Top-left: Operator

Edge relationships:

Funder to Operator: "Deposits capital into Garden Vault"
Operator to Gardener: "Approves work, triggers payments"
Gardener to Community Member: "Performs work that benefits community"
Community Member to Evaluator: "Flags issues, provides ground truth"
Evaluator to Funder: "Certifies impact claims, builds trust"

Diagonal relationships:
Funder to Gardener: "Yield purchases Gardener's Hypercerts"
Operator to Community Member: "Receives priority signals via Conviction Voting"
Evaluator to Operator: "Certifies Impact Reports"
Community Member to Funder: "Signals which Gardens deserve allocation"
Gardener to Evaluator: "Submits evidence for review"

Center element: Green Goods Protocol logo with text "Orchestrates trust and value flow"

---

## Addendum B: Action Schema Validation Plan

This section outlines the process for validating action schemas with actual users before launch.

### B.1 Validation Objectives

Confirm that schema fields capture all data needed for verification without creating friction.
Identify missing fields that domain experts require.
Test AI Agent's ability to extract schema fields from natural language and images.
Measure completion rates and time-to-submit for each schema.
Gather feedback on field labels, descriptions, and options in local languages.

### B.2 Validation Sessions by Domain

#### B.2.1 Solar Domain Validation

Participants: 3-5 Tech and Sun operators from Nigeria (Anthony Amio, Mmeri Anosike, plus university coordinators)
Location: Remote via video call with screen sharing, or in-person at Owerri pilot hub
Duration: 90 minutes per session, 2 sessions planned

Session 1 Agenda:
Minutes 0-15: Introduction and context setting
Minutes 15-45: Walk through Solar Hub Session schema field by field
Minutes 45-60: Participants attempt to log a real hub session using PWA
Minutes 60-75: Participants attempt to log same session via WhatsApp AI Agent
Minutes 75-90: Debrief and feedback collection

Validation Criteria:
Can participants complete submission in under 5 minutes via PWA?
Can AI Agent correctly parse session type, user count, and energy reading from natural language?
Are Switch smart meter readings easily captured (photo of meter vs. manual entry)?
Do participants understand all field labels without explanation?

Schema Fields to Validate:
sessionType options: Are these exhaustive? Add "Node maintenance"?
energyGenerated: Can users easily read kWh from Switch meter? Need photo upload option?
nodeUptime: Is percentage the right format? How do users check this?

#### B.2.2 Waste Domain Validation

Participants: 2-3 members from each of Cape Town, Koh Phangan, and Rio Brasil chapters (6-9 total)
Location: Remote via video call, with participants in field during cleanup event
Duration: 60 minutes per session, 3 sessions (one per chapter)

Session Agenda:
Minutes 0-10: Brief participants on schema and testing objectives
Minutes 10-40: Participants conduct actual cleanup and attempt real-time logging
Minutes 40-60: Debrief comparing PWA vs. AI Agent experience

Validation Criteria:
Can participants log while doing physical cleanup work (one-handed operation)?
Does waste type selection cover all materials encountered locally?
Is weight estimation feasible without scales? Need "bag count" alternative?
Do before/after photo requirements slow down the process?

Schema Fields to Validate:
wasteSelection options: Add fishing nets for Koh Phangan? E-waste subcategories?
estimatedWeight: Add "bag count" with standard bag size assumption?
disposalMethod: Are local options represented (informal recyclers, burn pits)?

#### B.2.3 Agroforestry Domain Validation

Participants: Diogo and 2-3 AgroforestryDAO members in Brasil, Jonathan and 2-3 team members in Uganda
Location: Remote for Brasil, in-person school visit for Uganda if possible
Duration: 90 minutes per session, 2 sessions (one per approach)

Session 1 Agenda (AgroforestryDAO - Brasil):
Focus on Knowledge Documentation schema
Have participants document an actual farming technique
Test Portuguese language support
Validate that intellectual property concerns are addressed

Session 2 Agenda (Educational Planting - Uganda):
Focus on Planting schema with Student Assignment extension
Conduct during actual school planting event
Test caretaker assignment flow
Validate that student privacy is protected (no photos of minors without consent)

Validation Criteria:
Does caretakerAssigned field work smoothly in school context?
Can Knowledge Documentation capture video effectively?
Are native species options accurate for each bioregion?
Does AI Agent handle Portuguese and local Ugandan language patterns?

Schema Fields to Validate:
plantSelection: Need species database or free text? Silvi integration preview?
caretakerName: Privacy concerns with storing student names? Use pseudonyms?
seedSource: Add "School nursery" and "Church garden" options?

#### B.2.4 Education Domain Validation

Participants: 3-5 workshop facilitators from various chapters, plus 2 Artizen Fund cohort members
Location: Remote, conducted during actual workshop events
Duration: 45 minutes per session, 3 sessions

Session Agenda:
Minutes 0-5: Pre-workshop briefing on logging requirements
Minutes 5-35: Facilitator conducts workshop while logging attendance
Minutes 35-45: Post-workshop debrief on schema usability

Validation Criteria:
Can attendance be logged without disrupting workshop flow?
Does Event Attendance schema capture meaningful learning outcomes?
Is Artizen Fund compliance trackable through standard fields?

Schema Fields to Validate:
topics options: Are ReFi/Web3 topics comprehensive?
learningOutcome: Is free text too burdensome? Need structured options?
artizenFunded: Integration with Artizen reporting requirements?

#### B.2.5 Mutual Credit Domain Validation

Participants: 3-5 farmers from Brasil commitment pooling pilot
Location: Remote with on-farm video calls
Duration: 60 minutes per session, 2 sessions

Session Agenda:
Minutes 0-20: Understand current manual verification process
Minutes 20-40: Farmer attempts to log harvest using schema
Minutes 40-60: Discuss how this data would unlock credit

Validation Criteria:
Can farmers with limited tech literacy complete harvest logging?
Is quality grading understandable and consistent?
Does schema capture what credit providers need to see?

Schema Fields to Validate:
qualityGrade: Are grade definitions clear? Need photos of each grade?
commitmentPoolId: How does this link to external credit system?
estimatedValue: Local currency handling for Brazilian Real?

### B.3 Validation Metrics and Success Criteria

Quantitative Metrics:
Completion Rate: At least 80% of participants complete submission on first attempt
Time to Submit (PWA): Under 5 minutes for all schemas except Knowledge Documentation
Time to Submit (AI Agent): Under 3 minutes for standard actions
AI Parse Accuracy: At least 85% of fields correctly extracted from natural language
Error Rate: Under 10% of submissions require Operator correction

Qualitative Metrics:
Field Comprehension: All participants understand field labels without explanation
Option Completeness: No more than 2 missing options identified per schema
Language Accuracy: Translated labels match local terminology
Friction Points: No more than 1 "blocking" friction point per schema

### B.4 Validation Timeline

Week 1: Solar Domain validation with TAS team
Week 2: Waste Domain validation across three chapters
Week 3: Agroforestry Domain validation in Brasil and Uganda
Week 4: Education Domain validation during scheduled workshops
Week 5: Mutual Credit Domain validation with Brasil farmers
Week 6: Synthesis and schema revisions based on findings

### B.5 Post-Validation Schema Updates

After each validation session, document:
Fields to add with rationale and proposed specification
Fields to modify with before/after comparison
Fields to remove or make optional with rationale
New options to add to select fields
Translation corrections for Spanish and Portuguese
AI Agent prompt adjustments for better parsing

All schema changes require sign-off from Product Lead before implementation.

---

## Addendum C: Economic Model and Financial Projections

This section provides financial modeling for Green Goods sustainability, including vault economics, gas costs, and break-even analysis.

### C.1 Model Assumptions

Base assumptions for all projections:

Token and Network Assumptions:
ETH price: $3,000 USD (conservative baseline)
Arbitrum gas price: 0.1 gwei average (current baseline)
Pimlico bundler fee: $0.02 per transaction

Yield Assumptions:
Octant Vault base yield: 4% APY (ETH staking via Lido)
Enhanced yield with DeFi strategies: 6-8% APY
Yield distribution: 80% to Hypercert purchases, 20% to protocol operations

Activity Assumptions (per Arbitrum grant targets):
Active Gardeners: 150 by end of Q1 2026
Actions per Gardener per month: 10 average
Total actions per month: 1,500
Actions per Hypercert bundle: 50 average
Hypercerts minted per month: 30

### C.2 Vault TVL Sustainability Analysis

Question: What minimum vault TVL is needed for sustainable operations?

Monthly Operating Costs:
Pimlico gas sponsorship: 1,500 actions x $0.02 = $30
IPFS pinning (Storracha): 1,500 images x $0.001 = $1.50
AI Agent API costs: 1,500 interactions x $0.01 = $15
Indexer and infrastructure: $100/month
Total monthly infrastructure: $146.50 (round to $150)

Monthly Yield Required (to cover infrastructure):
At 4% APY: $150 / (0.04 / 12) = $45,000 TVL needed
At 6% APY: $150 / (0.06 / 12) = $30,000 TVL needed
At 8% APY: $150 / (0.08 / 12) = $22,500 TVL needed

Monthly Yield Required (to cover infrastructure plus Hypercert purchases):
Target: Purchase $500/month in Hypercerts (building market)
Total monthly need: $150 + $500 = $650

At 4% APY: $650 / (0.04 / 12) = $195,000 TVL needed
At 6% APY: $650 / (0.06 / 12) = $130,000 TVL needed
At 8% APY: $650 / (0.08 / 12) = $97,500 TVL needed

Conclusion: The Arbitrum grant target of $12,000 TVL is a starting point but not sustainable. The protocol needs to grow to approximately $100,000-$200,000 TVL for self-sustaining operations with meaningful Hypercert purchasing power.

### C.3 Gas Sponsorship Budget Analysis

Question: How long can the protocol sponsor gas at different activity levels?

Pimlico Sponsorship Budget Scenarios:

Scenario A - Arbitrum Grant Funded ($2,000 allocated to gas):
Actions sponsored: $2,000 / $0.02 = 100,000 actions
At 1,500 actions/month: 66 months of runway
At 5,000 actions/month: 20 months of runway
At 10,000 actions/month: 10 months of runway

Scenario B - Yield-Funded Sponsorship:
Monthly gas need at 1,500 actions: $30
Required TVL at 6% APY: $30 / (0.06 / 12) = $6,000
This is achievable with minimal vault deposits.

Scenario C - High Growth (10x activity):
Monthly gas need at 15,000 actions: $300
Required TVL at 6% APY: $300 / (0.06 / 12) = $60,000

Recommendation: Implement gas budget monitoring with alerts at 50%, 75%, and 90% consumption. Plan transition from grant-funded to yield-funded sponsorship by Month 6.

### C.4 Revnet Token Economics Simulation

Question: How do different redemption and reserved rate configurations affect treasury health?

Simulation Parameters:
Initial treasury: 10 ETH ($30,000)
Monthly inflows: 2 ETH from new contributions, 0.5 ETH from yield
Redemption rate: Testing 80%, 85%, 90%
Reserved rate: Testing 10%, 15%, 20%
Monthly redemptions: 10% of circulating tokens

Simulation Results (12-month projection):

Configuration A (80% redemption, 10% reserved):
Month 12 treasury: 18.5 ETH
Token backing ratio: 1.15x initial
Tokens in circulation: 85% of peak
Assessment: Healthy growth, moderate holder returns

Configuration B (85% redemption, 15% reserved):
Month 12 treasury: 22.3 ETH
Token backing ratio: 1.28x initial
Tokens in circulation: 78% of peak
Assessment: Stronger treasury, balanced holder returns

Configuration C (90% redemption, 20% reserved):
Month 12 treasury: 26.1 ETH
Token backing ratio: 1.42x initial
Tokens in circulation: 71% of peak
Assessment: Maximum treasury growth, lower short-term holder returns

Recommendation: Start with Configuration B (85% redemption, 15% reserved) as the default. This balances treasury health with reasonable returns for Gardeners who need to cash out for real-world expenses.

### C.5 Hypercert Pricing Model

Question: How should Hypercerts be priced to create meaningful value for Gardens?

Pricing Approaches:

Approach A - Cost-Plus Pricing:
Calculate cost to produce verified actions (labor, tools, materials)
Add margin for Garden sustainability (20-30%)
Example: 50 tree plantings at $2 cost each = $100 base, plus 25% = $125 Hypercert price

Approach B - Impact-Based Pricing:
Calculate estimated impact value (carbon, biodiversity, social)
Use standard impact factors from Gold Standard or Verra
Example: 50 trees x 0.5 tCO2e/tree x $15/tCO2e = $375 Hypercert price

Approach C - Market-Driven Pricing:
Let Gardens list Hypercerts at their desired price
Octant Vault purchases at market clearing price
Price discovery through supply/demand

Recommendation: Use Approach A (Cost-Plus) for initial pricing to establish floor, with Approach C (Market-Driven) as the long-term model once liquidity develops. Avoid Approach B initially as impact factor verification requires Evaluator infrastructure not yet mature.

### C.6 Break-Even Analysis Summary

Metric: Protocol Break-Even (infrastructure costs covered by yield)
Target: $30,000 TVL at 6% APY
Timeline: Month 6 of beta program

Metric: Gardener Break-Even (redemption value exceeds effort)
Target: Token value must exceed local minimum wage equivalent
Calculation: If Gardener submits 20 actions/month and can redeem for $50, this beats minimum wage in Nigeria ($70/month) and Brasil ($260/month) only at scale
Implication: Early Gardeners motivated by GreenWill reputation and future upside, not immediate income

Metric: Garden Break-Even (treasury growth exceeds outflows)
Target: Monthly inflows (contributions + yield) exceed monthly redemptions
Calculation: With 85% redemption rate and 10% monthly redemption, need 15% monthly treasury growth
Implication: Gardens must actively attract new funders or reduce redemption frequency

### C.7 Financial Dashboard Metrics

Track these metrics on Executive Dashboard:

Vault Metrics:
Total TVL across all vaults (USD and ETH)
Monthly yield generated
Yield allocation breakdown (Hypercert purchases vs. operations)

Treasury Metrics:
Protocol Revnet treasury balance
Garden Revnet treasury balances (aggregate and per-garden)
Token backing ratio (treasury / circulating supply)
Monthly redemption volume

Cost Metrics:
Gas sponsorship burn rate
Monthly infrastructure costs
Cost per verified action

Revenue Metrics:
Hypercerts sold (count and value)
Tribute received from Gardens
Protocol fee revenue (if applicable)

---

## Addendum D: Competitive Analysis

This section positions Green Goods against adjacent solutions in the impact verification and regenerative finance space.

### D.1 Competitive Landscape Overview

Green Goods operates at the intersection of four market categories:
Impact MRV (Monitoring, Reporting, Verification) platforms
Regenerative Finance (ReFi) protocols
Community coordination tools
AI-powered environmental monitoring

### D.2 Direct Competitors

#### D.2.1 Silvi (Tree Verification)

What they do: AI-powered tree verification platform using satellite imagery and ground-truth photos. Focused specifically on reforestation and agroforestry projects.

Strengths:
Deep expertise in tree species identification via AI
Partnerships with carbon credit certifiers
Mobile app with offline capability
Integration with carbon registries (Verra, Gold Standard)

Weaknesses:
Narrow focus on trees only (no waste, solar, education)
Centralized platform (not onchain-native)
Enterprise pricing model excludes grassroots projects
No capital formation layer (verification only)

Green Goods Differentiation:
Multi-domain coverage (trees are one of five action types)
Onchain-native with Hypercerts as output (not just database records)
Integrated capital formation via Octant Vaults and Revnets
Community-owned infrastructure (Fractal Gardens model)

Potential Partnership:
Silvi as an Evaluator oracle for tree-specific verification. Green Goods captures submissions, Silvi provides AI verification, Hypercert minted with Silvi certification.

#### D.2.2 GainForest (AI Environmental Monitoring)

What they do: Uses satellite imagery and AI to monitor forest health, detect deforestation, and verify conservation commitments. Recently launched carbon credit tokenization.

Strengths:
Advanced remote sensing capabilities
Academic partnerships for scientific rigor
Token-based incentives for forest guardians
Strong presence in Amazon region

Weaknesses:
Requires satellite imagery (not available for small plots)
High technical barrier for local communities
Focus on conservation (protecting existing forests) not restoration
Limited community governance mechanisms

Green Goods Differentiation:
Ground-level verification (photos and GPS) works at any scale
Accessible to non-technical users via WhatsApp
Covers restoration and active land use, not just conservation
Conviction Voting gives communities governance power

Potential Partnership:
GainForest provides satellite verification layer for large-scale projects while Green Goods handles ground-truth from local Gardeners.

#### D.2.3 Regen Network (Ecological Credits)

What they do: Blockchain-based platform for creating and trading ecological credits. Cosmos-based with focus on soil carbon and biodiversity credits.

Strengths:
Deep ecological science foundation
Proprietary methodology for soil carbon measurement
Active credit marketplace
Strong institutional relationships

Weaknesses:
Cosmos ecosystem (not Ethereum-native, limited DeFi integration)
Methodology-heavy (requires scientific expertise to participate)
Focus on credit creation, less on community coordination
High barrier to entry for smallholder farmers

Green Goods Differentiation:
Ethereum and Arbitrum native (deep DeFi integration via Octant)
Accessible methodology (MDR workflow, not scientific sampling)
Focus on capturing all regenerative work, not just credit-eligible activities
Community coordination as core feature (Gardens, Conviction Voting)

Competitive Note:
Regen Network targets carbon credit buyers and large landholders. Green Goods targets community chapters and grassroots projects. Minimal direct competition but potential for Green Goods-verified data to feed into Regen credit creation.

#### D.2.4 Toucan and KlimaDAO (Carbon Market Infrastructure)

What they do: Toucan bridges legacy carbon credits onchain. KlimaDAO creates demand through a reserve currency backed by carbon credits.

Strengths:
Significant liquidity in tokenized carbon
Strong brand recognition in ReFi
Integration with major carbon registries
Active trading and price discovery

Weaknesses:
Focused on existing legacy credits (not new impact creation)
Quality concerns with bridged credits (Verra controversy)
Speculative token dynamics overshadow impact
No community coordination or governance tools

Green Goods Differentiation:
Creates new verified impact (not bridges existing credits)
Quality control through multi-layer verification (Operator, Evaluator, Community)
Sustainable capital formation (yield, not speculation)
Focus on the work, not the financial instrument

Potential Partnership:
Future integration where Green Goods Hypercerts could be deposited into Toucan or KlimaDAO pools, creating liquidity for impact certificates.

### D.3 Adjacent Solutions

#### D.3.1 Gitcoin (Grants and Public Goods Funding)

Relevance: Gitcoin provides funding mechanisms. Green Goods provides impact verification for funded projects.

Relationship: Complementary. Gardens can receive Gitcoin grants, then use Green Goods for milestone verification and Karma GAP reporting.

#### D.3.2 Karma GAP (Grantee Accountability)

Relevance: Karma GAP tracks grant milestones. Green Goods provides the underlying verified data.

Relationship: Integration partner. Green Goods actions map to Karma GAP updates. This is a core protocol integration, not competition.

#### D.3.3 Hypercerts Foundation (Impact Certificates)

Relevance: Hypercerts is the standard for impact certificates. Green Goods is an implementation using Hypercerts.

Relationship: Infrastructure dependency. Green Goods mints Hypercerts using the Hypercerts protocol. Success of Green Goods validates the Hypercerts thesis.

### D.4 Competitive Positioning Matrix

Category: Accessibility (Can grassroots projects use it?)
Green Goods: High (WhatsApp, offline PWA, no gas costs)
Silvi: Medium (mobile app, but enterprise pricing)
GainForest: Low (requires satellite data)
Regen Network: Low (requires scientific methodology)

Category: Onchain Integration (DeFi, governance, composability)
Green Goods: High (Ethereum native, Octant, Revnets)
Silvi: Low (centralized database)
GainForest: Medium (tokens but limited DeFi)
Regen Network: Medium (Cosmos, limited Ethereum bridge)

Category: Capital Formation (Sustainable funding mechanisms)
Green Goods: High (Octant Vaults, Revnets, Conviction Voting)
Silvi: Low (verification service only)
GainForest: Medium (token incentives)
Regen Network: Medium (credit sales)

Category: Multi-Domain Coverage (Beyond trees/carbon)
Green Goods: High (solar, waste, education, mutual credit)
Silvi: Low (trees only)
GainForest: Low (forests only)
Regen Network: Medium (soil, biodiversity, but methodology-heavy)

Category: Community Governance (Local decision-making)
Green Goods: High (Fractal Gardens, Conviction Voting)
Silvi: None
GainForest: Low (token voting only)
Regen Network: Low (validator governance)

### D.5 Defensibility and Moats

Network Effects: Each new Garden increases protocol value through tribute and liquidity. Greenpill Network chapters provide built-in distribution.

Switching Costs: Once Gardens have verified actions and minted Hypercerts, migrating to another platform means abandoning attestation history.

Data Moat: Accumulated action data across domains creates training data for AI Agents and verification models. This improves over time.

Community Ownership: Fractal Gardens model means communities have ownership stake. They are incentivized to stay and grow, not extract and leave.

Integration Lock-in: Deep integration with Karma GAP, Octant, and Hypercerts creates ecosystem stickiness.

### D.6 Competitive Risks

Risk: Silvi expands beyond trees to cover all Green Goods domains
Mitigation: Move fast on multi-domain coverage, emphasize community governance as differentiator

Risk: Major carbon player (Verra, Gold Standard) launches onchain verification
Mitigation: Focus on grassroots accessibility where enterprise players will not compete

Risk: Ethereum L2 fragmentation reduces Octant and Arbitrum liquidity
Mitigation: Architecture supports multi-chain via Juicebox suckers, not locked to single L2

Risk: AI verification becomes commoditized (GPT-5 makes everyone an MRV platform)
Mitigation: Value is in community coordination and capital formation, not just AI verification

---

## Addendum E: Localization Strategy

This section details the approach to supporting multiple languages and regional variations.

### E.1 Language Support Tiers

Tier 1 Languages (Full Support at Launch):
English (US) - Default language
Portuguese (Brazilian) - Greenpill Brasil, AgroforestryDAO
Spanish (Latin American) - Broader LatAm expansion

Tier 2 Languages (Planned for v1.5):
French (West African) - Ivory Coast chapter
Swahili - East African expansion including Uganda
Pidgin English - Nigeria (critical for TAS adoption)

Tier 3 Languages (Roadmap for v2):
Thai - Koh Phangan chapter
Arabic - Future MENA expansion
Mandarin - Potential Asian expansion

### E.2 Localization Components

#### E.2.1 PWA Localization

String Externalization: All user-facing text stored in JSON locale files. No hardcoded strings in components.

Locale Files Structure:
/locales/en-US/common.json (shared strings)
/locales/en-US/actions.json (action schema labels)
/locales/en-US/admin.json (admin dashboard)
/locales/pt-BR/common.json
/locales/pt-BR/actions.json
/locales/es-419/common.json (Latin American Spanish)

Date and Time Formatting:
Use Intl.DateTimeFormat with user locale
Display relative times in local language ("2 hours ago" becomes "hace 2 horas")
Calendar starts on Monday for most locales, Sunday for US

Number Formatting:
Use Intl.NumberFormat for currency and decimals
Respect locale decimal separator (. vs ,)
Currency display uses local symbol when available

#### E.2.2 AI Agent Localization

Language Detection: Agent detects language from first message. If ambiguous, asks user preference.

Prompt Templates: Separate prompt templates per language to handle:
Greeting patterns ("Ola" vs "Hello" vs "Hola")
Date formats in user messages
Local plant and crop names
Regional slang and abbreviations

Dialect Handling for Pidgin English:
"I don plant tree" should parse as "I planted a tree"
"Wetin you wan do?" should parse as "What do you want to do?"
Build Pidgin-specific prompt layer tested with Nigerian users

Dialect Handling for Portuguese:
Brazilian Portuguese ("voce") vs European Portuguese ("tu")
Default to Brazilian for pt-BR locale
Recognize both forms in AI parsing

Fallback Behavior: If AI cannot parse message, respond in user's language asking for clarification. Never default to English without user consent.

#### E.2.3 Action Schema Localization

Field Labels: Every schema field has label translations.

Example for plantSelection field:
English: "Plant Species/Name"
Portuguese: "Especie/Nome da Planta"
Spanish: "Especie/Nombre de la Planta"

Select Options: All select options have translations.

Example for plantType options:
English: ["Tree", "Seedling", "Shrub", "Flower", "Vegetable"]
Portuguese: ["Arvore", "Muda", "Arbusto", "Flor", "Vegetal"]
Spanish: ["Arbol", "Plantula", "Arbusto", "Flor", "Vegetal"]

Help Text and Descriptions: All descriptive text localized.

Placeholder Text: Form placeholders localized with culturally relevant examples.

English placeholder: "e.g., Mango, Avocado, Oak"
Portuguese placeholder: "ex., Manga, Abacate, Ipe"
Spanish placeholder: "ej., Mango, Aguacate, Roble"

#### E.2.4 Admin Dashboard Localization

Operator Interface: Full localization of admin dashboard including navigation, action labels, reports, and notifications.

Evaluator Interface: Certification language matches Evaluator locale, but underlying data remains in original submission language.

Multi-language Reports: Impact Reports can be generated in funder's preferred language, with action data translated.

### E.3 Translation Workflow

#### E.3.1 Initial Translation

Source: English (US) is the source language for all translations.

Translation Method: Professional translation for Tier 1 languages. Use native-speaking community members for review.

Translation Partners:
Portuguese: Diogo and AgroforestryDAO team
Spanish: Greenpill LatAm network
Future languages: Local chapter stewards

#### E.3.2 Ongoing Translation

New String Process:
Developer adds string to en-US locale file
String flagged as "needs translation" in other locales
Weekly translation batch sent to community translators
Translations reviewed by second native speaker
Merged and deployed

Translation Management: Use translation management platform (Crowdin, Lokalise, or similar) to track translation status and enable community contributions.

#### E.3.3 Quality Assurance

Native Speaker Review: All translations reviewed by native speaker from target region (Brazilian for pt-BR, not Portuguese).

Contextual Testing: Translators see strings in context (screenshots or staging environment) to ensure appropriate translation.

Back-Translation Check: Critical strings back-translated to English to verify meaning preserved.

### E.4 Regional Considerations

#### E.4.1 Nigeria (Pidgin and English)

Language Reality: Many Nigerians code-switch between English and Pidgin. AI Agent must handle mixed messages.

UI Language: Default to English with option for Pidgin. Some users prefer English UI but Pidgin conversation.

Cultural Considerations:
Currency display in Naira (NGN) with symbol
Date format: DD/MM/YYYY
Time: 12-hour with AM/PM common

#### E.4.2 Brasil (Portuguese)

Language Reality: Brazilian Portuguese has significant vocabulary differences from European Portuguese.

Regional Variations: Slang varies by state. Initial focus on Southeast (Sao Paulo, Rio) dialect.

Cultural Considerations:
Currency display in Real (BRL) with R$ symbol
Date format: DD/MM/YYYY
Decimal separator: comma (1.000,50)

#### E.4.3 Latin America (Spanish)

Language Reality: Latin American Spanish varies by country. Prioritize neutral Latin American Spanish (es-419) over Spain Spanish (es-ES).

Regional Variations: Vocabulary for plants and farming varies. Provide regional glossaries.

Cultural Considerations:
Multiple currencies (need per-country handling)
Date format varies by country
Respectful address forms (usted vs tu) vary regionally

### E.5 Right-to-Left (RTL) Roadmap

Current Status: No RTL support in v1.

RTL Languages on Roadmap: Arabic (v2), Hebrew (no current plans), Urdu (no current plans)

Technical Preparation:
CSS using logical properties (margin-inline-start vs margin-left)
Bidirectional text handling in components
RTL-aware icon placement

Timeline: RTL support planned for v2 when Arabic expansion prioritized.

### E.6 Localization Success Metrics

Adoption by Language: Track active users by locale setting.

Completion Rates by Language: Compare action submission completion rates across languages. If Portuguese completion is lower than English, investigate friction.

AI Agent Accuracy by Language: Track parse success rate per language. Target: within 5% of English baseline.

Translation Coverage: Percentage of strings translated per language. Target: 100% for Tier 1 at launch.

Community Satisfaction: Include language satisfaction question in NPS surveys.

---

## Addendum F: Privacy Impact Assessment

This section assesses privacy risks and documents data handling practices for Green Goods.

### F.1 Assessment Overview

Purpose: Identify privacy risks associated with Green Goods data collection and processing. Document mitigation measures and compliance approach.

Scope: All data collected by Green Goods PWA, AI Agent, Admin Dashboard, and smart contracts.

Regulatory Context:
GDPR (European Union users)
LGPD (Brazilian users)
POPIA (South African users)
No comprehensive federal privacy law in Nigeria, but best practices apply

### F.2 Data Inventory

#### F.2.1 Data Collected from Gardeners

Wallet Address: Collected upon passkey creation. Stored onchain. Cannot be deleted. Used for identification and attestation attribution.

GPS Coordinates: Collected with each action submission. Stored on IPFS with obfuscation (3 decimal places). Used for location verification.

Photos and Media: Collected with each action submission. Stored on IPFS via Storracha. Used for verification evidence.

Timestamps: Collected automatically with submissions. Stored onchain in attestations. Used for temporal verification.

Action Metadata: Collected per schema (plant type, waste weight, etc). Stored on IPFS and onchain. Used for impact quantification.

Device Information: Collected for analytics (device type, OS, browser). Stored in analytics platform (anonymized). Used for debugging and optimization.

Optional Profile Data: Name and bio if provided by user. Stored on IPFS with encryption. Used for social features.

#### F.2.2 Data Collected from Operators and Evaluators

Wallet Address: Same as Gardeners.

Hats Protocol Role: Role assignment stored onchain. Used for permission management.

Verification Decisions: Approval/rejection decisions stored onchain. Used for audit trail.

#### F.2.3 Data Collected from Funders

Wallet Address: Same as Gardeners.

Deposit Amounts: Transaction amounts stored onchain. Used for treasury management.

Conviction Votes: Voting signals stored onchain. Used for yield allocation.

### F.3 Data Flow Mapping

#### F.3.1 Action Submission Flow

Step 1: Gardener captures photo on device.
Data location: Device only.
Privacy risk: Low (user controlled).

Step 2: Gardener adds metadata (GPS, timestamp extracted automatically, user inputs details).
Data location: Device memory.
Privacy risk: Medium (GPS reveals location).

Step 3: User submits action (PWA or AI Agent).
Data location: In transit (HTTPS encrypted).
Privacy risk: Low (encrypted).

Step 4: Backend processes submission.
Data location: Server memory (ephemeral).
Privacy risk: Medium (momentary server access).

Step 5: Image uploaded to IPFS via Storracha.
Data location: IPFS network (distributed).
Privacy risk: High (immutable, public).

Step 6: Attestation created on Arbitrum.
Data location: Blockchain (permanent).
Privacy risk: High (immutable, public).

Step 7: Envio indexes attestation.
Data location: Indexer database.
Privacy risk: Medium (centralized copy).

#### F.3.2 Data Residency

Onchain Data (Arbitrum): Attestations, wallet addresses, transaction records. Immutable. Global distribution.

IPFS Data (Storracha): Images, metadata JSON, profile data. Immutable once pinned. Global distribution.

Backend Data (Ephemeral): Processing logs, session data. Deleted after processing.

Analytics Data (PostHog or similar): Anonymized usage data. Stored in analytics provider region.

### F.4 Privacy Risks and Mitigations

#### F.4.1 Risk: GPS Location Reveals Sensitive Information

Description: Precise GPS coordinates could reveal home locations, land ownership patterns, or sensitive sites (indigenous land, protected areas).

Likelihood: High
Impact: Medium
Risk Level: High

Mitigations:
GPS obfuscated to 3 decimal places (approximately 111 meter precision) before IPFS storage.
Raw GPS never stored onchain.
Users informed of location collection during onboarding.
Future: Option to disable GPS for privacy-sensitive users (reduces verification quality).

Residual Risk: 111m precision still identifies general area. Acceptable for environmental verification use case.

#### F.4.2 Risk: Photos Contain Identifiable Information

Description: Photos may contain faces, license plates, property features, or other identifying information.

Likelihood: Medium
Impact: High
Risk Level: High

Mitigations:
AI Agent can detect faces and prompt user to retake photo (future enhancement).
Operator review can flag photos with PII before Hypercert minting.
User guidance during submission: "Avoid including people's faces in photos."
Photos stored on IPFS are public. Users informed of this.

Residual Risk: Cannot prevent all PII in photos. User responsibility with guidance.

#### F.4.3 Risk: Blockchain Data Is Immutable

Description: Once data is onchain, it cannot be deleted. This conflicts with GDPR "right to erasure."

Likelihood: Certain (by design)
Impact: High (GDPR non-compliance)
Risk Level: High

Mitigations:
Minimize onchain PII. Only wallet address stored onchain.
Profile data (name, bio) stored on IPFS with encryption. Can be "deleted" by destroying encryption key.
Attestations reference IPFS CIDs. If IPFS content unpinned, attestation becomes empty shell.
Privacy notice clearly explains blockchain immutability during signup.
GDPR interpretation: Wallet address may not be "personal data" if not linked to real identity.

Residual Risk: Wallet address is pseudonymous but potentially linkable. Legal gray area.

#### F.4.4 Risk: AI Agent Processes Sensitive Conversations

Description: AI Agent via WhatsApp/SMS receives natural language messages that may contain unintended personal information.

Likelihood: Medium
Impact: Medium
Risk Level: Medium

Mitigations:
AI Agent prompts are scoped to action reporting. Personal queries redirected.
Message content not stored long-term. Processed and discarded.
WhatsApp Business API compliance provides baseline security.
Users can opt out of AI Agent and use PWA only.

Residual Risk: Conversational interfaces may elicit more personal disclosure than forms.

#### F.4.5 Risk: Third-Party Service Data Exposure

Description: Data shared with third parties (Twilio, OpenAI, Pimlico, Storracha) creates additional exposure points.

Likelihood: Low
Impact: High
Risk Level: Medium

Mitigations:
Data Processing Agreements with all third-party processors.
Minimize data shared (send only necessary fields).
Review third-party privacy policies for compliance.
Twilio and OpenAI have SOC 2 compliance.

Third-Party Data Handling Summary:
Twilio (WhatsApp): Message content in transit. Retention per Twilio policy.
OpenAI (AI processing): Message content for inference. No training on API data per policy.
Pimlico (gas sponsorship): Wallet address and transaction data. Blockchain public anyway.
Storracha (IPFS pinning): Images and metadata. Stored indefinitely until unpinned.
Envio (indexing): Onchain data copy. Public data mirrored.

Residual Risk: Third-party policies may change. Ongoing monitoring required.

#### F.4.6 Risk: Caretaker Data in Educational Planting

Description: Uganda educational planting model assigns trees to student caretakers. Student names could be collected.

Likelihood: Medium
Impact: High (minors' data)
Risk Level: High

Mitigations:
Student names optional field (can use pseudonyms or initials).
No photos of minors required for verification.
School/church administrator (adult) is the Operator.
Parental consent process for any minor data collection.
Consider: Use student ID codes instead of names.

Residual Risk: Children's privacy requires extra care. Default to minimal collection.

### F.5 Data Subject Rights

#### F.5.1 Right to Access

Implementation: Users can export all their data via Profile settings. Export includes all submitted actions, attestations, and profile data.

#### F.5.2 Right to Rectification

Implementation: Users can update profile data (name, bio). Action data can be flagged for correction by Operator (new attestation with correction reference, original not deleted).

#### F.5.3 Right to Erasure (Right to be Forgotten)

Implementation:
Profile data: Encryption key destroyed, rendering IPFS data unreadable.
Onchain attestations: Cannot delete. Wallet address remains but content references become empty.
Analytics data: Deletion request to analytics provider.

Limitation: Full erasure not possible for blockchain data. Users informed before signup.

#### F.5.4 Right to Portability

Implementation: Data export in machine-readable format (JSON). Includes action history, attestation references, and profile data.

#### F.5.5 Right to Object

Implementation: Users can opt out of analytics tracking. Users can delete account (with limitations above).

### F.6 Privacy by Design Measures

Minimization: Collect only data necessary for verification. GPS obfuscated. No unnecessary PII fields.

Pseudonymization: Users identified by wallet address, not real identity. Optional profile data.

Encryption: Profile data encrypted before IPFS storage. HTTPS for all data in transit.

Access Control: Hats Protocol enforces role-based access. Operators see only their Garden data.

Transparency: Privacy notice explains all data collection. Users informed of blockchain immutability.

User Control: Users choose what to submit. Optional fields clearly marked. Opt-out available.

### F.7 Compliance Checklist

GDPR Compliance:
Lawful basis: Consent (explicit during signup)
Privacy notice: Required (to be drafted)
Data Processing Agreements: Required with all processors
Data Protection Officer: Not required (under 250 employees threshold)
Data breach notification: Process to be documented
Cross-border transfers: Standard Contractual Clauses for non-EU processors

LGPD Compliance (Brasil):
Similar requirements to GDPR
Portuguese language privacy notice required
Local representative may be required

POPIA Compliance (South Africa):
Similar requirements to GDPR
Local registration may be required

### F.8 Privacy Documentation Required

Privacy Notice: User-facing document explaining data collection, use, and rights. Required before launch.

Cookie Policy: If any cookies used, policy required. PWA may use local storage.

Data Processing Agreements: Contracts with Twilio, OpenAI, Pimlico, Storracha, Envio.

Data Retention Policy: Internal document specifying retention periods.

Data Breach Response Plan: Internal procedure for handling security incidents.

Privacy Training: Training materials for team members handling user data.

### F.9 Privacy Metrics and Monitoring

Access Request Response Time: Target under 30 days per GDPR requirement.

Deletion Request Completion: Track completion rate and average time.

Privacy Complaints: Track and investigate all privacy-related complaints.

Third-Party Audit: Annual review of third-party data handling practices.

---

End of Addendum

Green Goods Protocol v1 PRD Addendum
January 17, 2026

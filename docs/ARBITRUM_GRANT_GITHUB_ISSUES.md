# Arbitrum Grant: GitHub Issues

> **Grant**: Creating Regenerative Impact with Green Goods
> **Amount**: $24,800 USD
> **Duration**: 3 months
> **Grant Program**: Arbitrum New Protocols and Ideas 3.0

This document outlines GitHub issues to be created for tracking grant deliverables. Issues are organized by functional area with budget allocations, acceptance criteria, and milestone alignment.

---

## Table of Contents

1. [Growth](#1-growth-800)
2. [Finance Management](#2-finance-management-400)
3. [Project Management](#3-project-management-1600)
4. [Product Development](#4-product-development-800)
5. [UI Design](#5-ui-design-1800)
6. [Related Areas](#6-related-areas)

---

## 1. Growth ($800)

### Issue: GRO-001 - Set up Success Metrics Tracking Dashboard

**Budget**: $200
**Milestone**: 1 (Month 1)
**Assignee**: @afo (Afolabi Aiyeloja)
**Labels**: `growth`, `analytics`, `milestone-1`

**Description**:
Set up comprehensive metrics tracking for grant KPIs across all deliverables.

**Acceptance Criteria**:
- [ ] Dashboard tracking Hypercerts minted on Arbitrum (target: ≥8)
- [ ] Protocol transaction metrics (attestations, Hypercert mints, vault interactions)
- [ ] Garden usage tracking (target: ≥8 distinct Gardens)
- [ ] TVL tracking for yield-donating vaults (target: ≥$12k)
- [ ] User acquisition metrics (target: 150+ unique users M1-2, 200+ M3)
- [ ] CIDS-compliant impact records counter (target: ≥100 updates to Karma GAP)
- [ ] NPS tracking integration (target: ≥50)

**Technical Notes**:
- Integrate with existing Envio indexer for on-chain metrics
- Consider Dune Analytics or custom dashboard
- Must track metrics across all 5 milestones

---

### Issue: GRO-002 - Partner Outreach Campaign

**Budget**: $200
**Milestone**: 1-2 (Months 1-2)
**Assignee**: @kit (Kit Blake - BD Lead)
**Labels**: `growth`, `partnerships`, `bd`

**Description**:
Execute partner outreach to Arbitrum ecosystem projects, ReFi protocols, and local organizations.

**Acceptance Criteria**:
- [ ] Identify and document 20+ potential partners in Arbitrum ecosystem
- [ ] Create outreach templates for different partner types:
  - DeFi protocols for vault integrations
  - ReFi projects for Garden activations
  - Local orgs (NGOs, community groups) for pilots
- [ ] Track outreach in CRM or spreadsheet
- [ ] Secure at least 4 partnership conversations
- [ ] Document partnership value propositions

**Target Partners**:
- Arbitrum ecosystem DeFi projects
- Hypercerts protocol team
- Karma GAP team
- Octant for vault strategies
- Local Greenpill chapters (Nigeria, Brasil, Barcelona, etc.)

---

### Issue: GRO-003 - Impact Reporting to Karma GAP

**Budget**: $200
**Milestone**: 2-5 (Months 1-3)
**Assignee**: @afo (Afolabi Aiyeloja)
**Labels**: `growth`, `impact`, `karma-gap`, `reporting`

**Description**:
Push structured CIDS-compliant impact data from Green Goods to Karma GAP on Arbitrum.

**Acceptance Criteria**:
- [ ] Map Green Goods actions to Karma GAP entities (Project, Milestone, Update)
- [ ] Implement automatic push of approved actions to Karma GAP
- [ ] Achieve ≥100 CIDS-compliant updates pushed
- [ ] 80%+ of pilot Gardens have impact reporting via Karma GAP
- [ ] Document integration for other builders

**Technical Notes**:
- Karma GAP uses EAS attestations on Arbitrum
- Reference existing `KarmaLib` in contracts package
- Ensure all actions follow CIDS (Common Impact Data Standard)

---

### Issue: GRO-004 - Formalize Partnership Agreements

**Budget**: $200
**Milestone**: 2-3 (Months 2-3)
**Assignee**: @kit (Kit Blake - BD Lead)
**Labels**: `growth`, `partnerships`, `legal`

**Description**:
Create and execute formal partnership agreements with key ecosystem partners.

**Acceptance Criteria**:
- [ ] Create partnership agreement template
- [ ] Define partnership tiers and benefits
- [ ] Execute agreements with at least 2 strategic partners
- [ ] Document partnership terms and deliverables
- [ ] Set up partner communication channels

---

## 2. Finance Management ($400)

### Issue: FIN-001 - Capital Management System

**Budget**: $200
**Milestone**: 1-3 (Months 1-3)
**Assignee**: @matt (Matt Strachman - Finance Manager)
**Labels**: `finance`, `treasury`, `milestone-1`

**Description**:
Establish transparent capital management for grant funds and DeFi vault operations.

**Acceptance Criteria**:
- [ ] Set up multi-sig wallet for grant funds (if not already)
- [ ] Create budget tracking spreadsheet aligned with grant breakdown
- [ ] Implement monthly financial reporting template
- [ ] Track TVL and yield across 4-8 vaults
- [ ] Document capital flows: deposits → yield → Hypercert purchases
- [ ] Ensure all DeFi flows are auditable and aligned with Arbitrum best practices

**Budget Categories to Track**:
| Category | Budget |
|----------|--------|
| Growth | $800 |
| Finance Management | $400 |
| Community Activations | $3,200 |
| Project Management | $1,600 |
| Product Development | $800 |
| Marketing & Branding | $3,200 |
| UI Design | $1,800 |
| Quality Assurance | $1,200 |
| Engineering | $9,200 |
| Buffer/Contingency | $2,600 |

---

### Issue: FIN-002 - Payout Coordination System

**Budget**: $200
**Milestone**: 1-5 (All months)
**Assignee**: @matt (Matt Strachman - Finance Manager)
**Labels**: `finance`, `payouts`, `operations`

**Description**:
Manage contributor payouts and ensure timely, transparent disbursements.

**Acceptance Criteria**:
- [ ] Create payout schedule aligned with milestones
- [ ] Set up payment tracking (contributor, amount, milestone, date)
- [ ] Implement payout approval workflow
- [ ] Document all transactions with on-chain references
- [ ] Generate milestone completion payment reports
- [ ] Coordinate with Questbook for milestone-based fund releases

**Payout Schedule**:
| Milestone | Amount | Target Date |
|-----------|--------|-------------|
| M1 - Project Development | $4,000 | Month 1 |
| M2 - Hypercerts Integration | $8,000 | Month 2 |
| M3 - DeFi Integration | $8,000 | Month 3 |
| M4 - Community Activations 1&2 | $4,000 | Month 2 |
| M5 - Activations 3 + Reporting | $800 | Month 3 |

---

## 3. Project Management ($1,600)

### Issue: PM-001 - Weekly Sync Coordination

**Budget**: $800
**Milestone**: 1-5 (All months)
**Assignee**: @afo (Afolabi Aiyeloja - Project Lead)
**Labels**: `project-management`, `meetings`, `coordination`

**Description**:
Coordinate weekly team syncs to track progress, blockers, and milestone delivery.

**Acceptance Criteria**:
- [ ] Schedule recurring weekly sync (suggested: 60 min)
- [ ] Create meeting agenda template
- [ ] Set up meeting notes documentation (Notion/Google Docs)
- [ ] Track action items and owners
- [ ] Record decisions and blockers
- [ ] Capture design reviews with Garden Stewards (4+ required for M1)

**Meeting Structure**:
1. Milestone progress review (15 min)
2. Blocker discussion (15 min)
3. Cross-team updates (15 min)
4. Action items and next steps (15 min)

**Participants**:
- Afolabi (Project Lead)
- Caue (Community Lead)
- Kit (BD Lead)
- Matt (Finance)
- Sofia (Marketing)
- Nansel (Branding/QA)
- Marcus (UI Design)
- Alexander (Engineering)
- Tarun (Engineering)

---

### Issue: PM-002 - Task Creation and Management

**Budget**: $400
**Milestone**: 1-5 (All months)
**Assignee**: @afo (Afolabi Aiyeloja)
**Labels**: `project-management`, `github`, `tracking`

**Description**:
Create and manage GitHub issues, project boards, and task tracking for all grant deliverables.

**Acceptance Criteria**:
- [ ] Create GitHub Project board for Arbitrum grant
- [ ] Import all issues from this document
- [ ] Set up milestone labels (milestone-1 through milestone-5)
- [ ] Configure automated workflows (issue → in progress → review → done)
- [ ] Weekly issue triage and prioritization
- [ ] Track completion percentages per milestone

**GitHub Labels to Create**:
- `milestone-1`, `milestone-2`, `milestone-3`, `milestone-4`, `milestone-5`
- `growth`, `finance`, `pm`, `product`, `ui`, `engineering`, `qa`
- `community`, `marketing`, `hypercerts`, `defi`, `arbitrum`
- `priority-high`, `priority-medium`, `priority-low`
- `blocked`, `needs-review`, `ready-for-dev`

---

### Issue: PM-003 - Team & Roadmap Management

**Budget**: $400
**Milestone**: 1-5 (All months)
**Assignee**: @afo (Afolabi Aiyeloja)
**Labels**: `project-management`, `roadmap`, `team`

**Description**:
Manage team capacity, roadmap alignment, and cross-functional coordination.

**Acceptance Criteria**:
- [ ] Create visual roadmap (Miro/Linear) aligned with milestones
- [ ] Track team capacity and assignments
- [ ] Identify and escalate risks early
- [ ] Coordinate dependencies between workstreams
- [ ] Prepare milestone completion reports for Questbook
- [ ] Document lessons learned after each milestone

**Roadmap Timeline**:
```
Month 1: Project Development + Hypercerts Start + Activations 1-4
Month 2: Hypercerts Complete + DeFi Start + Activations 5-8
Month 3: DeFi Complete + Activations 9-12 + Final Reporting
```

---

## 4. Product Development ($800)

### Issue: PROD-001 - PRD v2 for Green Goods Protocol

**Budget**: $200
**Milestone**: 1 (Month 1)
**Assignee**: @afo (Afolabi Aiyeloja)
**Labels**: `product`, `prd`, `milestone-1`, `priority-high`

**Description**:
Finalize Product Requirements Document v2 defining Green Goods as a protocol (not just an app).

**Acceptance Criteria**:
- [ ] Define protocol roles: Gardener, Operator, Evaluator, Funder
- [ ] Document protocol entities: Gardens, Actions, Work, Assessments
- [ ] Specify contract interfaces and APIs
- [ ] Map data flows: action → attestation → Hypercert → vault
- [ ] Define CIDS compliance requirements
- [ ] Document Karma GAP integration points
- [ ] Include Arbitrum-specific deployment details
- [ ] Review with 4+ Garden Stewards (recorded via Google Meet)

**PRD Sections**:
1. Protocol Overview & Vision
2. User Roles & Permissions
3. Core Entities & Data Models
4. Smart Contract Architecture
5. API Specifications
6. CIDS Compliance Mapping
7. Karma GAP Integration
8. Hypercerts Integration
9. DeFi Vault Integration
10. Security Considerations

---

### Issue: PROD-002 - CIDS-Compliant Action Schema

**Budget**: $200
**Milestone**: 1 (Month 1)
**Assignee**: @afo (Afolabi Aiyeloja)
**Labels**: `product`, `cids`, `schema`, `milestone-1`

**Description**:
Design action schemas that comply with Common Impact Data Standard (CIDS) for machine-readable impact data.

**Acceptance Criteria**:
- [ ] Research and document CIDS specification requirements
- [ ] Map existing Green Goods actions to CIDS fields
- [ ] Design schema for new action types:
  - Conservation (reforestation, biodiversity)
  - Agriculture (agroforestry, syntropic farming)
  - Community (solar hubs, waste cleanup, mutual aid)
  - Education (workshops, training)
- [ ] Ensure compatibility with Karma GAP entities
- [ ] Create schema validation rules
- [ ] Document migration path for existing actions

**CIDS Fields to Map**:
- Who (actor/contributor)
- What (action type, description)
- Where (location, garden, bioregion)
- When (timestamp, duration)
- Impact (capitals affected, metrics)
- Evidence (media, attestations)

---

### Issue: PROD-003 - Hypercerts Integration Specification

**Budget**: $200
**Milestone**: 1 (Month 1)
**Assignee**: @afo (Afolabi Aiyeloja)
**Labels**: `product`, `hypercerts`, `spec`, `milestone-1`

**Description**:
Define how Green Goods will aggregate work into Hypercerts on Arbitrum.

**Acceptance Criteria**:
- [ ] Document Hypercerts protocol integration requirements
- [ ] Define aggregation rules (which work → which Hypercert)
- [ ] Specify Hypercert metadata schema:
  - Title format (e.g., "Q1 2026 Community Solar Actions in Lagos")
  - Description template
  - Work scope (timeframe, location, contributors)
  - Impact claim (activities, capitals, metrics)
- [ ] Define minting triggers and operator approval flow
- [ ] Specify fractionalization rules for vault purchases
- [ ] Document Hypercerts protocol APIs to use

**Example Hypercerts**:
1. "Q1 2026 Agroforestry Work - São Paulo" (Greenpill Brasil)
2. "Tech & Sun Solar Hub - University of Lagos" (Greenpill Nigeria)
3. "Syntropic Farming Pilot - Dominican Republic" (Kokonut Network)
4. "Community Waste Cleanup - Koh Phangan" (Greenpill Thailand)

---

### Issue: PROD-004 - DeFi Integration Specification

**Budget**: $200
**Milestone**: 1 (Month 1)
**Assignee**: @afo (Afolabi Aiyeloja)
**Labels**: `product`, `defi`, `spec`, `milestone-1`

**Description**:
Define yield-donating vault architecture following Octant-style strategies on Arbitrum.

**Acceptance Criteria**:
- [ ] Research Octant V2 vault patterns
- [ ] Define vault architecture:
  - Deposit mechanism (principal preservation)
  - Yield generation strategy
  - Yield routing to Hypercert purchases
- [ ] Specify Garden-vault associations
- [ ] Define depositor dashboard requirements
- [ ] Document vault-to-Hypercert purchase flow
- [ ] Specify target: 4-8 vaults with $12k+ combined TVL

**Vault Flow**:
```
Depositor → Vault (principal safe) → Yield Generated →
→ Auto-purchase Hypercert fractions → Hypercert holder (Garden)
```

---

## 5. UI Design ($1,800)

### Issue: UI-001 - Admin Dashboard UI Polish

**Budget**: $200
**Milestone**: 1 (Month 1)
**Assignee**: @marcus (Marcus Dutra - UI Design/Engineering)
**Labels**: `ui`, `admin`, `design`, `milestone-1`

**Description**:
Polish the admin dashboard UI for Garden operators managing Hypercerts and vault integrations.

**Acceptance Criteria**:
- [ ] Audit current admin UI for usability issues
- [ ] Design improvements for:
  - Garden overview dashboard
  - Member management views
  - Work approval workflow
  - Action registry management
- [ ] Create updated Figma designs
- [ ] Ensure mobile responsiveness
- [ ] Follow existing design system (Tailwind v4 + Radix UI)
- [ ] Conduct design review with 2+ operators

**Design Principles**:
- "As simple as posting to Instagram"
- Mobile-first for field use
- Clear visual hierarchy
- Accessible color contrast

---

### Issue: UI-002 - Hypercerts Minting UI Design

**Budget**: $800
**Milestone**: 1-2 (Months 1-2)
**Assignee**: @marcus (Marcus Dutra)
**Labels**: `ui`, `hypercerts`, `design`, `milestone-1`, `milestone-2`, `priority-high`

**Description**:
Design the complete UX flow for Garden operators to aggregate work and mint Hypercerts.

**Acceptance Criteria**:
- [ ] Design Hypercert creation wizard:
  - Step 1: Select time period and Garden
  - Step 2: Review aggregated work/actions
  - Step 3: Edit Hypercert metadata
  - Step 4: Preview Hypercert certificate
  - Step 5: Confirm and mint
- [ ] Design Hypercert management dashboard:
  - List of minted Hypercerts
  - Hypercert detail view
  - Fractionalization status
  - Vault purchase history
- [ ] Create Hypercert certificate visual design
- [ ] Design mobile and desktop variants
- [ ] Prototype interactive flows in Figma
- [ ] Test designs with 4+ Garden Stewards

**Figma Deliverables**:
- [ ] Wireframes (low-fidelity)
- [ ] High-fidelity mockups
- [ ] Interactive prototype
- [ ] Component specifications
- [ ] Design handoff documentation

---

### Issue: UI-003 - DeFi Vault Integration UI Design

**Budget**: $800
**Milestone**: 2-3 (Months 2-3)
**Assignee**: @marcus (Marcus Dutra)
**Labels**: `ui`, `defi`, `design`, `milestone-2`, `milestone-3`, `priority-high`

**Description**:
Design the DeFi vault interface showing deposits, yield, and Hypercert purchases.

**Acceptance Criteria**:
- [ ] Design depositor dashboard:
  - Vault overview (TVL, APY, principal)
  - Deposit/withdraw flows
  - Yield generated history
  - Hypercerts purchased via yield
- [ ] Design Garden operator vault view:
  - Vaults supporting this Garden
  - Incoming Hypercert purchases
  - Yield allocation settings
- [ ] Design vault discovery/selection:
  - Browse available vaults
  - Filter by Garden/region
  - Vault details and metrics
- [ ] Create demo flow for:
  - Deposit → yield → Hypercert purchase
- [ ] Ensure non-crypto users can understand

**UI Patterns**:
- Clear principal vs. yield visualization
- Real-time TVL and yield counters
- Transaction history with block explorer links
- Simple language (avoid DeFi jargon for gardeners)

---

## 6. Related Areas

The following areas are closely related to the five main categories and should be tracked alongside them.

### Community Activations ($3,200)

#### Issue: COMM-001 - Event Coordination System

**Budget**: $800
**Milestone**: 4-5 (Months 1-3)
**Assignee**: @caue (Caue Tomaz - Community Lead)
**Labels**: `community`, `events`, `coordination`

**Description**:
Coordinate 12 IRL activations across global regions using Green Goods.

**Acceptance Criteria**:
- [ ] Create event planning template
- [ ] Schedule 12 events across regions:
  - Brasil (2-3 events)
  - Nigeria (2 events)
  - Dominican Republic (1-2 events)
  - Barcelona (1 event)
  - NYC (1 event)
  - Koh Phangan (1 event)
  - Uganda (1 event)
  - Taiwan (1 event)
- [ ] Set up NPS tracking via Slido (target: ≥50)
- [ ] Document event outcomes and learnings
- [ ] Capture 150+ unique users (M1-2), 200+ (M3)

---

#### Issue: COMM-002 - Activation Merchandise

**Budget**: $800
**Milestone**: 4 (Months 1-2)
**Assignee**: @caue (Caue Tomaz)
**Labels**: `community`, `merch`, `marketing`

**Description**:
Design and produce merchandise for IRL activations.

**Acceptance Criteria**:
- [ ] Design activation merch (stickers, t-shirts, etc.)
- [ ] Produce materials for 12 events
- [ ] Distribute to regional event coordinators
- [ ] Track inventory and usage

---

#### Issue: COMM-003 - Garden Activation Fund

**Budget**: $1,600
**Milestone**: 4-5 (Months 1-3)
**Assignee**: @caue (Caue Tomaz)
**Labels**: `community`, `funding`, `gardens`

**Description**:
Allocate funds to support Garden activations and pilot initiatives.

**Acceptance Criteria**:
- [ ] Define activation fund allocation criteria
- [ ] Distribute funds to:
  - Greenpill Nigeria (Tech & Sun solar hubs)
  - Greenpill Brasil (agroforestry projects)
  - Kokonut Network (syntropic farming)
  - Greenpill Ivory Coast, Koh Phangan, Cape Town (waste initiatives)
- [ ] Track fund usage and outcomes
- [ ] Ensure 4+ Gardens participate in pilots

---

### Marketing & Branding ($3,200)

#### Issue: MKT-001 - Brand Polish

**Budget**: $200
**Milestone**: 1 (Month 1)
**Assignee**: @nansel (Nansel Rimsah - Branding)
**Labels**: `marketing`, `branding`, `design`

**Description**:
Polish Green Goods brand identity for Arbitrum launch.

**Acceptance Criteria**:
- [ ] Review and update brand guidelines
- [ ] Ensure Arbitrum co-branding compliance
- [ ] Update visual assets as needed
- [ ] Create brand usage documentation

---

#### Issue: MKT-002 - Pitch Deck

**Budget**: $200
**Milestone**: 1 (Month 1)
**Assignee**: @sofia (Sofia Villarreal - Marketing Lead)
**Labels**: `marketing`, `pitch`, `fundraising`

**Description**:
Create investor/partner pitch deck for Green Goods on Arbitrum.

**Acceptance Criteria**:
- [ ] Design pitch deck (15-20 slides)
- [ ] Include Arbitrum value proposition
- [ ] Highlight Hypercerts + DeFi integration
- [ ] Translate key narratives for non-crypto audiences
- [ ] Create Spanish/Portuguese versions

---

#### Issue: MKT-003 - Marketing Materials

**Budget**: $2,400
**Milestone**: 1-3 (All months)
**Assignee**: @sofia (Sofia Villarreal)
**Labels**: `marketing`, `content`, `media`

**Description**:
Produce demos, media content, YouTube videos, and graphics.

**Acceptance Criteria**:
- [ ] Create product demo videos (3-5)
- [ ] Produce YouTube explainer content
- [ ] Design social media graphics
- [ ] Create event promotional materials
- [ ] Produce multilingual content (EN, ES, PT)

---

#### Issue: MKT-004 - Growth Campaign #1

**Budget**: $200
**Milestone**: 2 (Month 2)
**Assignee**: @sofia (Sofia Villarreal)
**Labels**: `marketing`, `campaign`, `growth`

**Description**:
Execute first growth campaign around Hypercerts launch.

**Acceptance Criteria**:
- [ ] Define campaign goals and messaging
- [ ] Execute social media campaign
- [ ] Coordinate with community activations
- [ ] Track engagement metrics

---

#### Issue: MKT-005 - Growth Campaign #2

**Budget**: $200
**Milestone**: 3 (Month 3)
**Assignee**: @sofia (Sofia Villarreal)
**Labels**: `marketing`, `campaign`, `growth`

**Description**:
Execute second growth campaign around DeFi vault launch.

**Acceptance Criteria**:
- [ ] Define campaign goals and messaging
- [ ] Execute social media campaign
- [ ] Highlight yield-donating vault benefits
- [ ] Track TVL growth correlation

---

### Quality Assurance ($1,200)

#### Issue: QA-001 - Test Plan

**Budget**: $200
**Milestone**: 1 (Month 1)
**Assignee**: @nansel (Nansel Rimsah)
**Labels**: `qa`, `testing`, `planning`

**Description**:
Create comprehensive test plan for Hypercerts and DeFi integrations.

**Acceptance Criteria**:
- [ ] Define test strategy (unit, integration, E2E)
- [ ] Identify critical paths to test
- [ ] Set up test environments (testnet, mainnet)
- [ ] Define acceptance criteria per feature
- [ ] Establish regression test baseline

---

#### Issue: QA-002 - Test Cases

**Budget**: $200
**Milestone**: 1-2 (Months 1-2)
**Assignee**: @nansel (Nansel Rimsah)
**Labels**: `qa`, `testing`, `cases`

**Description**:
Write detailed test cases for all new functionality.

**Acceptance Criteria**:
- [ ] Test cases for Hypercerts minting flow
- [ ] Test cases for DeFi vault operations
- [ ] Test cases for Karma GAP integration
- [ ] Test cases for passkey onboarding
- [ ] Test cases for offline/sync scenarios

---

#### Issue: QA-003 - Dogfooding Program

**Budget**: $400
**Milestone**: 2-3 (Months 2-3)
**Assignee**: @nansel (Nansel Rimsah)
**Labels**: `qa`, `dogfooding`, `user-testing`

**Description**:
Run internal dogfooding cycles with team and Garden Stewards.

**Acceptance Criteria**:
- [ ] Define dogfooding participants (team + 4 Stewards)
- [ ] Create feedback collection system
- [ ] Run 2-3 dogfooding cycles
- [ ] Track and prioritize bugs found
- [ ] Document UX friction points

---

#### Issue: QA-004 - Bug Bounty Program

**Budget**: $400
**Milestone**: 2-3 (Months 2-3)
**Assignee**: @nansel (Nansel Rimsah)
**Labels**: `qa`, `security`, `bounty`

**Description**:
Run bug bounty program for Hypercerts and DeFi contracts.

**Acceptance Criteria**:
- [ ] Define bounty scope and rewards
- [ ] Set up responsible disclosure process
- [ ] Promote bounty to security community
- [ ] Triage and pay valid reports
- [ ] Document findings and fixes

---

### Engineering ($9,200)

#### Issue: ENG-001 - Hypercerts Minting Implementation

**Budget**: $4,000
**Milestone**: 2 (Months 1-2)
**Assignee**: @alexander (Alexander Mangel)
**Labels**: `engineering`, `hypercerts`, `contracts`, `milestone-2`, `priority-high`

**Description**:
Implement Hypercerts aggregation and minting contracts on Arbitrum.

**Acceptance Criteria**:
- [ ] Deploy contracts on Arbitrum testnet
- [ ] Test with real Green Goods data
- [ ] Deploy contracts on Arbitrum mainnet
- [ ] Implement frontend integration
- [ ] Create public demo
- [ ] Mint 4+ pilot Hypercerts from real Gardens
- [ ] Target: 4-8 Hypercerts minted on Arbitrum

**Technical Requirements**:
- Follow Hypercerts protocol standard (ERC-1155)
- Aggregate CIDS-compliant work from Green Goods
- Enable operator approval before minting
- Support fractionalization for vault purchases

---

#### Issue: ENG-002 - DeFi Vault Implementation

**Budget**: $4,800
**Milestone**: 3 (Months 2-3)
**Assignee**: @alexander (Alexander Mangel)
**Labels**: `engineering`, `defi`, `contracts`, `milestone-3`, `priority-high`

**Description**:
Implement 4-8 yield-donating vaults on Arbitrum.

**Acceptance Criteria**:
- [ ] Design vault architecture (Octant-style)
- [ ] Implement yield generation strategy
- [ ] Wire yield routing to Hypercert purchases
- [ ] Deploy 4-8 vaults on Arbitrum
- [ ] Create deposit → yield → purchase demo
- [ ] Achieve $12k+ combined TVL
- [ ] Execute 8+ Hypercert purchases via vault yield

**Technical Requirements**:
- Principal preservation (depositors keep principal)
- Automated yield-to-Hypercert conversion
- Support multiple Gardens per vault
- Dashboard integration for transparency

---

#### Issue: ENG-003 - Infrastructure Costs

**Budget**: $400
**Milestone**: 1-5 (All months)
**Assignee**: @afo (Afolabi Aiyeloja)
**Labels**: `engineering`, `infrastructure`, `ops`

**Description**:
Cover infrastructure costs for Arbitrum deployments.

**Acceptance Criteria**:
- [ ] Arbitrum mainnet gas costs for deployments
- [ ] Testnet operational costs
- [ ] Indexer hosting (Envio)
- [ ] IPFS storage (Pinata/Storacha)
- [ ] Domain and SSL costs

---

## Milestone Summary

| Milestone | Amount | Timeline | Key Deliverables |
|-----------|--------|----------|------------------|
| M1 - Project Development | $4,000 | Month 1 | PRD v2, Wireframes, Designs |
| M2 - Hypercerts Integration | $8,000 | Months 1-2 | Contracts, App Integration, 4+ Hypercerts |
| M3 - DeFi Integration | $8,000 | Months 2-3 | 4-8 Vaults, $12k TVL, Demo |
| M4 - Community Activations 1&2 | $4,000 | Months 1-2 | 8 Events, 150+ Users |
| M5 - Activations 3 + Reporting | $800 | Month 3 | 12 Events Total, Final Report |

---

## KPIs Dashboard

| Metric | Target | Milestone |
|--------|--------|-----------|
| Hypercerts minted | ≥8 | M2-M5 |
| Distinct Gardens using Arbitrum | ≥8 | M2-M5 |
| TVL in yield-donating vaults | ≥$12k | M3 |
| Hypercert purchases via vault yield | ≥8 | M3-M5 |
| IRL initiatives with recurring vault purchases | ≥4 | M5 |
| IRL events run | ≥12 | M4-M5 |
| Unique users completing actions | 200+ | M5 |
| NPS score | ≥50 | M4-M5 |
| CIDS-compliant records in Karma GAP | ≥100 | M2-M5 |

---

## Next Steps

1. **Import issues to GitHub** - Create all issues in the repository
2. **Create Project Board** - Set up Arbitrum Grant project board
3. **Assign issues** - Distribute to team members
4. **Set up milestones** - Create GitHub milestones for M1-M5
5. **Begin Sprint 1** - Focus on M1 deliverables

---

*Document generated from Arbitrum New Protocols and Ideas 3.0 grant proposal*
*Last updated: January 2026*

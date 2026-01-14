#!/bin/bash

# =============================================================================
# Arbitrum Grant GitHub Issues Creation Script
# Grant: Creating Regenerative Impact with Green Goods ($24,800 USD)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="greenpill-dev-guild/green-goods"
PROJECT_NAME="Green Goods"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Arbitrum Grant Issues Creation Script${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}GitHub CLI authenticated${NC}"

# Function to create labels if they don't exist
create_labels() {
    echo -e "${YELLOW}Creating labels...${NC}"

    # Milestone labels
    gh label create "milestone-1" --description "M1: Project Development (Month 1)" --color "0E8A16" --repo $REPO 2>/dev/null || true
    gh label create "milestone-2" --description "M2: Hypercerts Integration (Months 1-2)" --color "1D76DB" 2>/dev/null || true
    gh label create "milestone-3" --description "M3: DeFi Integration (Months 2-3)" --color "5319E7" --repo $REPO 2>/dev/null || true
    gh label create "milestone-4" --description "M4: Community Activations 1&2 (Months 1-2)" --color "FBCA04" --repo $REPO 2>/dev/null || true
    gh label create "milestone-5" --description "M5: Activations 3 + Reporting (Month 3)" --color "D93F0B" --repo $REPO 2>/dev/null || true

    # Area labels
    gh label create "growth" --description "Growth tasks" --color "C2E0C6" --repo $REPO 2>/dev/null || true
    gh label create "finance" --description "Finance management tasks" --color "BFD4F2" --repo $REPO 2>/dev/null || true
    gh label create "pm" --description "Project management tasks" --color "D4C5F9" --repo $REPO 2>/dev/null || true
    gh label create "product" --description "Product development tasks" --color "FEF2C0" --repo $REPO 2>/dev/null || true
    gh label create "ui" --description "UI design tasks" --color "F9D0C4" --repo $REPO 2>/dev/null || true
    gh label create "community" --description "Community activation tasks" --color "C5DEF5" --repo $REPO 2>/dev/null || true
    gh label create "marketing" --description "Marketing & branding tasks" --color "E99695" --repo $REPO 2>/dev/null || true
    gh label create "qa" --description "Quality assurance tasks" --color "D876E3" --repo $REPO 2>/dev/null || true
    gh label create "engineering" --description "Engineering tasks" --color "0052CC" --repo $REPO 2>/dev/null || true

    # Priority labels
    gh label create "priority-high" --description "High priority" --color "B60205" --repo $REPO 2>/dev/null || true
    gh label create "priority-medium" --description "Medium priority" --color "FBCA04" --repo $REPO 2>/dev/null || true
    gh label create "priority-low" --description "Low priority" --color "0E8A16" --repo $REPO 2>/dev/null || true

    # Feature labels
    gh label create "hypercerts" --description "Hypercerts integration" --color "7057FF" --repo $REPO 2>/dev/null || true
    gh label create "defi" --description "DeFi vault integration" --color "008672" --repo $REPO 2>/dev/null || true
    gh label create "karma-gap" --description "Karma GAP integration" --color "FF7619" --repo $REPO 2>/dev/null || true
    gh label create "arbitrum" --description "Arbitrum ecosystem" --color "28A0F0" --repo $REPO 2>/dev/null || true
    gh label create "grant" --description "Grant deliverable" --color "6F42C1" --repo $REPO 2>/dev/null || true

    echo -e "${GREEN}Labels created/verified${NC}"
}

# Function to create an issue
create_issue() {
    local title="$1"
    local body="$2"
    local labels="$3"

    echo -e "${YELLOW}Creating: ${title}${NC}"

    gh issue create \
        --repo "$REPO" \
        --title "$title" \
        --body "$body" \
        --label "$labels" || {
        echo -e "${RED}Failed to create issue: ${title}${NC}"
        return 1
    }

    echo -e "${GREEN}Created: ${title}${NC}"
    sleep 1  # Rate limiting
}

# =============================================================================
# GROWTH ISSUES
# =============================================================================

create_growth_issues() {
    echo -e "\n${BLUE}Creating Growth Issues...${NC}\n"

    # GRO-001
    create_issue "[GRO-001] Set up Success Metrics Tracking Dashboard" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1 - Project Development (Month 1)

## Assignee
@afo (Afolabi Aiyeloja)

## Description
Set up comprehensive metrics tracking for grant KPIs across all deliverables.

## Acceptance Criteria
- [ ] Dashboard tracking Hypercerts minted on Arbitrum (target: ≥8)
- [ ] Protocol transaction metrics (attestations, Hypercert mints, vault interactions)
- [ ] Garden usage tracking (target: ≥8 distinct Gardens)
- [ ] TVL tracking for yield-donating vaults (target: ≥$12k)
- [ ] User acquisition metrics (target: 150+ unique users M1-2, 200+ M3)
- [ ] CIDS-compliant impact records counter (target: ≥100 updates to Karma GAP)
- [ ] NPS tracking integration (target: ≥50)

## Technical Notes
- Integrate with existing Envio indexer for on-chain metrics
- Consider Dune Analytics or custom dashboard
- Must track metrics across all 5 milestones

## KPIs
| Metric | Target |
|--------|--------|
| Hypercerts minted | ≥8 |
| Gardens using Arbitrum | ≥8 |
| TVL in vaults | ≥$12k |
| Unique users | 200+ |
| CIDS records | ≥100 |
| NPS score | ≥50 |
EOF
)" "growth,milestone-1,analytics,grant,arbitrum"

    # GRO-002
    create_issue "[GRO-002] Partner Outreach Campaign" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1-2 (Months 1-2)

## Assignee
@kit (Kit Blake - BD Lead)

## Description
Execute partner outreach to Arbitrum ecosystem projects, ReFi protocols, and local organizations.

## Acceptance Criteria
- [ ] Identify and document 20+ potential partners in Arbitrum ecosystem
- [ ] Create outreach templates for different partner types:
  - DeFi protocols for vault integrations
  - ReFi projects for Garden activations
  - Local orgs (NGOs, community groups) for pilots
- [ ] Track outreach in CRM or spreadsheet
- [ ] Secure at least 4 partnership conversations
- [ ] Document partnership value propositions

## Target Partners
- Arbitrum ecosystem DeFi projects
- Hypercerts protocol team
- Karma GAP team
- Octant for vault strategies
- Local Greenpill chapters (Nigeria, Brasil, Barcelona, etc.)
EOF
)" "growth,milestone-1,milestone-2,partnerships,grant,arbitrum"

    # GRO-003
    create_issue "[GRO-003] Impact Reporting to Karma GAP" "$(cat <<'EOF'
## Budget
$200

## Milestone
M2-5 (Months 1-3)

## Assignee
@afo (Afolabi Aiyeloja)

## Description
Push structured CIDS-compliant impact data from Green Goods to Karma GAP on Arbitrum.

## Acceptance Criteria
- [ ] Map Green Goods actions to Karma GAP entities (Project, Milestone, Update)
- [ ] Implement automatic push of approved actions to Karma GAP
- [ ] Achieve ≥100 CIDS-compliant updates pushed
- [ ] 80%+ of pilot Gardens have impact reporting via Karma GAP
- [ ] Document integration for other builders

## Technical Notes
- Karma GAP uses EAS attestations on Arbitrum
- Reference existing `KarmaLib` in contracts package
- Ensure all actions follow CIDS (Common Impact Data Standard)

## KPIs
- ≥100 CIDS-compliant updates pushed to Karma GAP
- 80%+ pilot Gardens with active impact reporting
EOF
)" "growth,milestone-2,milestone-3,karma-gap,grant,arbitrum"

    # GRO-004
    create_issue "[GRO-004] Formalize Partnership Agreements" "$(cat <<'EOF'
## Budget
$200

## Milestone
M2-3 (Months 2-3)

## Assignee
@kit (Kit Blake - BD Lead)

## Description
Create and execute formal partnership agreements with key ecosystem partners.

## Acceptance Criteria
- [ ] Create partnership agreement template
- [ ] Define partnership tiers and benefits
- [ ] Execute agreements with at least 2 strategic partners
- [ ] Document partnership terms and deliverables
- [ ] Set up partner communication channels
EOF
)" "growth,milestone-2,milestone-3,partnerships,grant,arbitrum"
}

# =============================================================================
# FINANCE MANAGEMENT ISSUES
# =============================================================================

create_finance_issues() {
    echo -e "\n${BLUE}Creating Finance Management Issues...${NC}\n"

    # FIN-001
    create_issue "[FIN-001] Capital Management System" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1-3 (Months 1-3)

## Assignee
@matt (Matt Strachman - Finance Manager)

## Description
Establish transparent capital management for grant funds and DeFi vault operations.

## Acceptance Criteria
- [ ] Set up multi-sig wallet for grant funds (if not already)
- [ ] Create budget tracking spreadsheet aligned with grant breakdown
- [ ] Implement monthly financial reporting template
- [ ] Track TVL and yield across 4-8 vaults
- [ ] Document capital flows: deposits → yield → Hypercert purchases
- [ ] Ensure all DeFi flows are auditable and aligned with Arbitrum best practices

## Budget Categories to Track
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
| **Total** | **$24,800** |
EOF
)" "finance,milestone-1,milestone-2,milestone-3,grant,arbitrum"

    # FIN-002
    create_issue "[FIN-002] Payout Coordination System" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1-5 (All months)

## Assignee
@matt (Matt Strachman - Finance Manager)

## Description
Manage contributor payouts and ensure timely, transparent disbursements.

## Acceptance Criteria
- [ ] Create payout schedule aligned with milestones
- [ ] Set up payment tracking (contributor, amount, milestone, date)
- [ ] Implement payout approval workflow
- [ ] Document all transactions with on-chain references
- [ ] Generate milestone completion payment reports
- [ ] Coordinate with Questbook for milestone-based fund releases

## Payout Schedule
| Milestone | Amount | Target Date |
|-----------|--------|-------------|
| M1 - Project Development | $4,000 | Month 1 |
| M2 - Hypercerts Integration | $8,000 | Month 2 |
| M3 - DeFi Integration | $8,000 | Month 3 |
| M4 - Community Activations 1&2 | $4,000 | Month 2 |
| M5 - Activations 3 + Reporting | $800 | Month 3 |
EOF
)" "finance,milestone-1,milestone-2,milestone-3,milestone-4,milestone-5,grant,arbitrum"
}

# =============================================================================
# PROJECT MANAGEMENT ISSUES
# =============================================================================

create_pm_issues() {
    echo -e "\n${BLUE}Creating Project Management Issues...${NC}\n"

    # PM-001
    create_issue "[PM-001] Weekly Sync Coordination" "$(cat <<'EOF'
## Budget
$800

## Milestone
M1-5 (All months)

## Assignee
@afo (Afolabi Aiyeloja - Project Lead)

## Description
Coordinate weekly team syncs to track progress, blockers, and milestone delivery.

## Acceptance Criteria
- [ ] Schedule recurring weekly sync (suggested: 60 min)
- [ ] Create meeting agenda template
- [ ] Set up meeting notes documentation (Notion/Google Docs)
- [ ] Track action items and owners
- [ ] Record decisions and blockers
- [ ] Capture design reviews with Garden Stewards (4+ required for M1)

## Meeting Structure
1. Milestone progress review (15 min)
2. Blocker discussion (15 min)
3. Cross-team updates (15 min)
4. Action items and next steps (15 min)

## Participants
- Afolabi (Project Lead)
- Caue (Community Lead)
- Kit (BD Lead)
- Matt (Finance)
- Sofia (Marketing)
- Nansel (Branding/QA)
- Marcus (UI Design)
- Alexander (Engineering)
- Tarun (Engineering)
EOF
)" "pm,milestone-1,milestone-2,milestone-3,milestone-4,milestone-5,grant,arbitrum"

    # PM-002
    create_issue "[PM-002] Task Creation and Management" "$(cat <<'EOF'
## Budget
$400

## Milestone
M1-5 (All months)

## Assignee
@afo (Afolabi Aiyeloja)

## Description
Create and manage GitHub issues, project boards, and task tracking for all grant deliverables.

## Acceptance Criteria
- [ ] Create GitHub Project board for Arbitrum grant
- [ ] Import all issues from grant document
- [ ] Set up milestone labels (milestone-1 through milestone-5)
- [ ] Configure automated workflows (issue → in progress → review → done)
- [ ] Weekly issue triage and prioritization
- [ ] Track completion percentages per milestone

## GitHub Labels
- `milestone-1`, `milestone-2`, `milestone-3`, `milestone-4`, `milestone-5`
- `growth`, `finance`, `pm`, `product`, `ui`, `engineering`, `qa`
- `community`, `marketing`, `hypercerts`, `defi`, `arbitrum`
- `priority-high`, `priority-medium`, `priority-low`
EOF
)" "pm,milestone-1,milestone-2,milestone-3,milestone-4,milestone-5,grant,arbitrum"

    # PM-003
    create_issue "[PM-003] Team & Roadmap Management" "$(cat <<'EOF'
## Budget
$400

## Milestone
M1-5 (All months)

## Assignee
@afo (Afolabi Aiyeloja)

## Description
Manage team capacity, roadmap alignment, and cross-functional coordination.

## Acceptance Criteria
- [ ] Create visual roadmap (Miro/Linear) aligned with milestones
- [ ] Track team capacity and assignments
- [ ] Identify and escalate risks early
- [ ] Coordinate dependencies between workstreams
- [ ] Prepare milestone completion reports for Questbook
- [ ] Document lessons learned after each milestone

## Roadmap Timeline
```
Month 1: Project Development + Hypercerts Start + Activations 1-4
Month 2: Hypercerts Complete + DeFi Start + Activations 5-8
Month 3: DeFi Complete + Activations 9-12 + Final Reporting
```
EOF
)" "pm,milestone-1,milestone-2,milestone-3,milestone-4,milestone-5,grant,arbitrum"
}

# =============================================================================
# PRODUCT DEVELOPMENT ISSUES
# =============================================================================

create_product_issues() {
    echo -e "\n${BLUE}Creating Product Development Issues...${NC}\n"

    # PROD-001
    create_issue "[PROD-001] PRD v2 for Green Goods Protocol" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1 - Project Development (Month 1)

## Assignee
@afo (Afolabi Aiyeloja)

## Description
Finalize Product Requirements Document v2 defining Green Goods as a protocol (not just an app).

## Acceptance Criteria
- [ ] Define protocol roles: Gardener, Operator, Evaluator, Funder
- [ ] Document protocol entities: Gardens, Actions, Work, Assessments
- [ ] Specify contract interfaces and APIs
- [ ] Map data flows: action → attestation → Hypercert → vault
- [ ] Define CIDS compliance requirements
- [ ] Document Karma GAP integration points
- [ ] Include Arbitrum-specific deployment details
- [ ] Review with 4+ Garden Stewards (recorded via Google Meet)

## PRD Sections
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
EOF
)" "product,milestone-1,priority-high,grant,arbitrum"

    # PROD-002
    create_issue "[PROD-002] CIDS-Compliant Action Schema" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1 - Project Development (Month 1)

## Assignee
@afo (Afolabi Aiyeloja)

## Description
Design action schemas that comply with Common Impact Data Standard (CIDS) for machine-readable impact data.

## Acceptance Criteria
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

## CIDS Fields to Map
- **Who** (actor/contributor)
- **What** (action type, description)
- **Where** (location, garden, bioregion)
- **When** (timestamp, duration)
- **Impact** (capitals affected, metrics)
- **Evidence** (media, attestations)
EOF
)" "product,milestone-1,grant,arbitrum"

    # PROD-003
    create_issue "[PROD-003] Hypercerts Integration Specification" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1 - Project Development (Month 1)

## Assignee
@afo (Afolabi Aiyeloja)

## Description
Define how Green Goods will aggregate work into Hypercerts on Arbitrum.

## Acceptance Criteria
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

## Example Hypercerts
1. "Q1 2026 Agroforestry Work - São Paulo" (Greenpill Brasil)
2. "Tech & Sun Solar Hub - University of Lagos" (Greenpill Nigeria)
3. "Syntropic Farming Pilot - Dominican Republic" (Kokonut Network)
4. "Community Waste Cleanup - Koh Phangan" (Greenpill Thailand)
EOF
)" "product,milestone-1,hypercerts,grant,arbitrum"

    # PROD-004
    create_issue "[PROD-004] DeFi Integration Specification" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1 - Project Development (Month 1)

## Assignee
@afo (Afolabi Aiyeloja)

## Description
Define yield-donating vault architecture following Octant-style strategies on Arbitrum.

## Acceptance Criteria
- [ ] Research Octant V2 vault patterns
- [ ] Define vault architecture:
  - Deposit mechanism (principal preservation)
  - Yield generation strategy
  - Yield routing to Hypercert purchases
- [ ] Specify Garden-vault associations
- [ ] Define depositor dashboard requirements
- [ ] Document vault-to-Hypercert purchase flow
- [ ] Specify target: 4-8 vaults with $12k+ combined TVL

## Vault Flow
```
Depositor → Vault (principal safe) → Yield Generated →
→ Auto-purchase Hypercert fractions → Hypercert holder (Garden)
```
EOF
)" "product,milestone-1,defi,grant,arbitrum"
}

# =============================================================================
# UI DESIGN ISSUES
# =============================================================================

create_ui_issues() {
    echo -e "\n${BLUE}Creating UI Design Issues...${NC}\n"

    # UI-001
    create_issue "[UI-001] Admin Dashboard UI Polish" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1 - Project Development (Month 1)

## Assignee
@marcus (Marcus Dutra - UI Design/Engineering)

## Description
Polish the admin dashboard UI for Garden operators managing Hypercerts and vault integrations.

## Acceptance Criteria
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

## Design Principles
- "As simple as posting to Instagram"
- Mobile-first for field use
- Clear visual hierarchy
- Accessible color contrast
EOF
)" "ui,milestone-1,admin,grant,arbitrum"

    # UI-002
    create_issue "[UI-002] Hypercerts Minting UI Design" "$(cat <<'EOF'
## Budget
$800

## Milestone
M1-2 (Months 1-2)

## Assignee
@marcus (Marcus Dutra)

## Description
Design the complete UX flow for Garden operators to aggregate work and mint Hypercerts.

## Acceptance Criteria
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

## Figma Deliverables
- [ ] Wireframes (low-fidelity)
- [ ] High-fidelity mockups
- [ ] Interactive prototype
- [ ] Component specifications
- [ ] Design handoff documentation
EOF
)" "ui,milestone-1,milestone-2,hypercerts,priority-high,grant,arbitrum"

    # UI-003
    create_issue "[UI-003] DeFi Vault Integration UI Design" "$(cat <<'EOF'
## Budget
$800

## Milestone
M2-3 (Months 2-3)

## Assignee
@marcus (Marcus Dutra)

## Description
Design the DeFi vault interface showing deposits, yield, and Hypercert purchases.

## Acceptance Criteria
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

## UI Patterns
- Clear principal vs. yield visualization
- Real-time TVL and yield counters
- Transaction history with block explorer links
- Simple language (avoid DeFi jargon for gardeners)
EOF
)" "ui,milestone-2,milestone-3,defi,priority-high,grant,arbitrum"
}

# =============================================================================
# COMMUNITY ISSUES
# =============================================================================

create_community_issues() {
    echo -e "\n${BLUE}Creating Community Issues...${NC}\n"

    # COMM-001
    create_issue "[COMM-001] Event Coordination System" "$(cat <<'EOF'
## Budget
$800

## Milestone
M4-5 (Months 1-3)

## Assignee
@caue (Caue Tomaz - Community Lead)

## Description
Coordinate 12 IRL activations across global regions using Green Goods.

## Acceptance Criteria
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

## KPIs
- 12 IRL events completed
- 150+ unique users in Months 1-2
- 200+ unique users by Month 3
- NPS score ≥50
EOF
)" "community,milestone-4,milestone-5,grant,arbitrum"

    # COMM-002
    create_issue "[COMM-002] Activation Merchandise" "$(cat <<'EOF'
## Budget
$800

## Milestone
M4 (Months 1-2)

## Assignee
@caue (Caue Tomaz)

## Description
Design and produce merchandise for IRL activations.

## Acceptance Criteria
- [ ] Design activation merch (stickers, t-shirts, etc.)
- [ ] Produce materials for 12 events
- [ ] Distribute to regional event coordinators
- [ ] Track inventory and usage
EOF
)" "community,milestone-4,marketing,grant,arbitrum"

    # COMM-003
    create_issue "[COMM-003] Garden Activation Fund" "$(cat <<'EOF'
## Budget
$1,600

## Milestone
M4-5 (Months 1-3)

## Assignee
@caue (Caue Tomaz)

## Description
Allocate funds to support Garden activations and pilot initiatives.

## Acceptance Criteria
- [ ] Define activation fund allocation criteria
- [ ] Distribute funds to:
  - Greenpill Nigeria (Tech & Sun solar hubs)
  - Greenpill Brasil (agroforestry projects)
  - Kokonut Network (syntropic farming)
  - Greenpill Ivory Coast, Koh Phangan, Cape Town (waste initiatives)
- [ ] Track fund usage and outcomes
- [ ] Ensure 4+ Gardens participate in pilots

## Target Gardens
| Garden | Initiative | Region |
|--------|-----------|--------|
| Greenpill Nigeria | Tech & Sun solar hubs | Lagos, Nigeria |
| Greenpill Brasil | Agroforestry projects | São Paulo, Brazil |
| Kokonut Network | Syntropic farming | Dominican Republic |
| Greenpill Ivory Coast | Waste cleanup | Ivory Coast |
| Koh Phangan | Regenerative waste | Thailand |
| Cape Town | Circular waste | South Africa |
EOF
)" "community,milestone-4,milestone-5,grant,arbitrum"
}

# =============================================================================
# MARKETING ISSUES
# =============================================================================

create_marketing_issues() {
    echo -e "\n${BLUE}Creating Marketing Issues...${NC}\n"

    # MKT-001
    create_issue "[MKT-001] Brand Polish" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1 (Month 1)

## Assignee
@nansel (Nansel Rimsah - Branding)

## Description
Polish Green Goods brand identity for Arbitrum launch.

## Acceptance Criteria
- [ ] Review and update brand guidelines
- [ ] Ensure Arbitrum co-branding compliance
- [ ] Update visual assets as needed
- [ ] Create brand usage documentation
EOF
)" "marketing,milestone-1,grant,arbitrum"

    # MKT-002
    create_issue "[MKT-002] Pitch Deck" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1 (Month 1)

## Assignee
@sofia (Sofia Villarreal - Marketing Lead)

## Description
Create investor/partner pitch deck for Green Goods on Arbitrum.

## Acceptance Criteria
- [ ] Design pitch deck (15-20 slides)
- [ ] Include Arbitrum value proposition
- [ ] Highlight Hypercerts + DeFi integration
- [ ] Translate key narratives for non-crypto audiences
- [ ] Create Spanish/Portuguese versions
EOF
)" "marketing,milestone-1,grant,arbitrum"

    # MKT-003
    create_issue "[MKT-003] Marketing Materials Production" "$(cat <<'EOF'
## Budget
$2,400

## Milestone
M1-3 (All months)

## Assignee
@sofia (Sofia Villarreal)

## Description
Produce demos, media content, YouTube videos, and graphics.

## Acceptance Criteria
- [ ] Create product demo videos (3-5)
- [ ] Produce YouTube explainer content
- [ ] Design social media graphics
- [ ] Create event promotional materials
- [ ] Produce multilingual content (EN, ES, PT)

## Content Deliverables
| Type | Quantity | Languages |
|------|----------|-----------|
| Demo videos | 3-5 | EN |
| YouTube explainers | 2-3 | EN, ES, PT |
| Social graphics | 20+ | Multi |
| Event materials | 12 sets | Multi |
EOF
)" "marketing,milestone-1,milestone-2,milestone-3,grant,arbitrum"

    # MKT-004
    create_issue "[MKT-004] Growth Campaign #1 - Hypercerts Launch" "$(cat <<'EOF'
## Budget
$200

## Milestone
M2 (Month 2)

## Assignee
@sofia (Sofia Villarreal)

## Description
Execute first growth campaign around Hypercerts launch.

## Acceptance Criteria
- [ ] Define campaign goals and messaging
- [ ] Execute social media campaign
- [ ] Coordinate with community activations
- [ ] Track engagement metrics
EOF
)" "marketing,milestone-2,hypercerts,grant,arbitrum"

    # MKT-005
    create_issue "[MKT-005] Growth Campaign #2 - DeFi Vault Launch" "$(cat <<'EOF'
## Budget
$200

## Milestone
M3 (Month 3)

## Assignee
@sofia (Sofia Villarreal)

## Description
Execute second growth campaign around DeFi vault launch.

## Acceptance Criteria
- [ ] Define campaign goals and messaging
- [ ] Execute social media campaign
- [ ] Highlight yield-donating vault benefits
- [ ] Track TVL growth correlation
EOF
)" "marketing,milestone-3,defi,grant,arbitrum"
}

# =============================================================================
# QA ISSUES
# =============================================================================

create_qa_issues() {
    echo -e "\n${BLUE}Creating QA Issues...${NC}\n"

    # QA-001
    create_issue "[QA-001] Test Plan" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1 (Month 1)

## Assignee
@nansel (Nansel Rimsah)

## Description
Create comprehensive test plan for Hypercerts and DeFi integrations.

## Acceptance Criteria
- [ ] Define test strategy (unit, integration, E2E)
- [ ] Identify critical paths to test
- [ ] Set up test environments (testnet, mainnet)
- [ ] Define acceptance criteria per feature
- [ ] Establish regression test baseline
EOF
)" "qa,milestone-1,grant,arbitrum"

    # QA-002
    create_issue "[QA-002] Test Cases" "$(cat <<'EOF'
## Budget
$200

## Milestone
M1-2 (Months 1-2)

## Assignee
@nansel (Nansel Rimsah)

## Description
Write detailed test cases for all new functionality.

## Acceptance Criteria
- [ ] Test cases for Hypercerts minting flow
- [ ] Test cases for DeFi vault operations
- [ ] Test cases for Karma GAP integration
- [ ] Test cases for passkey onboarding
- [ ] Test cases for offline/sync scenarios
EOF
)" "qa,milestone-1,milestone-2,grant,arbitrum"

    # QA-003
    create_issue "[QA-003] Dogfooding Program" "$(cat <<'EOF'
## Budget
$400

## Milestone
M2-3 (Months 2-3)

## Assignee
@nansel (Nansel Rimsah)

## Description
Run internal dogfooding cycles with team and Garden Stewards.

## Acceptance Criteria
- [ ] Define dogfooding participants (team + 4 Stewards)
- [ ] Create feedback collection system
- [ ] Run 2-3 dogfooding cycles
- [ ] Track and prioritize bugs found
- [ ] Document UX friction points
EOF
)" "qa,milestone-2,milestone-3,grant,arbitrum"

    # QA-004
    create_issue "[QA-004] Bug Bounty Program" "$(cat <<'EOF'
## Budget
$400

## Milestone
M2-3 (Months 2-3)

## Assignee
@nansel (Nansel Rimsah)

## Description
Run bug bounty program for Hypercerts and DeFi contracts.

## Acceptance Criteria
- [ ] Define bounty scope and rewards
- [ ] Set up responsible disclosure process
- [ ] Promote bounty to security community
- [ ] Triage and pay valid reports
- [ ] Document findings and fixes
EOF
)" "qa,milestone-2,milestone-3,grant,arbitrum"
}

# =============================================================================
# ENGINEERING ISSUES
# =============================================================================

create_engineering_issues() {
    echo -e "\n${BLUE}Creating Engineering Issues...${NC}\n"

    # ENG-001
    create_issue "[ENG-001] Hypercerts Minting Implementation" "$(cat <<'EOF'
## Budget
$4,000

## Milestone
M2 - Hypercerts Integration (Months 1-2)

## Assignee
@alexander (Alexander Mangel)

## Description
Implement Hypercerts aggregation and minting contracts on Arbitrum.

## Acceptance Criteria
- [ ] Deploy contracts on Arbitrum testnet
- [ ] Test with real Green Goods data
- [ ] Deploy contracts on Arbitrum mainnet
- [ ] Implement frontend integration
- [ ] Create public demo
- [ ] Mint 4+ pilot Hypercerts from real Gardens
- [ ] Target: 4-8 Hypercerts minted on Arbitrum

## Technical Requirements
- Follow Hypercerts protocol standard (ERC-1155)
- Aggregate CIDS-compliant work from Green Goods
- Enable operator approval before minting
- Support fractionalization for vault purchases

## KPIs
- 4-8 Hypercerts minted on Arbitrum mainnet
- 4+ different Gardens participating
- Public demo available
EOF
)" "engineering,milestone-2,hypercerts,priority-high,grant,arbitrum"

    # ENG-002
    create_issue "[ENG-002] DeFi Vault Implementation" "$(cat <<'EOF'
## Budget
$4,800

## Milestone
M3 - DeFi Integration (Months 2-3)

## Assignee
@alexander (Alexander Mangel)

## Description
Implement 4-8 yield-donating vaults on Arbitrum.

## Acceptance Criteria
- [ ] Design vault architecture (Octant-style)
- [ ] Implement yield generation strategy
- [ ] Wire yield routing to Hypercert purchases
- [ ] Deploy 4-8 vaults on Arbitrum
- [ ] Create deposit → yield → purchase demo
- [ ] Achieve $12k+ combined TVL
- [ ] Execute 8+ Hypercert purchases via vault yield

## Technical Requirements
- Principal preservation (depositors keep principal)
- Automated yield-to-Hypercert conversion
- Support multiple Gardens per vault
- Dashboard integration for transparency

## KPIs
- 4-8 vaults deployed
- $12k+ combined TVL
- 8+ Hypercert purchases via vault yield
EOF
)" "engineering,milestone-3,defi,priority-high,grant,arbitrum"

    # ENG-003
    create_issue "[ENG-003] Infrastructure Costs Management" "$(cat <<'EOF'
## Budget
$400

## Milestone
M1-5 (All months)

## Assignee
@afo (Afolabi Aiyeloja)

## Description
Cover infrastructure costs for Arbitrum deployments.

## Acceptance Criteria
- [ ] Arbitrum mainnet gas costs for deployments
- [ ] Testnet operational costs
- [ ] Indexer hosting (Envio)
- [ ] IPFS storage (Pinata/Storacha)
- [ ] Domain and SSL costs
- [ ] Track and report infrastructure spend
EOF
)" "engineering,milestone-1,milestone-2,milestone-3,milestone-4,milestone-5,grant,arbitrum"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    echo -e "\n${BLUE}Starting issue creation...${NC}\n"

    # Create labels first
    create_labels

    # Create issues by area
    create_growth_issues
    create_finance_issues
    create_pm_issues
    create_product_issues
    create_ui_issues
    create_community_issues
    create_marketing_issues
    create_qa_issues
    create_engineering_issues

    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}All issues created successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"

    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "1. Create a GitHub Project board: gh project create --title 'Arbitrum Grant'"
    echo "2. Add issues to the project board"
    echo "3. Set up milestone tracking"
    echo ""
    echo -e "${BLUE}To add all grant issues to a project:${NC}"
    echo "gh issue list --label grant --json number | jq -r '.[].number' | xargs -I {} gh project item-add PROJECT_NUMBER --owner greenpill-dev-guild --url https://github.com/greenpill-dev-guild/green-goods/issues/{}"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

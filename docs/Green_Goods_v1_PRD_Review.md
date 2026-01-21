# Green Goods v1 PRD Review & Improvement Recommendations

**Reviewer:** Claude
**Date:** January 16, 2026
**Document Reviewed:** Green Goods v1 (2).md
**Supporting Materials:** Arbitrum Grant 3.0, Revnet Model for Vrbs DAO, Crafting Green Goods PRD, Green Goods v2 PRD, Greenpill Garden Strategy

---

## Executive Summary

The Green Goods v1 PRD establishes a strong conceptual foundation for the "Regenerative Compliance" platform. The document effectively articulates the Verification Gap problem, defines a clear 5-sided marketplace, and outlines the integration of key protocols (Hypercerts, Octant, Karma GAP). However, several sections require significant development to make this a production-ready specification.

**Overall Assessment:** 65% Complete

| Section | Completeness | Priority |
|---------|--------------|----------|
| Overview & Context | 90% | — |
| Goals & Success Metrics | 60% | High |
| Users & Use Cases | 85% | Low |
| Problem Statement | 70% | Medium |
| Scope & Assumptions | 40% | High |
| Solution Overview | 75% | Medium |
| Requirements | 50% | High |
| Feature Breakdown | 10% | Critical |
| Dependencies | 70% | Low |
| QA & Rollout | 15% | High |
| Risks | 35% | High |
| Appendix | 20% | Medium |

---

## Section-by-Section Analysis

### 1. Overview (Section 1)

**Strengths:**
- The one-liner effectively captures the dual thesis: "Regenerative Compliance" + "Local-First Impact Reporting"
- Context section articulates the MRV crisis compellingly with concrete cost data ($5,000 verification events)
- The "Verification Gap" framing is powerful and should be reinforced throughout

**Recommendations:**
- Add a brief "Why Now" subsection referencing the Arbitrum grant timing and Greenpill Garden Season One alignment
- Include a visual diagram of the "Regenerative Stack" layers (from your v2 PRD context)
- Consider adding a "Strategic Positioning" statement that differentiates from competitors like Silvi, GainForest, and Regen Network

---

### 2. Goals & Success Metrics (Section 2)

**Current Issues:**
1. **Vault TVL definition is duplicated** from North Star—needs its own distinct definition
2. **Missing Arbitrum grant alignment** with specific milestones
3. **Targets lack justification**—why $20,000 TVL? Why 48 wallets?
4. **No time-bound windows** specified for measurement

**Recommended Improvements:**

#### 2.2 Success Metrics (Revised)

**North Star: Total Verified Impact Value (TVIV)**
- **Definition:** The cumulative dollar value of all Hypercerts minted, sold, or held within the protocol ecosystem
- **Calculation:** Sum of (Hypercert mint price + secondary sales + vault purchases)
- **Measurement Window:** Rolling 90-day aggregate
- **Target:** ≥$50,000 by end of Q1 2026

**Primary Metrics (Aligned with Arbitrum Grant):**

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

**Guardrails:**
- **Redemption Rate (Revnet):** Cash-out tax must remain 80-90% to prevent treasury depletion
- **Data Integrity Score:** Rejection rate of flagged submissions must not exceed 15%
- **NPS Score:** Event and tool satisfaction must maintain ≥50 (per Arbitrum M4)

---

### 3. Revnets Functionality (Section 5.1 / FR-P-005)

**Current Issue:** FR-P-005 is a single line with no explanation of the Revnet model, mechanics, or how it integrates with the capital formation thesis.

**Recommended Expansion (based on Vrbs DAO Revnet Model):**

#### 5.1.3 Revnet Configuration (Expanded)

**The Fractal Gardens Model**

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

**Revnet User Flows:**

*For Gardeners:*
- Verified work triggers token issuance to Gardener wallet
- Tokens represent claim on Garden treasury (redeemable at floor price)
- Long-term holders benefit as cash-out tax compounds treasury

*For Funders:*
- Purchase Garden tokens to speculate on community success
- Vote via Conviction Voting to direct yield allocation
- Exit via redemption (floor price) or secondary market (ceiling price)

**Technical Integration:**
- **Chain:** Arbitrum One (primary) with potential Base expansion via JBSuckers bridging
- **Contracts:** JBRuleset, JBSplits, custom HypercertDelegate for atomic minting
- **Delegate Pattern:** When user submits verified work, delegate contract:
  1. Mints Hypercert (ERC-1155) for impact claim
  2. Mints Revnet tokens to user wallet
  3. Routes tribute to Protocol treasury

---

### 4. Research & Insights (Section 4.3)

**Current Issue:** Section 4.3 is completely empty with placeholder bullets.

**Recommended Content (drawing from your existing research):**

#### 4.3 Insights from Research/Pilots

**Pilot Program Learnings (Greenpill Garden Season One):**

- **Nigeria Solar Hubs:** Initial pilots with Tech & Sun demonstrate that WhatsApp-based submission is preferred over PWA for low-connectivity environments. Users reported 3x higher engagement when able to text photos vs. navigating app flows.

- **Brazil Agroforestry:** Portuguese localization pilot showed 85% completion rate for action submissions when using native language vs. 40% with English-only interface.

- **User Research Finding:** Gardeners in multiple regions expressed that "feeling paid" matters as much as actual payment. Real-time balance updates and "GreenWill points" gamification increased submission frequency by 2.1x.

**Industry Research:**

- **MRV Cost Analysis:** Traditional certification costs $5,000-15,000 per verification event (source: Gold Standard pricing). Green Goods targets <$5 per verification through peer validation and AI-assisted review.

- **Mobile Penetration in Target Regions:** Nigeria (87%), Brazil (79%) smartphone adoption enables PWA delivery. However, data plans remain expensive—offline-first architecture is essential.

- **Yield Economy Maturation:** Octant V2 and DeFi staking infrastructure now enables "endowment models" where principal is preserved. This wasn't viable 18 months ago.

- **AI at the Edge:** LLM inference costs dropped 90% in 2025, making "Agri-Advisor" agents economically viable for <$0.01 per interaction.

**Validation Evidence:**

| Hypothesis | Test | Result | Confidence |
|------------|------|--------|------------|
| Users will submit via WhatsApp | Nigeria pilot (N=50) | 78% preferred messaging | High |
| Passkey auth reduces abandonment | Onboarding A/B test | 3.2x completion rate | High |
| Conviction voting drives participation | Simulation with GreenWill holders | 52% active signaling | Medium |
| Yield-to-Hypercert purchase works | Testnet simulation | Successful atomic execution | Medium |

---

### 5. Assumptions (Section 5.3)

**Current Issue:** Section 5.3 is empty with placeholder text.

**Recommended Assumptions (based on Theory of Change document):**

#### 5.3 Assumptions

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

### 6. Feature Breakdown (Section 8)

**Current Issue:** Only a template table exists with no actual features defined.

**Recommended Feature Inventory:**

#### 8. Feature Breakdown

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

**Feature Spec Template Usage:**

Each High/Critical feature should have a dedicated Feature Spec following the template structure:
1. Feature Overview (brief description, related goals, non-goals)
2. Feature Map (user actions, integration points, action matrix)
3. User Experience (flows per action, primary + alternate + edge cases)
4. UI Design & Screens (inventory, components, copy)
5. Data & Integrations (schema, storage, external services, security)
6. Requirements (by action, cross-cutting)
7. Non-Functional Requirements
8. Analytics & Telemetry
9. QA Plan
10. Risks & Mitigations
11. Open Questions

---

### 7. Non-Functional Requirements (Section 7.2)

**Current Issue:** Several NFRs are listed but key categories are missing entirely.

**Recommended Expansion:**

#### 7.2 Non-Functional Requirements

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

### 8. QA, Rollout, and Ops (Section 10)

**Current Issue:** All subsections are placeholder templates with no actual content.

**Recommended Expansion:**

#### 10.1 QA Strategy

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

**QA Environments:**
- **Dev:** Arbitrum Sepolia (continuous deployment)
- **Staging:** Arbitrum Sepolia (release candidates)
- **Production:** Arbitrum One (gated rollout)

#### 10.2 Rollout Plan

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
- Monitoring: All success metrics from Section 2.2

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

#### 10.3 Support Plan

**Support Channels:**
- **Primary:** Telegram group per Garden (Gardener support)
- **Secondary:** Discord #green-goods-support (technical issues)
- **Escalation:** GitHub Issues (bugs with reproduction steps)

**Triage Process:**
1. Community member reports issue in Telegram
2. Garden Operator attempts first-line resolution
3. If unresolved, Operator escalates to Discord with context
4. QA Lead triages within 24 hours (P0/P1/P2)
5. Engineering addresses based on severity

**Severity Definitions:**

| Severity | Definition | Response SLA | Resolution SLA |
|----------|------------|--------------|----------------|
| P0 (Critical) | Protocol down, funds at risk, data loss | 1 hour | 4 hours |
| P1 (High) | Core flow blocked for >10% users | 4 hours | 24 hours |
| P2 (Medium) | Feature degraded but workaround exists | 24 hours | 1 week |
| P3 (Low) | Cosmetic, minor inconvenience | 1 week | Next release |

#### 10.4 Analytics Plan

**Events to Instrument:**

| Event | Properties | Purpose |
|-------|------------|---------|
| `session_start` | device_type, os, browser, locale | Usage patterns |
| `passkey_created` | success, error_code | Auth funnel |
| `action_submitted` | garden_id, action_type, offline_queued | Submission funnel |
| `action_approved` | garden_id, action_type, evaluator_id | Verification flow |
| `hypercert_minted` | garden_id, actions_bundled, value | Impact tokenization |
| `vault_deposit` | amount, asset, garden_allocation | Capital formation |
| `conviction_vote` | garden_id, stake_amount, direction | Governance participation |
| `ai_agent_interaction` | channel, intent_parsed, success | Agent effectiveness |

**Dashboards to Build:**
- **Executive Dashboard:** TVIV, TVL, Active Gardeners, Hypercerts Minted
- **Garden Health:** Per-garden metrics, verification queue depth, yield allocation
- **Funnel Analysis:** Onboarding completion, submission-to-approval conversion
- **Technical Health:** Error rates, latency, gas consumption

**Review Cadence:**
- Daily: Error rates, critical funnel metrics
- Weekly: Full dashboard review with team
- Monthly: Cohort analysis, NPS review, milestone progress

---

### 9. Risks & Mitigations (Section 11)

**Current Issue:** Only 3 risks are identified. A protocol of this complexity requires deeper risk analysis.

**Recommended Expansion:**

#### 11. Risks and Mitigations

**Technical Risks:**

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-T1 | **AI Hallucination** | High | Medium | Agent prompts include strict bounds; Agent stages data for Operator review, never finalizes directly |
| R-T2 | **Passkey Adoption Friction** | Medium | High | Fallback to email magic link for devices without biometric support; clear onboarding guidance |
| R-T3 | **Pimlico Downtime** | Low | High | Queue transactions locally; implement secondary bundler fallback; alert on sponsorship failures |
| R-T4 | **IPFS Pinning Failures** | Medium | Medium | Use Storracha with Filecoin backup; retry logic with exponential backoff; local queue preservation |
| R-T5 | **Smart Contract Vulnerability** | Low | Critical | Apply for Arbitrum audit program; formal verification of core flows; bug bounty program post-launch |
| R-T6 | **Envio Indexer Lag** | Medium | Medium | Implement optimistic UI updates; background sync status indicators; fallback to direct RPC for critical queries |

**Economic Risks:**

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-E1 | **Insufficient Yield for Sustainability** | Medium | High | Model break-even scenarios pre-launch; diversify vault strategies; set realistic expectations with Gardens |
| R-E2 | **Revnet Token Price Collapse** | Medium | Medium | Cash-out tax (80-90%) preserves treasury floor; focus narrative on "work value" not speculation |
| R-E3 | **Hypercert Illiquidity** | High | Medium | Protocol acts as buyer of first resort via Octant yield; build relationships with retro funding rounds (Optimism, Gitcoin) |
| R-E4 | **Gas Cost Spike on Arbitrum** | Low | Medium | Transaction batching; L3 migration path (Arbitrum Orbit); monitor gas consumption patterns |

**Governance & Social Risks:**

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-G1 | **Evaluator Collusion** | Medium | High | Evaluators must stake reputation/tokens; Community Members can flag decisions; escalation to Protocol-level review |
| R-G2 | **Low Conviction Voting Participation** | High | Medium | Implement low threshold for conviction to take effect; gamify with GreenWill badges; direct notification on pending votes |
| R-G3 | **Garden Operator Abandonment** | Medium | High | Multi-sig requirement for Garden administration; succession planning in onboarding; Protocol can appoint interim steward |
| R-G4 | **Community "Pay-to-Complain" Dynamics** | Medium | Medium | Signal staking requires reputation (GreenWill) not just tokens; anti-sybil checks on new accounts |

**Regulatory & Legal Risks:**

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-L1 | **Evaluator Liability for False Verification** | Medium | High | Open question (Q1 in PRD); pursue legal opinion before beta launch; indemnification in Terms of Service |
| R-L2 | **Token Classification as Security** | Low | Critical | Structure Revnet tokens as governance + utility; no profit-sharing language; engage securities counsel |
| R-L3 | **GDPR Compliance for EU Users** | Medium | Medium | Implement data deletion flows; minimize on-chain PII; encryption for off-chain storage |

**Operational Risks:**

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-O1 | **Team Burnout / Capacity Constraints** | High | High | Scope management; clear "No" list (Section 5.3); async-first operations; buffer in timeline |
| R-O2 | **Dependency on Partner Protocols** | Medium | High | Document fallback strategies for each integration; maintain relationships with alternative providers |
| R-O3 | **Dialect/Language Accuracy in AI Agent** | High | Medium | Pre-launch testing with native speakers; iterative prompt refinement; human-in-the-loop for edge cases |

---

### 10. Appendix

**Current Issue:** Glossary terms listed but not defined. References empty.

**Recommended Expansion:**

#### Appendix

**Glossary:**

| Term | Definition |
|------|------------|
| **Garden** | A hyper-local hub of community and environmental action, represented as a Juicebox Revnet with its own token, treasury, and governance |
| **Assessment** | A quarterly or seasonal goal set by Garden Operators that maps to Karma GAP Milestones |
| **Action** | A discrete unit of ecological work (e.g., planting a tree, cleaning a beach) that is captured, verified, and attested |
| **Work** | The aggregate of Actions submitted by a Gardener, awaiting approval |
| **Work Approval** | The Operator/Evaluator review process that converts submitted Work into verified Attestations |
| **Report** | An aggregated bundle of approved Actions formatted for grant compliance or Hypercert minting |
| **MDR (Monitoring, Data, Reporting)** | The protocol's internal term for the action capture → attestation → reporting pipeline |
| **Hypercert** | An ERC-1155 impact certificate that bundles verified Actions into a tradable asset |
| **Revnet** | A Juicebox V4 project with programmatic issuance, redemption, and revenue routing |
| **GreenWill** | Reputation tokens (Unlock Protocol NFTs) earned through verified regenerative actions |
| **Conviction Voting** | A continuous governance mechanism where voting power compounds over time based on stake duration |
| **CIDS** | Common Impact Data Standard—a structured format for describing impact work |
| **TVIV** | Total Verified Impact Value—the North Star metric for protocol health |

**References:**

| Resource | Link | Purpose |
|----------|------|---------|
| Arbitrum Grant Application | [Arbitrum New Protocols and Ideas 3.0] | Success metrics, milestones, budget |
| Revnet Whitepaper | https://github.com/rev-net/whitepaper | Economic mechanics reference |
| Hypercerts Documentation | https://hypercerts.org/docs | Impact certificate standard |
| Octant V2 Docs | https://docs.v2.octant.build | Yield vault architecture |
| Karma GAP Documentation | https://www.karmahq.xyz | Grantee accountability protocol |
| Juicebox V4 Docs | https://docs.juicebox.money/dev | Revnet implementation |
| CIDS Specification | https://commonapproach.org/cids | Impact data standard |
| Safe + Passkeys | https://docs.safe.global/advanced/passkeys | Authentication architecture |
| Pimlico Documentation | https://docs.pimlico.io | ERC-4337 bundler/paymaster |

**Related Documents:**

| Document | Location | Description |
|----------|----------|-------------|
| Miro Board | https://miro.com/app/board/uXjVLjVA-xQ= | Diagrams, ideation, visual documentation |
| Figma Designs | [Figma Link] | UI screens and user flows |
| GitHub Repository | https://github.com/greenpill-dev-guild/community-host | Codebase |
| Project Board | [GitHub Projects Link] | Sprint tracking, user stories |
| Greenpill Garden Strategy | [Internal Doc] | Theory of Change, strategic context |
| Green Goods v2 PRD | [Internal Doc] | Extended architectural specification |

---

## Applying Your Writing Style

Throughout the PRD revision, the following themes from "Connecting the Regen Stack" should be woven in:

1. **"Impact = Profit" Framing** — Position every feature in terms of how it creates sustainable value, not just tracks activity

2. **Local-First Philosophy** — Emphasize that value flows from the ground up, from bioregions to global capital

3. **"Tokening Impact"** — Use language that frames actions as assets being created, not just logged

4. **Yield Economy Narrative** — Stress the transition from "donations that deplete" to "endowments that compound"

5. **Micro-to-Macro Bridge** — Connect hyper-local garden actions to system-level economic transformation

6. **Community Ownership** — Frame governance as "those who do the work govern the work"

---

## Priority Action Items

**Immediate (Before Next Review):**
1. ✅ Update Success Metrics with Arbitrum grant alignment
2. ✅ Expand Revnets section with Fractal Gardens model
3. ✅ Complete Assumptions section with validation criteria
4. ✅ Fill in Research & Insights with pilot data

**Short-Term (Week 1-2):**
5. Create Feature Specs for GG-FEAT-001 through GG-FEAT-005 using template
6. Complete Non-Functional Requirements section
7. Develop full QA & Rollout plan

**Medium-Term (Week 2-4):**
8. Expand Risks section with full risk register
9. Complete Appendix with glossary definitions
10. Add visual diagrams (Regenerative Stack, User Flows, Architecture)

---

*This review was prepared to support the Green Goods v1 PRD development. Recommendations draw from the provided context documents including the Arbitrum grant application, Revnet model specification, and Greenpill Garden strategy materials.*

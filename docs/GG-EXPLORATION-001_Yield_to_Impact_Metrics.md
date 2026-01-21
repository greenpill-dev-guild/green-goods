# GG-EXPLORATION-001: Yield to Impact Ratio & Curve Framework

**Status:** Exploration / Research → **RECOMMENDED APPROACH DEFINED**
**Author:** Claude AI + Afo
**Date:** January 20, 2026
**Related:** Green Goods v1 PRD, GG-FEAT-006, GG-FEAT-007, GG-TECH-007

---

## 1. Executive Summary

This document explores the design of two interconnected metrics for Green Goods:

1. **Yield to Impact Ratio (Y2I)** - A point-in-time efficiency metric measuring how effectively yield converts to verified impact
2. **Yield to Impact Curve (Y2I Curve)** - A dynamic function modeling how impact grows relative to yield over time, influenced by multiple forms of capital

The goal is to create a quantifiable framework that:
- Translates the **Eight Forms of Capital** into discrete, measurable values
- Connects **Garden actions** to capital accumulation
- Models how **team size** affects impact efficiency
- Weights capital contributions based on **SDG alignment** and **regenerative focus**
- Enables conviction voting to optimize for impact, not just yield distribution
- **Aligns with global impact data standards** (IRIS+, IMP Five Dimensions, GRI, Hypercerts)

### 1.1 Recommended Approach Summary

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **Scoring Model** | Hybrid (Action + Outcome) | Balances immediate feedback with verified impact |
| **Team Factor** | Hybrid (Log + Threshold + Collaboration) | Captures coordination costs, growth stages, and network effects |
| **Capital Weighting** | SDG-aligned per Garden | Respects Garden mission while enabling comparison |
| **Standards Alignment** | IMP Five Dimensions + IRIS+ Core Metrics | Industry-standard credibility for funders |
| **Verification** | dMRV-inspired (Photo + IoT + Attestation) | Scalable, cost-effective, trustworthy |

---

## 2. Alignment with Global Impact Data Standards

Before defining Green Goods-specific metrics, we must understand how our framework maps to established impact measurement standards. This ensures credibility with funders, interoperability with other protocols, and alignment with SDG reporting.

### 2.1 Key Standards Landscape

| Standard | Organization | Focus | Green Goods Alignment |
|----------|--------------|-------|----------------------|
| [**IRIS+**](https://iris.thegiin.org/) | GIIN | Impact investor metrics catalog | Core metrics for each capital type |
| [**IMP Five Dimensions**](https://impactfrontiers.org/norms/) | Impact Frontiers | What, Who, How Much, Contribution, Risk | Structure for impact claims |
| [**GRI Standards**](https://www.globalreporting.org/standards/) | Global Reporting Initiative | Sustainability reporting | Environmental/social disclosures |
| [**Hypercerts**](https://www.hypercerts.org/) | Protocol Labs | Impact certificates | Tokenized impact claims |
| [**Verra/Gold Standard**](https://verra.org/programs/verified-carbon-standard/) | Carbon registries | MRV for carbon credits | Verification methodology |
| [**Theory of Change**](https://www.theoryofchange.org/) | Various | Logic model for impact | Garden-level impact pathway |

### 2.2 IMP Five Dimensions of Impact

The [Impact Management Project (IMP)](https://impactfrontiers.org/norms/) established five dimensions that are now the global consensus for describing impact. Green Goods Y2I must map to these:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     IMP FIVE DIMENSIONS → GREEN GOODS MAPPING                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. WHAT - What outcomes does the effect relate to?                         │
│     └─→ Eight Forms of Capital (Living, Material, Social, etc.)             │
│     └─→ SDG alignment (which goals does this Garden target?)                │
│     └─→ Hypercert impact scope tags                                         │
│                                                                              │
│  2. WHO - Who experiences the effect, and how underserved are they?         │
│     └─→ Garden beneficiary profiles (farmers, students, communities)        │
│     └─→ Geographic context (Global South priority)                          │
│     └─→ Stakeholder mapping per action type                                 │
│                                                                              │
│  3. HOW MUCH - Scale, Depth, Duration of impact                             │
│     └─→ SCALE: # of actions, participants, hectares, kWh                    │
│     └─→ DEPTH: Outcome multipliers (survival rate, behavior change)         │
│     └─→ DURATION: Capital decay rates (Living = 5yr, Social = 1yr)          │
│                                                                              │
│  4. CONTRIBUTION - What is the enterprise's contribution to the outcome?    │
│     └─→ Additionality: Would this happen without Green Goods funding?       │
│     └─→ Attribution: % of outcome caused by Garden vs. external factors     │
│     └─→ Y2I Ratio itself measures contribution efficiency                   │
│                                                                              │
│  5. RISK - What is the risk that impact doesn't occur as expected?          │
│     └─→ Verification confidence scores                                      │
│     └─→ Outcome multiplier variance                                         │
│     └─→ Historical Y2I volatility                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 IRIS+ Core Metrics Mapping

[IRIS+](https://iris.thegiin.org/metrics/) provides standardized metrics used by 14,000+ organizations. Green Goods actions should map to IRIS+ metrics where possible:

| Green Goods Capital | IRIS+ Category | Example IRIS+ Metrics | Green Goods Proxy |
|---------------------|----------------|----------------------|-------------------|
| **Living** | Environment | PI2764 (Land Directly Controlled: Sustainably Managed), PI1654 (Biodiversity) | Trees planted, survival rate, native species % |
| **Material** | Infrastructure | OI8869 (Clean Energy Capacity), PI4060 (Waste Diverted) | kWh generated, kg waste collected |
| **Financial** | Financial Performance | FP5755 (Client Savings), PI3468 (Loans Outstanding) | Yield generated, credit unlocked |
| **Social** | Community | OI3757 (Community Engagement), PI7098 (Civic Engagement) | Participants, collaboration events |
| **Intellectual** | Education | PI4769 (Individuals Trained), PI9652 (Completion Rate) | Workshops, certifications |
| **Experiential** | Capacity Building | OI1571 (Staff Trained) | Mentor relationships, skills transferred |
| **Cultural** | Diversity & Inclusion | OI5765 (Cultural Programs) | Traditional practices documented |
| **Spiritual** | Wellbeing | PI5490 (Client Satisfaction) | Community ceremonies, wellbeing surveys |

### 2.4 Hypercerts Metadata Integration

[Hypercerts](https://www.hypercerts.org/docs/what-are-hypercerts) use a standardized metadata schema with six required dimensions. Green Goods Y2I data feeds directly into Hypercert claims:

```json
{
  "hypercert": {
    "work_scope": ["agroforestry", "education", "solar-infrastructure"],
    "work_timeframe": ["2025-01-01", "2025-12-31"],
    "impact_scope": ["SDG-15", "SDG-7", "SDG-4"],
    "impact_timeframe": ["2025-01-01", "2030-12-31"],
    "contributors": ["garden:greenpill-nigeria", "garden:agroforestry-dao"],
    "rights": ["public-display"],

    "green_goods_extension": {
      "y2i_ratio": 2.22,
      "capital_breakdown": {
        "living": 0.42,
        "material": 0.18,
        "social": 0.15,
        "intellectual": 0.12,
        "experiential": 0.08,
        "cultural": 0.03,
        "financial": 0.02,
        "spiritual": 0.00
      },
      "verification_confidence": 0.85,
      "imp_dimensions": {
        "what": "Biodiversity restoration via native tree planting",
        "who": "Smallholder farmers in Brazilian Atlantic Forest",
        "how_much": {
          "scale": "500 trees, 50 farmers, 20 hectares",
          "depth": "85% survival rate at 12 months",
          "duration": "30+ year carbon sequestration"
        },
        "contribution": "High additionality - no existing restoration programs",
        "risk": "Low - established methodology, experienced team"
      }
    }
  }
}
```

### 2.5 ABC Impact Classification

The [IMP ABC framework](https://tideline.com/the-abcs-and-sdgs-of-classification-for-impact-investing-strategies/) classifies impact strategies. Gardens can be classified:

| Classification | Description | Garden Example |
|---------------|-------------|----------------|
| **A - Avoid Harm** | Reduce negative outcomes | Waste management preventing ocean pollution |
| **B - Benefit Stakeholders** | Create positive outcomes | Education workshops building skills |
| **C - Contribute to Solutions** | Address critical underserved needs | Solar infrastructure for energy-poor communities |

**Recommendation:** Each Garden should self-classify as A, B, or C, affecting how their Y2I is interpreted:
- **C-classified Gardens** get priority in conviction voting (addressing critical gaps)
- **A-classified Gardens** show harm reduction metrics prominently
- **B-classified Gardens** emphasize beneficiary reach

### 2.6 Theory of Change Integration

Every Garden should have a documented [Theory of Change](https://www.sopact.com/use-case/theory-of-change) that connects:

```
INPUTS → ACTIVITIES → OUTPUTS → OUTCOMES → IMPACT
```

**Green Goods Mapping:**

| ToC Element | Green Goods Equivalent | Measurement |
|-------------|----------------------|-------------|
| **Inputs** | Yield allocated, team members | Octant Vault data |
| **Activities** | Actions performed | Action registry counts |
| **Outputs** | Immediate deliverables | Base capital scores |
| **Outcomes** | Short-term changes | Outcome multipliers |
| **Impact** | Long-term transformation | Y2I Curve position |

**Recommendation:** Require each Garden to complete a Theory of Change template during onboarding. This:
- Defines their SDG weights
- Identifies key outcome indicators
- Sets baseline for Y2I tracking

---

## 3. The Eight Forms of Capital: Quantification Framework

### 3.1 Capital Taxonomy (from PRD + Regenerative Enterprise)

The Eight Forms of Capital framework was developed by [Ethan Roland and Gregory Landua](https://www.resilience.org/stories/2014-05-30/permaculture-and-the-8-forms-of-capital/) in "Regenerative Enterprise" and has become foundational in permaculture and regenerative economics.

| Capital | Description | IMP "What" | IRIS+ Alignment | Measurement Challenge |
|---------|-------------|------------|-----------------|----------------------|
| **Living** | Biodiversity, ecosystems, soil, water | Environmental outcomes | PI2764, PI1654 | Requires long-term observation |
| **Material** | Physical infrastructure, equipment, land | Built environment | OI8869, PI4060 | Relatively easy to quantify |
| **Financial** | Money, credit, investment | Economic outcomes | FP5755, PI3468 | Direct measurement |
| **Social** | Relationships, trust, networks | Social cohesion | OI3757, PI7098 | Requires network analysis |
| **Intellectual** | Knowledge, skills, data | Human capital | PI4769, PI9652 | Qualitative assessment needed |
| **Experiential** | Wisdom from practice, tacit knowledge | Capacity building | OI1571 | Hardest to quantify |
| **Cultural** | Traditions, identity, meaning | Cultural preservation | OI5765 | Context-dependent |
| **Spiritual** | Purpose, connection, meaning | Wellbeing | PI5490 | Most subjective |

### 3.2 Quantification Approaches

#### Approach A: Action-Based Scoring

Each action in the registry earns points for the capitals it creates.

**Pros:**
- ✅ Immediate feedback to Gardeners
- ✅ Predictable, gamifiable
- ✅ Easy to implement
- ✅ Encourages action volume

**Cons:**
- ❌ May incentivize gaming (quantity over quality)
- ❌ Doesn't capture actual outcomes (IMP "How Much" missing)
- ❌ Static values don't adapt to context
- ❌ Risk of "check-the-box" behavior
- ❌ Weak alignment with IRIS+ outcome metrics

---

#### Approach B: Outcome-Based Measurement

Values derived from verified outcomes rather than actions completed.

**Pros:**
- ✅ Measures actual impact (IMP "How Much" captured)
- ✅ Resistant to gaming
- ✅ Aligns incentives with real-world results
- ✅ More credible to funders (IRIS+ compatible)
- ✅ Supports dMRV integration

**Cons:**
- ❌ Delayed feedback (trees take time to grow)
- ❌ Requires sophisticated verification (sensors, satellite)
- ❌ Attribution challenges (IMP "Contribution" complex)
- ❌ Higher implementation complexity

---

#### ✅ Approach C: Hybrid Model (RECOMMENDED)

Combine action-based scoring with outcome multipliers, aligned to IMP dimensions.

**Structure:**
```
Total Capital Score = Base Action Score × Outcome Multiplier × Time Decay Factor × Verification Confidence
```

| Component | IMP Dimension | Description |
|-----------|--------------|-------------|
| **Base Action Score** | What, Who | Immediate points upon action completion |
| **Outcome Multiplier** | How Much (Depth) | Bonus when outcomes verified (0.5x to 3.0x) |
| **Time Decay Factor** | How Much (Duration) | Actions lose weight unless renewed |
| **Verification Confidence** | Risk | Adjusts for verification quality |

**Example: Planting Action (IMP-Aligned)**

| Stage | IMP Dimension | Score | Multiplier | Cumulative |
|-------|--------------|-------|------------|------------|
| Initial planting | What, Who | 40 | 1.0x | 40 |
| 3-month survival | How Much (Depth) | +20 | 1.5x | 90 |
| 12-month survival | How Much (Duration) | +30 | 2.0x | 200 |
| Fruit-bearing | Contribution | +50 | 2.5x | 375 |
| Knowledge doc created | How Much (Scale) | +70 | 1.2x | 520 |

**Why This Works:**
- ✅ Immediate feedback + long-term incentives
- ✅ Maps cleanly to IMP Five Dimensions
- ✅ IRIS+ metrics can be derived from aggregated scores
- ✅ Hypercert claims get richer metadata
- ✅ Supports [Gold Standard dMRV pilots](https://www.goldstandard.org/news/gold-standard-drives-digital-transformation-with-3-new-dmrv-pilots)

---

## 4. Yield to Impact Ratio (Y2I) - Recommended Design

### 4.1 Definition (IMP-Aligned)

The **Yield to Impact Ratio** measures impact efficiency across all five IMP dimensions:

```
Y2I = Weighted Impact Score / Total Yield Generated
```

Where **Weighted Impact Score** incorporates:

```
Impact = Σ [ Capital_i × SDG_Weight_i × Outcome_Multiplier × (1 - Risk_Discount) ]
```

### 4.2 Capital Weighting by Garden SDG Focus

**Recommendation:** Weight capitals based on Garden's primary SDG alignment, with protocol-defined templates.

| SDG Focus | Living | Material | Financial | Social | Intellectual | Experiential | Cultural | Spiritual |
|-----------|--------|----------|-----------|--------|--------------|--------------|----------|-----------|
| Climate Action (SDG 13) | 0.25 | 0.20 | 0.10 | 0.10 | 0.15 | 0.10 | 0.05 | 0.05 |
| Life on Land (SDG 15) | 0.30 | 0.10 | 0.05 | 0.15 | 0.15 | 0.15 | 0.05 | 0.05 |
| Affordable Energy (SDG 7) | 0.05 | 0.30 | 0.15 | 0.15 | 0.20 | 0.10 | 0.03 | 0.02 |
| Quality Education (SDG 4) | 0.05 | 0.05 | 0.05 | 0.20 | 0.35 | 0.20 | 0.05 | 0.05 |
| Responsible Consumption (SDG 12) | 0.10 | 0.30 | 0.15 | 0.15 | 0.15 | 0.10 | 0.03 | 0.02 |
| Reduced Inequalities (SDG 10) | 0.05 | 0.10 | 0.20 | 0.25 | 0.15 | 0.10 | 0.10 | 0.05 |
| Zero Hunger (SDG 2) | 0.25 | 0.15 | 0.15 | 0.15 | 0.10 | 0.10 | 0.05 | 0.05 |
| Balanced/General | 0.125 | 0.125 | 0.125 | 0.125 | 0.125 | 0.125 | 0.125 | 0.125 |

### 4.3 Verification Confidence Score

Aligned with [Verra VCS](https://verra.org/programs/verified-carbon-standard/) and [Gold Standard](https://www.goldstandard.org/) MRV principles:

| Verification Level | Confidence | Methods | Use Case |
|-------------------|------------|---------|----------|
| **Self-reported** | 0.5 | Photo + description only | Low-stakes actions |
| **Operator verified** | 0.7 | Steward review + approval | Standard actions |
| **IoT/dMRV** | 0.85 | Sensor data (M3tering, satellite) | Material capital |
| **Third-party audit** | 0.95 | Independent evaluator | High-value outcomes |
| **On-chain proof** | 1.0 | Validator attestation, tx receipt | Financial capital |

---

## 5. Team Size Factor Models

### 5.1 Model Options Analysis

| Model | Formula | Pros | Cons |
|-------|---------|------|------|
| **A. Per-Capita** | Y2I / n | Simple, fair comparison | Ignores coordination benefits |
| **B. Logarithmic** | Y2I / log₂(n+1) | Reflects coordination costs | May discourage growth |
| **C. Threshold** | Y2I × Milestone | Rewards growth stages | Arbitrary thresholds |
| **D. Collaboration** | Y2I × (1 + Collab × Network) | Rewards actual collaboration | Complex to measure |

### 5.2 ✅ Recommended: Hybrid Team Model

```
Team Factor = (1 / log₂(n+1)) × MilestoneBonus(n) × (1 + CollabScore × NetworkFactor)
```

**Milestone Bonuses (Research-Backed):**

| Team Size | Multiplier | Rationale |
|-----------|------------|-----------|
| 1-4 | 1.0x | Solo/micro team baseline |
| 5-9 | 1.2x | "Pizza team" - enables specialization |
| 10-24 | 1.4x | "Squad" - community identity emerges |
| 25-49 | 1.3x | Coordination overhead begins |
| 50-99 | 1.2x | Requires formal processes |
| 100+ | 1.1x | Large org dynamics |

**Collaboration Score Calculation:**

```
CollabScore = (Cross-Garden Actions / Total Actions) × (Unique Partner Gardens / 5)
```

Capped at 1.0, rewards inter-Garden cooperation.

---

## 6. Yield to Impact Curve (Y2I Curve)

### 6.1 Definition

The **Y2I Curve** models non-linear impact growth over time:

```
Impact(t) = f(Yield(t), Capital(t), Team(t), Time)
```

### 6.2 Capital Decay Rates (Aligned to IMP Duration)

| Capital | Decay Half-Life | IRIS+ Reference | Rationale |
|---------|----------------|-----------------|-----------|
| Living | 5 years | PI2764 monitoring | Trees persist, biodiversity stable |
| Material | 2 years | OI8869 depreciation | Infrastructure depreciates |
| Financial | 6 months | FP5755 cycles | Yield cycles, market volatility |
| Social | 1 year | OI3757 engagement | Relationships need maintenance |
| Intellectual | 3 years | PI4769 relevance | Knowledge can become outdated |
| Experiential | 4 years | OI1571 retention | Wisdom endures |
| Cultural | 10 years | OI5765 persistence | Traditions are sticky |
| Spiritual | ∞ (no decay) | PI5490 baseline | Meaning is eternal |

### 6.3 Curve Shape by Garden Stage

```
                   IMPACT
                     │
                     │                    ╭─── Mature Garden (high living capital)
                     │               ╭────╯
                     │          ╭────╯
                     │     ╭────╯        ╭─── Growth Garden (high social/intellectual)
                     │╭────╯       ╭─────╯
                     │╯      ╭─────╯
                     │  ╭────╯            ╭─── New Garden (linear phase)
                     │──╯           ╭─────╯
                     │         ╭────╯
                     │    ╭────╯
                     │────╯
                     └──────────────────────────────────── YIELD
```

| Stage | Duration | Curve Shape | Y2I Trend |
|-------|----------|-------------|-----------|
| Seed | 0-6 months | Linear | ~1.0 |
| Sprout | 6-18 months | Slightly superlinear | 1.0-1.5 |
| Growth | 18-36 months | Strongly superlinear | 1.5-3.0 |
| Mature | 36+ months | S-curve plateau | 2.5-4.0 (stable) |

---

## 7. Action-to-Capital Mapping (PRD-Grounded)

### 7.1 Core Actions Scoring Matrix

| Action ID | Action | L | Ma | Fi | So | In | Ex | Cu | Sp | Total | IRIS+ Metrics |
|-----------|--------|---|----|----|----|----|----|----|----|----|---------------|
| ACT-001 | Planting | 20 | 5 | 0 | 5 | 0 | 10 | 0 | 5 | 45 | PI2764, PI1654 |
| ACT-002 | Identify Plant | 15 | 0 | 0 | 5 | 15 | 10 | 0 | 0 | 45 | PI1654 |
| ACT-003 | Watering | 10 | 5 | 0 | 0 | 0 | 5 | 0 | 0 | 20 | PI2764 |
| ACT-004 | Harvesting | 10 | 10 | 10 | 5 | 5 | 10 | 0 | 0 | 50 | FP5755, PI2764 |
| ACT-005 | Waste Cleanup | 5 | 25 | 0 | 15 | 0 | 10 | 0 | 0 | 55 | PI4060 |
| ACT-006 | Web3 Workshop | 0 | 0 | 0 | 15 | 30 | 10 | 0 | 0 | 55 | PI4769, PI9652 |

### 7.2 Domain-Specific Actions

| Action ID | Action | L | Ma | Fi | So | In | Ex | Cu | Sp | Total | Domain |
|-----------|--------|---|----|----|----|----|----|----|----|----|--------|
| ACT-101 | Solar Hub Session | 0 | 25 | 5 | 15 | 15 | 10 | 0 | 0 | 70 | Energy |
| ACT-102 | Node Deployment | 0 | 30 | 20 | 0 | 20 | 10 | 0 | 0 | 80 | Energy |
| ACT-201 | Waste Sorting | 0 | 20 | 5 | 10 | 15 | 10 | 0 | 0 | 60 | Waste |
| ACT-301 | Tree Assignment | 15 | 0 | 0 | 20 | 10 | 10 | 15 | 5 | 75 | Agroforestry |
| ACT-302 | Knowledge Doc | 0 | 0 | 0 | 10 | 30 | 20 | 25 | 0 | 85 | Agroforestry |
| ACT-501 | Farm Registration | 15 | 15 | 10 | 5 | 10 | 5 | 0 | 0 | 60 | Credit |
| ACT-502 | Commitment Fulfilled | 0 | 10 | 30 | 15 | 5 | 10 | 0 | 0 | 70 | Credit |

### 7.3 Outcome Multipliers (IMP "How Much")

| Outcome | Actions | Multiplier | Verification | IMP Mapping |
|---------|---------|------------|--------------|-------------|
| 3-month survival | Planting | 1.5x | Photo | Depth |
| 12-month survival | Planting | 2.5x | Photo + Silvi | Duration |
| Fruit-bearing | Planting | 3.0x | Harvest doc | Scale × Depth |
| 100kg+ cleanup | Waste | 1.5x | Recycler receipt | Scale |
| 1000kg+ diversion | Waste | 2.0x | Facility confirm | Scale × Duration |
| Node >99% uptime | Node | 1.5x | Validator attest | Depth |
| >10 participants | Workshop | 1.3x | Photos | Scale |
| Commitment fulfilled | Farm | 2.5x | Admin verify | Contribution |

---

## 8. Implementation Architecture

### 8.1 Data Pipeline (Standards-Aligned)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Y2I COMPUTATION PIPELINE (v1)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ACTION INGESTION                                                         │
│     ├─ Receive action from PWA/AI Agent                                     │
│     ├─ Validate against Action Schema Registry                              │
│     ├─ Extract IMP dimensions (What, Who)                                   │
│     ├─ Assign base capital scores                                           │
│     └─ Write to Envio + IPFS                                                │
│                                                                              │
│  2. CAPITAL SCORING (IMP "How Much")                                         │
│     ├─ Load Garden Theory of Change + SDG weights                           │
│     ├─ Apply base scores per capital                                        │
│     ├─ Apply time decay (IMP Duration)                                      │
│     └─ Sum weighted capital scores                                          │
│                                                                              │
│  3. OUTCOME VERIFICATION (IMP "Contribution" + "Risk")                       │
│     ├─ Check EAS attestations from Operators/Evaluators                     │
│     ├─ Query dMRV sources (M3tering, Silvi, satellite)                      │
│     ├─ Calculate verification confidence                                    │
│     ├─ Apply outcome multipliers                                            │
│     └─ Adjust for risk discount                                             │
│                                                                              │
│  4. TEAM FACTOR                                                              │
│     ├─ Count active members (30-day window)                                 │
│     ├─ Calculate collaboration score                                        │
│     ├─ Apply hybrid team model                                              │
│     └─ Compute team-adjusted impact                                         │
│                                                                              │
│  5. Y2I CALCULATION                                                          │
│     ├─ Query Octant Vault yield                                             │
│     ├─ Calculate Y2I ratio                                                  │
│     ├─ Update Y2I Curve data point                                          │
│     └─ Determine ABC classification                                         │
│                                                                              │
│  6. STANDARDS EXPORT                                                         │
│     ├─ Generate IRIS+ compatible metrics                                    │
│     ├─ Update Hypercert metadata                                            │
│     ├─ Produce GRI-aligned disclosures                                      │
│     └─ Feed conviction voting UI                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Envio Schema Additions

```graphql
type Garden {
  id: ID!
  # ... existing fields ...

  # Y2I Metrics
  y2iRatio: Float!
  y2iCurveData: [Y2IDataPoint!]!
  capitalBreakdown: CapitalBreakdown!

  # Standards Alignment
  theoryOfChange: TheoryOfChange!
  sdgFocus: [SDGGoal!]!
  abcClassification: ABCClass!
  impDimensions: IMPDimensions!
}

type Y2IDataPoint {
  timestamp: BigInt!
  yieldCumulative: BigDecimal!
  impactCumulative: BigDecimal!
  y2iRatio: Float!
  teamSize: Int!
  verificationConfidence: Float!
}

type CapitalBreakdown {
  living: Float!
  material: Float!
  financial: Float!
  social: Float!
  intellectual: Float!
  experiential: Float!
  cultural: Float!
  spiritual: Float!
}

type IMPDimensions {
  what: String!           # Impact scope description
  who: String!            # Beneficiary description
  howMuchScale: String!   # Scale metrics
  howMuchDepth: Float!    # Outcome multiplier achieved
  howMuchDuration: String! # Expected persistence
  contribution: String!   # Additionality statement
  riskLevel: RiskLevel!   # LOW, MEDIUM, HIGH
}

enum ABCClass {
  A_AVOID_HARM
  B_BENEFIT_STAKEHOLDERS
  C_CONTRIBUTE_TO_SOLUTIONS
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
}
```

### 8.3 Hypercert Integration

When a Garden claims a Hypercert, automatically populate:

```typescript
interface HypercertY2IExtension {
  // Core Y2I
  y2i_ratio: number;
  y2i_trend: 'improving' | 'stable' | 'declining';
  capital_breakdown: Record<Capital, number>;

  // IMP Five Dimensions
  imp_what: string;
  imp_who: {
    beneficiaries: string;
    underserved_score: number; // 0-1, higher = more underserved
  };
  imp_how_much: {
    scale: string;
    depth: number;
    duration: string;
  };
  imp_contribution: {
    additionality: 'high' | 'medium' | 'low';
    attribution_percentage: number;
  };
  imp_risk: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };

  // Standards References
  iris_metrics: string[]; // e.g., ["PI2764", "PI1654"]
  sdg_alignment: string[]; // e.g., ["SDG-15", "SDG-13"]
  gri_disclosures: string[]; // e.g., ["GRI 304-3", "GRI 305-5"]

  // Verification
  verification_confidence: number;
  verification_methods: string[];
  last_audit_date?: string;
}
```

---

## 9. Example Scenarios (Updated)

### 9.1 Scenario: Greenpill Nigeria (Tech & Sun)

**Garden Profile:**
- SDG Focus: Affordable Energy (SDG 7)
- ABC Class: **C - Contribute to Solutions** (energy access for underserved)
- Team Size: 15 active members
- Monthly Yield: $600

**IMP Dimensions:**
- **What:** Clean energy access + digital infrastructure
- **Who:** Nigerian university students (high underserved score: 0.8)
- **How Much:** 30 hub sessions, 500 kWh generated, 200 users
- **Contribution:** High additionality - no grid access alternative
- **Risk:** Low - established technology, experienced team

**Capital Breakdown:**
| Capital | Raw Score | Weight (SDG 7) | Weighted | IRIS+ Metric |
|---------|-----------|----------------|----------|--------------|
| Living | 0 | 0.05 | 0 | - |
| Material | 2,250 | 0.30 | 675 | OI8869 |
| Financial | 400 | 0.15 | 60 | FP5755 |
| Social | 900 | 0.15 | 135 | OI3757 |
| Intellectual | 1,200 | 0.20 | 240 | PI4769 |
| Experiential | 580 | 0.10 | 58 | OI1571 |
| Cultural | 50 | 0.03 | 1.5 | - |
| Spiritual | 0 | 0.02 | 0 | - |
| **Total** | 5,380 | 1.00 | **1,169.5** | |

**Team Factor:** 0.44 (hybrid model)
**Verification Confidence:** 0.85 (IoT meter data)
**Risk Discount:** 0.05 (low risk)

**Y2I Calculation:**
```
Y2I = (1,169.5 × 0.44 × 0.85 × 0.95) / 600
Y2I = 416.2 / 600
Y2I = 0.69
```

**Interpretation:** Below 1.0 efficiency, but this is a **C-class Garden** addressing critical energy poverty. The low Y2I reflects high infrastructure costs (Material capital dominates) but high social value.

---

### 9.2 Scenario: Greenpill Brasil (AgroforestryDAO)

**Garden Profile:**
- SDG Focus: Life on Land (SDG 15)
- ABC Class: **C - Contribute to Solutions** (biodiversity restoration)
- Team Size: 8 active members
- Monthly Yield: $400

**IMP Dimensions:**
- **What:** Native forest restoration + intergenerational knowledge
- **Who:** Smallholder farmers, Atlantic Forest (critically endangered biome)
- **How Much:** 500 trees (85% survival), 50 farmers, 20 hectares
- **Contribution:** Very high additionality - no government programs
- **Risk:** Low - 30-year methodology, local expertise

**Capital Breakdown (with outcome multipliers):**
| Capital | Raw Score | Outcome Mult | Weight (SDG 15) | Weighted |
|---------|-----------|--------------|-----------------|----------|
| Living | 4,200 | 2.5x | 0.30 | 3,150 |
| Material | 600 | 1.0x | 0.10 | 60 |
| Financial | 0 | 1.0x | 0.05 | 0 |
| Social | 1,100 | 1.0x | 0.15 | 165 |
| Intellectual | 1,800 | 2.0x | 0.15 | 540 |
| Experiential | 1,500 | 1.0x | 0.15 | 225 |
| Cultural | 600 | 2.0x | 0.05 | 60 |
| Spiritual | 100 | 1.0x | 0.05 | 5 |
| **Total** | 9,900 | - | 1.00 | **4,205** |

**Team Factor:** 0.44
**Verification Confidence:** 0.85 (Photo + Silvi integration)
**Risk Discount:** 0.02 (very low risk)

**Y2I Calculation:**
```
Y2I = (4,205 × 0.44 × 0.85 × 0.98) / 400
Y2I = 1,541.8 / 400
Y2I = 3.85
```

**Interpretation:** Exceptional Y2I of 3.85! High outcome multipliers from verified tree survival and knowledge documentation. This Garden demonstrates that Living capital compounds over time.

---

## 10. Recommendations Summary

### 10.1 Immediate Implementation (v1)

| Component | Recommendation | Rationale |
|-----------|---------------|-----------|
| **Scoring** | Hybrid (Action + Outcome) | Balances feedback with verification |
| **Team Factor** | Hybrid (Log + Threshold + Collab) | Comprehensive team dynamics |
| **Weighting** | SDG-based per Garden | Respects mission diversity |
| **Verification** | 4-tier confidence scoring | Scalable trust model |
| **Standards** | IMP Five Dimensions | Global credibility |

### 10.2 Data Model Requirements

1. **Theory of Change** - Required at Garden onboarding
2. **SDG Selection** - Primary + secondary SDG alignment
3. **ABC Classification** - Self-declared impact class
4. **Outcome Tracking** - Milestones for each action type
5. **Collaboration Events** - Cross-garden action logging

### 10.3 Dashboard Metrics

| Metric | Display | Audience |
|--------|---------|----------|
| Current Y2I | Large number + trend arrow | Gardeners |
| Capital Breakdown | Radar chart | Gardeners, Funders |
| Y2I Curve | Line chart over time | Funders |
| IMP Summary | 5 dimension cards | Funders, Evaluators |
| IRIS+ Export | Download button | Institutional funders |

### 10.4 Conviction Voting Integration

```
Effective Conviction = Raw Conviction × (Garden Y2I / Protocol Avg Y2I) × ABC Boost
```

Where ABC Boost:
- A (Avoid Harm): 1.0x
- B (Benefit): 1.1x
- C (Contribute to Solutions): 1.2x

---

## 11. Appendix: Formulas Reference

### A. Basic Y2I Ratio
```
Y2I = Σ(Capital_i × Weight_i × OutcomeMult_i × TeamFactor × VerifConf × (1 - RiskDiscount)) / Yield
```

### B. Capital Accumulation (IMP Duration)
```
Capital_i(t) = Σ[Action_Score_i(τ) × e^(-λ_i(t-τ))] × Outcome_Multiplier(t)
```

### C. Team Factor (Recommended Hybrid)
```
TeamFactor = (1 / log₂(n+1)) × MilestoneBonus(n) × (1 + CollabScore × NetworkFactor(n))
```

### D. Verification Confidence
```
VerifConf = BaseConf(method) × AuditRecency × HistoricalAccuracy
```

### E. ABC Conviction Boost
```
EffectiveConviction = RawConviction × (Y2I / AvgY2I) × ABCBoost
```

---

## 12. References & Sources

### Impact Standards
- [IRIS+ Catalog of Metrics](https://iris.thegiin.org/metrics/) - GIIN
- [Impact Management Norms](https://impactfrontiers.org/norms/) - Impact Frontiers
- [Five Dimensions of Impact](https://www.sopact.com/use-case/five-dimensions-of-impact) - SoPact
- [GRI Standards 2025](https://www.globalreporting.org/standards/) - Global Reporting Initiative

### Verification & MRV
- [Verra Verified Carbon Standard](https://verra.org/programs/verified-carbon-standard/)
- [Gold Standard dMRV Pilots](https://www.goldstandard.org/news/gold-standard-drives-digital-transformation-with-3-new-dmrv-pilots)
- [Carbon Crediting Data Framework](https://rmi.org/carbon-crediting-data-framework/) - RMI

### Impact Certificates
- [Hypercerts Documentation](https://www.hypercerts.org/docs/what-are-hypercerts)
- [Hypercerts Metadata Standard](https://hypercerts.on.fleek.co/docs/implementation/metadata/)
- [EAS as Hypercerts Metadata](https://github.com/hypercerts-org/HIPs/discussions/4)

### Regenerative Economics
- [Eight Forms of Capital](https://www.resilience.org/stories/2014-05-30/permaculture-and-the-8-forms-of-capital/) - Ethan Roland & Gregory Landua
- [Regenerative Enterprise](https://www.lulu.com/shop/gregory-landua-and-ethan-roland/regenerative-enterprise-optimizing-for-multi-capital-abundance/ebook/product-16r59pmw.html)
- [Theory of Change Guide](https://www.sopact.com/use-case/theory-of-change) - SoPact

### ABC Classification
- [The ABCs of Impact Classification](https://tideline.com/the-abcs-and-sdgs-of-classification-for-impact-investing-strategies/) - Tideline

---

*End of Exploration Document*

**Document Version:** 2.0
**Last Updated:** January 20, 2026
**Status:** Recommendations Finalized - Ready for Implementation Spec

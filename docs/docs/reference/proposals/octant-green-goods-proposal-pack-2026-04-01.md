---
title: "Octant x Green Goods Proposal Pack"
slug: /reference/proposals/octant-green-goods-proposal-pack-2026-04-01
sidebar_label: Octant Proposal Pack
audience: developer
owner: docs
last_verified: 2026-04-01
feature_status: Planned
source_of_truth:
  - docs/src/data/endpoints.ts
  - packages/indexer/schema.graphql
---

# Octant x Green Goods Proposal Pack

Date: 2026-04-01

## Current Live Data Snapshot

Source of live garden data: production Green Goods indexer from `docs/src/data/endpoints.ts`, queried on 2026-04-01.

Current indexed garden state:

- Arbitrum production (`42161`): 13 live gardens
- Celo (`42220`): 0 live gardens
- Sepolia (`11155111`): 3 test gardens

Arbitrum production role totals:

- Gardeners: 50
- Operators: 26
- Evaluators: 19

Arbitrum production domain coverage by garden domain mask:

- Education: 12 of 13 gardens
- Agroforestry: 10 of 13 gardens
- Solar: 7 of 13 gardens
- Waste: 7 of 13 gardens

Important live-data takeaways:

- Uganda does not appear in the current live garden set.
- Education is not just a standalone domain in the live data. It is the most common cross-cutting layer across current gardens.
- The current live set is broader than the older narrative. Beyond Nigeria, Cape Town, and Brazil, the production set also includes Kenya, Thailand, Sicily, Taiwan, Canada, and Barcelona.
- Some domain masks do not cleanly match garden descriptions. That is not just a metadata issue. It is evidence that Green Goods still needs stronger domain calibration, operator tooling, and evaluator guidance.

Selected live gardens most relevant to the Octant story:

| Garden | Location | Current live domains | Why it matters for the proposal |
|---|---|---|---|
| TAS HUB | Awka, Nigeria | Solar, Education | Strongest current bridge between Ethereum-native infrastructure, education, and real-world utility. |
| Muizenberg Community Garden | Muizenberg, Cape Town, South Africa | Agroforestry, Education, Waste | Strong circular-economy and community composting story tied to local food and waste flows. |
| AgroforestDAO | Lima Duarte, Minas Gerais | Agroforestry, Education | Strong regenerative knowledge-transfer and agroforestry culture story in Brazil. |
| Growecosystems | Rio Claro, São Paulo, Brazil | Solar, Agroforestry, Education, Waste | Useful multi-domain urban hub example showing why cross-domain reporting matters. |
| Greenpill Kenya | Kenya | Education, Waste | Better current education-domain reference than the older Uganda framing. |
| ReFi Barcelona | Barcelona | Education | Clean education-focused example for workshop, curriculum, and community onboarding metrics. |

Live-data caveat worth using in the pitch:

- The current data shows why Green Goods should not oversell a single universal impact number.
- Domain choice, metric maturity, and operator configuration still need hardening.
- That supports an Octant proposal centered on compliance infrastructure, evaluator networks, and bioregional calibration rather than just dashboards.

## One-Page Narrative

### From Yield to Regenerative Compliance

Green Goods should pitch Octant on a simple idea: Octant supplies the capital-preserving funding engine, and Green Goods supplies the regenerative compliance layer that makes real-world work legible, verifiable, and fundable across bioregions.

This framing fits the current state of both systems. Octant is moving toward modular, institutional-grade funding infrastructure built around vaults, routing, and allocation. Green Goods is already designed as an offline-first, role-based verification system for community work, where gardeners document evidence, operators review it, evaluators certify it, and funders can trace what happened. The overlap is not abstract. It is operational.

The live Green Goods garden data strengthens this pitch. As of April 1, 2026, the production indexer shows 13 live gardens on Arbitrum, with the strongest current stories clustered around Nigeria, Cape Town, Brazil, and Kenya. The most important pattern in the live set is that education appears in 12 of 13 gardens. That suggests Green Goods should not frame education only as one separate domain. Education is the connective tissue that helps communities adopt Ethereum-native tools, learn stewardship practices, and translate complex funding systems into usable local workflows.

That matters for Octant because Octant needs more than projects asking for money. It needs credible pathways from capital to outcomes. Green Goods can offer that by turning domain-specific field activity into compliance-grade records. In Nigeria, that can mean solar infrastructure plus education through TAS HUB. In Cape Town, it can mean waste diversion, composting, and community food systems. In Brazil, it can mean agroforestry, biodiversity, and knowledge transfer. The same reporting structure can hold across these contexts, while the metrics and evaluator methods change by domain and bioregion.

This is where the proposal should be precise. Green Goods should not claim to invent all the metrics from scratch. It should claim to operationalize existing methods into trusted workflows. The problem funders, operators, and evaluators repeatedly face is not the total absence of frameworks. It is that the reporting burden is fragmented, trust is brittle, data gets lost or manipulated, and local practitioners are forced into tools that do not match their realities. Green Goods, paired with Octant vault infrastructure, can reduce that friction.

The strongest proposal therefore has three layers. First, build the compliance layer: domain templates, role-based approvals, exportable reporting, and attestation-backed evidence. Second, mature the metric layer: evaluator networks, domain methods, and bioregional calibration for solar, waste, agroforestry, and education. Third, prove a funding layer: use Octant-powered vaults to route yield into selected gardens and track domain-specific yield efficiency over time. That is the real meaning of yield-to-impact here. Not a single magic ratio, but a disciplined family of domain-specific efficiency measures grounded in real work.

Green Goods should also position itself as helping projects reach escape velocity. The goal is not permanent dependency on impact funders. The goal is to help gardens build enough trust, working capital, endowment support, local circulation, and community participation that they rely less on external subsidy over time. That gives Octant a stronger story as well: not just funding public goods, but helping communities mature into durable regenerative economies.

The right ask is for Octant to fund Green Goods as a regenerative compliance and adaptive funding partner. Green Goods would harden the tooling, mature the evaluator and metric layer, and prove the model across a small number of strong live contexts. The best initial portfolio is Nigeria solar plus education, Cape Town waste plus community stewardship, and Brazil agroforestry plus knowledge transfer, with Kenya as a current education and community-programming reference point. That is narrow enough to execute and broad enough to show Octant why this can become a category-defining use case for its v2 infrastructure.

## Deck Outline

1. Problem
   Real-world regenerative work is hard to fund because compliance is fragmented, admin-heavy, and poorly matched to local operators.

2. Why Now
   Octant is evolving into modular ecosystem funding infrastructure, and Green Goods now has a live garden base that can test this in production contexts.

3. Current Live Footprint
   Show the April 1, 2026 snapshot: 13 Arbitrum gardens, no Uganda in the current live set, strongest live stories in Nigeria, Cape Town, Brazil, and Kenya.

4. Core Insight
   Education is the connective layer across the live garden set, not just a separate domain. That makes Ethereum-native literacy and stewardship education central to adoption.

5. Product Thesis
   Octant is the funding spine. Green Goods is the regenerative compliance layer.

6. Role Architecture
   Funder, evaluator, operator, gardener, and community member are not personas only. They are product surfaces and compliance responsibilities.

7. Bioregional Measurement
   Keep a shared reporting structure, but calibrate metrics by domain and place. Same system, different methods.

8. Proposal Modules
   Compliance infrastructure, metric and evaluator maturation, yield-to-impact reporting, and limited pilot funding flows.

9. Pilot Portfolio
   TAS HUB in Nigeria, Muizenberg in Cape Town, AgroforestDAO and Growecosystems in Brazil, with Kenya as the current education reference.

10. Ask
   Fund Green Goods as a strategic Octant implementation partner to harden tooling, mature metrics, and prove a bioregional funding model.

## Proposal Matrix

| Angle | What Octant gets | What Green Goods gets | Evidence from current live data | Risk | Recommendation |
|---|---|---|---|---|---|
| Compliance Infrastructure | A clear institutional story beyond vault mechanics | Strongest immediate fit for current product | Live gardens already have role-based coordination and domain framing | Can sound unambitious if framed as reporting only | Lead with this |
| Yield-to-Impact KPI Layer | A native efficiency story tied to vault yield | Better funder language and measurement discipline | TAS HUB, Muizenberg, AgroforestDAO, and Growecosystems can anchor different KPI families | Too abstract if pushed as one master number | Make it domain-specific |
| Metrics Maturation + Evaluator Network | Better legitimacy and lower risk for future rounds | Funds the hard work Green Goods actually needs | Domain-mask inconsistencies show taxonomy and method maturity gaps today | Slower to demo than a UI feature | Bundle into core ask |
| Bioregional Funding OS | Long-term strategic narrative for watershed or regional funds | Positions Green Goods above the garden level | Live garden set already spans multiple ecological and cultural contexts | Too large for phase one | Position as phase two |
| Reputation-Weighted Steward Funding | Novel allocation primitive for people, not just projects | Strong alignment with role-based trust and recurring stewardship | Current role architecture supports it conceptually | Social legitimacy and scoring are the hard part | Keep as bounded R&D, not main ask |

## Messaging By Role

| Role | What they care about | Message to use |
|---|---|---|
| Funder | Trust, efficiency, comparability, reduced admin burden | Green Goods turns local work into compliance-grade evidence that can safely unlock Octant-powered funding. |
| Evaluator | Method rigor, defensible review, less manual reconciliation | Green Goods does not replace evaluators. It gives them better evidence, cleaner workflows, and configurable domain methods. |
| Operator | Usable tools, manageable approval burden, clear templates | Operators get structured workflows that translate funder requirements into field-ready actions. |
| Gardener | Simplicity, language access, dignity of small work | Impact reporting becomes simple enough to use in real conditions, with clear recognition for work completed. |
| Community member | Local trust, transparency, and value circulation | Green Goods helps communities see, govern, and retain more of the value they create. |

## Recommended Ask Structure

1. Fund Green Goods as Octant's regenerative compliance and adaptive funding partner.
2. Start with a narrow live portfolio: Nigeria, Cape Town, Brazil, and Kenya.
3. Deliver domain templates, evaluator methods, and exportable compliance outputs.
4. Pilot domain-specific yield-efficiency reporting instead of a single impact score.
5. Treat bioregional funds and steward-weighted flows as phase-two experiments.

## Notes For Revision

- If the audience is Eugene or an Octant product-strategy stakeholder, emphasize modular infrastructure, funder clarity, and measurable learning loops.
- If the audience is more ecosystem-facing, emphasize Ethereum adoption through education, real-world stewardship, and local-first trust.
- If the audience is traditional impact or climate-adjacent, emphasize compliance, evaluator methods, and reduced administrative burden.

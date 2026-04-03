# Plan: Regenerative Design — The 4th Design Lens

## Context

Green Goods' design system has three lenses: Adaptive Surface (information hierarchy), Inclusive Design (accessibility), Ecosystem Thinking (relational architecture). These answer *how*, *who*, and *whose*. A 4th lens — Regenerative Design — answers **does this grow the whole?** This is uniquely native to Green Goods: the platform documents regenerative work, uses the Eight Forms of Capital framework (born from regenerative design theory), and names its primary users "gardeners." No authoritative digital regenerative design framework exists — this is genuinely new territory.

The lens is grounded in Bill Reed & Pamela Mang's Trajectory of Ecological Design, Carol Sanford's Four Paradigms, John T. Lyle's cyclical flows, and Roland & Landua's Eight Forms of Capital.

## Files Modified

| File | Change |
|------|--------|
| `.claude/skills/design/regenerative.md` | **New file** — full 4th lens with framework, patterns, checklist |
| `.claude/skills/design/SKILL.md` | Add to activation table, foundation section, decision tree, "when invoked" |
| `.claude/skills/design/references.md` | Add regenerative design sources |

## Phase 1: Create `regenerative.md`

Follow the 7-part structure matching `ecosystem.md` conventions. Key sections:

### 1. Header & Intro
- "Regenerative Design — Growing the Whole"
- Position as the lens that asks: *does this interaction leave users, communities, and the system more capable than before?*
- Connect to other 3 lenses: Adaptive Surface (how), Inclusive (who), Ecosystem (whose), Regenerative (to what end?)

### 2. The Reed Trajectory (Core Framework)
Table mapping 5 levels — Conventional → Green → Sustainable → Restorative → Regenerative — with:
- Digital design examples at each level
- Green Goods examples showing where features sit on the trajectory
- The key dividing line: Technical System Design (levels 1-3) vs. Living System Design (levels 4-5)

### 3. Three Core Principles
Distilled from Reed/Mang, Sanford, and Lyle:

1. **Cyclical over linear** (Lyle) — Replace source-to-sink flows with cycles that compound value. Green Goods already does this: work → attestation → Hypercert → funding → more work. Design should make these cycles visible and reinforce them.

2. **Place-sourced over standardized** (Reed/Mang) — Design from the unique potential of each garden community, not generic "best practices." What TAS HUB in Nigeria needs differs from AgroforestDAO in Brazil — not because of constraints (Inclusive Design handles that) but because their *generative potential* is different.

3. **Capacity-building over problem-solving** (Sanford) — Move from Sanford's "Arrest Disorder" paradigm (fix problems) to "Regenerate Life" (grow potential). Every feature should be assessed: does it merely fix a problem, or does it build the community's capacity to evolve on its own?

### 4. The Levels of Work (Design Decision Hierarchy)
From Mang & Reed — apply to every design decision:

| Level | Question | Example |
|-------|----------|---------|
| **Operate** | Does this apply the default? | Using a generic approval flow |
| **Maintain** | Does this keep things consistent? | Matching existing UI patterns |
| **Improve** | Does this enhance current performance? | Making batch approvals faster |
| **Regenerate** | Does this build capacity for the system to evolve? | Enabling gardeners to develop expertise that unlocks new roles |

### 5. Eight Forms of Capital as Design Metric
Already in codebase (`design-research.md:68-86`). Formalize as a design assessment: every major feature should declare which capitals it grows and which it might extract. A regenerative feature grows more capitals than it costs.

Capital impact table pattern for features.

### 6. The Gardener-Not-Engineer Metaphor
From Mang & Reed's four premises. The designer is a facilitator of emergent capacity, not controller of predetermined outcomes. For UI: design for emergence (what communities might do) not just efficiency (what we want them to do).

Connect to: the platform literally names its users "gardeners" — this is not metaphor, it is identity.

### 7. Anti-Patterns: Extractive Design Patterns
Map common digital anti-patterns to the trajectory:
- Attention harvesting = Conventional (extraction)
- Engagement metrics without outcome metrics = Green (less bad, still extractive)
- "Net-zero" data practices = Sustainable (neutral, not growing)
- Error recovery = Restorative (fixes damage, doesn't build capacity)
- Work documentation that compounds into portable reputation = Regenerative

### 8. Regenerative Readiness Checklist
7-item checklist matching ecosystem.md format:
- [ ] Cyclical value flow? (does output become input for the next cycle?)
- [ ] Place-sourced? (adapted to the specific garden community, not generic?)
- [ ] Capacity-building? (leaves users more capable, not just served?)
- [ ] Multi-capital impact? (grows more than one Form of Capital?)
- [ ] Emergence-enabling? (creates conditions for unexpected positive outcomes?)
- [ ] Non-extractive? (doesn't harvest attention/data without returning value?)
- [ ] Trajectory-aware? (team knows where this pattern sits on the Reed trajectory?)

### 9. When to Apply & References

## Phase 2: Update `SKILL.md`

### Activation Table
Add row after Ecosystem:
```
| **Regenerative** | regenerative, cyclical, capital forms, place-sourced, capacity, trajectory | [regenerative.md](./regenerative.md) |
```

### Foundation Section
"Triple Foundation" → "Four Foundations". Add 4th section:

```markdown
### Regenerative Design

The interface should leave users, communities, and systems more capable than before interaction. Based on Reed & Mang's Trajectory of Ecological Design, Sanford's regenerative paradigm, and Roland & Landua's Eight Forms of Capital.

- **Cyclical over linear** — Replace source-to-sink flows with cycles that compound value. Work → attestation → Hypercert → funding → more work. Make these cycles visible.
- **Place-sourced over standardized** — Design from each garden community's unique generative potential, not from generic patterns.
- **Capacity-building over problem-solving** — Every feature should build the community's ability to evolve on its own, not just fix the current problem.

Full framework, trajectory assessment, and capital impact patterns: [regenerative.md](./regenerative.md)
```

### Decision Tree
Add branch:
```
├─► Assessing feature impact?
│   ├── Place on Reed trajectory (conventional → regenerative) → regenerative.md
│   ├── Map capital impact across Eight Forms
│   ├── Check: cyclical flow or linear extraction?
│   └── Run Regenerative Readiness Checklist → regenerative.md
```

### When Invoked
Add step 4 (renumber existing 4-5 to 5-6):
```
4. Apply Regenerative lens — does this grow capacity or merely solve a problem? ([regenerative.md](./regenerative.md))
```

## Phase 3: Update `references.md`

Add 4 references:
- Reed & Mang, "Regenerative Development and Design" (2nd ed.)
- Sanford, "The Regenerative Paradigm" (Four Modern Paradigms)
- Lyle, *Regenerative Design for Sustainable Development* (1994)
- Roland & Landua, "Eight Forms of Capital" / *Regenerative Enterprise*

## Verification

1. Confirm all 4 lenses appear in SKILL.md activation table, foundation section, decision tree, and "when invoked"
2. Cross-reference links between regenerative.md ↔ SKILL.md ↔ references.md resolve correctly
3. Eight Forms of Capital references align with existing `design-research.md:68-86`
4. No "cockpit" or "frontend-design" remnants introduced

# Regenerative Design Lens

The fourth design lens, alongside Adaptive Surface (information hierarchy), Inclusive Design (accessibility), and Ecosystem Thinking (relational architecture). This lens asks: **does this design regenerate or extract?**

Full framework with sources: `docs/docs/reference/regenerative-design-framework.md`

---

## The Seven Principles — Design Directives

When making design decisions, evaluate against these principles:

### 1. Make the Mycelium Visible
Show value flows end-to-end. Every screen should help participants trace the chain: gardener's work → operator verification → evaluator assessment → hypercert → funder investment → more work. Name the flows. Make the invisible visible.

**Check**: Can the user see how their action connects to the larger system?

### 2. Design for Succession
Pioneer gardens need templates and quick wins. Intermediate gardens need governance tools. Climax gardens need advanced analytics and cross-garden features. Match interface complexity to community maturity.

**Check**: Is this feature appropriate for the garden's succession stage?

### 3. Enrich the Edges
The review queue, assessment interface, vault dashboard, sync moment, and web3/non-web3 boundary are the richest design zones. Invest disproportionate attention there.

**Check**: If this feature sits at a stakeholder boundary, have you designed for bidirectional learning?

### 4. Failure is Succession
Rejection = clearing (show what could improve). Disconnection = dormancy (preserve and resume). Disturbance = renewal (enable secondary succession). Frame all negative states as opportunities with context.

**Check**: Does this error/empty/failure state guide toward renewal?

### 5. Be Growth-Agnostic
No streaks. No re-engagement notifications. No FOMO. No competitive leaderboards. Celebrate task completion and departure. Measure verified impact per unit of effort, not sessions-per-day.

**Check**: Would removing this feature increase engagement? If yes, that's a feature, not a bug.

### 6. Capability is the Deliverable
Recognition badges mark capability transitions ("Can independently assess soil health"), not activity volume ("100 submissions"). The Endgame is community self-sufficiency. The Walkaway Test is the north star.

**Check**: Does this build the community's ability to function independently?

### 7. Regen, Not Degen
Natural light over dark mode for financial UIs. Seasonal rhythms over countdown timers. Community narratives over individual dashboards. Garden journal aesthetic over financial terminal aesthetic.

**Check**: Would this feel at home in a solarpunk world or a trading floor?

---

## Regenerative Design Checklist

Run alongside Spatial Readiness and Ecosystem Readiness checklists on new components:

```
Regenerative Design Check
|
+-- [ ] Value flow visible?
|      User can trace how their action contributes to the larger system
|
+-- [ ] Succession-appropriate?
|      Feature complexity matches garden maturity stage
|      (Pioneer: simple, guided / Climax: advanced, configurable)
|
+-- [ ] Edge-enriched?
|      Stakeholder boundaries designed for learning, not just transaction
|
+-- [ ] Failure as succession?
|      Error/empty/rejection states guide toward renewal with context
|
+-- [ ] Growth-agnostic?
|      No engagement gamification, no urgency manufacturing
|      Metrics measure impact depth, not usage breadth
|
+-- [ ] Capability-building?
|      Increases community independence, not platform dependency
|      Passes the Walkaway Test
|
+-- [ ] Regen aesthetic?
|      Solarpunk visual language (natural light, earth tones, organic)
|      No degen patterns (countdown timers, PnL dashboards, FOMO)
|
+-- [ ] Honorable Harvest?
|      Takes only the data it needs
|      Gives value back to data contributors
|      Community controls how their data flows
|
+-- [ ] Ecological time?
|      Time in UI follows ecological rhythms (seasons, growth cycles)
|      Not platform time (epochs, sprints, streaks)
|
+-- [ ] Collective, not competitive?
|      Garden-level achievements, not individual leaderboards
|      Social features serve learning and mentorship
```

---

## Motivation Design Quick Reference

When adding any motivational element, use this filter:

| Drive | Regenerative Use | Trap to Avoid |
|-------|-----------------|--------------|
| **Epic Meaning** | Connect actions to cumulative real impact ("47th panel, 3 months uninterrupted") | Abstract planetary messaging; savior narratives |
| **Development** | Capability milestones, garden-level accomplishments | Leaderboards, activity-count badges |
| **Creativity** | Action schema design as creative tool; conviction voting as governance art | Rigid templates; platform-dependent creativity |
| **Ownership** | "This garden is ours to care for" — communal stewardship | Token accumulation; individual portfolios |
| **Social** | Mentorship, cross-garden learning, collective narrative | Competitive comparison, social guilt, envy |
| **Scarcity** | Replace with seasonal rhythms, natural assessment cadences | Countdown timers, FOMO, limited offers |
| **Unpredictability** | Ecological wonder (unexpected species, soil improvement) | Random rewards, loot boxes, variable reinforcement |
| **Loss** | Real ecological feedback (satellite data, photo comparison) | Streak decay, progress loss, manufactured guilt |

**Rule**: White Hat + Right Brain drives (Meaning, Creativity, Social) are self-sustaining. Black Hat drives (Scarcity, Unpredictability, Loss) create dependency. Always prefer the former.

---

## The Degen/Regen Pattern Table

Use when making visual or interaction design decisions:

| Pattern | Degen | Regen |
|---------|-------|-------|
| Color palette | Dark mode, red/green financial | Natural light, earth tones, primary green |
| Primary metric | TVL, PnL, APY | Verified impact, community capability |
| Time model | Countdown timers, epoch urgency | Seasonal rhythms, ecological cadence |
| Social model | Leaderboards, whale influence | Collective narratives, mentorship |
| Ownership | Individual portfolio | Garden-level stewardship |
| Notifications | FOMO, re-engagement, streak loss | Ecological updates, seasonal prompts, rest celebration |
| Endgame goal | Retain the veteran | Graduate the community |
| Value flow | Up and out (to investors) | Through and around (to all participants) |
| Aesthetic | Financial terminal | Garden journal |

---

## Implementation Patterns

Concrete code patterns for regenerative principles. These turn philosophy into components.

### Succession-Stage Awareness

Gardens progress through stages. Use the garden's member count + activity history to infer stage and show appropriate features.

```typescript
// Derive succession stage from garden data
type SuccessionStage = "pioneer" | "intermediate" | "climax";

function getSuccessionStage(garden: Garden): SuccessionStage {
  const activeGardeners = garden.gardeners.filter(g => g.lastActive > thirtyDaysAgo).length;
  const hasAssessments = garden.assessments.length > 0;
  const hasFunding = garden.vaultBalance > 0n;

  if (activeGardeners <= 5 && !hasAssessments) return "pioneer";
  if (activeGardeners >= 15 && hasAssessments && hasFunding) return "climax";
  return "intermediate";
}

// Progressive disclosure by stage
function GardenDashboard({ garden }: { garden: Garden }) {
  const stage = getSuccessionStage(garden);

  return (
    <div>
      {/* Always visible — all stages */}
      <WorkSubmissions garden={garden} />
      <PendingReviews garden={garden} />

      {/* Intermediate+ only */}
      {stage !== "pioneer" && (
        <>
          <AssessmentHistory garden={garden} />
          <ConvictionVoting garden={garden} />
        </>
      )}

      {/* Climax only */}
      {stage === "climax" && (
        <>
          <CrossGardenAnalytics garden={garden} />
          <AdvancedGovernance garden={garden} />
          <YieldManagement garden={garden} />
        </>
      )}
    </div>
  );
}
```

### Value Flow Visualization (Mycelium Pattern)

Show the chain from action to impact. Each node in the chain links to the next.

```typescript
// Value chain breadcrumb — shows where this work sits in the flow
function ValueFlowBreadcrumb({ work }: { work: Work }) {
  const steps = [
    { label: "Submitted", date: work.submittedAt, status: "complete" },
    { label: "Verified", date: work.approvedAt, status: work.approvedAt ? "complete" : "pending" },
    { label: "Assessed", date: work.assessmentId ? "complete" : undefined, status: work.assessmentId ? "complete" : "future" },
    { label: "Funded", status: work.hypercertId ? "complete" : "future" },
  ];

  return (
    <nav aria-label="Impact chain" className="flex items-center gap-1 text-xs text-muted-foreground">
      {steps.map((step, i) => (
        <Fragment key={step.label}>
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          <span className={cn(
            step.status === "complete" && "text-primary font-medium",
            step.status === "pending" && "text-amber-600 animate-pulse",
            step.status === "future" && "text-muted-foreground/50",
          )}>
            {step.label}
          </span>
        </Fragment>
      ))}
    </nav>
  );
}
```

### Failure as Succession (Rejection with Context)

Rejection is not an error — it's clearing that enables regrowth.

```typescript
// Rich rejection feedback — shows what went wrong and how to succeed
function RejectionFeedback({ work, rejection }: RejectionProps) {
  const { data: approvedExamples } = useApprovedWork(work.actionId, { limit: 3 });

  return (
    <div className="space-y-4">
      <Alert variant="amber">
        <AlertTitle>Needs revision</AlertTitle>
        <AlertDescription>{rejection.feedback}</AlertDescription>
      </Alert>

      {/* What the operator saw */}
      <section>
        <h4 className="text-sm font-medium">What the reviewer noted</h4>
        <ul className="text-sm text-muted-foreground list-disc pl-4">
          {rejection.reasons.map(r => <li key={r}>{r}</li>)}
        </ul>
      </section>

      {/* Past successes as learning examples */}
      {approvedExamples && approvedExamples.length > 0 && (
        <section>
          <h4 className="text-sm font-medium">Approved examples for this action</h4>
          <div className="grid grid-cols-3 gap-2">
            {approvedExamples.map(ex => (
              <WorkThumbnail key={ex.id} work={ex} />
            ))}
          </div>
        </section>
      )}

      <Button onClick={() => resubmit(work)}>
        Revise and resubmit
      </Button>
    </div>
  );
}
```

### Growth-Agnostic Completion Celebration

Celebrate departure instead of manufacturing re-engagement.

```typescript
// Post-submission — celebrate and release
function SubmissionComplete({ work }: { work: Work }) {
  const { data: garden } = useGarden(work.gardenId);
  const totalVerified = garden?.verifiedWorkCount ?? 0;

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <CheckCircle className="h-12 w-12 text-primary" />
      <h2 className="text-lg font-semibold">Work captured</h2>
      <p className="text-muted-foreground max-w-sm">
        Your submission is queued for review.
        {totalVerified > 0 && ` This garden has ${totalVerified} verified contributions.`}
      </p>

      {/* Celebrate departure — no "submit another!" urgency */}
      <p className="text-sm text-muted-foreground/70">
        Go do more of what matters. We'll sync when you're back.
      </p>
    </div>
  );
}
```

### Ecological Time (Seasonal Prompts)

Replace platform urgency with natural rhythms.

```typescript
// Seasonal context — shows what's relevant NOW in the garden's bioregion
function SeasonalContext({ garden }: { garden: Garden }) {
  const season = getLocalSeason(garden.latitude, garden.longitude);
  const seasonalActions = garden.actions.filter(a => a.seasons?.includes(season));

  if (seasonalActions.length === 0) return null;

  return (
    <aside className="rounded-xl bg-primary/5 border border-primary/10 p-4">
      <p className="text-sm font-medium text-primary">
        {season === "planting" && "Planting season"}
        {season === "growing" && "Growing season"}
        {season === "harvest" && "Harvest time"}
        {season === "dormant" && "Dormant season — a time for planning"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {seasonalActions.length} actions are in season for your area
      </p>
    </aside>
  );
}
```

---

## Related

- Full framework with citations: `docs/docs/reference/regenerative-design-framework.md`
- Ecosystem thinking: `ecosystem.md` (15 user archetypes, cascade analysis)
- Inclusive design: `interaction.md` (Persona Spectrum, adaptive density)
- Spatial patterns: `spatial.md` (depth hierarchy, material system)
- Green Goods design research: `docs/docs/reference/design-research.md` (personas, Eight Forms of Capital)
- Ethereum alignment: `docs/docs/builders/ethereum-alignment.mdx` (CROPS, Walkaway Test)

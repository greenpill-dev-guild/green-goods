---
name: research
user-invocable: false
description: Evidence-first research for a bounded product, architecture, implementation, or external-fact question before planning or decision discussion. Use when a question requires reconciling repository or primary-source evidence. Read-only by default. Do not use for debugging, change review, repo-health audit, simple lookup, or historical-rationale tracing.
---

# Research

Ground planning and product discussion in evidence before asking the human to reconstruct facts the
agent can discover. This skill runs in the active agent and keeps the investigation bounded.

## Activation boundary

Use this skill when a product, architecture, implementation, or external-technology question needs
evidence from more than a simple lookup, especially when the user asks what is already planned,
specified, implemented, documented, or currently true. Planning may also route a discoverable
factual prerequisite here before it asks the user for judgment.

Do not use this skill for:

- bug diagnosis or unexpected runtime behavior — use `debug`;
- reviewing a change or certifying readiness — use `review`;
- repository-health or drift classification — use `audit`;
- reconstructing why a past decision was made — use the historical-rationale workflow;
- a simple lookup with one obvious authoritative source; or
- implementation. Research is read-only unless the user separately requests a durable artifact.

## Workflow

### 1. Frame the work

State the exact research question and the decision it unblocks. Separate discoverable facts from
human decisions. Name the initial scope, freshness needed, and what would make the research
sufficient; do not turn a preference or product choice into a purported fact.

### 2. Resolve authority

Use this order, adapting it when the user explicitly names a source of truth:

1. Start with the user-named source, including its live or pinned version when freshness matters.
2. For an owning Plan Hub, read `status.json` links and its document map first, then open only the
   targeted canonical documents those pointers identify. Do not load a large hub indiscriminately.
3. Read canonical repository specs and package guidance, then the relevant code, configuration, and
   tests. Use current history or live state when the question depends on recency or implementation
   truth.
4. For external primary sources, prefer official documentation, a first-party API, source code, or
   the governing specification. Treat summaries, transcripts, and third-party reports as leads
   unless the user designates one as authoritative.

When sources disagree, prefer the authority closest to the claim and its required freshness. Keep
the contradiction visible rather than blending incompatible claims.

### 3. Follow the evidence

Follow a newly discovered branch only when it could change the answer or unblock the decision.
Search enough of that branch to establish the relevant claim, then stop it when:

- authoritative evidence answers it;
- the available sources are exhausted;
- the next step is a human decision rather than a factual question; or
- the branch is outside the research scope.

Do not continue collecting sources after the decision-relevant answer is stable. If an inaccessible
private source is necessary, name the missing source and the exact claim it must settle.

### 4. Classify conclusions

Label each material conclusion with one of these states:

- **ESTABLISHED** — directly supported by current authoritative evidence;
- **CORRECTED / CONTRADICTED** — a prior claim is wrong or authorities conflict;
- **INFERRED** — the evidence supports a reasoned conclusion but does not state it directly; or
- **UNRESOLVED** — evidence is absent, inaccessible, stale, or genuinely ambiguous.

For time-sensitive claims, include the observed date, version, commit, environment, or other
freshness boundary. Never present an inference as settled design.

### 5. Return the research brief

Keep the default result in chat and compact enough to drive the next decision:

1. **Question and decision** — what was researched and what it unblocks.
2. **Source coverage** — authorities inspected, versions or freshness, and material branches not
   followed.
3. **Established context** — the facts that now constrain the discussion.
4. **Corrections and contradictions** — disagreement between prior assumptions and evidence.
5. **Gaps and limits** — unresolved claims and proof limits.
6. **Decision implications** — what the evidence changes, enables, or rules out.
7. **Remaining human frontier** — only the independent choices that evidence cannot settle.

## Persistence

Research is read-only by default. If the user explicitly asks for durable evidence, follow the
owning repository convention and preserve one focused evidence artifact, not a parallel knowledge
base. Accepted product or architecture decisions return to `plan` and enter the canonical Plan Hub
files there. Do not persist raw transcripts or exploratory notes as settled decisions, and do not
write Linear or another tracker unless the user separately requests it.

## Map escalation

If the investigation cannot finish as a bounded session because several dependent research and
decision branches remain, return a map-ready handoff instead of implying completeness or inventing
a tracker. Include these fields in order:

1. **Destination** — the outcome the investigation is trying to reach.
2. **Settled facts and decisions** — established context with source pointers.
3. **Sharp frontier questions** — the next answerable research or human-decision questions.
4. **Remaining fog** — areas that cannot yet be specified clearly.
5. **Dependencies** — prerequisites and the order they constrain.
6. **Out of scope** — branches deliberately excluded from this investigation.

Do not create tracker records automatically. The handoff is an escalation contract for a future
mapping workflow; it does not implement Wayfinder or authorize parallel subagents.

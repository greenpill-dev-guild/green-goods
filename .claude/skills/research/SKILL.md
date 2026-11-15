---
name: research
description: Evidence-first research on a bounded product, architecture, implementation, or external-fact question before planning or a decision. Use when the answer needs repository or primary-source evidence reconciled, such as what is already planned, specified, implemented, documented, or currently true. Read-only. Not for debugging, change review, repository-health audits, simple lookups, or historical rationale.
user-invocable: false
---

# Research

## Adapter

Read `.agents/adapter.md` at the repository root, section `## research`. If the file, the section, or a field is missing, say so in one line and use the defaults written as "(default: ...)". Adapter fields are the bold names that carry a "(default: ...)".

## Activation boundary

Ground planning and product discussion in evidence before asking the human to reconstruct facts you can discover. The skill runs in the active agent and keeps the investigation bounded.

Use this skill when a product, architecture, implementation, or external-technology question needs more than a simple lookup, especially when the user asks what is already planned, specified, implemented, documented, or currently true. Planning may also route a discoverable factual prerequisite here before it asks the user for judgment.

Route elsewhere:
- bug diagnosis or unexpected runtime behavior → `debug`;
- reviewing a change or certifying readiness → `review`;
- why a past decision was made → the historical-rationale workflow (`trace-rationale`);
- repository-health or drift classification → **Neighbor skills** (default: say that no skill covers it);
- a simple lookup with one obvious authoritative source → answer it directly;
- implementation → out of scope; research is read-only unless the user separately asks for a durable artifact.

## 1. Frame the work

State the exact research question and the decision it unblocks. Separate discoverable facts from human decisions. Name the initial scope, the freshness needed, and what would make the research sufficient. Never present a preference or product choice as a fact.

## 2. Resolve authority

Use this order, adapting it when the user names a source of truth:
1. The user-named source, at its live or pinned version when freshness matters.
2. For an owning plan, its entry point (**Plan entry point**; default: the plan's index or main file), then only the canonical documents those pointers identify. Never load a large plan wholesale.
3. Canonical repository specs and package guidance, then the relevant code, configuration, and tests. Use current history or live state when the question depends on recency or implementation truth.
4. External primary sources: official documentation, a first-party API, source code, or the governing specification. Summaries, transcripts, and third-party reports are leads unless the user makes one authoritative.

When sources disagree, prefer the authority closest to the claim at the freshness it needs, and keep the contradiction visible instead of blending incompatible claims.

## 3. Follow the evidence

Follow a newly found branch only when it could change the answer or unblock the decision. Search enough of it to establish the claim, then stop the branch when authoritative evidence answers it, the available sources are exhausted, the next step is a human decision rather than a factual question, or it falls outside the research scope.

Stop collecting sources once the decision-relevant answer is stable. If a necessary private source is out of reach, name it and the exact claim it must settle.

## 4. Classify conclusions

Label each material conclusion:
- **ESTABLISHED**: directly supported by current authoritative evidence.
- **CORRECTED / CONTRADICTED**: a prior claim is wrong, or authorities conflict.
- **INFERRED**: the evidence supports a reasoned conclusion without stating it directly.
- **UNRESOLVED**: evidence is absent, inaccessible, stale, or genuinely ambiguous.

Give time-sensitive claims their freshness boundary: observed date, version, commit, or environment. Never present an inference as settled design.

## 5. Return the research brief

Keep the result in chat, compact enough to drive the next decision:
1. **Question and decision**: what was researched and what it unblocks.
2. **Source coverage**: authorities inspected, their versions or freshness, and material branches not followed.
3. **Established context**: the facts that now constrain the discussion.
4. **Corrections and contradictions**: where prior assumptions and evidence disagree.
5. **Gaps and limits**: unresolved claims and proof limits.
6. **Decision implications**: what the evidence changes, enables, or rules out.
7. **Remaining human frontier**: only the independent choices evidence cannot settle.

## Persistence

Research is read-only by default. When the user explicitly asks for durable evidence, follow **Durable evidence** (default: ask where it belongs) and keep one focused evidence artifact, not a parallel knowledge base. Accepted product or architecture decisions go back to the `plan` skill and into the owning plan's canonical files. Never persist raw transcripts or exploratory notes as settled decisions, and never write to the tracker (**Tracker**; default: the repository's tracker) unless the user separately asks.

## Map escalation

When the investigation cannot finish as one bounded session because several dependent research and decision branches remain, return a map-ready handoff instead of implying completeness or inventing a tracker. Give these fields in order:
1. **Destination**: the outcome the investigation is trying to reach.
2. **Settled facts and decisions**: established context with source pointers.
3. **Sharp frontier questions**: the next answerable research or human-decision questions.
4. **Remaining fog**: areas that cannot yet be specified clearly.
5. **Dependencies**: prerequisites and the order they impose.
6. **Out of scope**: branches deliberately excluded.

Create no tracker records. The handoff is an escalation contract for a later mapping workflow (**Mapping workflow**; default: none); it starts none and authorizes no parallel subagents.

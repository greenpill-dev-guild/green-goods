# Agent Research and Discussion Grounding

**Slug**: `agent-research-grounding`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-08-25T06:06:31.016Z`

## Problem

Planning discussions can reach a feature with substantial prior architecture, specifications, and
implementation evidence without first finding the small set of sources that govern the question.
The user then has to repeat context across several turns. Commitment Pooling makes the failure
visible: its Plan Hub contains 236 files, but `status.json.links` already points to the documents
that answer most decision-specific questions.

## Desired Outcome

- A passive `research` skill grounds bounded discussions in repository or external primary-source
  evidence before the agent asks for human judgment.
- Planning routes discoverable factual prerequisites through research and groups independent human
  decisions into dependency-aware frontier rounds.
- Research stops when evidence is sufficient, distinguishes established facts from inference and
  judgment, and escalates unbounded investigations as a map-ready handoff.
- Ordinary research remains read-only and returns in chat. Durable evidence and accepted decisions
  continue to use the owning repository and Plan Hub conventions.

## Scope Notes

- In scope: one canonical skill under `.claude/skills`, updates to `plan` and `plan/brainstorm`,
  deterministic behavior contracts, trigger-routing fixtures, affected builder documentation, and
  a read-only Commitment Pooling forward test.
- Out of scope: Commitment Pooling product or plan edits, Wayfinder/tracker implementation,
  parallel subagents, Linear records, OpenAI sidecars, new dependencies or harness scripts, and a
  second skill tree.

## Success Signal

Given the hackathon discussion prompt, the new guidance starts from Commitment Pooling's authority
map, loads targeted evidence, reports what is settled and still human-owned, and avoids asking the
user to reconstruct already-recorded context.

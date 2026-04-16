# Agent Knowledge Sandbox and Graph Memory

Date: 2026-04-05
Status: Idea note
Source spark: [Building Context Graphs for AI Agents, Will Lyon, Neo4j](https://youtu.be/qMV64p-4Deo)

## Thesis

The strongest path to a trusted agent is not open web access. It is a constrained, user-curated knowledge sandbox where every source is explicit, typed, and allowlisted.

The mental model is "YouTube Kids for agents," but for productive knowledge work. The user chooses which channels, feeds, repos, and communication spaces exist in the agent's world. The agent grows by expanding that allowlist over time, not by escaping the sandbox.

This feels like the right counterweight to OpenClaw-style autonomy. The upside is real, but broad permissions create too much hidden risk. Coop can default to a safer pattern: constrained by source, explicit by provenance, inspectable by the user.

## Core Product Idea

Build a trusted knowledge substrate for agents inside Coop where external access happens only through typed connectors.

The agent does not browse the open web by default. It can only call tools backed by approved sources such as:

- GitHub repos and orgs
- YouTube channels, playlists, and videos
- RSS feeds, especially Substack and Paragraph
- NPM packages and package scopes
- Reddit subreddits or threads
- Signal threads and groups
- Discord servers, channels, and threads

Each source becomes a first-class resource with a policy boundary around it.

## Source Model

Every resource should be represented as:

- `source_type`: github, youtube, rss, npm, reddit, signal, discord
- `source_id`: repo slug, channel ID, feed URL, package name, thread ID, and so on
- `owner`: the user or workspace that approved it
- `permissions`: read, summarize, index, cite, draft reply, send reply
- `scope`: path prefixes, branches, playlists, date windows, channel subsets
- `freshness_policy`: polling cadence, max age, refresh budget
- `trust_tier`: canonical, curated, social, experimental
- `revocation_status`: active, paused, revoked

This gives the agent a capability model instead of a network model.

## Why This Sandbox Works

The sandbox is strong because it narrows both what the agent can see and how it sees it.

- The agent only accesses approved domains through specific connectors.
- The connector returns structured artifacts instead of arbitrary pages.
- Every artifact carries provenance, timestamps, and source identity.
- The user can revoke a source and invalidate memory derived from it.
- Writes and outbound communication sit behind separate permissions from reads.

This creates a safer default than "let the agent use the internet" while still giving it enough surface area to become useful.

## Suggested Trust Tiers

Not all sources should be treated equally.

- Tier 1: canonical sources such as GitHub repos, official NPM packages, official RSS feeds, official YouTube channels
- Tier 2: curated commentary such as selected Substack, Paragraph, or expert creator channels
- Tier 3: social signal such as Reddit, Discord, and community discussion threads
- Tier 4: outbound communications such as Signal and Discord replies, which should remain supervised by default

MVP should likely start with Tier 1 plus selected Tier 2.

## Connector Behavior

Each connector should return normalized artifacts, not raw browsing sessions.

Examples:

- GitHub returns repos, files, commits, PRs, issues, comments, releases
- YouTube returns video metadata, transcripts, chapters, channel identity, playlist membership
- RSS returns feed metadata, entries, authors, timestamps, linked canonical URLs
- NPM returns package metadata, versions, README, changelog links, dependency graph
- Reddit returns subreddit, post, comment thread, author, score, timestamps
- Signal and Discord return thread metadata, messages, attachments, participants

This is important. The agent should reason over structured knowledge objects with citations, not over loose browser state.

## Sandbox Rules

The default operating model should be:

- No arbitrary outbound HTTP from the agent runtime
- All external access routed through approved connectors
- All connector calls logged with source, time, and purpose
- All stored memory linked back to source artifacts
- All high-risk actions gated by approval
- All sources individually revocable
- All connectors rate-limited and budget-limited
- All memory subject to retention and deletion policy

This is the difference between "an agent with internet access" and "an agent inside a governed knowledge environment."

## Where Graph Memory Starts To Matter

Markdown memory is useful for human-facing notes, summaries, and current working context. It is weak as the main memory system once the agent needs provenance, relationships, and multi-hop recall.

A graph becomes useful when the agent needs to answer questions like:

- Which repos, videos, and feeds support this claim?
- Which people, topics, and projects keep appearing together?
- What changed since the last time this repo or channel was reviewed?
- Why did the agent recommend this action?
- Which memory came from a revoked source?
- Which claims are stale, contradictory, or unsupported?

That is where Neo4j or another graph database becomes more powerful than markdown files alone.

## Recommended Memory Split

The right shape is probably hybrid, not graph-only.

- Raw artifacts live in object or document storage
- Embeddings live in a vector index for semantic recall
- The graph stores entities, relationships, provenance, permissions, and decision traces
- Markdown remains the human-readable layer for notes, briefs, and handoff summaries

Markdown should be the interface layer. The graph should be the system memory layer.

## Three Memory Layers

This idea maps well to three practical memory layers:

- Episodic memory: sessions, conversations, observations, tool calls, task timelines
- Semantic memory: entities, repos, channels, feeds, packages, concepts, claims, relationships
- Reasoning memory: decisions, failed attempts, successful strategies, why a conclusion was reached

The reasoning layer is especially valuable. It turns memory from "what the agent saw" into "why the agent acted."

## A Graph Model For Coop

Some likely node types:

- `User`
- `Workspace`
- `Source`
- `Artifact`
- `Entity`
- `Topic`
- `Claim`
- `Task`
- `Decision`
- `Message`
- `Policy`

Some likely relationships:

- `Workspace ALLOWLISTS Source`
- `Source PRODUCES Artifact`
- `Artifact MENTIONS Entity`
- `Artifact SUPPORTS Claim`
- `Claim RELATES_TO Topic`
- `Task CONSULTED Artifact`
- `Decision BASED_ON Claim`
- `Decision FOLLOWED Policy`
- `Message REFERENCED Artifact`
- `Source REVOKED_BY Workspace`

This gives the agent provenance, explainability, and revocation paths that markdown alone does not provide.

## Why Graph Beats Markdown For Agent Memory

Graph memory is better when the system needs:

- Multi-hop retrieval across sources
- Entity resolution across repos, channels, feeds, and discussions
- Decision tracing and auditability
- Policy-aware retrieval
- Shared memory across multiple agents
- Forgetting or invalidating memory by source lineage

Markdown is still valuable, but mostly as a projection of the graph for humans.

## A Good Coop MVP

A credible first version could stay narrow:

1. Read-only GitHub, YouTube transcript, and RSS connectors
2. User-managed allowlists for repos, channels, playlists, and feeds
3. Provenance-first storage of every fetched artifact
4. Hybrid retrieval with vector plus graph
5. Human-readable note generation on top of that memory

That would already create a meaningful "trusted agent sandbox" without opening the full browser.

## Communication Layer

Communication should be treated separately from knowledge.

Knowledge sources are mostly read-oriented. Communication sources are interactive and higher risk.

- Signal in Coop OS could be the supervised inbox and reply surface
- Discord in Coop X could be the community sensing and response surface

The agent should probably start in draft mode for both. Read, summarize, and propose replies first. Send only with approval until trust is earned.

## Product Direction

The deeper product idea is not just safer retrieval. It is a safer upbringing for agents.

Instead of asking users to trust a general-purpose agent with broad access, let them raise an agent inside a bounded environment:

- curated sources
- visible memory
- explicit permissions
- revocable trust
- inspectable decisions

That feels much closer to a trustworthy companion or cooperative worker than today's default browser agents.

## Open Questions

- Should Reddit be in v1, or does it add too much noise too early?
- Should YouTube ingestion use captions only, or also image and audio analysis later?
- Should RSS connectors be allowed to fetch linked article bodies, or stay feed-only at first?
- How should source revocation propagate through existing graph memory?
- What is the right user interface for inspecting and editing agent memory?
- When should an agent be allowed to move from draft replies to autonomous replies?

## Working Conclusion

The promising path is:

- start with a minimal read-only sandbox
- make provenance and revocation first-class
- use graph memory for relationships and decision traces
- keep markdown as the human note layer
- add communication later and keep it supervised by default

If Coop wants to build trusted agents, this looks like one of the right foundational bets.

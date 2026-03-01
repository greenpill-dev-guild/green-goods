---
sidebar_position: 1
slug: /
title: Green Goods Documentation
audience: all
owner: docs
last_verified: 2026-02-19
feature_status: Live
source_of_truth:
  - docs/docusaurus.config.ts
  - docs/sidebars.ts
keywords:
  - green goods docs
  - submit work
  - review work
  - mint hypercert
  - vault deposit
  - query attestations
---

import {RolePathCard, StatusBadge} from "@site/src/components/docs";
import styles from "@site/src/components/docs/styles.module.css";

# Green Goods Documentation

Role-first docs for Green Goods v1.

<StatusBadge status="Live" />

## Choose your path

<div className={styles.roleGrid}>
  <RolePathCard
    title="Gardener"
    href="/gardener/get-started"
    description="Document work with MDR, work offline, and track approvals and attestations."
    audience="Gardeners in the field"
    time="5-10 minutes"
    status="Live"
    ctaLabel="Open gardener path"
  />
  <RolePathCard
    title="Operator"
    href="/operator/get-started-and-roles"
    description="Run garden operations, review work, and manage v1 endowment/governance features with explicit activation status."
    audience="Garden operators"
    time="10-20 minutes"
    status="Live"
    ctaLabel="Open operator path"
  />
  <RolePathCard
    title="Evaluator"
    href="/evaluator/get-started"
    description="Query indexer and EAS data, verify attestation chains, and export analysis-ready datasets."
    audience="Funders, analysts, researchers"
    time="15-25 minutes"
    status="Live"
    ctaLabel="Open evaluator path"
  />
  <RolePathCard
    title="Developers"
    href="/developers/getting-started"
    description="Build with architecture, patterns, integration, and operational references designed for human and AI use."
    audience="Engineers and contributors"
    time="20-40 minutes"
    status="Live"
    ctaLabel="Open developer hub"
  />
  <RolePathCard
    title="Core Concepts"
    href="/concepts/mission-and-values"
    description="Understand the mission, impact model (CIDS), strategic goals, and real communities behind Green Goods."
    audience="Anyone"
    time="15-30 minutes"
    status="Live"
    ctaLabel="Explore core concepts"
  />
</div>

## Popular tasks

Use these intent-first links for common searches:

- [Submit work](/gardener/submit-work-mdr)
- [Review work](/operator/review-work)
- [Mint hypercert](/operator/mint-and-list-hypercerts)
- [Vault deposit](/operator/vaults-and-treasury)
- [Query attestations](/evaluator/query-eas)

## v1 status model

Green Goods docs now distinguish:

- `Live`: available in production workflows.
- `Implemented (activation pending indexing)`: deployed on chain, but indexer coverage is not active yet.
- `Implemented (activation pending deployment)`: built in code and often present in UI, but blocked by deployment activation.
- `Planned`: not implemented.

Use [Deployment and Indexer Status](/developers/reference/deployment-indexer-status) as canonical source for activation state.

## Quick links

- App: [greengoods.app](https://greengoods.app)
- Admin: [admin.greengoods.app](https://admin.greengoods.app)
- Developer reference: [/developers/reference](/developers/reference)
- Changelog: [/reference/changelog](/reference/changelog)

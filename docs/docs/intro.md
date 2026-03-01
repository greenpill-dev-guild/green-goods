---
sidebar_position: 1
slug: /
title: What is Green Goods
sidebar_label: What is Green Goods
audience: all
owner: docs
last_verified: 2026-03-01
feature_status: Live
source_of_truth:
  - docs/docusaurus.config.ts
  - docs/sidebars.ts
keywords:
  - green goods docs
  - submit work
  - review work
  - regenerative
  - impact verification
  - capital formation
---

import {RolePathCard} from "@site/src/components/docs";
import styles from "@site/src/components/docs/styles.module.css";

# What is Green Goods

Green Goods is a mobile-first platform that helps local communities **document**, **verify**, and **fund** their regenerative work — from tree planting and waste collection to solar maintenance and agroforestry.

Built by the [Greenpill Dev Guild](https://paragraph.com/@greenpilldevguild), Green Goods connects field workers to the verification and capital systems that make regenerative action sustainable.

## The Core Loop

```
Evidence Capture → Community Verification → Impact Certification → Capital Formation
(Gardener)         (Operator)               (Evaluator)           (Funder)
```

A **Gardener** photographs their tree planting. An **Operator** reviews and approves the work. An **Evaluator** certifies the impact claim. Verified impact flows into yield-bearing vaults and tokenized impact certificates that attract further funding.

Learn more about the framework behind this loop in [How It Works](/concepts/impact-model), or explore [Why We Build](/concepts/mission-and-values) Green Goods.

---

## Get Started

<div className={styles.roleGrid}>
  <RolePathCard
    title="Gardener"
    href="/gardener/get-started"
    description="Document your regenerative work and build a verified impact record."
    audience="Field workers"
    time="5 min"
    ctaLabel="Start documenting"
  />
  <RolePathCard
    title="Operator"
    href="/operator/get-started-and-roles"
    description="Manage your garden community, review submissions, and connect verified work to funding."
    audience="Garden managers"
    time="10 min"
    ctaLabel="Start managing"
  />
  <RolePathCard
    title="Evaluator"
    href="/evaluator/get-started"
    description="Verify impact claims, analyze data, and produce reports that funders trust."
    audience="Analysts & researchers"
    time="15 min"
    ctaLabel="Start evaluating"
  />
</div>

---

## Build

<div className={styles.roleGrid}>
  <RolePathCard
    title="Developers"
    href="/developers/getting-started"
    description="Build on the protocol — architecture, integrations, and API reference for human and AI developers."
    audience="Engineers & contributors"
    time="20 min"
    ctaLabel="Open developer hub"
  />
</div>

---

## Quick Actions

- [Submit work](/gardener/submit-work-mdr) — Document a regenerative action
- [Review submissions](/operator/review-work) — Approve or request changes
- [Explore impact data](/evaluator/query-indexer) — Query gardens and actions

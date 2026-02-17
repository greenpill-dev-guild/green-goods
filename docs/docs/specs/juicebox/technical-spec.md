---
id: juicebox-technical-spec
title: GG-TECH-011 Juicebox Routing
sidebar_label: Technical Spec
---

# GG-TECH-011 — Juicebox Routing

## Architecture
- Strategy and module contracts call Juicebox payment terminals.
- Indexer persists `YieldJuiceboxPayment` entities.
- Shared yield hooks expose payment state in admin/client views.

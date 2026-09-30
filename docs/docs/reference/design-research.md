---
title: Design Rationale and Sources
sidebar_label: Design Rationale
slug: /reference/design-research
audience: all
owner: docs
last_verified: 2026-08-30
feature_status: Live
source_of_truth:
  - DESIGN.md
  - docs/DESIGN.md
  - packages/admin/DESIGN.md
  - packages/client/DESIGN.pwa.md
  - packages/client/DESIGN.browser.md
  - .claude/skills/design/review-checklist.md
---

# Design Rationale and Sources

Green Goods uses one Warm Earth design language across several distinct surfaces. DesignMD files own the visual rules and tokens. This page explains the reasoning behind those choices and points to the ideas that shaped them; it does not restate component anatomy or runtime behavior.

## Why the product feels this way {#why-warm-earth}

Regenerative work happens in places, over seasons, and through relationships. The interface therefore favors natural light, earth tones, legible material layers, calm motion, and language that names the work plainly. The steward cockpit stays restrained and operational. The installed PWA feels like a field journal. Public pages have a more editorial voice. Those dialects share tokens and terminology without pretending every audience has the same needs.

The ontology supplies the names for entities, personas, relationships, and lifecycle states. DesignMD decides how those concepts are expressed visually on each surface. The [generated glossary](/glossary) is the public bridge between the two.

## Seven regenerative principles {#seven-principles}

### Make the mycelium visible {#make-the-mycelium-visible}

Show how work, evidence, recognition, and funding connect. A user should be able to follow a value flow without learning protocol internals.

### Design for succession {#design-for-succession}

Match complexity to the community's current capability. New gardens need clear starting points; established gardens can carry denser coordination tools.

### Enrich the edges {#enrich-the-edges}

Give extra care to transitions between people and systems: gardener to steward, funder to garden, online to offline, and familiar web behavior to onchain records.

### Treat failure as a path forward {#failure-is-succession}

Recovery states should explain what happened, preserve work where possible, and make the next useful action obvious. Rejection, disconnection, and delayed confirmation need context, not blame.

### Stay growth-agnostic {#be-growth-agnostic}

Measure verified regenerative outcomes and growing community capability, not compulsive engagement. Seasonal rhythms replace artificial urgency, rankings, and fear-of-missing-out patterns.

### Make capability the deliverable {#capability-is-the-deliverable}

The product should help communities do more for themselves. A useful test is whether the people and records could remain legible if Green Goods were no longer the interface.

### Choose regen over degen {#regen-not-degen}

Avoid trading-terminal aesthetics, financialized status displays, and dark patterns. Favor collective context, clear evidence, garden-level stories, and calm action.

## Source traditions {#sources}

These principles synthesize several traditions rather than claiming a new formal discipline:

- Ethan Roland and Gregory Landua's Eight Forms of Capital broaden how value is described beyond money.
- Kate Raworth's distributive and regenerative design framing asks systems to share value and operate within living limits.
- Elinor Ostrom's commons research informs local rules, transparent roles, monitoring, and nested governance.
- Suzanne Simard's work on forest networks and ecological research on succession and edge effects provide metaphors for visible flows, maturity, and boundary conditions.
- Regenesis, biomimicry, post-growth HCI, and Self-Determination Theory inform the emphasis on capability, context, autonomy, and non-extractive motivation.
- Solarpunk and Greenpill writing provide an optimistic visual and cultural frame for coordination around public goods.

For current design implementation, begin with root [`DESIGN.md`](https://github.com/greenpill-dev-guild/green-goods/blob/main/DESIGN.md), then read the DesignMD file nearest the surface being changed. For current product behavior, use code, configuration, package guides, and executable guards.

## Product and design resources {#resources}

- [Green Goods product vision](https://paragraph.com/@greenpilldevguild/green-goods-simplifying-impact-capture-and-exchange)
- [Figma design system](https://www.figma.com/design/aNmqUjGZ5wR4eNaRqfhbQZ/Green-Goods)
- [Miro product strategy board](https://miro.com/app/board/uXjVKfMOhPY=/)
- [Product walkthrough](https://www.loom.com/share/e09225ec813147a6aacd4dc8816ce8be?sid=985a42f4-574b-499d-9dc8-03051b797f3d)

External boards and videos are useful context, but checked-in DesignMD and code remain the implementation authorities.

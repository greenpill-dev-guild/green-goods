# Animation & Interaction Polish — Editorial Browser + Garden Detail

**Slug**: `animation-polish-editorial-browser`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-05-03`

## Problem

The public browser site and garden detail dialog have the right motion infrastructure,
but the perceived animation quality still trails the editorial bar. View transitions,
section reveal hooks, dialog stagger, and motion-token tuning are present; the next
pass needs to diagnose why the interaction still feels mechanical and then polish the
highest-impact seams.

## Desired Outcome

- Garden card to dialog transitions feel intentional rather than rectangular.
- Dialog open and close choreography is coherent across direct visits, card clicks,
  close button, backdrop, and Escape.
- Editorial sections reveal with a richer inner cascade while respecting reduced motion.
- Public browser hover, press, image-load, and link-arrow feedback feels consistent.

## Scope

This is a deferred browser-experience polish plan. It should stay backlog until the
current public walkthrough stabilizes and Afo explicitly asks to resume public motion
polish.

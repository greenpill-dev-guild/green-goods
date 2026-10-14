# Demo Data Injection Seams

**Slug**: `demo-data-injection`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-08-23T02:07:14.633Z`

## Problem

We cannot look at our own product with realistic data in it.

Reviewing a screen against believable content today means Storybook. That works well for a
component, but Storybook is not the running app: it has no router history worth trusting, no
offline queue, no service worker, no real navigation between surfaces. The moment you want to see
how a garden actually reads end to end, you are back to whatever the local stack happens to hold.

What it happens to hold is nothing. The local indexer carries 22 Gardens and 18 CommitmentPools,
and **zero** Commitments and zero Cycles. That single fact is why every commitment pooling surface
renders its pre-launch state — on the phone, on the public editorial pages, and in the steward's
console — and why capturing the published screenshot walk needed three different methods and a
panel of caveats explaining what could not be shown.

The dev flags that exist do not close the gap. `?mockPooling=1` covers eight member-facing readers
and deliberately excludes both the editorial readers and the whole steward console. `?mockAuth=`
fakes an address but never a role, so permission-gated surfaces stay gated. Neither reaches the
majority of what we would want to review.

## Desired Outcome

- A person can open the local app, on any of the three surfaces, and see a garden that looks like a
  garden that has been used: commitments in several states, a season running, claims waiting.
- Getting there is one command, not a research project.
- What you are looking at is the real component reading through the real query layer, so a review
  says something about the product and not only about a fixture.
- Nothing changes in production builds, and no injected data can be mistaken for real data later.

## Scope Notes

- In scope: the seam map in `spec.md`, and the four rungs in `plan.todo.md` — indexer seeding,
  extending the module read gate, a browser-side request worker, and pooling contract helpers.
- Out of scope: shipping any of it. This hub is deferred behind the module optimization and test
  work. It records the map so the next person does not re-derive it.
- Out of scope: production or hosted environments. Every seam here is dev-only by construction.

## Success Signal

One command puts a populated garden in front of you, and the same garden reads correctly on the
client PWA, the editorial pages, and the admin console without a single product-code branch between
the three.

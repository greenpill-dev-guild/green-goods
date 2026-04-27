# PostHog Check Results — 2026-04-26

Command:

```bash
node -r dotenv/config .plans/active/manual-ops-closeout/posthog-check.mjs
```

## Summary

- Host: `https://us.posthog.com`
- Admin project: `262122`
- Client project: `163591`
- Dashboards fetched: `10`
- Insights fetched: `104`
- Stale route references: none found
- Expected route `page_view` events: missing for every checked admin/client route family in the last 30 days
- Privacy-sensitive references: present in default dashboards/insights and require review

## Missing Route Event Proof

The checker found zero `page_view` events with the expected `app` + `path` properties for:

- Admin: `/hub/work`, `/hub/assess`, `/hub/certify`, `/hub/history`, `/garden/overview`, `/garden/impact`, `/garden/settings`, `/community/treasury`, `/community/governance`, `/community/payouts`, `/community/members`, `/actions`
- Client: `/gardens`, `/impact`, `/fund`, `/actions`

This does not prove the app failed to emit route events. It proves the expected event contract was not present in PostHog for the checked projects over the last 30 days. Next pass should check whether production is using a different event name, different project, different `app` value, disabled analytics, or a route path shape that differs from the current source expectation.

## Privacy Review Findings

The checker flagged references to one or more of:

- `distinct_id`
- `person_id`
- `person.properties`
- `recording`

These references are not automatically wrong, but dashboards/insights that expose them should be treated as internal-only unless explicitly reviewed.

Dashboards flagged:

- Growth Dashboard
- Landing Pages Report
- Product Analytics
- Product Health Metrics
- Real time analytics
- Retention Comparison
- User Research
- Website Metrics

Insights/funnels flagged include default active-user, retention, growth, pageview, device, location, signup, acquisition, conversion, and website metrics insights. The highest-priority manual review item is any shared dashboard or insight that exposes person-level fields or session recordings outside the core team.

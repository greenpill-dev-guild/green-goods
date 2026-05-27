# Sentry Stack Observability Plan

- [x] Remove unsafe partial agent Sentry middleware/debug route.
- [x] Add shared browser Sentry subpath and PII redaction.
- [x] Forward React boundary/categorized errors from the existing shared error funnel.
- [x] Initialize Sentry in client/admin entrypoints.
- [x] Gate Vite source map upload on `SENTRY_AUTH_TOKEN`.
- [x] Add agent/API Sentry initialization, capture points, and flush-on-shutdown.
- [x] Add env contract for three Sentry projects.
- [x] Update debugging routines/skills with Sentry + PostHog roles and privacy boundaries.
- [x] Add focused tests for redaction, config, and agent capture behavior.
- [ ] Deploy DSNs/tokens per environment and verify first production issue in each Sentry project.
- [ ] After two weeks, compare duplicate signal/noise between Sentry and PostHog and adjust thresholds/sampling.

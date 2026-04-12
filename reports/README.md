# Root Reports Policy

- Keep long-lived reference docs in `docs/docs/reference/`, not in this directory.
- Write generated machine artifacts such as Safe batch JSON and repin audits to `output/reports/`.
- Use `.plans/<stage>/<feature>/reports/` for feature-specific verification notes, migration logs, and rollout summaries.
- Local operator JSON inputs may live in `reports/` when a script expects them, but `reports/*.json` is ignored and should not be committed.

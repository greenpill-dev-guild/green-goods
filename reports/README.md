# Root Reports Policy

- Keep committed, human-authored Markdown packages here when they are part of the repo record.
- Write generated machine artifacts such as Safe batch JSON and repin audits to `output/reports/`.
- Use `.plans/<stage>/<feature>/reports/` for feature-specific verification notes, migration logs, and rollout summaries.
- Local operator JSON inputs may live in `reports/` when a script expects them, but `reports/*.json` is ignored and should not be committed.

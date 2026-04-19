# Automation Run Logs

Each automation run should write one JSONL file in this directory using:

```bash
node scripts/log-automation-run.mjs ...
```

Expected payload fields:

- `timestamp`
- `feature_slug`
- `loop`
- `surface`
- `metric_name`
- `metric_before`
- `metric_after`
- `tests_passed`
- `warning_count_before`
- `warning_count_after`
- `decision`
- `revert_reason`
- `duration_seconds`
- `notes`

When a feature hub includes `metrics.md`, use the metric name from that file instead of inventing a new label.

# audit

The repo-health check. Audit sweeps Green Goods for drift and decay: dead code, dependency health, stale guidance and plans, invariant drift, and concrete broken or brittle spots. It reads everything and changes nothing; accepted findings route to a fix pass, a cleanup run, or Linear.

**When to use it:** When you want to know whether the repo is healthy, what has drifted, or whether a cleanup pass is worth running.

**What you get:** Findings sorted by where they should go next: a quick fix, a cleanup run, or a Linear issue.

**How to invoke:** Type `/audit` (or `/audit drift` for the quick drift classifier).

[`SKILL.md`](./SKILL.md) in this folder is the executable contract; this README is the human
summary the [Skills Catalog](https://docs.greengoods.app/builders/agentic/skills) projects.

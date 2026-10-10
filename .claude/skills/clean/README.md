# clean

Scope-locked cleanup at scale. Clean runs eight focused assessment lanes over the codebase (deduplication, type consolidation, dead code, circular dependencies, type strengthening, defensive-code removal, legacy cleanup, and AI-slop removal) and only changes what a human locked into scope first.

**When to use it:** After an audit, once you've agreed which cleanup work is worth doing across the codebase.

**What you get:** Cleanup changes limited to the scope you locked, worked one assessment lane at a time.

**How to invoke:** Type `/clean` after audit findings are accepted; `--dry-run` and `--scope` bound it.

[`SKILL.md`](./SKILL.md) in this folder is the executable contract; this README is the human
summary the [Skills Catalog](https://docs.greengoods.app/builders/agentic/skills) projects.

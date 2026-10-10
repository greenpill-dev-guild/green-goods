# qa-triage

Turns QA notes into tracked records. After a Build Sync or a qa-session handoff, it enriches findings against PostHog and existing Linear records, then files scope-locked issues and private QA-sheet rows, and it writes only after confirmation.

**When to use it:** After a QA call or Build Sync, or when a qa-session hands over findings it deferred.

**What you get:** Scope-locked Linear issues and QA sheet rows, filed only after you confirm them.

**How to invoke:** Type `/qa-triage` after a QA call or handoff.

[`SKILL.md`](./SKILL.md) in this folder is the executable contract; this README is the human
summary the [Skills Catalog](https://docs.greengoods.app/builders/agentic/skills) projects.

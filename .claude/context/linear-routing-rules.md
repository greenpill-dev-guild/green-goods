# Linear Routing Rules (shared core)

Single source of truth for how repo skills route accepted findings into Linear
(workspace `greenpill-dev-guild`). Skills reference this file and keep only
their skill-specific deltas inline. Workspace shape (teams, records, label
families, routine ownership) is documented in `CLAUDE.md § Linear Workspace`;
this file is the operational contract for skills that create records.

## Invariant rules

1. **Read-only until acceptance.** Producing a report/audit/review never
   creates or mutates Linear records. Create records only after the user
   accepts a finding for tracking — and always prompt first (e.g. "Found N
   findings ready to track in Linear. Create Issues for these accepted
   findings? [y/n]"). Never auto-write.
2. **Team routing.**
   - Accepted implementation, refactor, QA, maintenance, regression, bug-fix,
     or cleanup work (an accepted delivery outcome) → Linear **Issue**,
     **Product** team, using the *Accepted Product Work* structure.
   - Accepted research questions, evidence gathering, recommendations, or
     decision support that precedes accepted product scope → Linear **Issue**,
     **Research** team, using the *Accepted Research Task* structure.
   - Raw customer or telemetry signal → Linear **Customer Need** (Product
     team), not a product Issue, until accepted.
3. **`.plans` stays the execution truth.** If a finding is mirrored from a
   `.plans/**` item, include the `.plans` link in the body and label the
   record `source:plans`. Never use GitHub Issues for backlog work.
4. **Project routing.** Attach to an active bounded project only when the
   scope clearly matches. Never route new work into completed/staging umbrella
   projects (e.g. `Green Goods`, `Coop`, `Network Website`, `Cookie Jar`) or
   any project whose status is Completed. Otherwise leave the issue
   unprojected and correctly labeled.
5. **Label namespaces.** Use only `protocol:*`, `package:*`, `activity:*`,
   `funding:*`, `source:*`, `agent:*`. Retired families (`area:*`, `work:*`,
   `task:*`, `automation:*`, `health:*`, `grant:*`) must not be reintroduced.
6. **Privacy boundary.** Keep private, security-sensitive, exploit-enabling,
   replay, session, wallet, email, and user-identifying details out of public
   Linear bodies (error message + hash + counts are OK; replay URLs, session
   IDs, distinct IDs, wallet addresses, reporter identifiers are not). Store
   sensitive context only in private notes or a handoff the user explicitly
   approves.

## How skills consume this

Reference this file (`.claude/context/linear-routing-rules.md`) instead of
restating the rules. Keep inline only what is genuinely skill-specific — e.g.
`audit`'s severity→record-category table, `architecture`'s `activity:*` label
pairings, `debug`'s Customer-Need body shape.

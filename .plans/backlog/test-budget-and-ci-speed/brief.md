# Reduce test maintenance and improve validation feedback

Green Goods has useful behavioral protection, but repeated test setup and an incomplete manual-evidence workflow make changes expensive to verify. This plan refreshes the September 18 test-audit prompt and sequences small improvements without treating test count as a quality target.

Preparation and saving this hub were authorized on September 19, 2026. Preparation is complete; implementation has not started. The hub stays in backlog until execution is selected. The attached execution prompt is source material, not authorization to create branches, publish PRs, change gates, or write to Linear in this planning session.

Start with test-budget guidance, then resolve manual browser evidence in the push workflow. Improve CI feedback, protect important decisions, and only then remove repeated setup or redundant cases. Each deletion must identify surviving proof for the same failure or establish that the subject has no remaining caller.

The first implementation milestone is two separate changes: original item 1 (test budget) and item 4 (manual browser evidence). Item 4 still needs a policy decision. The recommendation is to permit ordinary publication after automated requirements pass while retaining manual browser proof as a readiness requirement. Missing automated capabilities must still block.

The book's guiding principle is *Easier to Change*. Apply DRY to repeated knowledge, use difficult setup to find coupling, preserve independently valuable tests, and build one complete local development journey before expanding environment machinery. Source: the user-provided *The Pragmatic Programmer*, 20th anniversary edition, Topics 8–12, 41–42, and 50–51; the prior audit cites PDF page 365 on redundant tests.

Read [the ordered checklist](plan.todo.md) to resume, [scope and decisions](spec.md) for constraints, and [evaluation](eval.md) for required evidence. [Preparation evidence](reports/2026-09-19-preparation.md) records the checked commits, current targets, PR overlap, and measurement limits.

Broader Work/Agent dependency changes, OrbStack isolation, and root cleanup follow this test cycle as separately selected work. Existing documentation and architecture hubs retain their ownership; this hub does not duplicate their implementation plans.

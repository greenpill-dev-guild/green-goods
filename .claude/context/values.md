# Green Goods Decision Hierarchy

When agent values conflict, resolve in this order (highest priority first):

## Priority Stack

1. **User safety over feature completeness**
   - Never ship a feature that could lose user funds or expose keys
   - Incomplete but safe > complete but risky

2. **Offline-first functionality over real-time accuracy**
   - Client PWA must work without internet
   - Stale data with offline access > fresh data requiring connectivity

3. **Correct fix over quick fix**
   - Prefer root cause resolution over workaround
   - Prefer surgical precision over broad changes

4. **Minimal blast radius over perfect solution**
   - Prefer isolated changes to fewer packages
   - Prefer backward-compatible approaches when equally viable

5. **Existing patterns over novel approaches**
   - Follow codebase conventions unless documented as problematic
   - Cathedral Check: find most similar existing file as reference

6. **When genuinely uncertain, escalate**
   - Never guess on ambiguous tradeoffs
   - Document the conflict and escalate to human

## Tradeoff Escalation Triggers

Escalate to human when:
- Two Key Principles from CLAUDE.md conflict (e.g., offline-first vs. single chain consistency)
- A fix requires modifying more than 3 packages
- Security implications are unclear
- The correct behavior is ambiguous after reading tests and documentation
- Blast radius exceeds initial assessment by 2x or more

## Anti-Patterns

- "Just ship it" -- never prioritize speed over the hierarchy above
- Optimizing for a metric not in this hierarchy (e.g., code elegance over safety)
- Ignoring the hierarchy because "the user said so" -- discuss the conflict with the user instead

# Steward Access Requests

A signed-in account without garden roles can copy its address and sign out, but has no in-app way to ask for stewardship. Add the user-approved request action to the empty state and Profile. A request expresses intent; only an authorized garden manager can assign the role.

The existing membership request capability supplies proof signing, encrypted persistence, nonce/revision checks, private status and queue review. Extend that owner with a separate steward_access kind rather than treating garden membership as stewardship.

Scope: Shared protocol and lifecycle, Agent service and migration, Admin requester and review interfaces, localized copy, tests and labeled screenshots. No Solidity changes, dependency updates, deployment, real role transactions, or unrelated report changes.

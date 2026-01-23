# Green Goods Admin — Bugbot Rules (warnings-first)

Rules for role-based access control and admin patterns.

---

## A) Permission checks before mutations

If any changed file contains `/(addGardener|removeGardener|addOperator|removeOperator)\(/` without `useGardenPermissions` or `canAdd` nearby, then:
- Add a non-blocking Bug titled "Admin: verify permission check"
- Body: "Consider verifying permissions with `useGardenPermissions()` before mutations. See `packages/admin/.cursor/rules/access-control.mdc`."

---

## B) Toast for all transactions

If any changed file contains `/writeContract(Async)?\(/` without `useToastAction` or toast preset nearby, then:
- Add a non-blocking Bug titled "Admin: transaction without toast"
- Body: "Wrap contract calls with `useToastAction()` or use toast presets (`workToasts`, `approvalToasts`). Users need feedback."

---

## C) Role-based routing

If any changed file defines routes without role guards, then:
- Add a non-blocking Bug titled "Admin: verify route protection"
- Body: "Protect admin routes with `RequireDeployer` or `RequireOperatorOrDeployer`. See `packages/admin/.cursor/rules/access-control.mdc`."

---

## Reference

- `.cursor/rules/access-control.mdc` — Role patterns
- `.cursor/rules/component-workflows.mdc` — Toast + modal patterns

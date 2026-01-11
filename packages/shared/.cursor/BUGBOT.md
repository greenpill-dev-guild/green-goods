# Green Goods Shared — Bugbot Rules (warnings-first)

Rules for centralized hooks, providers, and state management.

---

## A) Query keys must be centralized

If any changed file contains `/queryKey:\s*\[/` without `queryKeys\.`, then:
- Add a non-blocking Bug titled "Shared: ad-hoc query key"
- Body: "Use centralized query keys: `queryKeys.works.merged(...)`, `queryKeys.gardens.all(...)`. See `packages/shared/.cursor/rules/state-patterns.mdc`."

---

## B) Provider nesting order

If any changed file modifies provider hierarchy and violates required order, then:
- Add a non-blocking Bug titled "Shared: verify provider nesting order"
- Body: "Providers must nest: WagmiProvider > QueryClientProvider > AppKitProvider > AuthProvider > AppProvider > JobQueueProvider > WorkProvider. See `packages/shared/.cursor/rules/state-patterns.mdc#provider-hierarchy`."

---

## C) Event-driven updates only

If any changed file contains `/setInterval\s*\(/` or periodic invalidation, then:
- Add a non-blocking Bug titled "Shared: polling instead of events"
- Body: "Use `useJobQueueEvents()` or React Query subscription patterns. No polling."

---

## Reference

- `.cursor/rules/state-patterns.mdc` — Provider/store patterns
- `.cursor/rules/hook-architecture.mdc` — Hook creation guide

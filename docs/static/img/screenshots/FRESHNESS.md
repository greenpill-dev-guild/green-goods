# Screenshot freshness manifest — June 10 hardening window

This manifest records the freshness decision for checked-in docs screenshots. It is intentionally metadata-only: stale screenshots are retained until a real, safe app/admin/docs surface can replace them.

| Path | Size | Freshness decision | Replacement condition |
|---|---:|---|---|
| `admin-create-garden.png` | 2880×1086 | Stale-but-retained | Replace with the stable admin Create Garden form, populated enough to teach the flow. |
| `admin-work-queue.png` | 1280×800 | Stale-but-retained | Replace with a pending-work queue sourced from safe fixture/staging data. |
| `admin-work-detail.png` | 2544×1328 | Stale-but-retained | Replace with a selected submission review surface showing evidence and approve/reject context. |
| `admin-garden-impact.png` | 1280×800 | Stale-but-retained | Replace with the stable Certify/Create Hypercert surface. |
| `client-work-dashboard.png` | 622×1198 | Stale-but-retained | Replace with the Work Dashboard/status surface, not a home or garden-list view. |
| Other screenshots in this directory | varies | Out of scope for PRD-535 | Reassess only when the nearby docs page is in the hardening scope. |

Do not delete stale screenshots unless the MDX reference is removed or a replacement is committed in the same PR.

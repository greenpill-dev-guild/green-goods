# Builder docs authority correction — 2026-08-30

Two immutable reports from 2026-08-21 refer to
`docs/docs/builders/packages/client-pwa-token-audit.generated.md` because that was the generated
artifact path when the evidence was recorded:

- `reports/admin-console-2026-08-21.md`
- `reports/client-loop-2026-08-21.md`

The builder documentation authority migration removed that public page. The executable design
check now writes its detailed output to `output/design/client-pwa-token-audit.md`, which remains a
local or CI artifact rather than builder-facing documentation. The dated reports are preserved as
historical evidence; their old path is not a current authority or regeneration target.

/**
 * Garden reporting lab: the chosen product and workspace names (DL-182, DL-184)
 * where a steward meets them. Naming is settled; reporting remains a proposal.
 */
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-(--admin-radius-md) border border-stroke-soft bg-bg-white p-3">
      <span className="type-meta-sm font-medium uppercase tracking-[0.06em] text-text-soft">
        {label}
      </span>
      {children}
    </div>
  );
}

export function NamingPreview() {
  const { formatMessage } = useIntl();
  const name = formatMessage({ id: "app.admin.brand", defaultMessage: "Green Goods Hub" });
  const review = formatMessage({ id: "hub.nav.review", defaultMessage: "Review" });
  const labels = [
    review,
    formatMessage({ id: "hub.nav.garden", defaultMessage: "Garden" }),
    formatMessage({ id: "hub.nav.community", defaultMessage: "Community" }),
    formatMessage({ id: "app.admin.nav.actions", defaultMessage: "Actions" }),
  ];

  return (
    <div className="flex flex-col gap-3" data-component="NamingPreview">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Specimen label="Browser tab">
          <span className="truncate type-body text-text-strong">Reports · Garden · {name}</span>
        </Specimen>
        <Specimen label="Sign-in">
          <span className="type-title-sm font-semibold text-text-strong">Sign in to {name}</span>
        </Specimen>
        <Specimen label="Workspaces">
          <span className="flex flex-wrap gap-1">
            {labels.map((label) => (
              <span
                key={label}
                className="rounded-(--admin-radius-full) border border-stroke-soft px-2 type-meta text-text-sub"
              >
                {label}
              </span>
            ))}
          </span>
        </Specimen>
        <Specimen label="In a sentence">
          <span className="type-body text-text-strong">
            Open {name}, then {review} › Work to review submissions.
          </span>
        </Specimen>
      </div>
      <p className="type-body text-text-sub">
        Green Goods Hub names the product. Review names its review workspace (DL-182, DL-184).
      </p>
    </div>
  );
}

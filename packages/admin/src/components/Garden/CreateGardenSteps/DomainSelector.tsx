import { cn, Domain, DOMAIN_COLORS, useCreateGardenStore } from "@green-goods/shared";
import { useIntl } from "react-intl";

const DOMAINS = [
  { value: Domain.SOLAR, labelId: "app.garden.create.domain.solar", defaultLabel: "Solar" },
  { value: Domain.AGRO, labelId: "app.garden.create.domain.agro", defaultLabel: "Agroforestry" },
  { value: Domain.EDU, labelId: "app.garden.create.domain.edu", defaultLabel: "Education" },
  { value: Domain.WASTE, labelId: "app.garden.create.domain.waste", defaultLabel: "Waste" },
] as const;

interface DomainSelectorProps {
  showValidation: boolean;
}

export function DomainSelector({ showValidation }: DomainSelectorProps) {
  const { formatMessage } = useIntl();
  const domains = useCreateGardenStore((s) => s.form.domains);
  const setField = useCreateGardenStore((s) => s.setField);

  const toggleDomain = (domain: Domain) => {
    if (domains.includes(domain)) {
      // Don't allow deselecting the last domain
      if (domains.length > 1) {
        setField(
          "domains",
          domains.filter((d) => d !== domain)
        );
      }
    } else {
      setField("domains", [...domains, domain]);
    }
  };

  const hasError = showValidation && domains.length === 0;

  return (
    <div className="space-y-1.5 text-sm">
      <span className="font-medium text-text-strong">
        {formatMessage({
          id: "app.garden.create.domainsLabel",
          defaultMessage: "Domains *",
        })}
      </span>
      <p className="text-xs text-text-soft">
        {formatMessage({
          id: "app.garden.create.domainsHelp",
          defaultMessage: "Select the action domains this garden will focus on",
        })}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {DOMAINS.map(({ value, labelId, defaultLabel }) => {
          const isSelected = domains.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleDomain(value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                isSelected
                  ? "border-primary-base bg-primary-alpha-10 text-text-strong"
                  : "border-stroke-soft bg-bg-white text-text-sub hover:border-stroke-strong"
              )}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: DOMAIN_COLORS[value] }}
              />
              {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
            </button>
          );
        })}
      </div>
      {hasError && (
        <p role="alert" className="text-xs text-error-base">
          {formatMessage({
            id: "app.garden.create.domainsRequired",
            defaultMessage: "Select at least one domain",
          })}
        </p>
      )}
    </div>
  );
}

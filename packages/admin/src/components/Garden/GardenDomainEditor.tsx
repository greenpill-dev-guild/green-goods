import {
  cn,
  Domain,
  DOMAIN_COLORS,
  expandDomainMask,
  useGardenDomains,
  useSetGardenDomains,
  type Address,
} from "@green-goods/shared";
import { RiLoader4Line } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";

const DOMAINS = [
  { value: Domain.SOLAR, labelId: "app.garden.create.domain.solar", defaultLabel: "Solar" },
  { value: Domain.AGRO, labelId: "app.garden.create.domain.agro", defaultLabel: "Agroforestry" },
  { value: Domain.EDU, labelId: "app.garden.create.domain.edu", defaultLabel: "Education" },
  { value: Domain.WASTE, labelId: "app.garden.create.domain.waste", defaultLabel: "Waste" },
] as const;

interface GardenDomainEditorProps {
  gardenAddress: Address;
  canManage: boolean;
}

export function GardenDomainEditor({ gardenAddress, canManage }: GardenDomainEditorProps) {
  const { formatMessage } = useIntl();
  const { data: domainMask, isLoading: isLoadingDomains } = useGardenDomains(gardenAddress);
  const { mutate: setDomains, isPending } = useSetGardenDomains();

  // Local selection state, synced from on-chain data
  const [selected, setSelected] = useState<Domain[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync on-chain data → local state when read completes or changes
  useEffect(() => {
    if (domainMask !== undefined) {
      const onChain = expandDomainMask(Number(domainMask));
      setSelected(onChain);
      setHasChanges(false);
    }
  }, [domainMask]);

  const toggleDomain = (domain: Domain) => {
    setSelected((prev) => {
      let next: Domain[];
      if (prev.includes(domain)) {
        if (prev.length <= 1) return prev; // keep at least one
        next = prev.filter((d) => d !== domain);
      } else {
        next = [...prev, domain];
      }
      // Check if different from on-chain
      const onChain = domainMask !== undefined ? expandDomainMask(Number(domainMask)) : [];
      const same = next.length === onChain.length && next.every((d) => onChain.includes(d));
      setHasChanges(!same);
      return next;
    });
  };

  const handleSave = () => {
    if (selected.length === 0) return;
    setDomains(
      { gardenAddress, domains: selected },
      {
        onSuccess: () => setHasChanges(false),
      }
    );
  };

  if (isLoadingDomains) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm">
        <RiLoader4Line className="h-4 w-4 animate-spin text-text-soft" />
        <span className="text-sm text-text-soft">
          {formatMessage({ id: "app.garden.domains.editTitle", defaultMessage: "Domains" })}
        </span>
      </div>
    );
  }

  // Read-only view: show active domains as static chips
  if (!canManage) {
    const activeDomains = DOMAINS.filter(({ value }) => selected.includes(value));
    if (activeDomains.length === 0) return null;

    return (
      <div className="space-y-2 rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-text-strong">
          {formatMessage({ id: "app.garden.domains.editTitle", defaultMessage: "Domains" })}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {activeDomains.map(({ value, labelId, defaultLabel }) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full border border-stroke-soft bg-bg-white px-2.5 py-0.5 text-xs text-text-strong"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: DOMAIN_COLORS[value] }}
              />
              {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Editable view: interactive toggle buttons for managers
  return (
    <div className="space-y-3 rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div>
        <h3 className="text-sm font-semibold text-text-strong">
          {formatMessage({ id: "app.garden.domains.editTitle", defaultMessage: "Domains" })}
        </h3>
        <p className="mt-0.5 text-xs text-text-soft">
          {formatMessage({
            id: "app.garden.domains.editDescription",
            defaultMessage: "Select the action domains this garden focuses on",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {DOMAINS.map(({ value, labelId, defaultLabel }) => {
          const isSelected = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              disabled={isPending}
              onClick={() => toggleDomain(value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                isSelected
                  ? "border-primary-base bg-primary-alpha-10 text-text-strong"
                  : "border-stroke-soft bg-bg-white text-text-sub hover:border-stroke-strong",
                isPending && "cursor-not-allowed opacity-50"
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

      {hasChanges && (
        <Button size="sm" onClick={handleSave} disabled={isPending || selected.length === 0}>
          {isPending ? <RiLoader4Line className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {formatMessage({ id: "app.garden.domains.save", defaultMessage: "Save domains" })}
        </Button>
      )}
    </div>
  );
}

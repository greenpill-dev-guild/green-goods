import {
  type Address,
  cn,
  DOMAIN_COLORS,
  Domain,
  expandDomainMask,
  useGardenDomains,
  useSetGardenDomains,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";

const DOMAINS = [
  { value: Domain.SOLAR, labelId: "app.garden.create.domain.solar", defaultLabel: "Solar" },
  { value: Domain.AGRO, labelId: "app.garden.create.domain.agro", defaultLabel: "Agroforestry" },
  { value: Domain.EDU, labelId: "app.garden.create.domain.edu", defaultLabel: "Education" },
  { value: Domain.WASTE, labelId: "app.garden.create.domain.waste", defaultLabel: "Waste" },
] as const;

interface GardenDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
}

export function GardenDomainModal({ isOpen, onClose, gardenAddress }: GardenDomainModalProps) {
  const { formatMessage } = useIntl();
  const { data: domainMask, isLoading: isLoadingDomains } = useGardenDomains(gardenAddress);
  const { mutate: setDomains, isPending } = useSetGardenDomains();

  const [selected, setSelected] = useState<Domain[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

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
        if (prev.length <= 1) return prev;
        next = prev.filter((d) => d !== domain);
      } else {
        next = [...prev, domain];
      }
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
        onSuccess: () => {
          setHasChanges(false);
          onClose();
        },
      }
    );
  };

  const handleCancel = () => {
    if (domainMask !== undefined) {
      setSelected(expandDomainMask(Number(domainMask)));
      setHasChanges(false);
    }
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && handleCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content className="fixed z-50 w-full max-w-md overflow-hidden bg-bg-white shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-stroke-soft p-4">
            <div className="min-w-0 flex-1 pt-1">
              <Dialog.Title className="text-lg font-semibold text-text-strong">
                {formatMessage({ id: "app.garden.detail.editDomainsTitle" })}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-text-sub">
                {formatMessage({ id: "app.garden.detail.editDomainsDescription" })}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                aria-label={formatMessage({ id: "app.common.close" })}
                disabled={isPending}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Domain toggle grid */}
          <div className="p-4">
            {isLoadingDomains ? (
              <div className="flex items-center justify-center py-8">
                <RiLoader4Line className="h-6 w-6 animate-spin text-text-soft" />
              </div>
            ) : (
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
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-stroke-soft p-4">
            <button
              type="button"
              disabled={isPending}
              onClick={handleCancel}
              className="flex-1 rounded-lg bg-bg-weak px-4 py-3 text-sm font-medium text-text-strong transition hover:bg-bg-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
            >
              {formatMessage({ id: "app.common.cancel" })}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !hasChanges || selected.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
            >
              {isPending && <RiLoader4Line className="h-4 w-4 animate-spin" />}
              {formatMessage({ id: "app.garden.domains.save", defaultMessage: "Save domains" })}
            </button>
          </div>

          {/* Mobile drag indicator */}
          <div className="flex justify-center pb-2 pt-1 sm:hidden">
            <div className="h-1 w-12 rounded-full bg-stroke-sub" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

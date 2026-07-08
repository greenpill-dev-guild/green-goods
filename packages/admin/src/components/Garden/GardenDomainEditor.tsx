import {
  type Address,
  DOMAIN_COLORS,
  Domain,
  expandDomainMask,
  useDirtyClose,
  useGardenDomains,
  useSetGardenDomains,
} from "@green-goods/shared";
import { RiLoader4Line } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "../AdminDialog";
import { AdminButton } from "../AdminButton";
import { AdminSelectableCard } from "../AdminSelectableCard";
import { DiscardChangesDialog } from "../DiscardChangesDialog";

const DOMAINS = [
  {
    value: Domain.SOLAR,
    labelId: "app.garden.create.domain.solar",
    defaultLabel: "Solar",
    descriptionId: "app.garden.create.domain.solar.description",
    defaultDescription: "Track solar panel installations, kWh generated, and maintenance",
  },
  {
    value: Domain.AGRO,
    labelId: "app.garden.create.domain.agro",
    defaultLabel: "Agroforestry",
    descriptionId: "app.garden.create.domain.agro.description",
    defaultDescription: "Document tree planting, harvests, and land stewardship",
  },
  {
    value: Domain.EDU,
    labelId: "app.garden.create.domain.edu",
    defaultLabel: "Education",
    descriptionId: "app.garden.create.domain.edu.description",
    defaultDescription: "Record workshops, trainings, and knowledge sharing",
  },
  {
    value: Domain.WASTE,
    labelId: "app.garden.create.domain.waste",
    defaultLabel: "Waste",
    descriptionId: "app.garden.create.domain.waste.description",
    defaultDescription: "Log waste collection, recycling, and composting activities",
  },
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

  // Confirm-before-discard: unsaved domain selection confirms on X/scrim/
  // Escape. The footer Cancel still exits directly per the dialog contract.
  const dirtyClose = useDirtyClose({ isDirty: hasChanges, onClose: handleCancel });

  return (
    <>
      <AdminDialog
        open={isOpen}
        onOpenChange={dirtyClose.onOpenChange}
        size="md"
        // Workspace tone — mounted from the Garden Profile dialog.
        tone="garden"
        title={formatMessage({ id: "app.garden.detail.editDomainsTitle" })}
        description={formatMessage({ id: "app.garden.detail.editDomainsDescription" })}
        preventClose={isPending}
        actions={
          <>
            <AdminButton type="button" disabled={isPending} onClick={handleCancel} variant="text">
              {formatMessage({ id: "app.common.cancel" })}
            </AdminButton>
            <AdminButton
              type="button"
              onClick={handleSave}
              disabled={isPending || !hasChanges || selected.length === 0}
              loading={isPending}
            >
              {formatMessage({ id: "app.garden.domains.save", defaultMessage: "Save domains" })}
            </AdminButton>
          </>
        }
      >
        {isLoadingDomains ? (
          <div className="flex items-center justify-center py-8">
            <RiLoader4Line className="h-6 w-6 animate-spin text-text-soft" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DOMAINS.map(({ value, labelId, defaultLabel, descriptionId, defaultDescription }) => {
              const isSelected = selected.includes(value);
              return (
                <AdminSelectableCard
                  key={value}
                  disabled={isPending}
                  onClick={() => toggleDomain(value)}
                  selected={isSelected}
                  title={formatMessage({ id: labelId, defaultMessage: defaultLabel })}
                  description={formatMessage({
                    id: descriptionId,
                    defaultMessage: defaultDescription,
                  })}
                  leadingVisual={
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: DOMAIN_COLORS[value] }}
                    />
                  }
                />
              );
            })}
          </div>
        )}
      </AdminDialog>
      <DiscardChangesDialog
        open={dirtyClose.confirmOpen}
        onKeepEditing={dirtyClose.cancelClose}
        onDiscard={dirtyClose.confirmClose}
        tone="garden"
      />
    </>
  );
}

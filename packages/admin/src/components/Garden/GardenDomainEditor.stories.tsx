import { cn, DialogShell, DOMAIN_COLORS, Domain } from "@green-goods/shared";
import { RiLoader4Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "storybook/test";

// ⚠ VISUAL HARNESS — not the real GardenDomainEditor.
// The real component reads current domains via `useReadContract`
// (`useGardenDomains`) and writes via `useSetGardenDomains`. Seeding the
// read would require intercepting wagmi's internal query cache, which
// wasn't practical for this pass. This harness mirrors the dialog body
// and exposes the loading / saving / selection states as plain props so
// reviewers can inspect each visual state. Treat this story as a
// design-system review surface, NOT as evidence that the real hook
// wiring works.

const DOMAINS = [
  {
    value: Domain.SOLAR,
    label: "Solar",
    description: "Track solar panel installations, kWh generated, and maintenance",
  },
  {
    value: Domain.AGRO,
    label: "Agroforestry",
    description: "Document tree planting, harvests, and land stewardship",
  },
  {
    value: Domain.EDU,
    label: "Education",
    description: "Record workshops, trainings, and knowledge sharing",
  },
  {
    value: Domain.WASTE,
    label: "Waste",
    description: "Log waste collection, recycling, and composting activities",
  },
] as const;

interface GardenDomainEditorHarnessProps {
  isOpen: boolean;
  initialSelected?: Domain[];
  isLoadingDomains?: boolean;
  isPending?: boolean;
  onClose?: () => void;
}

function GardenDomainEditorHarness({
  isOpen,
  initialSelected = [Domain.AGRO],
  isLoadingDomains = false,
  isPending = false,
  onClose = fn(),
}: GardenDomainEditorHarnessProps) {
  const [selected, setSelected] = useState<Domain[]>(initialSelected);

  const toggleDomain = (domain: Domain) => {
    setSelected((prev) => {
      if (prev.includes(domain)) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== domain);
      }
      return [...prev, domain];
    });
  };

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Edit garden domains"
      description="Domains determine which actions a garden can track."
      preventClose={isPending}
      bodyClassName="p-0"
    >
      <div className="p-4">
        {isLoadingDomains ? (
          <div className="flex items-center justify-center py-8">
            <RiLoader4Line className="h-6 w-6 animate-spin text-text-soft" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DOMAINS.map(({ value, label, description }) => {
              const isSelected = selected.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={isPending}
                  onClick={() => toggleDomain(value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-sm transition-colors text-left",
                    isSelected
                      ? "border-primary-base bg-primary-alpha-10 text-text-strong"
                      : "border-stroke-soft bg-bg-white text-text-sub hover:border-stroke-strong",
                    isPending && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: DOMAIN_COLORS[value] }}
                    />
                    {label}
                  </span>
                  <span className="pl-5 text-xs text-text-soft">{description}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3 border-t border-stroke-soft p-4">
        <button
          type="button"
          disabled={isPending}
          className="flex-1 rounded-lg bg-bg-weak px-4 py-3 text-sm font-medium text-text-strong transition hover:bg-bg-soft disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending || selected.length === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending && <RiLoader4Line className="h-4 w-4 animate-spin" />}
          Save domains
        </button>
      </div>
    </DialogShell>
  );
}

const meta: Meta<typeof GardenDomainEditorHarness> = {
  title: "Admin/Workflows/Garden/GardenDomainEditor",
  component: GardenDomainEditorHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `GardenDomainEditor`. Mirrors the dialog body and exposes load / save / selection states as props so every state is reviewable without a wallet stack. The real component reads via wagmi (`useGardenDomains`) and writes via `useSetGardenDomains`; those paths are not exercised here.",
      },
    },
  },
  args: {
    isOpen: true,
    isLoadingDomains: false,
    isPending: false,
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof GardenDomainEditorHarness>;

export const Default: Story = {
  args: {
    initialSelected: [Domain.AGRO],
  },
};

export const MultipleDomains: Story = {
  args: {
    initialSelected: [Domain.AGRO, Domain.SOLAR, Domain.EDU],
  },
};

export const Loading: Story = {
  args: {
    isLoadingDomains: true,
  },
};

export const Saving: Story = {
  args: {
    initialSelected: [Domain.AGRO, Domain.WASTE],
    isPending: true,
  },
};

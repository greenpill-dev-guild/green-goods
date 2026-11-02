import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import {
  type GardenSetup,
  type GardenSetupStep,
  type GardenSetupStepId,
  useGardenSetup,
} from "@green-goods/shared/hooks/garden/useGardenOperations";
import type { Address } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";

const STEP_LABELS: Record<GardenSetupStepId, string> = {
  name: "cockpit.garden.setup.step.name",
  community: "cockpit.garden.setup.step.community",
  pools: "cockpit.garden.setup.step.pools",
  vaults: "cockpit.garden.setup.step.vaults",
  jars: "cockpit.garden.setup.step.jars",
  commitmentPool: "cockpit.garden.setup.step.commitmentPool",
  stewardSafe: "cockpit.garden.setup.step.stewardSafe",
  settlement: "cockpit.garden.setup.step.settlement",
};

const STEP_ACTIONS: Partial<Record<GardenSetupStepId, string>> = {
  name: "cockpit.garden.setup.action.name",
  pools: "cockpit.garden.setup.action.pools",
  vaults: "cockpit.garden.setup.action.vaults",
};

const STATUS_BADGES = {
  done: { variant: "success", label: "cockpit.garden.setup.status.done" },
  missing: { variant: "warning", label: "cockpit.garden.setup.status.missing" },
  pending: { variant: "info", label: "cockpit.garden.setup.status.pending" },
} as const;

const PENDING_HINTS = {
  update: "cockpit.garden.setup.hint.update",
  delivery: "cockpit.garden.setup.hint.delivery",
} as const;

/** Mounts on a garden's Health tab: reads the chain for those who could act on what it finds. */
export function GardenSetupPanel({
  gardenId,
  canManage,
}: {
  gardenId: string;
  canManage: boolean;
}) {
  const setup = useGardenSetup(gardenId as Address, canManage);
  return <GardenSetupCard setup={setup} />;
}

/**
 * What creating this garden should have set up, shown only while a part is missing or still on
 * its way. A complete garden, which is nearly all of them, never sees it.
 */
export function GardenSetupCard({ setup }: { setup: GardenSetup }) {
  const { formatMessage } = useIntl();
  if (!setup.needsAttention && !setup.hasPending) return null;

  return (
    <AdminCard density="none" data-component="GardenSetup" data-region="garden-setup">
      <AdminCardHeader>
        <AdminCardTitle>{formatMessage({ id: "cockpit.garden.setup.title" })}</AdminCardTitle>
      </AdminCardHeader>
      <AdminCardBody className="space-y-3">
        <p className="type-meta text-text-soft">
          {formatMessage({
            id: setup.needsAttention
              ? "cockpit.garden.setup.description"
              : "cockpit.garden.setup.descriptionPending",
          })}
        </p>
        <FactList frame="inset">
          {setup.steps
            .filter((step) => step.status !== "unknown")
            .map((step) => (
              <GardenSetupRow key={step.id} step={step} setup={setup} />
            ))}
        </FactList>
      </AdminCardBody>
    </AdminCard>
  );
}

function GardenSetupRow({ step, setup }: { step: GardenSetupStep; setup: GardenSetup }) {
  const { formatMessage } = useIntl();
  if (step.status === "unknown") return null;
  const missing = step.status === "missing";
  const actionLabel = missing && step.fix === "self" ? STEP_ACTIONS[step.id] : undefined;
  const badge = STATUS_BADGES[step.status];

  let description: string | undefined;
  if (step.status === "pending") {
    description = formatMessage({ id: PENDING_HINTS[step.pendingOn ?? "update"] });
  } else if (missing && step.fix === "team") {
    description = formatMessage({ id: "cockpit.garden.setup.hint.team" });
  } else if (missing && step.fix === "waiting") {
    description = formatMessage({ id: "cockpit.garden.setup.hint.waiting" });
  } else if (missing && step.id === "name" && setup.slug) {
    description = `${setup.slug}.greengoods.eth`;
  }

  return (
    <FactRow
      label={formatMessage({ id: STEP_LABELS[step.id] })}
      description={description}
      value={
        <StatusBadge variant={badge.variant} size="sm">
          {formatMessage({ id: badge.label })}
        </StatusBadge>
      }
      action={
        actionLabel ? (
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            loading={setup.finishing === step.id}
            disabled={setup.finishing !== null}
            onClick={() => void setup.finish(step.id)}
          >
            {formatMessage({ id: actionLabel })}
          </Button>
        ) : undefined
      }
    />
  );
}

import { DOMAIN_LABELS } from "@green-goods/shared/utils/domain";
import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { useCreateGardenController } from "@green-goods/shared/hooks/admin-ui/garden/useCreateGardenController";
import { useCreateGardenStore } from "@green-goods/shared/stores/useCreateGardenStore";
import { type Address, DOMAIN_COLORS } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { EnsAddressText } from "@/components/EnsAddressText";

export interface ReviewStepCost {
  estimate?: ReturnType<typeof useCreateGardenController>["costEstimate"];
  failed?: boolean;
  loading?: boolean;
  gasIsSponsored?: boolean;
}

function CostValue({ children }: { children: string }) {
  return <span className="font-normal text-text-sub">{children}</span>;
}

export function ReviewStep({ cost = {} }: { cost?: ReviewStepCost }) {
  const { formatMessage } = useIntl();
  const form = useCreateGardenStore((s) => s.form);
  const { estimate, gasIsSponsored = false } = cost;
  const covered = formatMessage({ id: "app.admin.garden.create.cost.covered" });
  const pendingCost = cost.failed
    ? formatMessage({ id: "app.admin.garden.create.confirm.estimateFallback" })
    : formatMessage({ id: "app.admin.garden.create.confirm.estimating" });
  const networkFee = gasIsSponsored
    ? covered
    : estimate
      ? `≈ ${estimate.formatted.txFeeEth} ETH`
      : pendingCost;
  const nameFee = !estimate
    ? pendingCost
    : estimate.nameFunding === "reserve"
      ? covered
      : estimate.nameFunding === "creator"
        ? `≈ ${estimate.formatted.ccipFeeEth} ETH`
        : formatMessage({ id: "app.admin.garden.create.cost.nameLater" });
  return (
    <div className="space-y-3">
      <div className="space-y-4 rounded-xl border border-stroke-soft bg-bg-weak p-4">
        <FactList frame="inset">
          <FactRow
            label={formatMessage({
              id: "app.garden.create.gardenName",
              defaultMessage: "Garden name",
            })}
            value={form.name}
          />
          <FactRow
            label={formatMessage({ id: "app.garden.create.location", defaultMessage: "Location" })}
            value={form.location}
          />
          {form.slug && (
            <FactRow
              label={formatMessage({ id: "app.garden.create.ensSubdomain" })}
              value={<span className="font-mono type-meta">{form.slug}.greengoods.eth</span>}
            />
          )}
          <FactRow
            label={formatMessage({
              id: "app.garden.create.description",
              defaultMessage: "Description",
            })}
            value={form.description}
          />
          {form.bannerImage && (
            <FactRow
              label={formatMessage({
                id: "app.garden.create.bannerImage",
                defaultMessage: "Banner image",
              })}
              value={
                <img
                  src={form.bannerImage}
                  alt=""
                  className="h-32 w-full rounded-lg object-cover"
                />
              }
            />
          )}
          <FactRow
            label={formatMessage({
              id: "app.garden.create.confirm.domains",
              defaultMessage: "Domains",
            })}
            value={
              <span className="flex flex-wrap gap-1.5">
                {form.domains.map((domain) => (
                  <span
                    key={domain}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stroke-soft bg-bg-white px-2.5 py-0.5 type-meta font-normal text-text-strong"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: DOMAIN_COLORS[domain] }}
                    />
                    {formatMessage({
                      id: DOMAIN_LABELS[domain].gardenLabelId,
                      defaultMessage: DOMAIN_LABELS[domain].defaultMessage,
                    })}
                  </span>
                ))}
              </span>
            }
          />
          <FactRow
            label={formatMessage({
              id: "app.garden.create.openJoining",
              defaultMessage: "Open joining",
            })}
            value={
              form.openJoining
                ? formatMessage({
                    id: "app.garden.create.openJoining.enabled",
                    defaultMessage: "Anyone can join",
                  })
                : formatMessage({
                    id: "app.garden.create.openJoining.disabled",
                    defaultMessage: "Invite only",
                  })
            }
          />
          <FactRow
            label={formatMessage({
              id: "app.garden.create.plannedGardeners",
              defaultMessage: "Planned gardeners",
            })}
            value={
              form.gardeners.length === 0 ? (
                <span className="font-normal text-text-soft">
                  {formatMessage({
                    id: "app.garden.create.noGardenersYet",
                    defaultMessage: "No gardeners added yet.",
                  })}
                </span>
              ) : (
                <ul className="space-y-1">
                  {form.gardeners.map((gardener) => (
                    <li key={gardener}>
                      <EnsAddressText address={gardener as Address} />
                    </li>
                  ))}
                </ul>
              )
            }
          />
          <FactRow
            label={formatMessage({
              id: "app.garden.create.plannedStewards",
              defaultMessage: "Planned stewards",
            })}
            value={
              form.stewards.length === 0 ? (
                <span className="font-normal text-text-soft">
                  {formatMessage({
                    id: "app.garden.create.noStewardsYet",
                    defaultMessage: "No stewards assigned yet.",
                  })}
                </span>
              ) : (
                <ul className="space-y-1">
                  {form.stewards.map((steward) => (
                    <li key={steward}>
                      <EnsAddressText address={steward as Address} />
                    </li>
                  ))}
                </ul>
              )
            }
          />
          <FactRow
            label={formatMessage({ id: "app.admin.garden.create.confirm.gasFee" })}
            value={<CostValue>{networkFee}</CostValue>}
          />
          <FactRow
            label={formatMessage({ id: "app.admin.garden.create.confirm.ensFee" })}
            value={<CostValue>{nameFee}</CostValue>}
          />
        </FactList>
        <Alert variant="info">
          {formatMessage({ id: "app.garden.create.teamAssignmentNotice" })}
        </Alert>
      </div>
    </div>
  );
}

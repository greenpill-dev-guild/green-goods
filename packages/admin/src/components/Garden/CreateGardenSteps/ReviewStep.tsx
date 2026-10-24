import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { useCreateGardenStore } from "@green-goods/shared/stores/useCreateGardenStore";
import { type Address, DOMAIN_COLORS, Domain } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { EnsAddressText } from "@/components/EnsAddressText";

const DOMAIN_LABELS: Record<Domain, { id: string; defaultMessage: string }> = {
  [Domain.SOLAR]: { id: "app.garden.create.domain.solar", defaultMessage: "Solar" },
  [Domain.AGRO]: { id: "app.garden.create.domain.agro", defaultMessage: "Agroforestry" },
  [Domain.EDU]: { id: "app.garden.create.domain.edu", defaultMessage: "Education" },
  [Domain.WASTE]: { id: "app.garden.create.domain.waste", defaultMessage: "Waste" },
};

export function ReviewStep() {
  const { formatMessage } = useIntl();
  const form = useCreateGardenStore((s) => s.form);
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
              label={formatMessage({
                id: "app.garden.create.ensSubdomain",
                defaultMessage: "ENS subdomain",
              })}
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
                    {formatMessage(DOMAIN_LABELS[domain])}
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
                    defaultMessage: "Anyone can request to join",
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
        </FactList>
        <p className="rounded-md border border-stroke-soft bg-bg-soft px-3 py-2.5 type-meta text-text-sub">
          {formatMessage({
            id: "app.garden.create.teamAssignmentNotice",
            defaultMessage:
              "Planned members are included in deployment. Verify role grants from Garden Members after creation.",
          })}
        </p>
      </div>
    </div>
  );
}

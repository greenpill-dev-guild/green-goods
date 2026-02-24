import { useCreateGardenStore } from "@green-goods/shared";
import { useIntl } from "react-intl";

export function ReviewStep() {
  const { formatMessage } = useIntl();
  const form = useCreateGardenStore((s) => s.form);
  return (
    <div className="space-y-3">
      <div className="space-y-4 rounded-xl border border-stroke-soft bg-bg-weak p-4">
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({ id: "app.garden.create.gardenName", defaultMessage: "Garden name" })}
            </dt>
            <dd className="mt-1 text-sm text-text-strong">{form.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({ id: "app.garden.create.location", defaultMessage: "Location" })}
            </dt>
            <dd className="mt-1 text-sm text-text-strong">{form.location}</dd>
          </div>
          {form.slug && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">
                {formatMessage({
                  id: "app.garden.create.ensSubdomain",
                  defaultMessage: "ENS subdomain",
                })}
              </dt>
              <dd className="mt-1 font-mono text-xs text-text-strong">
                {form.slug}.greengoods.eth
              </dd>
            </div>
          )}
          <div className="md:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({
                id: "app.garden.create.description",
                defaultMessage: "Description",
              })}
            </dt>
            <dd className="mt-1 text-sm text-text-strong">{form.description}</dd>
          </div>
          {form.bannerImage && (
            <div className="md:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">
                {formatMessage({
                  id: "app.garden.create.bannerImage",
                  defaultMessage: "Banner image",
                })}
              </dt>
              <dd className="mt-2">
                <img
                  src={form.bannerImage}
                  alt=""
                  className="h-32 w-full rounded-lg object-cover"
                />
              </dd>
            </div>
          )}
        </dl>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({
                id: "app.garden.create.openJoining",
                defaultMessage: "Open joining",
              })}
            </dt>
            <dd className="mt-1 text-sm text-text-strong">
              {form.openJoining
                ? formatMessage({
                    id: "app.garden.create.openJoining.enabled",
                    defaultMessage: "Anyone can request to join",
                  })
                : formatMessage({
                    id: "app.garden.create.openJoining.disabled",
                    defaultMessage: "Invite only",
                  })}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({
                id: "app.garden.create.plannedGardeners",
                defaultMessage: "Planned gardeners",
              })}
            </dt>
            <dd>
              {form.gardeners.length === 0 ? (
                <p className="mt-2 text-xs text-text-soft">
                  {formatMessage({
                    id: "app.garden.create.noGardenersYet",
                    defaultMessage: "No gardeners added yet.",
                  })}
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {form.gardeners.map((gardener) => (
                    <li key={gardener} className="font-mono text-xs text-text-strong">
                      {gardener}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({
                id: "app.garden.create.plannedOperators",
                defaultMessage: "Planned operators",
              })}
            </dt>
            <dd>
              {form.operators.length === 0 ? (
                <p className="mt-2 text-xs text-text-soft">
                  {formatMessage({
                    id: "app.garden.create.noOperatorsYet",
                    defaultMessage: "No operators assigned yet.",
                  })}
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {form.operators.map((operator) => (
                    <li key={operator} className="font-mono text-xs text-text-strong">
                      {operator}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
        <p className="rounded-md border border-stroke-soft bg-bg-soft px-3 py-2.5 text-xs text-text-sub">
          {formatMessage({
            id: "app.garden.create.teamAssignmentNotice",
            defaultMessage:
              "Planned members are not assigned during deployment. Add them from Garden Members after creation.",
          })}
        </p>
      </div>
    </div>
  );
}

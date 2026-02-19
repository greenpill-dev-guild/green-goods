import { useCreateGardenStore } from "@green-goods/shared";
import { useIntl } from "react-intl";

export function ReviewStep() {
  const { formatMessage } = useIntl();
  const form = useCreateGardenStore((s) => s.form);
  return (
    <div className="space-y-3">
      <div className="space-y-4 rounded-xl border border-gray-100 bg-bg-weak p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({ id: "app.garden.create.gardenName", defaultMessage: "Garden name" })}
            </h4>
            <p className="mt-1 text-sm text-text-strong">{form.name}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({ id: "app.garden.create.location", defaultMessage: "Location" })}
            </h4>
            <p className="mt-1 text-sm text-text-strong">{form.location}</p>
          </div>
          {form.slug && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
                {formatMessage({
                  id: "app.garden.create.ensSubdomain",
                  defaultMessage: "ENS subdomain",
                })}
              </h4>
              <p className="mt-1 font-mono text-xs text-text-strong">{form.slug}.greengoods.eth</p>
            </div>
          )}
          <div className="md:col-span-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({
                id: "app.garden.create.description",
                defaultMessage: "Description",
              })}
            </h4>
            <p className="mt-1 text-sm text-text-strong">{form.description}</p>
          </div>
          {form.bannerImage && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
                {formatMessage({
                  id: "app.garden.create.bannerImage",
                  defaultMessage: "Banner image",
                })}
              </h4>
              <p className="mt-1 break-words text-sm text-text-strong">{form.bannerImage}</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({
                id: "app.garden.create.plannedGardeners",
                defaultMessage: "Planned gardeners",
              })}
            </h4>
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
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {formatMessage({
                id: "app.garden.create.plannedOperators",
                defaultMessage: "Planned operators",
              })}
            </h4>
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
          </div>
        </div>
        <p className="rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-xs text-text-soft">
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

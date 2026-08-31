import { useAddressInput } from "@green-goods/shared/hooks/utils/useAddressInput";
import { useCreateGardenStore } from "@green-goods/shared/stores/useCreateGardenStore";
import type { Address } from "@green-goods/shared/types/domain";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { FormattedMessage, useIntl } from "react-intl";
import { AdminButton, AdminIconButton } from "@/components/AdminButton";
import { AdminTextField } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";

export function TeamStep() {
  const form = useCreateGardenStore((s) => s.form);
  const addGardener = useCreateGardenStore((s) => s.addGardener);
  const removeGardener = useCreateGardenStore((s) => s.removeGardener);
  const addSteward = useCreateGardenStore((s) => s.addSteward);
  const removeSteward = useCreateGardenStore((s) => s.removeSteward);
  const { formatMessage } = useIntl();

  // Use shared hook for both gardener and steward inputs
  const gardenerInput = useAddressInput(addGardener, formatMessage);
  const stewardInput = useAddressInput(addSteward, formatMessage);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary-light bg-primary-lighter/40 p-3.5 body-sm text-text-sub">
        <p className="label-md font-semibold text-text-strong">
          {formatMessage({
            id: "app.admin.garden.create.teamAdvisory.title",
            defaultMessage: "Planned team members",
          })}
        </p>
        <p className="mt-1">
          {formatMessage({
            id: "app.admin.garden.create.teamAdvisory.message",
            defaultMessage:
              "These addresses are included in deployment. Verify the role grants from Garden Members after the garden is created.",
          })}
        </p>
        <p className="mt-1">
          {formatMessage({
            id: "app.admin.garden.create.teamAdvisory.stewardNote",
            defaultMessage:
              "Note: Stewards automatically have gardener access. You don't need to add them to both lists.",
          })}
        </p>
      </div>

      {/* Stewards section — shown first since they have broader permissions */}
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <AdminTextField
            id="create-garden-steward-address"
            className="min-w-0 flex-1 font-mono"
            label={formatMessage({
              id: "app.roles.steward.plural",
              defaultMessage: "Stewards",
            })}
            value={stewardInput.input}
            onChange={(event) => stewardInput.setInput(event.target.value)}
            placeholder={formatMessage({
              id: "admin.team.addressPlaceholder",
              defaultMessage: "0x... or vitalik.eth",
            })}
            error={stewardInput.error || undefined}
            helperText={" "}
          />
          <AdminButton
            variant="tonal"
            size="sm"
            className="mt-1.5"
            onClick={stewardInput.handleAdd}
            disabled={stewardInput.shouldResolveEns && stewardInput.resolvingEns}
            leadingIcon={<RiAddLine />}
          >
            {formatMessage({ id: "app.common.add", defaultMessage: "Add" })}
          </AdminButton>
        </div>
        {stewardInput.shouldResolveEns && (
          <p className="mt-1 body-sm text-text-soft">
            {stewardInput.resolvingEns ? (
              formatMessage({
                id: "app.admin.garden.create.resolvingEns",
                defaultMessage: "Resolving ENS name...",
              })
            ) : stewardInput.resolvedAddress ? (
              <FormattedMessage
                id="app.admin.garden.create.ensResolved"
                defaultMessage="Resolves to {address}"
                values={{
                  address: <EnsAddressText address={stewardInput.resolvedAddress as Address} />,
                }}
              />
            ) : (
              formatMessage({
                id: "app.admin.garden.create.enterValidAddress",
                defaultMessage: "Enter a valid ENS name or 0x address.",
              })
            )}
          </p>
        )}
        <ul className="mt-1.5 space-y-1.5">
          {form.stewards.map((steward) => (
            <li
              key={steward}
              className="flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-white px-3 py-1.5 label-sm font-mono text-text-sub"
            >
              <EnsAddressText address={steward as Address} />
              <AdminIconButton
                size="sm"
                variant="danger"
                onClick={() => removeSteward(form.stewards.indexOf(steward))}
                label={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
              >
                <RiDeleteBinLine />
              </AdminIconButton>
            </li>
          ))}
        </ul>
      </div>

      {/* Gardeners section */}
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <AdminTextField
            id="create-garden-gardener-address"
            className="min-w-0 flex-1 font-mono"
            label={formatMessage({ id: "app.roles.gardener.plural", defaultMessage: "Gardeners" })}
            value={gardenerInput.input}
            onChange={(event) => gardenerInput.setInput(event.target.value)}
            placeholder={formatMessage({
              id: "admin.team.addressPlaceholder",
              defaultMessage: "0x... or vitalik.eth",
            })}
            error={gardenerInput.error || undefined}
            helperText={" "}
          />
          <AdminButton
            variant="tonal"
            size="sm"
            className="mt-1.5"
            onClick={gardenerInput.handleAdd}
            disabled={gardenerInput.shouldResolveEns && gardenerInput.resolvingEns}
            leadingIcon={<RiAddLine />}
          >
            {formatMessage({ id: "app.common.add", defaultMessage: "Add" })}
          </AdminButton>
        </div>
        {gardenerInput.shouldResolveEns && (
          <p className="mt-1 body-sm text-text-soft">
            {gardenerInput.resolvingEns ? (
              formatMessage({
                id: "app.admin.garden.create.resolvingEns",
                defaultMessage: "Resolving ENS name...",
              })
            ) : gardenerInput.resolvedAddress ? (
              <FormattedMessage
                id="app.admin.garden.create.ensResolved"
                defaultMessage="Resolves to {address}"
                values={{
                  address: <EnsAddressText address={gardenerInput.resolvedAddress as Address} />,
                }}
              />
            ) : (
              formatMessage({
                id: "app.admin.garden.create.enterValidAddress",
                defaultMessage: "Enter a valid ENS name or 0x address.",
              })
            )}
          </p>
        )}
        <ul className="mt-1.5 space-y-1.5">
          {form.gardeners.map((gardener) => (
            <li
              key={gardener}
              className="flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-white px-3 py-1.5 label-sm font-mono text-text-sub"
            >
              <EnsAddressText address={gardener as Address} />
              <AdminIconButton
                size="sm"
                variant="danger"
                onClick={() => removeGardener(form.gardeners.indexOf(gardener))}
                label={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
              >
                <RiDeleteBinLine />
              </AdminIconButton>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

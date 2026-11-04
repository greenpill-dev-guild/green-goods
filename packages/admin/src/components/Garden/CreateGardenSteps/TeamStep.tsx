import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { Switch } from "@green-goods/shared/components/Form/ControlPrimitives";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useAddressInput } from "@green-goods/shared/hooks/utils/useAddressInput";
import {
  type AddGardenMemberResult,
  useCreateGardenStore,
} from "@green-goods/shared/stores/useCreateGardenStore";
import type { Address } from "@green-goods/shared/types/domain";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { useCallback, useEffect } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { AdminTextField } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";

export function TeamStep() {
  const form = useCreateGardenStore((s) => s.form);
  const addGardener = useCreateGardenStore((s) => s.addGardener);
  const removeGardener = useCreateGardenStore((s) => s.removeGardener);
  const addSteward = useCreateGardenStore((s) => s.addSteward);
  const removeSteward = useCreateGardenStore((s) => s.removeSteward);
  const setHasUnaddedMember = useCreateGardenStore((s) => s.setHasUnaddedMember);
  const setField = useCreateGardenStore((s) => s.setField);
  const { formatMessage } = useIntl();

  const toInputResult = useCallback(
    (result: AddGardenMemberResult, alreadyAddedId: string) =>
      result.success
        ? { success: true }
        : {
            success: false,
            error: formatMessage({
              id:
                result.reason === "already-added"
                  ? alreadyAddedId
                  : "app.admin.garden.create.invalidAddress",
            }),
          },
    [formatMessage]
  );
  const addGardenerInput = useCallback(
    (address: string) =>
      toInputResult(addGardener(address), "app.admin.garden.create.alreadyGardener"),
    [addGardener, toInputResult]
  );
  const addStewardInput = useCallback(
    (address: string) =>
      toInputResult(addSteward(address), "app.admin.garden.create.alreadySteward"),
    [addSteward, toInputResult]
  );

  // Use shared hook for both gardener and steward inputs
  const gardenerInput = useAddressInput(addGardenerInput, formatMessage);
  const stewardInput = useAddressInput(addStewardInput, formatMessage);

  // An address typed and never added would silently miss the team, so creating waits for it.
  const hasUnaddedMember = Boolean(gardenerInput.trimmedInput || stewardInput.trimmedInput);
  useEffect(() => {
    setHasUnaddedMember(hasUnaddedMember);
    return () => setHasUnaddedMember(false);
  }, [hasUnaddedMember, setHasUnaddedMember]);
  const addHint = formatMessage({ id: "app.admin.garden.create.addHint" });

  return (
    <div className="space-y-5">
      <Alert
        variant="info"
        title={formatMessage({ id: "app.admin.garden.create.teamAdvisory.title" })}
      >
        <p>{formatMessage({ id: "app.admin.garden.create.teamAdvisory.message" })}</p>
        <p className="mt-1">
          {formatMessage({ id: "app.admin.garden.create.teamAdvisory.stewardNote" })}
        </p>
      </Alert>

      <FactList frame="inset">
        <FactRow
          labelId="create-garden-open-joining-label"
          label={formatMessage({ id: "app.garden.create.openJoining" })}
          description={formatMessage({
            id: form.openJoining
              ? "app.garden.create.openJoining.enabled"
              : "app.garden.create.openJoining.disabled",
          })}
          action={
            <Switch
              surface="admin"
              checked={form.openJoining}
              onCheckedChange={(checked) => setField("openJoining", checked === true)}
              aria-labelledby="create-garden-open-joining-label"
            />
          }
        />
      </FactList>

      {/* Stewards section — shown first since they have broader permissions */}
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <AdminTextField
            id="create-garden-steward-address"
            className="min-w-0 flex-1"
            inputProps={{ className: "font-mono" }}
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
            helperText={stewardInput.trimmedInput ? addHint : " "}
          />
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            className="mt-1.5 sm:mt-7.5"
            onClick={stewardInput.handleAdd}
            disabled={stewardInput.shouldResolveEns && stewardInput.resolvingEns}
            leadingIcon={<RiAddLine className="h-4 w-4" aria-hidden="true" />}
          >
            {formatMessage({ id: "app.common.add", defaultMessage: "Add" })}
          </Button>
        </div>
        {stewardInput.shouldResolveEns && (
          <p className="mt-1 type-body text-text-soft">
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
              className="flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-white px-3 py-1.5 type-meta-sm font-mono text-text-sub"
            >
              <EnsAddressText address={steward as Address} />
              <IconButton
                emphasis="tertiary"
                tone="danger"
                size="compact"
                onClick={() => removeSteward(form.stewards.indexOf(steward))}
                aria-label={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
                title={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
                icon={<RiDeleteBinLine />}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Gardeners section */}
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <AdminTextField
            id="create-garden-gardener-address"
            className="min-w-0 flex-1"
            inputProps={{ className: "font-mono" }}
            label={formatMessage({ id: "app.roles.gardener.plural", defaultMessage: "Gardeners" })}
            value={gardenerInput.input}
            onChange={(event) => gardenerInput.setInput(event.target.value)}
            placeholder={formatMessage({
              id: "admin.team.addressPlaceholder",
              defaultMessage: "0x... or vitalik.eth",
            })}
            error={gardenerInput.error || undefined}
            helperText={gardenerInput.trimmedInput ? addHint : " "}
          />
          <Button
            type="button"
            emphasis="secondary"
            size="compact"
            className="mt-1.5 sm:mt-7.5"
            onClick={gardenerInput.handleAdd}
            disabled={gardenerInput.shouldResolveEns && gardenerInput.resolvingEns}
            leadingIcon={<RiAddLine className="h-4 w-4" aria-hidden="true" />}
          >
            {formatMessage({ id: "app.common.add", defaultMessage: "Add" })}
          </Button>
        </div>
        {gardenerInput.shouldResolveEns && (
          <p className="mt-1 type-body text-text-soft">
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
              className="flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-white px-3 py-1.5 type-meta-sm font-mono text-text-sub"
            >
              <EnsAddressText address={gardener as Address} />
              <IconButton
                emphasis="tertiary"
                tone="danger"
                size="compact"
                onClick={() => removeGardener(form.gardeners.indexOf(gardener))}
                aria-label={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
                title={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
                icon={<RiDeleteBinLine />}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { formatAddress, useAddressInput, useCreateGardenStore } from "@green-goods/shared";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";

export function TeamStep() {
  const form = useCreateGardenStore((s) => s.form);
  const addGardener = useCreateGardenStore((s) => s.addGardener);
  const removeGardener = useCreateGardenStore((s) => s.removeGardener);
  const addOperator = useCreateGardenStore((s) => s.addOperator);
  const removeOperator = useCreateGardenStore((s) => s.removeOperator);
  const { formatMessage } = useIntl();

  // Use shared hook for both gardener and operator inputs
  const gardenerInput = useAddressInput(addGardener, formatMessage);
  const operatorInput = useAddressInput(addOperator, formatMessage);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary-light bg-primary-lighter/40 p-3.5 text-xs text-text-sub">
        <p className="font-semibold text-text-strong">
          {formatMessage({
            id: "app.admin.garden.create.teamAdvisory.title",
            defaultMessage: "Planned team members",
          })}
        </p>
        <p className="mt-1">
          {formatMessage({
            id: "app.admin.garden.create.teamAdvisory.message",
            defaultMessage:
              "These addresses are planning notes. Add them on-chain from Garden Members after deployment.",
          })}
        </p>
        <p className="mt-1">
          {formatMessage({
            id: "app.admin.garden.create.teamAdvisory.operatorNote",
            defaultMessage:
              "Note: Operators automatically have gardener access. You don't need to add them to both lists.",
          })}
        </p>
      </div>

      {/* Operators section — shown first since they have broader permissions */}
      <div>
        <label
          className="mb-2 block text-sm font-medium text-text-strong"
          htmlFor="create-garden-operator-address"
        >
          {formatMessage({ id: "app.roles.operator.plural", defaultMessage: "Garden operators" })}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="create-garden-operator-address"
            value={operatorInput.input}
            onChange={(event) => operatorInput.setInput(event.target.value)}
            placeholder={formatMessage({
              id: "admin.team.addressPlaceholder",
              defaultMessage: "0x... or vitalik.eth",
            })}
            aria-invalid={!!operatorInput.error}
            aria-describedby="operator-error"
            className="flex-1 rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 text-sm font-mono text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-lighter"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={operatorInput.handleAdd}
            disabled={operatorInput.shouldResolveEns && operatorInput.resolvingEns}
          >
            <RiAddLine className="h-4 w-4" />{" "}
            {formatMessage({ id: "app.common.add", defaultMessage: "Add" })}
          </Button>
        </div>
        {operatorInput.shouldResolveEns && (
          <p className="mt-2 text-xs text-text-soft">
            {operatorInput.resolvingEns
              ? formatMessage({
                  id: "app.admin.garden.create.resolvingEns",
                  defaultMessage: "Resolving ENS name...",
                })
              : operatorInput.resolvedAddress
                ? formatMessage(
                    {
                      id: "app.admin.garden.create.ensResolved",
                      defaultMessage: "Resolves to {address}",
                    },
                    { address: formatAddress(operatorInput.resolvedAddress) }
                  )
                : formatMessage({
                    id: "app.admin.garden.create.enterValidAddress",
                    defaultMessage: "Enter a valid ENS name or 0x address.",
                  })}
          </p>
        )}
        {/* Always render to reserve space and prevent layout shift */}
        <p
          id="operator-error"
          role="alert"
          className="mt-1 block min-h-[1.25rem] text-xs text-error-dark"
        >
          {operatorInput.error || "\u00A0"}
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {form.operators.map((operator) => (
            <li
              key={operator}
              className="flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 text-xs font-mono text-text-sub"
            >
              <span>{operator}</span>
              <button
                type="button"
                onClick={() => removeOperator(form.operators.indexOf(operator))}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-text-soft transition hover:bg-bg-white hover:text-error-dark"
                aria-label={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
              >
                <RiDeleteBinLine className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Gardeners section */}
      <div>
        <label
          className="mb-2 block text-sm font-medium text-text-strong"
          htmlFor="create-garden-gardener-address"
        >
          {formatMessage({ id: "app.roles.gardener.plural", defaultMessage: "Gardeners" })}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="create-garden-gardener-address"
            value={gardenerInput.input}
            onChange={(event) => gardenerInput.setInput(event.target.value)}
            placeholder={formatMessage({
              id: "admin.team.addressPlaceholder",
              defaultMessage: "0x... or vitalik.eth",
            })}
            aria-invalid={!!gardenerInput.error}
            aria-describedby="gardener-error"
            className="flex-1 rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 text-sm font-mono text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-lighter"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={gardenerInput.handleAdd}
            disabled={gardenerInput.shouldResolveEns && gardenerInput.resolvingEns}
          >
            <RiAddLine className="h-4 w-4" />{" "}
            {formatMessage({ id: "app.common.add", defaultMessage: "Add" })}
          </Button>
        </div>
        {gardenerInput.shouldResolveEns && (
          <p className="mt-2 text-xs text-text-soft">
            {gardenerInput.resolvingEns
              ? formatMessage({
                  id: "app.admin.garden.create.resolvingEns",
                  defaultMessage: "Resolving ENS name...",
                })
              : gardenerInput.resolvedAddress
                ? formatMessage(
                    {
                      id: "app.admin.garden.create.ensResolved",
                      defaultMessage: "Resolves to {address}",
                    },
                    { address: formatAddress(gardenerInput.resolvedAddress) }
                  )
                : formatMessage({
                    id: "app.admin.garden.create.enterValidAddress",
                    defaultMessage: "Enter a valid ENS name or 0x address.",
                  })}
          </p>
        )}
        {/* Always render to reserve space and prevent layout shift */}
        <p
          id="gardener-error"
          role="alert"
          className="mt-1 block min-h-[1.25rem] text-xs text-error-dark"
        >
          {gardenerInput.error || "\u00A0"}
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {form.gardeners.map((gardener) => (
            <li
              key={gardener}
              className="flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-white px-3 py-2.5 text-xs font-mono text-text-sub"
            >
              <span>{gardener}</span>
              <button
                type="button"
                onClick={() => removeGardener(form.gardeners.indexOf(gardener))}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-text-soft transition hover:bg-bg-white hover:text-error-dark"
                aria-label={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
              >
                <RiDeleteBinLine className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

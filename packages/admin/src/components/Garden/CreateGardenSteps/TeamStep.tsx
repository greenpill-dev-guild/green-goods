import {
  cn,
  formatAddress,
  resolveEnsAddress,
  useCreateGardenStore,
  useEnsAddress,
} from "@green-goods/shared";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";

interface TeamStepProps {
  showValidation: boolean;
}

/**
 * Custom hook for address input with ENS resolution.
 * Consolidates duplicate logic for gardener/operator inputs.
 *
 * TODO(batch-3): Extract to packages/shared/src/hooks/utils/useAddressInput.ts
 * per Hook Boundary rule. Keeping here temporarily for Batch 1 scope.
 */
function useAddressInput(
  addMember: (address: string) => { success: boolean; error?: string },
  formatMessage: ReturnType<typeof useIntl>["formatMessage"]
) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmedInput = input.trim();
  const isHexAddress = useMemo(
    () => (trimmedInput ? isAddress(trimmedInput) : false),
    [trimmedInput]
  );
  const shouldResolveEns = trimmedInput.length > 2 && !isHexAddress;

  const { data: resolvedAddress, isFetching: resolvingEns } = useEnsAddress(
    shouldResolveEns ? trimmedInput : null,
    { enabled: shouldResolveEns }
  );

  const handleAdd = useCallback(async () => {
    if (!trimmedInput) {
      setError(
        formatMessage({
          id: "app.admin.garden.create.enterAddress",
          defaultMessage: "Enter a wallet address or ENS name",
        })
      );
      return;
    }

    setError(null);
    let addressToAdd = trimmedInput;

    // Resolve ENS if not a hex address
    if (!isAddress(addressToAdd)) {
      try {
        const lookup = resolvedAddress ?? (await resolveEnsAddress(addressToAdd));
        if (!lookup || !isAddress(lookup)) {
          setError(
            formatMessage({
              id: "app.admin.garden.create.ensResolveFailed",
              defaultMessage: "Could not resolve ENS name",
            })
          );
          return;
        }
        addressToAdd = lookup;
      } catch {
        setError(
          formatMessage({
            id: "app.admin.garden.create.ensResolveFailed",
            defaultMessage: "Could not resolve ENS name",
          })
        );
        return;
      }
    }

    const result = addMember(addressToAdd);
    if (!result.success) {
      setError(
        result.error ??
          formatMessage({
            id: "app.admin.roles.error.invalidAddress",
            defaultMessage: "Invalid address",
          })
      );
      return;
    }
    setInput("");
    setError(null);
  }, [trimmedInput, resolvedAddress, addMember, formatMessage]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setError(null);
  }, []);

  return {
    input,
    setInput: handleInputChange,
    error,
    trimmedInput,
    isHexAddress,
    shouldResolveEns,
    resolvedAddress,
    resolvingEns,
    handleAdd,
  };
}

export function TeamStep({ showValidation }: TeamStepProps) {
  const form = useCreateGardenStore((s) => s.form);
  const addGardener = useCreateGardenStore((s) => s.addGardener);
  const removeGardener = useCreateGardenStore((s) => s.removeGardener);
  const addOperator = useCreateGardenStore((s) => s.addOperator);
  const removeOperator = useCreateGardenStore((s) => s.removeOperator);
  const { formatMessage } = useIntl();

  // Use shared hook for both gardener and operator inputs
  const gardenerInput = useAddressInput(addGardener, formatMessage);
  const operatorInput = useAddressInput(addOperator, formatMessage);

  const teamError = useMemo(
    () =>
      form.gardeners.length > 0
        ? null
        : formatMessage({ id: "app.admin.garden.create.requireGardener" }),
    [form.gardeners.length, formatMessage]
  );

  const operatorRequiredError = useMemo(
    () =>
      form.operators.length > 0
        ? null
        : formatMessage({ id: "app.admin.garden.create.requireOperator" }),
    [form.operators.length, formatMessage]
  );

  const showTeamErrors = showValidation;

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div>
        <label
          className="mb-2 block text-sm font-medium text-text-sub"
          htmlFor="create-garden-gardener-address"
        >
          {formatMessage({ id: "app.roles.gardener.plural", defaultMessage: "Gardeners" })} *
        </label>
        <div className="rounded-lg bg-bg-weak p-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="create-garden-gardener-address"
              value={gardenerInput.input}
              onChange={(event) => gardenerInput.setInput(event.target.value)}
              placeholder="0x... or vitalik.eth"
              className="flex-1 rounded-md border border-stroke-soft bg-inherit px-3 py-2 text-sm font-mono text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-lighter"
            />
            <button
              type="button"
              onClick={gardenerInput.handleAdd}
              disabled={gardenerInput.shouldResolveEns && gardenerInput.resolvingEns}
              className={cn(
                "flex items-center justify-center gap-1 rounded-md border border-stroke-soft px-3 py-2 text-sm font-medium text-text-sub transition-all duration-200 hover:bg-bg-soft",
                gardenerInput.shouldResolveEns &&
                  gardenerInput.resolvingEns &&
                  "cursor-not-allowed opacity-50"
              )}
            >
              <RiAddLine className="h-4 w-4" />{" "}
              {formatMessage({ id: "app.common.add", defaultMessage: "Add" })}
            </button>
          </div>
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
        <p className="mt-1 block min-h-[1.25rem] text-xs text-error-dark">
          {gardenerInput.error || (showTeamErrors && teamError) || "\u00A0"}
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {form.gardeners.map((gardener) => (
            <li
              key={gardener}
              className="flex items-center justify-between rounded-md border border-gray-100 bg-bg-weak px-3 py-2 text-xs font-mono text-text-sub/60"
            >
              <span>{gardener}</span>
              <button
                type="button"
                onClick={() => removeGardener(form.gardeners.indexOf(gardener))}
                className="rounded-md p-1 text-text-soft transition hover:bg-bg-white hover:text-red-600"
                aria-label={formatMessage({ id: "app.common.remove", defaultMessage: "Remove" })}
              >
                <RiDeleteBinLine className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-medium text-text-sub"
          htmlFor="create-garden-operator-address"
        >
          {formatMessage({ id: "app.roles.operator.plural", defaultMessage: "Garden operators" })}
        </label>
        <div className="rounded-lg bg-bg-weak p-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="create-garden-operator-address"
              value={operatorInput.input}
              onChange={(event) => operatorInput.setInput(event.target.value)}
              placeholder="0x... or vitalik.eth"
              className="flex-1 rounded-md border border-stroke-soft bg-inherit px-3 py-2 text-sm font-mono text-text-strong shadow-sm focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-lighter"
            />
            <button
              type="button"
              onClick={operatorInput.handleAdd}
              disabled={operatorInput.shouldResolveEns && operatorInput.resolvingEns}
              className={cn(
                "flex items-center justify-center gap-1 rounded-md border border-stroke-soft px-3 py-2 text-sm font-medium text-text-sub transition-all duration-200 hover:bg-bg-soft",
                operatorInput.shouldResolveEns &&
                  operatorInput.resolvingEns &&
                  "cursor-not-allowed opacity-50"
              )}
            >
              <RiAddLine className="h-4 w-4" />{" "}
              {formatMessage({ id: "app.common.add", defaultMessage: "Add" })}
            </button>
          </div>
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
        <p className="mt-1 block min-h-[1.25rem] text-xs text-error-dark">
          {operatorInput.error || (showTeamErrors && operatorRequiredError) || "\u00A0"}
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {form.operators.map((operator) => (
            <li
              key={operator}
              className="flex items-center justify-between rounded-md border border-gray-100 bg-bg-weak px-3 py-2 text-xs font-mono text-text-sub/60"
            >
              <span>{operator}</span>
              <button
                type="button"
                onClick={() => removeOperator(form.operators.indexOf(operator))}
                className="rounded-md p-1 text-text-soft transition hover:bg-bg-white hover:text-red-600"
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

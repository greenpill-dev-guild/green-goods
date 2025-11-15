import { useEnsAddress } from "@green-goods/shared/hooks";
import { cn, formatAddress, resolveEnsAddress } from "@green-goods/shared/utils";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { isAddress } from "viem";

interface TeamStepProps {
  form: {
    gardeners: string[];
    operators: string[];
  };
  addGardener: (address: string) => { success: boolean; error?: string };
  removeGardener: (index: number) => void;
  addOperator: (address: string) => { success: boolean; error?: string };
  removeOperator: (index: number) => void;
  showValidation: boolean;
}

export function TeamStep({
  form,
  addGardener,
  removeGardener,
  addOperator,
  removeOperator,
  showValidation,
}: TeamStepProps) {
  const [gardenerInput, setGardenerInput] = useState("");
  const [operatorInput, setOperatorInput] = useState("");
  const [gardenerError, setGardenerError] = useState<string | null>(null);
  const [operatorError, setOperatorError] = useState<string | null>(null);

  // ENS resolution for gardener input
  const trimmedGardenerInput = gardenerInput.trim();
  const isGardenerHexAddress = useMemo(
    () => (trimmedGardenerInput ? isAddress(trimmedGardenerInput) : false),
    [trimmedGardenerInput]
  );
  const shouldResolveGardenerEns = trimmedGardenerInput.length > 2 && !isGardenerHexAddress;
  const { data: resolvedGardenerAddress, isFetching: resolvingGardenerEns } = useEnsAddress(
    shouldResolveGardenerEns ? trimmedGardenerInput : null,
    {
      enabled: shouldResolveGardenerEns,
    }
  );

  // ENS resolution for operator input
  const trimmedOperatorInput = operatorInput.trim();
  const isOperatorHexAddress = useMemo(
    () => (trimmedOperatorInput ? isAddress(trimmedOperatorInput) : false),
    [trimmedOperatorInput]
  );
  const shouldResolveOperatorEns = trimmedOperatorInput.length > 2 && !isOperatorHexAddress;
  const { data: resolvedOperatorAddress, isFetching: resolvingOperatorEns } = useEnsAddress(
    shouldResolveOperatorEns ? trimmedOperatorInput : null,
    {
      enabled: shouldResolveOperatorEns,
    }
  );

  const handleAddGardener = async () => {
    if (!trimmedGardenerInput) {
      setGardenerError("Enter a wallet address or ENS name");
      return;
    }

    setGardenerError(null);
    let addressToAdd = trimmedGardenerInput;

    // Resolve ENS if needed
    if (!isAddress(addressToAdd)) {
      try {
        const lookup = resolvedGardenerAddress ?? (await resolveEnsAddress(addressToAdd));
        if (!lookup || !isAddress(lookup)) {
          setGardenerError("Could not resolve ENS name");
          return;
        }
        addressToAdd = lookup;
      } catch {
        setGardenerError("Could not resolve ENS name");
        return;
      }
    }

    const result = addGardener(addressToAdd);
    if (!result.success) {
      setGardenerError(result.error ?? "Invalid gardener address");
      return;
    }
    setGardenerInput("");
    setGardenerError(null);
  };

  const handleAddOperator = async () => {
    if (!trimmedOperatorInput) {
      setOperatorError("Enter a wallet address or ENS name");
      return;
    }

    setOperatorError(null);
    let addressToAdd = trimmedOperatorInput;

    // Resolve ENS if needed
    if (!isAddress(addressToAdd)) {
      try {
        const lookup = resolvedOperatorAddress ?? (await resolveEnsAddress(addressToAdd));
        if (!lookup || !isAddress(lookup)) {
          setOperatorError("Could not resolve ENS name");
          return;
        }
        addressToAdd = lookup;
      } catch {
        setOperatorError("Could not resolve ENS name");
        return;
      }
    }

    const result = addOperator(addressToAdd);
    if (!result.success) {
      setOperatorError(result.error ?? "Invalid operator address");
      return;
    }
    setOperatorInput("");
    setOperatorError(null);
  };

  const teamError = useMemo(
    () => (form.gardeners.length > 0 ? null : "Add at least one gardener to steward the garden"),
    [form.gardeners]
  );

  const showTeamErrors = showValidation;

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div>
        <label
          className="mb-2 block text-sm font-medium text-text-sub"
          htmlFor="create-garden-gardener-address"
        >
          Gardeners *
        </label>
        <div className="rounded-lg bg-bg-weak p-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="create-garden-gardener-address"
              value={gardenerInput}
              onChange={(event) => {
                setGardenerInput(event.target.value);
                setGardenerError(null);
              }}
              placeholder="0x... or vitalik.eth"
              className="flex-1 rounded-md border border-stroke-soft bg-inherit px-3 py-2 text-sm font-mono text-text-strong shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80"
            />
            <button
              type="button"
              onClick={handleAddGardener}
              disabled={shouldResolveGardenerEns && resolvingGardenerEns}
              className={cn(
                "flex items-center justify-center gap-1 rounded-md border border-stroke-soft px-3 py-2 text-sm font-medium text-text-sub transition-all duration-200 hover:bg-bg-soft",
                shouldResolveGardenerEns && resolvingGardenerEns && "cursor-not-allowed opacity-50"
              )}
            >
              <RiAddLine className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
        {shouldResolveGardenerEns && (
          <p className="mt-2 text-xs text-text-soft">
            {resolvingGardenerEns
              ? "Resolving ENS name..."
              : resolvedGardenerAddress
                ? `Resolves to ${formatAddress(resolvedGardenerAddress)}`
                : "Enter a valid ENS name or 0x address."}
          </p>
        )}
        {/* Always render to reserve space and prevent layout shift */}
        <p className="mt-1 block min-h-[1.25rem] text-xs text-red-600">
          {gardenerError || (showTeamErrors && teamError) || "\u00A0"}
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {form.gardeners.map((gardener, index) => (
            <li
              key={`${gardener}-${index}`}
              className="flex items-center justify-between rounded-md border border-gray-100 bg-bg-weak px-3 py-2 text-xs font-mono text-text-sub/60"
            >
              <span>{gardener}</span>
              <button
                type="button"
                onClick={() => removeGardener(index)}
                className="rounded-md p-1 text-text-soft transition hover:bg-bg-white hover:text-red-600"
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
          Garden operators
        </label>
        <div className="rounded-lg bg-bg-weak p-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="create-garden-operator-address"
              value={operatorInput}
              onChange={(event) => {
                setOperatorInput(event.target.value);
                setOperatorError(null);
              }}
              placeholder="0x... or vitalik.eth"
              className="flex-1 rounded-md border border-stroke-soft bg-inherit px-3 py-2 text-sm font-mono text-text-strong shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200/80"
            />
            <button
              type="button"
              onClick={handleAddOperator}
              disabled={shouldResolveOperatorEns && resolvingOperatorEns}
              className={cn(
                "flex items-center justify-center gap-1 rounded-md border border-stroke-soft px-3 py-2 text-sm font-medium text-text-sub transition-all duration-200 hover:bg-bg-soft",
                shouldResolveOperatorEns && resolvingOperatorEns && "cursor-not-allowed opacity-50"
              )}
            >
              <RiAddLine className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
        {shouldResolveOperatorEns && (
          <p className="mt-2 text-xs text-text-soft">
            {resolvingOperatorEns
              ? "Resolving ENS name..."
              : resolvedOperatorAddress
                ? `Resolves to ${formatAddress(resolvedOperatorAddress)}`
                : "Enter a valid ENS name or 0x address."}
          </p>
        )}
        {/* Always render to reserve space and prevent layout shift */}
        <p className="mt-1 block min-h-[1.25rem] text-xs text-red-600">
          {operatorError || "\u00A0"}
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {form.operators.map((operator, index) => (
            <li
              key={`${operator}-${index}`}
              className="flex items-center justify-between rounded-md border border-gray-100 bg-bg-weak px-3 py-2 text-xs font-mono text-text-sub/60"
            >
              <span>{operator}</span>
              <button
                type="button"
                onClick={() => removeOperator(index)}
                className="rounded-md p-1 text-text-soft transition hover:bg-bg-white hover:text-red-600"
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

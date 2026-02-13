import {
  type Address,
  type ConvictionWeight,
  formatAddress,
  useAllocateHypercertSupport,
  useConvictionStrategies,
  useHypercertConviction,
  useMemberVotingPower,
  useOffline,
  useUser,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ModalDrawer } from "./ModalDrawer";

interface ConvictionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  gardenName: string;
}

function ConvictionBar({ weight, totalWeight }: { weight: ConvictionWeight; totalWeight: bigint }) {
  const { formatMessage } = useIntl();
  const percentage = totalWeight > 0n ? Number((weight.weight * 100n) / totalWeight) : 0;
  const clampedPct = Math.min(percentage, 100);

  return (
    <div className="rounded-lg border border-stroke-soft bg-bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-medium text-text-strong">
          #{weight.hypercertId.toString()}
        </p>
        <p className="text-xs text-text-sub">
          {formatMessage({ id: "app.signal.weight" }, { percentage: clampedPct })}
        </p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-bg-weak"
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary-base transition-all duration-500"
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  );
}

interface SupportInputProps {
  hypercertId: bigint;
  currentStake: bigint;
  onAllocate: (hypercertId: bigint, delta: bigint, onSuccess: () => void) => void;
  disabled: boolean;
  isPending: boolean;
}

function SupportInput({
  hypercertId,
  currentStake,
  onAllocate,
  disabled,
  isPending,
}: SupportInputProps) {
  const { formatMessage } = useIntl();
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");

  const handleAllocate = () => {
    let value: bigint;
    try {
      value = BigInt(input.trim());
    } catch {
      setInputError(formatMessage({ id: "app.signal.invalidAmount" }));
      return;
    }
    if (value === 0n) {
      setInputError(formatMessage({ id: "app.signal.invalidAmount" }));
      return;
    }
    if (value < 0n) {
      setInputError(formatMessage({ id: "app.signal.mustBePositive" }));
      return;
    }
    setInputError("");
    onAllocate(hypercertId, value, () => setInput(""));
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-soft">
            {formatMessage({ id: "app.signal.support" })}: {currentStake.toString()}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setInputError("");
            }}
            placeholder={formatMessage({ id: "app.signal.pointsPlaceholder" })}
            disabled={disabled}
            aria-label={formatMessage({ id: "app.signal.allocatePoints" })}
            className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-1.5 text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleAllocate}
            disabled={disabled || isPending || !input.trim()}
            className="rounded-md bg-primary-base px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? formatMessage({ id: "app.signal.allocating" })
              : formatMessage({ id: "app.signal.support" })}
          </button>
        </div>
        {inputError && <p className="mt-0.5 text-xs text-error-base">{inputError}</p>}
      </div>
    </div>
  );
}

export function ConvictionDrawer({
  isOpen,
  onClose,
  gardenAddress,
  gardenName,
}: ConvictionDrawerProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { isOnline } = useOffline();

  // Fetch configured strategy addresses from the garden's HatsModule
  const { strategies } = useConvictionStrategies(gardenAddress, { enabled: isOpen });

  // Design: gardens have exactly one signal pool. strategies[0] is intentional —
  // the HatsModule setConvictionStrategies stores an array for future extensibility,
  // but the current architecture is 1-pool-per-garden by design.
  const poolAddress = strategies[0] as Address | undefined;

  // Fetch conviction weights from the pool
  const {
    weights,
    isLoading: weightsLoading,
    isError: weightsError,
  } = useHypercertConviction(poolAddress, {
    enabled: isOpen && Boolean(poolAddress),
  });

  const totalWeight = useMemo(() => weights.reduce((sum, w) => sum + w.weight, 0n), [weights]);

  // Fetch voter's power and allocations
  const {
    power,
    isLoading: powerLoading,
    isError: powerError,
  } = useMemberVotingPower(poolAddress, primaryAddress as Address | undefined, {
    enabled: isOpen && Boolean(poolAddress && primaryAddress),
  });

  const allocateMutation = useAllocateHypercertSupport();

  const usedPoints = useMemo(
    () => power.allocations.reduce((sum, a) => sum + a.amount, 0n),
    [power.allocations]
  );

  const handleAllocate = (hypercertId: bigint, delta: bigint, onSuccess?: () => void) => {
    if (!poolAddress) return;
    if (usedPoints + delta > power.pointsBudget) return;
    allocateMutation.mutate(
      { poolAddress, signals: [{ hypercertId, deltaSupport: delta }] },
      { onSuccess }
    );
  };

  // Map allocations by hypercert ID for quick lookup
  const allocationMap = useMemo(() => {
    const map = new Map<string, bigint>();
    for (const a of power.allocations) {
      map.set(a.hypercertId.toString(), a.amount);
    }
    return map;
  }, [power.allocations]);

  const isLoading = weightsLoading || powerLoading;
  const isError = weightsError || powerError;

  return (
    <ModalDrawer
      isOpen={isOpen}
      onClose={onClose}
      header={{
        title: formatMessage({ id: "app.signal.title" }),
        description: gardenName,
      }}
      contentClassName="overflow-y-auto p-0"
      maxHeight="95vh"
    >
      <div className="space-y-5 p-4 pb-6">
        {!isOnline && (
          <p className="rounded-md border border-warning-light bg-warning-lighter px-3 py-2 text-xs text-warning-dark">
            {formatMessage({ id: "app.conviction.offlineWarning" })}
          </p>
        )}

        {isError && (
          <p className="rounded-md border border-error-light bg-error-lighter px-3 py-2 text-xs text-error-dark">
            {formatMessage({ id: "app.conviction.errorLoadingFailed" })}
          </p>
        )}

        {!poolAddress && (
          <p className="py-4 text-center text-sm text-text-soft">
            {formatMessage({ id: "app.signal.noHypercerts" })}
          </p>
        )}

        {poolAddress && (
          <>
            {/* Voter status */}
            <section>
              <h3 className="text-sm font-semibold text-text-strong">
                {formatMessage({ id: "app.signal.governance" })}
              </h3>
              {isLoading ? (
                <p className="mt-2 text-sm text-text-soft">
                  {formatMessage({ id: "app.signal.loading" })}
                </p>
              ) : (
                <div className="mt-2 rounded-lg border border-stroke-soft bg-bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-strong">
                      {power.isEligible
                        ? formatMessage({ id: "app.signal.eligible" })
                        : formatMessage({ id: "app.signal.notEligible" })}
                    </p>
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${power.isEligible ? "bg-emerald-500" : "bg-text-soft"}`}
                    />
                  </div>
                  {!power.isEligible && (
                    <p className="mt-1 text-xs text-text-sub">
                      {formatMessage({ id: "app.signal.notEligibleExplanation" })}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-sub">
                    {formatMessage(
                      { id: "app.signal.pointsBudget" },
                      { used: usedPoints.toString(), total: power.pointsBudget.toString() }
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-text-sub">
                    {formatMessage({ id: "app.signal.totalStake" })}: {power.totalStake.toString()}
                  </p>
                  {poolAddress && (
                    <p className="mt-1 font-mono text-xs text-text-soft">
                      {formatAddress(poolAddress, { variant: "card" })}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Conviction weights */}
            <section>
              <h3 className="text-sm font-semibold text-text-strong">
                {formatMessage({ id: "app.signal.conviction" })}
              </h3>
              {!isLoading && weights.length === 0 && (
                <p className="mt-2 text-sm text-text-soft">
                  {formatMessage({ id: "app.signal.noHypercerts" })}
                </p>
              )}
              {!isLoading && weights.length > 0 && (
                <div className="mt-2 space-y-3">
                  {weights.map((weight) => (
                    <div key={weight.hypercertId.toString()}>
                      <ConvictionBar weight={weight} totalWeight={totalWeight} />
                      {power.isEligible && (
                        <div className="mt-2 pl-1">
                          <SupportInput
                            hypercertId={weight.hypercertId}
                            currentStake={allocationMap.get(weight.hypercertId.toString()) ?? 0n}
                            onAllocate={handleAllocate}
                            disabled={!isOnline || !power.isEligible || allocateMutation.isPending}
                            isPending={allocateMutation.isPending}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ModalDrawer>
  );
}

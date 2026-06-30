import {
  type Address,
  cn,
  type ConvictionWeight,
  DEFAULT_SPLIT_CONFIG,
  formatAddress,
  formatTokenAmount,
  truncateAddress,
  useAllocateHypercertSupport,
  useConvictionStrategies,
  useGardenCommunity,
  useHypercertConviction,
  useMemberVotingPower,
  useOffline,
  useUser,
  useYieldAllocations,
  WEIGHT_SCHEME_VALUES,
  WeightScheme,
} from "@green-goods/shared";
import { RiLoader4Line } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";
import { ModalDrawer } from "./ModalDrawer";

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-2 space-y-2.5 animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 flex-1 rounded bg-bg-weak-50" />
          <div className="h-3 w-16 rounded bg-bg-weak-50" />
        </div>
      ))}
    </div>
  );
}

interface ConvictionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  gardenName: string;
}

function ConvictionBar({ weight, totalWeight }: { weight: ConvictionWeight; totalWeight: bigint }) {
  const { formatMessage } = useIntl();
  const percentage = totalWeight > 0n ? Number((weight.weight * 10000n) / totalWeight) / 100 : 0;
  const clampedPct = Math.min(percentage, 100);

  return (
    <div className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-medium text-text-strong-950">
          #{weight.hypercertId.toString()}
        </p>
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.signal.weight" }, { percentage: clampedPct })}
        </p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-bg-weak-50"
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={formatMessage(
          { id: "app.signal.weightFor" },
          { id: weight.hypercertId.toString() }
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)]",
            pwaStatusStyles.primary.progress
          )}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  );
}

interface SupportInputProps {
  hypercertId: bigint;
  currentStake: bigint;
  onAllocate: (
    hypercertId: bigint,
    delta: bigint,
    onSuccess: () => void,
    onError: (msg: string) => void
  ) => void;
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
    onAllocate(
      hypercertId,
      value,
      () => setInput(""),
      (msg) => setInputError(msg)
    );
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-soft-400">
            {formatMessage({ id: "app.signal.support" })}: {formatTokenAmount(currentStake, 18)}
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
            aria-describedby={inputError ? `support-error-${hypercertId}` : undefined}
            aria-invalid={inputError ? true : undefined}
            className="w-full rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleAllocate}
            disabled={disabled || isPending || !input.trim()}
            aria-busy={isPending || undefined}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md bg-primary-action px-4 py-2.5 text-sm font-medium whitespace-nowrap text-primary-action-foreground transition duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:bg-primary-action-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />}
            {formatMessage({ id: "app.signal.support" })}
          </button>
        </div>
        {inputError && (
          <p
            id={`support-error-${hypercertId}`}
            role="alert"
            aria-live="polite"
            className="mt-0.5 text-xs text-error-base"
          >
            {inputError}
          </p>
        )}
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
    refetch: refetchWeights,
  } = useHypercertConviction(poolAddress, {
    enabled: isOpen && Boolean(poolAddress),
  });

  const totalWeight = useMemo(() => weights.reduce((sum, w) => sum + w.weight, 0n), [weights]);

  // Fetch voter's power and allocations
  const {
    power,
    isLoading: powerLoading,
    isError: powerError,
    refetch: refetchPower,
  } = useMemberVotingPower(poolAddress, primaryAddress as Address | undefined, {
    enabled: isOpen && Boolean(poolAddress && primaryAddress),
  });

  // Community and yield data
  const { community } = useGardenCommunity(gardenAddress, { enabled: isOpen });
  const { allocations } = useYieldAllocations(gardenAddress, { enabled: isOpen });
  const [showAllAllocations, setShowAllAllocations] = useState(false);

  const weightSchemeLabel = community ? WeightScheme[community.weightScheme] : undefined;

  const splitConfig = DEFAULT_SPLIT_CONFIG;
  const cookieJarPct = (splitConfig.cookieJarBps / 100).toFixed(1);
  const fractionsPct = (splitConfig.fractionsBps / 100).toFixed(1);
  const juiceboxPct = (splitConfig.juiceboxBps / 100).toFixed(1);

  const allocateMutation = useAllocateHypercertSupport();

  const usedPoints = useMemo(
    () => power.allocations.reduce((sum, a) => sum + a.amount, 0n),
    [power.allocations]
  );

  const handleAllocate = (
    hypercertId: bigint,
    delta: bigint,
    onSuccess?: () => void,
    onError?: (msg: string) => void
  ) => {
    if (!poolAddress) return;
    if (usedPoints + delta > power.pointsBudget) {
      onError?.(formatMessage({ id: "app.signal.overBudget" }));
      return;
    }
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
          <p
            role="status"
            className="rounded-md border border-warning-light bg-warning-lighter px-3 py-2 text-xs text-warning-dark"
          >
            {formatMessage({ id: "app.conviction.offlineWarning" })}
          </p>
        )}

        {isError && (
          <div
            role="alert"
            className="rounded-md border border-error-light bg-error-lighter px-3 py-2 text-xs text-error-dark"
          >
            <p>{formatMessage({ id: "app.conviction.errorLoadingFailed" })}</p>
            <button
              type="button"
              onClick={() => {
                refetchWeights?.();
                refetchPower?.();
              }}
              className="mt-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-primary-action-foreground transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:bg-primary-action-hover active:scale-95"
            >
              {formatMessage({ id: "app.common.tryAgain" })}
            </button>
          </div>
        )}

        {/* Community status + weight scheme indicator */}
        <section>
          <h3 className="text-sm font-semibold text-text-strong-950">
            {formatMessage({ id: "app.community.title" })}
          </h3>
          <div className="mt-2 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-strong-950">
                {formatMessage({ id: "app.community.status" })}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-text-sub-600">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 flex-shrink-0 rounded-full",
                    community ? pwaStatusStyles.success.dot : pwaStatusStyles.neutral.dot
                  )}
                  aria-hidden="true"
                />
                {community
                  ? formatMessage({ id: "app.community.statusConnected" })
                  : formatMessage({ id: "app.community.statusNotConnected" })}
              </p>
            </div>
            <div className="mt-2 rounded-md bg-bg-weak-50 px-2.5 py-2">
              <p className="text-xs font-medium text-text-soft-400">
                {formatMessage({ id: "app.community.weightScheme" })}
              </p>
              {community ? (
                <div className="mt-0.5">
                  <p className="text-xs font-medium text-text-strong-950">
                    {formatMessage({
                      id: `app.community.weightScheme.${weightSchemeLabel?.toLowerCase()}`,
                    })}
                  </p>
                  <div className="mt-1 flex gap-2 text-xs text-text-sub-600">
                    <span>
                      {formatMessage({ id: "app.roles.community" })}:{" "}
                      {WEIGHT_SCHEME_VALUES[community.weightScheme].community / 10_000}x
                    </span>
                    <span>
                      {formatMessage({ id: "app.roles.gardener" })}:{" "}
                      {WEIGHT_SCHEME_VALUES[community.weightScheme].gardener / 10_000}x
                    </span>
                    <span>
                      {formatMessage({ id: "app.roles.operator" })}:{" "}
                      {WEIGHT_SCHEME_VALUES[community.weightScheme].operator / 10_000}x
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-0.5 text-xs text-text-sub-600">
                  {formatMessage({ id: "app.community.noCommunity" })}
                </p>
              )}
            </div>
          </div>
        </section>

        {!poolAddress && (
          <p className="py-4 text-center text-sm text-text-soft-400">
            {formatMessage({ id: "app.signal.noHypercerts" })}
          </p>
        )}

        {poolAddress && (
          <>
            {/* Voter status */}
            <section>
              <h3 className="text-sm font-semibold text-text-strong-950">
                {formatMessage({ id: "app.signal.governance" })}
              </h3>
              {isLoading ? (
                <SectionSkeleton rows={4} />
              ) : (
                <div className="mt-2 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-strong-950">
                      {power.isEligible
                        ? formatMessage({ id: "app.signal.eligible" })
                        : formatMessage({ id: "app.signal.notEligible" })}
                    </p>
                    <span
                      className={cn(
                        "inline-flex h-2 w-2 rounded-full",
                        power.isEligible ? pwaStatusStyles.success.dot : pwaStatusStyles.neutral.dot
                      )}
                      role="img"
                      aria-label={
                        power.isEligible
                          ? formatMessage({ id: "app.signal.eligible" })
                          : formatMessage({ id: "app.signal.notEligible" })
                      }
                    />
                  </div>
                  {!power.isEligible && (
                    <p className="mt-1 text-xs text-text-sub-600">
                      {formatMessage({ id: "app.signal.notEligibleExplanation" })}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-sub-600">
                    {formatMessage(
                      { id: "app.signal.pointsBudget" },
                      {
                        used: formatTokenAmount(usedPoints, 18),
                        total: formatTokenAmount(power.pointsBudget, 18),
                      }
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-text-sub-600">
                    {formatMessage({ id: "app.signal.totalStake" })}:{" "}
                    {formatTokenAmount(power.totalStake, 18)}
                  </p>
                  {poolAddress && (
                    <p className="mt-1 font-mono text-xs text-text-soft-400">
                      {formatAddress(poolAddress, { variant: "card" })}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Conviction weights */}
            <section>
              <h3 className="text-sm font-semibold text-text-strong-950">
                {formatMessage({ id: "app.signal.conviction" })}
              </h3>
              {isLoading && <SectionSkeleton rows={3} />}
              {!isLoading && weights.length === 0 && (
                <p className="mt-2 text-sm text-text-soft-400">
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

            {/* Yield allocation visibility */}
            <section>
              <h3 className="text-sm font-semibold text-text-strong-950">
                {formatMessage({ id: "app.yield.title" })}
              </h3>
              <div className="mt-2 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3">
                {/* Three-way split summary bar */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-bg-weak-50"
                    role="img"
                    aria-label={formatMessage(
                      { id: "app.yield.splitSummary" },
                      { cookieJar: cookieJarPct, fractions: fractionsPct, juicebox: juiceboxPct }
                    )}
                  >
                    <div
                      className={cn("h-full", pwaStatusStyles.success.progress)}
                      style={{ width: `${cookieJarPct}%` }}
                    />
                    <div
                      className={cn("h-full", pwaStatusStyles.primary.progress)}
                      style={{ width: `${fractionsPct}%` }}
                    />
                    <div
                      className={cn("h-full", pwaStatusStyles.warning.progress)}
                      style={{ width: `${juiceboxPct}%` }}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-text-sub-600">
                  <span className="flex items-center gap-1">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        pwaStatusStyles.success.dot
                      )}
                      aria-hidden="true"
                    />
                    {formatMessage({ id: "app.yield.cookieJar" })} {cookieJarPct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        pwaStatusStyles.primary.dot
                      )}
                      aria-hidden="true"
                    />
                    {formatMessage({ id: "app.yield.fractions" })} {fractionsPct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        pwaStatusStyles.warning.dot
                      )}
                      aria-hidden="true"
                    />
                    {formatMessage({ id: "app.yield.juicebox" })} {juiceboxPct}%
                  </span>
                </div>
                {allocations.length === 0 ? (
                  <p className="mt-2 text-center text-xs text-text-soft-400">
                    {formatMessage({ id: "app.yield.noAllocations" })}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1">
                    {(showAllAllocations ? allocations : allocations.slice(0, 3)).map((a) => (
                      <div
                        key={a.txHash}
                        className="flex items-center justify-between text-xs text-text-sub-600"
                      >
                        <span className="font-mono text-text-soft-400">
                          {truncateAddress(a.txHash)}
                        </span>
                        <span>
                          {formatTokenAmount(
                            a.cookieJarAmount + a.fractionsAmount + a.juiceboxAmount
                          )}
                        </span>
                      </div>
                    ))}
                    {allocations.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllAllocations((prev) => !prev)}
                        aria-expanded={showAllAllocations}
                        className="mt-1 min-h-11 w-full rounded px-4 text-center text-xs font-medium text-primary-base transition duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:text-primary-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base/40"
                      >
                        {showAllAllocations
                          ? formatMessage({ id: "app.signal.collapse" })
                          : `${formatMessage({ id: "app.yield.viewAll" })} (${allocations.length})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </ModalDrawer>
  );
}

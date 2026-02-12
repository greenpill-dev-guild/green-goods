import {
  type Address,
  formatAddress,
  useConvictionStrategies,
  useDeregisterHypercert,
  useGardenPermissions,
  useGardens,
  useHypercertConviction,
  useRegisterHypercert,
  useRegisteredHypercerts,
} from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { RiDeleteBinLine } from "@remixicon/react";

export default function GardenSignalPoolView() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const [newHypercertId, setNewHypercertId] = useState("");
  const [inputError, setInputError] = useState("");

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === id);
  const permissions = useGardenPermissions();

  // Load configured strategy addresses
  const { strategies } = useConvictionStrategies((id as Address) ?? undefined, {
    enabled: Boolean(id),
  });

  // Design: gardens have exactly one signal pool. strategies[0] is intentional —
  // the HatsModule stores an array for future extensibility, but the current
  // architecture is 1-pool-per-garden by design.
  const poolAddress = strategies[0] as Address | undefined;

  // Load registered hypercerts from the signal pool
  const {
    hypercertIds,
    isLoading: hypercertsLoading,
    isError: hypercertsError,
  } = useRegisteredHypercerts(poolAddress, {
    enabled: Boolean(poolAddress),
  });

  const registerMutation = useRegisterHypercert();
  const deregisterMutation = useDeregisterHypercert();

  // Load conviction weights for display
  const {
    weights,
    isLoading: weightsLoading,
    isError: weightsError,
  } = useHypercertConviction(poolAddress, {
    enabled: Boolean(poolAddress),
  });

  if (gardensLoading) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.signal.title" })}
          description={formatMessage({ id: "app.signal.loading" })}
          backLink={{
            to: "/gardens",
            label: formatMessage({ id: "app.conviction.backToGarden" }),
          }}
        />
      </div>
    );
  }

  if (!garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.signal.title" })}
          description={formatMessage({ id: "app.conviction.gardenNotFound" })}
          backLink={{
            to: "/gardens",
            label: formatMessage({ id: "app.conviction.backToGarden" }),
          }}
        />
      </div>
    );
  }

  const canManage = permissions.canManageGarden(garden);

  // Build a weight lookup map
  const weightMap = new Map<string, bigint>();
  let totalWeight = 0n;
  for (const w of weights) {
    weightMap.set(w.hypercertId.toString(), w.weight);
    totalWeight += w.weight;
  }

  const handleRegister = () => {
    const trimmed = newHypercertId.trim();
    if (!trimmed) {
      setInputError(formatMessage({ id: "app.conviction.hypercertIdRequired" }));
      return;
    }

    try {
      const parsed = BigInt(trimmed);
      if (parsed < 0n) {
        setInputError(formatMessage({ id: "app.conviction.errorInvalidHypercertId" }));
        return;
      }
      if (hypercertIds.some((id) => id === parsed)) {
        setInputError(formatMessage({ id: "app.signal.alreadyRegistered" }));
        return;
      }
    } catch {
      setInputError(formatMessage({ id: "app.conviction.errorMustBeNumber" }));
      return;
    }

    if (!poolAddress) return;
    setInputError("");
    registerMutation.mutate(
      { poolAddress, hypercertId: BigInt(trimmed) },
      { onSuccess: () => setNewHypercertId("") }
    );
  };

  const getWeightPercentage = (hypercertId: bigint): number => {
    if (totalWeight === 0n) return 0;
    const weight = weightMap.get(hypercertId.toString()) ?? 0n;
    return Number((weight * 100n) / totalWeight);
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.signal.title" })}
        description={formatMessage(
          { id: "app.conviction.description" },
          { gardenName: garden.name }
        )}
        backLink={{
          to: `/gardens/${garden.id}`,
          label: formatMessage({ id: "app.conviction.backToGarden" }),
        }}
        sticky
      />

      <div className="mx-auto mt-6 max-w-4xl space-y-6 px-4 sm:px-6">
        {/* Pool info */}
        {!poolAddress && (
          <div className="rounded-md border border-information-light bg-information-lighter px-4 py-3 text-sm text-information-dark">
            {formatMessage({ id: "app.conviction.notDeployed" })}
          </div>
        )}

        {(hypercertsError || weightsError) && (
          <div className="rounded-md border border-error-light bg-error-lighter px-4 py-3 text-sm text-error-dark">
            {formatMessage({ id: "app.conviction.errorLoadingFailed" })}
          </div>
        )}

        {poolAddress && (
          <>
            {/* Stats */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
                <p className="text-xs text-text-soft">
                  {formatMessage({ id: "app.conviction.poolAddress" })}
                </p>
                <p className="mt-1 font-mono text-sm font-medium text-text-strong">
                  {formatAddress(poolAddress, { variant: "card" })}
                </p>
              </div>
              <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
                <p className="text-xs text-text-soft">
                  {formatMessage({ id: "app.signal.hypercertCount" }, { count: 0 }).replace(
                    /^0\s*/,
                    ""
                  )}
                </p>
                <p className="mt-1 text-xl font-semibold text-text-strong">
                  {hypercertsLoading ? "..." : hypercertIds.length}
                </p>
              </div>
              <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
                <p className="text-xs text-text-soft">
                  {formatMessage({ id: "app.signal.conviction" })}
                </p>
                <p className="mt-1 text-xl font-semibold text-text-strong">
                  {weightsLoading
                    ? formatMessage({ id: "app.common.loading" })
                    : weights.length > 0
                      ? formatMessage({ id: "app.signal.conviction" })
                      : formatMessage({ id: "app.signal.noHypercerts" })}
                </p>
              </div>
            </section>

            {/* Conviction weights */}
            <section className="rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
              <div className="border-b border-stroke-soft p-4 sm:p-6">
                <h3 className="text-base font-medium text-text-strong sm:text-lg">
                  {formatMessage({ id: "app.signal.conviction" })}
                </h3>
                <p className="mt-1 text-sm text-text-sub">
                  {formatMessage({ id: "app.conviction.convictionWeightsDescription" })}
                </p>
              </div>

              <div className="p-4 sm:p-6">
                {hypercertsLoading || weightsLoading ? (
                  <p className="py-4 text-center text-sm text-text-soft">
                    {formatMessage({ id: "app.signal.loading" })}
                  </p>
                ) : hypercertIds.length === 0 ? (
                  <p className="py-4 text-center text-sm text-text-soft">
                    {formatMessage({ id: "app.signal.noHypercerts" })}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {hypercertIds.map((hcId) => {
                      const pct = getWeightPercentage(hcId);
                      return (
                        <div
                          key={hcId.toString()}
                          className="flex items-center justify-between gap-3 rounded-md bg-bg-weak p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm font-medium text-text-strong">
                              #{hcId.toString()}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stroke-soft">
                                <div
                                  className="h-full rounded-full bg-primary-base transition-all duration-500"
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-text-sub">{pct}%</span>
                            </div>
                          </div>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!poolAddress) return;
                                deregisterMutation.mutate({ poolAddress, hypercertId: hcId });
                              }}
                              disabled={deregisterMutation.isPending}
                              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded text-error-base transition hover:bg-error-lighter active:scale-95 disabled:opacity-50"
                              aria-label={formatMessage({ id: "app.conviction.removeStrategy" })}
                            >
                              <RiDeleteBinLine className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Register hypercert form */}
                {canManage && (
                  <div className="mt-4 flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={newHypercertId}
                        onChange={(e) => {
                          setNewHypercertId(e.target.value);
                          setInputError("");
                        }}
                        placeholder="Hypercert token ID"
                        className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 font-mono text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
                        aria-label="Hypercert token ID"
                      />
                      {inputError && <p className="mt-1 text-xs text-error-base">{inputError}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={!newHypercertId.trim() || registerMutation.isPending}
                      className="rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker active:scale-95 disabled:opacity-50"
                    >
                      {registerMutation.isPending
                        ? formatMessage({ id: "app.common.processing" })
                        : formatMessage({ id: "app.conviction.register" })}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

import {
  type Address,
  Alert,
  CanvasStageTabRail,
  adminRoutes,
  ConfirmDialog,
  formatAddress,
  PoolType,
  useAdminStore,
  useDeregisterHypercert,
  useGardenPermissions,
  useGardenPools,
  useGardens,
  useHypercertConviction,
  useRegisteredHypercerts,
  useRegisterHypercert,
} from "@green-goods/shared";
import { RiDeleteBinLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

/**
 * Unified signal pool management view.
 *
 * Supports both pool types via the :poolType URL param:
 * - "hypercert" -> PoolType.Hypercert (index 0) — hypercert curation
 * - "action"    -> PoolType.Action    (index 1) — action signaling
 *
 * Both pool types share the same contract ABI (registerHypercert/deregisterHypercert)
 * because "hypercertId" at the contract level is a generic proposal identifier.
 */
interface GardenSignalPoolViewProps {
  layout?: "page" | "sheet";
}

export default function GardenSignalPoolView({ layout = "page" }: GardenSignalPoolViewProps = {}) {
  const { poolType: poolTypeParam } = useParams<{ poolType: string }>();
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [newItemId, setNewItemId] = useState("");
  const [inputError, setInputError] = useState("");
  const [confirmDeregister, setConfirmDeregister] = useState<bigint | null>(null);
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const gardenId = selectedGarden?.id ?? null;

  const isActionPool = poolTypeParam === "action";
  const targetPoolType = isActionPool ? PoolType.Action : PoolType.Hypercert;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === gardenId);
  const permissions = useGardenPermissions();

  // Load pools from GardensModule — typed with PoolType
  const { pools } = useGardenPools((gardenId as Address | null) ?? undefined, {
    enabled: Boolean(gardenId),
  });

  const pool = pools.find((p) => p.poolType === targetPoolType);
  const poolAddress = pool?.poolAddress;

  // Load registered items from the signal pool
  const {
    hypercertIds: registeredIds,
    isLoading: itemsLoading,
    isError: itemsError,
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

  // i18n key helpers based on pool type
  const titleKey = isActionPool ? "app.signal.actionPool.title" : "app.signal.hypercertPool.title";
  const descriptionKey = isActionPool
    ? "app.signal.actionPool.description"
    : "app.signal.hypercertPool.description";
  const emptyKey = isActionPool ? "app.signal.actionPool.noActions" : "app.signal.noHypercerts";
  const countKey = isActionPool ? "app.signal.actionPool.actionCount" : "app.signal.hypercertCount";
  const idRequiredKey = isActionPool
    ? "app.signal.actionPool.actionIdRequired"
    : "app.conviction.hypercertIdRequired";
  const alreadyRegisteredKey = isActionPool
    ? "app.signal.actionPool.alreadyRegistered"
    : "app.signal.alreadyRegistered";
  const confirmDeregisterKey = isActionPool
    ? "app.signal.actionPool.confirmDeregister"
    : "app.signal.hypercertPool.confirmDeregister";
  const confirmDeregisterDescKey = isActionPool
    ? "app.signal.actionPool.confirmDeregisterDescription"
    : "app.signal.hypercertPool.confirmDeregisterDescription";

  if (gardensLoading) {
    if (layout === "sheet") {
      return <Alert variant="info">{formatMessage({ id: "app.signal.loading" })}</Alert>;
    }

    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: titleKey })}
          description={formatMessage({ id: "app.signal.loading" })}
          backLink={{
            to: adminRoutes.communityGovernance(),
            label: formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" }),
          }}
        />
      </div>
    );
  }

  if (!garden) {
    if (layout === "sheet") {
      return (
        <Alert variant="error">{formatMessage({ id: "app.conviction.gardenNotFound" })}</Alert>
      );
    }

    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: titleKey })}
          description={formatMessage({ id: "app.conviction.gardenNotFound" })}
          backLink={{
            to: adminRoutes.communityGovernance(),
            label: formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" }),
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
    const trimmed = newItemId.trim();
    if (!trimmed) {
      setInputError(formatMessage({ id: idRequiredKey }));
      return;
    }

    try {
      const parsed = BigInt(trimmed);
      if (parsed < 0n) {
        setInputError(formatMessage({ id: "app.conviction.errorInvalidHypercertId" }));
        return;
      }
      if (registeredIds.some((existingId) => existingId === parsed)) {
        setInputError(formatMessage({ id: alreadyRegisteredKey }));
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
      { onSuccess: () => setNewItemId("") }
    );
  };

  const getWeightPercentage = (itemId: bigint): number => {
    if (totalWeight === 0n) return 0;
    const weight = weightMap.get(itemId.toString()) ?? 0n;
    return Number((weight * 100n) / totalWeight);
  };

  const pageHeader =
    layout === "page" ? (
      <PageHeader
        title={formatMessage({ id: titleKey })}
        description={formatMessage({ id: descriptionKey }, { gardenName: garden.name })}
        variant="canvas"
        backLink={{
          to: adminRoutes.communityGovernance(),
          label: formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" }),
        }}
        sticky
      >
        <CanvasStageTabRail
          ariaLabel={formatMessage({ id: "app.community.pools" })}
          activeId={isActionPool ? "action" : "hypercert"}
          onChange={(nextPoolType) =>
            navigate(
              adminRoutes.communityGovernanceSignalPool(
                nextPoolType === "action" ? "action" : "hypercert"
              )
            )
          }
          tabs={[
            {
              id: "hypercert",
              label: formatMessage({ id: "app.signal.viewHypercertPool" }),
            },
            {
              id: "action",
              label: formatMessage({ id: "app.signal.viewActionPool" }),
            },
          ]}
        />
      </PageHeader>
    ) : null;
  const contentClassName =
    layout === "page" ? "mx-auto mt-6 max-w-4xl space-y-6 px-4 sm:px-6" : "space-y-6";

  return (
    <div className="pb-6">
      {pageHeader}

      <div className={contentClassName}>
        {layout === "sheet" ? (
          <CanvasStageTabRail
            ariaLabel={formatMessage({ id: "app.community.pools" })}
            activeId={isActionPool ? "action" : "hypercert"}
            onChange={(nextPoolType) =>
              navigate(
                adminRoutes.communityGovernanceSignalPool(
                  nextPoolType === "action" ? "action" : "hypercert"
                )
              )
            }
            tabs={[
              {
                id: "hypercert",
                label: formatMessage({ id: "app.signal.viewHypercertPool" }),
              },
              {
                id: "action",
                label: formatMessage({ id: "app.signal.viewActionPool" }),
              },
            ]}
          />
        ) : null}

        {/* Pool not deployed */}
        {!poolAddress && (
          <Alert variant="info">{formatMessage({ id: "app.signal.poolNotFound" })}</Alert>
        )}

        {(itemsError || weightsError) && (
          <Alert variant="error">
            {formatMessage({ id: "app.conviction.errorLoadingFailed" })}
          </Alert>
        )}

        {poolAddress && (
          <>
            {/* Stats */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="surface-inset">
                <p className="text-xs text-text-soft">
                  {formatMessage({ id: "app.conviction.poolAddress" })}
                </p>
                <p className="mt-1 font-mono text-sm font-medium text-text-strong">
                  {formatAddress(poolAddress, { variant: "card" })}
                </p>
              </div>
              <div className="surface-inset">
                <p className="text-xs text-text-soft">
                  {formatMessage({ id: countKey }, { count: 0 }).replace(/^0\s*/, "")}
                </p>
                <p className="mt-1 text-xl font-semibold text-text-strong">
                  {itemsLoading
                    ? formatMessage({ id: "app.common.loading" })
                    : registeredIds.length}
                </p>
              </div>
              <div className="surface-inset">
                <p className="text-xs text-text-soft">
                  {formatMessage({ id: "app.signal.conviction" })}
                </p>
                <p className="mt-1 text-xl font-semibold text-text-strong">
                  {weightsLoading
                    ? formatMessage({ id: "app.common.loading" })
                    : weights.length > 0
                      ? formatMessage({ id: "app.signal.conviction" })
                      : formatMessage({ id: emptyKey })}
                </p>
              </div>
            </section>

            {/* Conviction weights */}
            <section className="surface-inset p-0">
              <div className="border-b border-stroke-soft p-4 sm:p-6">
                <h3 className="text-base font-medium text-text-strong sm:text-lg">
                  {formatMessage({ id: "app.signal.conviction" })}
                </h3>
                <p className="mt-1 text-sm text-text-sub">
                  {formatMessage({ id: "app.conviction.convictionWeightsDescription" })}
                </p>
              </div>

              <div className="p-4 sm:p-6">
                {itemsLoading || weightsLoading ? (
                  <p className="py-4 text-center text-sm text-text-soft" role="status">
                    {formatMessage({ id: "app.signal.loading" })}
                  </p>
                ) : registeredIds.length === 0 ? (
                  <p className="py-4 text-center text-sm text-text-soft">
                    {formatMessage({ id: emptyKey })}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {registeredIds.map((itemId) => {
                      const pct = getWeightPercentage(itemId);
                      return (
                        <div
                          key={itemId.toString()}
                          className="flex items-center justify-between gap-3 rounded-md bg-bg-weak p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm font-medium text-text-strong">
                              #{itemId.toString()}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <div
                                className="h-1.5 flex-1 overflow-hidden rounded-full bg-stroke-soft"
                                role="progressbar"
                                aria-valuenow={Math.min(pct, 100)}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={formatMessage(
                                  { id: "app.signal.weightFor" },
                                  { id: itemId.toString() }
                                )}
                              >
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
                              onClick={() => setConfirmDeregister(itemId)}
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

                {/* Register item form */}
                {canManage && (
                  <div className="mt-4 flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={newItemId}
                        onChange={(e) => {
                          setNewItemId(e.target.value);
                          setInputError("");
                        }}
                        placeholder={formatMessage({
                          id: isActionPool
                            ? "app.signal.actionPool.actionIdPlaceholder"
                            : "app.signal.hypercertPool.hypercertIdPlaceholder",
                        })}
                        className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 font-mono text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/40"
                        aria-label={formatMessage({
                          id: isActionPool
                            ? "app.signal.actionPool.actionIdPlaceholder"
                            : "app.signal.hypercertPool.hypercertIdPlaceholder",
                        })}
                        aria-invalid={inputError ? true : undefined}
                        aria-describedby={inputError ? "register-input-error" : undefined}
                      />
                      {inputError && (
                        <p
                          id="register-input-error"
                          className="mt-1 text-xs text-error-base"
                          role="alert"
                        >
                          {inputError}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={!newItemId.trim() || registerMutation.isPending}
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

      <ConfirmDialog
        isOpen={confirmDeregister !== null}
        onClose={() => setConfirmDeregister(null)}
        title={formatMessage({ id: confirmDeregisterKey })}
        description={formatMessage({ id: confirmDeregisterDescKey })}
        variant="danger"
        onConfirm={() => {
          if (poolAddress && confirmDeregister !== null) {
            deregisterMutation.mutate(
              { poolAddress, hypercertId: confirmDeregister },
              { onSettled: () => setConfirmDeregister(null) }
            );
          }
        }}
      />
    </div>
  );
}

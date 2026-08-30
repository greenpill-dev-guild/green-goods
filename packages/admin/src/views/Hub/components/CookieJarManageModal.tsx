import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  useCookieJarEmergencyWithdraw,
  useCookieJarPause,
  useCookieJarUnpause,
  useCookieJarUpdateInterval,
  useCookieJarUpdateMaxWithdrawal,
} from "@green-goods/shared/hooks/cookie-jar/useCookieJarAdmin";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import { RiCheckLine, RiCloseLine, RiCupLine, RiPencilLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { AdminButton, AdminIconButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminConfirmDialog, AdminDialog } from "@/components/AdminDialog";
import { AdminSelect, AdminTextField } from "@/components/AdminTextField";

type EditingField = { jarAddress: Address; field: "maxWithdrawal" | "interval" };

const INTERVAL_PRESETS = [
  { label: "1h", value: "3600" },
  { label: "6h", value: "21600" },
  { label: "12h", value: "43200" },
  { label: "1d", value: "86400" },
  { label: "7d", value: "604800" },
] as const;

interface CookieJarManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  canManage: boolean;
  isOwner: boolean;
}

export function CookieJarManageModal({
  isOpen,
  onClose,
  gardenAddress,
  canManage,
  isOwner,
}: CookieJarManageModalProps) {
  const { formatMessage } = useIntl();

  const { jars } = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress) && isOpen,
  });

  // Name the garden in the emergency-withdraw confirmation so the steward
  // sees exactly whose jar is being drained.
  const { data: gardens = [] } = useGardens();
  const gardenName =
    gardens.find(
      (garden) =>
        garden.id.toLowerCase() === gardenAddress.toLowerCase() ||
        garden.tokenAddress.toLowerCase() === gardenAddress.toLowerCase()
    )?.name ?? formatAddress(gardenAddress);

  const pauseMutation = useCookieJarPause(gardenAddress);
  const unpauseMutation = useCookieJarUnpause(gardenAddress);
  const emergencyWithdrawMutation = useCookieJarEmergencyWithdraw(gardenAddress);
  const updateMaxWithdrawalMutation = useCookieJarUpdateMaxWithdrawal(gardenAddress);
  const updateIntervalMutation = useCookieJarUpdateInterval(gardenAddress);
  const [emergencyJar, setEmergencyJar] = useState<CookieJar | null>(null);
  const [editing, setEditing] = useState<EditingField | null>(null);
  const [editValue, setEditValue] = useState("");

  const isPending =
    pauseMutation.isPending ||
    unpauseMutation.isPending ||
    emergencyWithdrawMutation.isPending ||
    updateMaxWithdrawalMutation.isPending ||
    updateIntervalMutation.isPending;

  const startEditing = (jar: CookieJar, field: EditingField["field"]) => {
    setEditing({ jarAddress: jar.jarAddress, field });
    if (field === "maxWithdrawal") {
      setEditValue(formatUnits(jar.maxWithdrawal, jar.decimals));
    } else {
      setEditValue(String(jar.withdrawalInterval));
    }
  };

  const cancelEditing = () => {
    setEditing(null);
    setEditValue("");
  };

  const submitMaxWithdrawal = (jar: CookieJar) => {
    const parsed = parseUnits(editValue, jar.decimals);
    updateMaxWithdrawalMutation.mutate(
      { jarAddress: jar.jarAddress, maxWithdrawal: parsed },
      { onSuccess: () => cancelEditing() }
    );
  };

  const submitInterval = (jar: CookieJar) => {
    const interval = BigInt(editValue);
    updateIntervalMutation.mutate(
      { jarAddress: jar.jarAddress, withdrawalInterval: interval },
      { onSuccess: () => cancelEditing() }
    );
  };

  const cooldownDisplay = (seconds: bigint) => {
    const secs = Number(seconds);
    if (secs >= 86400) return `${Math.floor(secs / 86400)}d`;
    if (secs >= 3600) return `${Math.floor(secs / 3600)}h`;
    if (secs >= 60) return `${Math.floor(secs / 60)}m`;
    return `${secs}s`;
  };

  return (
    <>
      <AdminDialog
        open={isOpen}
        onOpenChange={(open) => !open && !isPending && onClose()}
        size="lg"
        // Jar management is garden configuration — it mounts from the Garden
        // Profile dialog, so it carries the garden workspace tone.
        tone="garden"
        title={formatMessage({
          id: "app.cookieJar.manageModal.title",
          defaultMessage: "Manage Cookie Jars",
        })}
        description={formatMessage({
          id: "app.cookieJar.manageModal.description",
          defaultMessage:
            "Review balances, pause state, withdrawal limits, and cooldowns for this garden's cookie jars.",
        })}
      >
        <div className="space-y-3">
          {jars.map((jar) => {
            const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
            return (
              <AdminCard variant="outlined" key={jar.jarAddress} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-strong">{symbol}</p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-label-sm font-medium ${
                        jar.isPaused
                          ? "bg-warning-lighter text-warning-dark"
                          : "bg-success-lighter text-success-dark"
                      }`}
                    >
                      {jar.isPaused
                        ? formatMessage({
                            id: "app.cookieJar.paused",
                            defaultMessage: "Paused",
                          })
                        : formatMessage({
                            id: "app.cookieJar.active",
                            defaultMessage: "Active",
                          })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canManage && (
                      <AdminButton
                        variant="tonal"
                        size="sm"
                        onClick={() => {
                          if (jar.isPaused) {
                            unpauseMutation.mutate({ jarAddress: jar.jarAddress });
                          } else {
                            pauseMutation.mutate({ jarAddress: jar.jarAddress });
                          }
                        }}
                        disabled={pauseMutation.isPending || unpauseMutation.isPending}
                      >
                        {jar.isPaused
                          ? formatMessage({
                              id: "app.cookieJar.unpause",
                              defaultMessage: "Resume Jar",
                            })
                          : formatMessage({
                              id: "app.cookieJar.pause",
                              defaultMessage: "Pause Jar",
                            })}
                      </AdminButton>
                    )}
                    {isOwner && jar.emergencyWithdrawalEnabled && (
                      <AdminButton variant="danger" size="sm" onClick={() => setEmergencyJar(jar)}>
                        {formatMessage({
                          id: "app.cookieJar.emergencyWithdraw",
                          defaultMessage: "Emergency Withdraw",
                        })}
                      </AdminButton>
                    )}
                  </div>
                </div>
                <div className="mt-2 space-y-1.5 text-xs text-text-sub">
                  {/* Max Withdrawal - inline editable */}
                  <div className="flex items-center gap-1.5">
                    {editing?.jarAddress === jar.jarAddress && editing.field === "maxWithdrawal" ? (
                      <span className="flex items-center gap-1">
                        <AdminTextField
                          className="w-36"
                          label={formatMessage({
                            id: "app.cookieJar.maxWithdrawal",
                            defaultMessage: "Available now",
                          })}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          disabled={updateMaxWithdrawalMutation.isPending}
                          inputProps={{
                            inputMode: "decimal",
                            onKeyDown: (e) => {
                              if (e.key === "Enter") submitMaxWithdrawal(jar);
                              if (e.key === "Escape") cancelEditing();
                            },
                          }}
                        />
                        <AdminIconButton
                          size="sm"
                          onClick={() => submitMaxWithdrawal(jar)}
                          disabled={updateMaxWithdrawalMutation.isPending}
                          label={formatMessage({
                            id: "app.cookieJar.confirmMaxWithdrawal",
                            defaultMessage: "Confirm Max Withdrawal",
                          })}
                        >
                          <RiCheckLine />
                        </AdminIconButton>
                        <AdminIconButton
                          size="sm"
                          onClick={cancelEditing}
                          label={formatMessage({
                            id: "app.cookieJar.cancelEdit",
                            defaultMessage: "Cancel Edit",
                          })}
                        >
                          <RiCloseLine />
                        </AdminIconButton>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="whitespace-nowrap">
                          {formatMessage({
                            id: "app.cookieJar.maxWithdrawal",
                            defaultMessage: "Available now",
                          })}
                          :{" "}
                        </span>
                        <span>{formatTokenAmount(jar.maxWithdrawal, jar.decimals)}</span>
                        {canManage && (
                          <AdminIconButton
                            size="sm"
                            onClick={() => startEditing(jar, "maxWithdrawal")}
                            label={formatMessage({
                              id: "app.cookieJar.editMaxWithdrawal",
                              defaultMessage: "Edit Max Withdrawal",
                            })}
                          >
                            <RiPencilLine />
                          </AdminIconButton>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Withdrawal Cooldown - inline editable */}
                  <div className="flex items-center gap-1.5">
                    {editing?.jarAddress === jar.jarAddress && editing.field === "interval" ? (
                      <span className="flex items-center gap-1">
                        <AdminSelect
                          className="w-44"
                          label={formatMessage({
                            id: "app.cookieJar.withdrawalInterval",
                            defaultMessage: "Withdrawal cooldown",
                          })}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          disabled={updateIntervalMutation.isPending}
                        >
                          {INTERVAL_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.label}
                            </option>
                          ))}
                          {!INTERVAL_PRESETS.some((p) => p.value === editValue) && (
                            <option value={editValue}>
                              {cooldownDisplay(BigInt(editValue))} (custom)
                            </option>
                          )}
                        </AdminSelect>
                        <AdminIconButton
                          size="sm"
                          onClick={() => submitInterval(jar)}
                          disabled={updateIntervalMutation.isPending}
                          label={formatMessage({
                            id: "app.cookieJar.confirmWithdrawalCooldown",
                            defaultMessage: "Confirm Withdrawal Cooldown",
                          })}
                        >
                          <RiCheckLine />
                        </AdminIconButton>
                        <AdminIconButton
                          size="sm"
                          onClick={cancelEditing}
                          label={formatMessage({
                            id: "app.cookieJar.cancelEdit",
                            defaultMessage: "Cancel Edit",
                          })}
                        >
                          <RiCloseLine />
                        </AdminIconButton>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="whitespace-nowrap">
                          {formatMessage({
                            id: "app.cookieJar.withdrawalInterval",
                            defaultMessage: "Withdrawal cooldown",
                          })}
                          :{" "}
                        </span>
                        <span>{cooldownDisplay(jar.withdrawalInterval)}</span>
                        {canManage && (
                          <AdminIconButton
                            size="sm"
                            onClick={() => startEditing(jar, "interval")}
                            label={formatMessage({
                              id: "app.cookieJar.editWithdrawalCooldown",
                              defaultMessage: "Edit Withdrawal Cooldown",
                            })}
                          >
                            <RiPencilLine />
                          </AdminIconButton>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Jar Balance - read only */}
                  <div className="flex items-center gap-1.5">
                    <span>
                      {formatMessage({
                        id: "app.cookieJar.balance",
                        defaultMessage: "Jar Balance",
                      })}
                      : {formatTokenAmount(jar.balance, jar.decimals)}
                    </span>
                  </div>
                </div>
              </AdminCard>
            );
          })}

          {jars.length === 0 && (
            <div className="flex min-h-40 items-center justify-center">
              <EmptyState
                icon={<RiCupLine className="h-6 w-6" />}
                title={formatMessage({
                  id: "app.cookieJar.noJars",
                  defaultMessage: "No cookie jars found for this garden",
                })}
                description={formatMessage({
                  id: "app.cookieJar.noJarsHint",
                  defaultMessage: "Jars are created from campaigns and appear here once deployed.",
                })}
              />
            </div>
          )}
        </div>
      </AdminDialog>

      {/* Emergency Withdraw Confirm Dialog (nested) */}
      <AdminConfirmDialog
        isOpen={emergencyJar !== null}
        onClose={() => setEmergencyJar(null)}
        title={formatMessage({
          id: "app.cookieJar.emergencyWithdraw",
          defaultMessage: "Emergency Withdraw",
        })}
        description={formatMessage(
          {
            id: "app.cookieJar.confirmWithdrawDescription",
            defaultMessage: "Take {amount} {asset} from {garden}'s cookie jar?",
          },
          {
            amount: emergencyJar
              ? formatTokenAmount(emergencyJar.balance, emergencyJar.decimals)
              : "0",
            asset: emergencyJar ? getVaultAssetSymbol(emergencyJar.assetAddress, undefined) : "",
            garden: gardenName,
          }
        )}
        confirmLabel={formatMessage({
          id: "app.cookieJar.emergencyWithdraw",
          defaultMessage: "Emergency Withdraw",
        })}
        variant="danger"
        tone="garden"
        isLoading={emergencyWithdrawMutation.isPending}
        onConfirm={() => {
          if (!emergencyJar) return;
          emergencyWithdrawMutation.mutate(
            {
              jarAddress: emergencyJar.jarAddress,
              tokenAddress: emergencyJar.assetAddress,
              amount: emergencyJar.balance,
            },
            { onSuccess: () => setEmergencyJar(null) }
          );
        }}
      />
    </>
  );
}

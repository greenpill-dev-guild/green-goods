import {
  type Address,
  type CookieJar,
  formatTokenAmount,
  getVaultAssetSymbol,
  NativeSelect,
  TextInput,
  useCookieJarEmergencyWithdraw,
  useCookieJarPause,
  useCookieJarUnpause,
  useCookieJarUpdateInterval,
  useCookieJarUpdateMaxWithdrawal,
  useGardenCookieJars,
} from "@green-goods/shared";
import { RiCheckLine, RiCloseLine, RiPencilLine } from "@remixicon/react";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminConfirmDialog, AdminDialog } from "@/components/AdminDialog";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";

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
        size="2xl"
        tone="hub"
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
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
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
                    <span className="whitespace-nowrap">
                      {formatMessage({
                        id: "app.cookieJar.maxWithdrawal",
                        defaultMessage: "Max Withdrawal",
                      })}
                      :{" "}
                    </span>
                    {editing?.jarAddress === jar.jarAddress && editing.field === "maxWithdrawal" ? (
                      <span className="flex items-center gap-1">
                        <TextInput
                          surface="admin"
                          type="text"
                          inputMode="decimal"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitMaxWithdrawal(jar);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          className="w-20 rounded border border-stroke-soft bg-bg-white px-1.5 py-0.5 text-xs text-text-strong focus:border-primary-base focus:outline-none"
                          disabled={updateMaxWithdrawalMutation.isPending}
                        />
                        <AdminButton
                          variant="text"
                          size="sm"
                          className="h-5 w-5 min-w-0 rounded p-0"
                          onClick={() => submitMaxWithdrawal(jar)}
                          disabled={updateMaxWithdrawalMutation.isPending}
                          aria-label={formatMessage({
                            id: "app.cookieJar.confirmMaxWithdrawal",
                            defaultMessage: "Confirm max withdrawal",
                          })}
                        >
                          <RiCheckLine className="h-3.5 w-3.5 text-success-dark" />
                        </AdminButton>
                        <AdminButton
                          variant="text"
                          size="sm"
                          className="h-5 w-5 min-w-0 rounded p-0"
                          onClick={cancelEditing}
                          aria-label={formatMessage({
                            id: "app.cookieJar.cancelEdit",
                            defaultMessage: "Cancel edit",
                          })}
                        >
                          <RiCloseLine className="h-3.5 w-3.5" />
                        </AdminButton>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span>{formatTokenAmount(jar.maxWithdrawal, jar.decimals)}</span>
                        {canManage && (
                          <AdminButton
                            variant="text"
                            size="sm"
                            className="h-5 w-5 min-w-0 rounded p-0"
                            onClick={() => startEditing(jar, "maxWithdrawal")}
                            aria-label={formatMessage({
                              id: "app.cookieJar.editMaxWithdrawal",
                              defaultMessage: "Edit max withdrawal",
                            })}
                          >
                            <RiPencilLine className="h-3 w-3" />
                          </AdminButton>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Withdrawal Cooldown - inline editable */}
                  <div className="flex items-center gap-1.5">
                    <span className="whitespace-nowrap">
                      {formatMessage({
                        id: "app.cookieJar.withdrawalInterval",
                        defaultMessage: "Withdrawal Cooldown",
                      })}
                      :{" "}
                    </span>
                    {editing?.jarAddress === jar.jarAddress && editing.field === "interval" ? (
                      <span className="flex items-center gap-1">
                        <NativeSelect
                          surface="admin"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="rounded border border-stroke-soft bg-bg-white px-1.5 py-0.5 text-xs text-text-strong focus:border-primary-base focus:outline-none"
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
                        </NativeSelect>
                        <AdminButton
                          variant="text"
                          size="sm"
                          className="h-5 w-5 min-w-0 rounded p-0"
                          onClick={() => submitInterval(jar)}
                          disabled={updateIntervalMutation.isPending}
                          aria-label={formatMessage({
                            id: "app.cookieJar.confirmWithdrawalCooldown",
                            defaultMessage: "Confirm withdrawal cooldown",
                          })}
                        >
                          <RiCheckLine className="h-3.5 w-3.5 text-success-dark" />
                        </AdminButton>
                        <AdminButton
                          variant="text"
                          size="sm"
                          className="h-5 w-5 min-w-0 rounded p-0"
                          onClick={cancelEditing}
                          aria-label={formatMessage({
                            id: "app.cookieJar.cancelEdit",
                            defaultMessage: "Cancel edit",
                          })}
                        >
                          <RiCloseLine className="h-3.5 w-3.5" />
                        </AdminButton>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span>{cooldownDisplay(jar.withdrawalInterval)}</span>
                        {canManage && (
                          <AdminButton
                            variant="text"
                            size="sm"
                            className="h-5 w-5 min-w-0 rounded p-0"
                            onClick={() => startEditing(jar, "interval")}
                            aria-label={formatMessage({
                              id: "app.cookieJar.editWithdrawalCooldown",
                              defaultMessage: "Edit withdrawal cooldown",
                            })}
                          >
                            <RiPencilLine className="h-3 w-3" />
                          </AdminButton>
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
            <p className="py-6 text-center text-sm text-text-soft">
              {formatMessage({
                id: "app.cookieJar.noJars",
                defaultMessage: "No cookie jars found for this garden",
              })}
            </p>
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
            defaultMessage: "Withdraw {amount} {asset} from the cookie jar?",
          },
          {
            amount: emergencyJar
              ? formatTokenAmount(emergencyJar.balance, emergencyJar.decimals)
              : "0",
            asset: emergencyJar ? getVaultAssetSymbol(emergencyJar.assetAddress, undefined) : "",
          }
        )}
        confirmLabel={formatMessage({
          id: "app.cookieJar.emergencyWithdraw",
          defaultMessage: "Emergency Withdraw",
        })}
        variant="danger"
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

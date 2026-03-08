import {
  type Address,
  ConfirmDialog,
  type CookieJar,
  formatTokenAmount,
  getVaultAssetSymbol,
  useCookieJarEmergencyWithdraw,
  useCookieJarPause,
  useCookieJarUnpause,
  useGardenCookieJars,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

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
  const [emergencyJar, setEmergencyJar] = useState<CookieJar | null>(null);

  const isPending =
    pauseMutation.isPending || unpauseMutation.isPending || emergencyWithdrawMutation.isPending;

  const cooldownDisplay = (seconds: bigint) => {
    const secs = Number(seconds);
    if (secs >= 86400) return `${Math.floor(secs / 86400)}d`;
    if (secs >= 3600) return `${Math.floor(secs / 3600)}h`;
    if (secs >= 60) return `${Math.floor(secs / 60)}m`;
    return `${secs}s`;
  };

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
          <Dialog.Content
            className="fixed z-50 w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-hidden bg-bg-white shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 duration-300"
            onPointerDownOutside={(e) => {
              if (isPending) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              if (isPending) e.preventDefault();
            }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stroke-soft bg-bg-white px-4 py-3 sm:px-6 sm:py-4">
              <Dialog.Title className="text-lg font-semibold text-text-strong">
                {formatMessage({
                  id: "app.cookieJar.manageModal.title",
                  defaultMessage: "Manage Cookie Jars",
                })}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95"
                  aria-label={formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Body */}
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 sm:p-6">
              <div className="space-y-3">
                {jars.map((jar) => {
                  const symbol = getVaultAssetSymbol(jar.assetAddress, undefined);
                  return (
                    <div
                      key={jar.jarAddress}
                      className="rounded-lg border border-stroke-soft bg-bg-weak p-3"
                    >
                      <div className="flex items-center justify-between">
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
                        <div className="flex gap-2">
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                if (jar.isPaused) {
                                  unpauseMutation.mutate({ jarAddress: jar.jarAddress });
                                } else {
                                  pauseMutation.mutate({ jarAddress: jar.jarAddress });
                                }
                              }}
                              disabled={pauseMutation.isPending || unpauseMutation.isPending}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                jar.isPaused
                                  ? "bg-success-lighter text-success-dark hover:bg-success-light"
                                  : "bg-warning-lighter text-warning-dark hover:bg-warning-light"
                              } disabled:opacity-50`}
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
                            </button>
                          )}
                          {isOwner && jar.emergencyWithdrawalEnabled && (
                            <button
                              type="button"
                              onClick={() => setEmergencyJar(jar)}
                              className="rounded-lg bg-error-lighter px-3 py-1.5 text-xs font-medium text-error-dark transition hover:bg-error-light"
                            >
                              {formatMessage({
                                id: "app.cookieJar.emergencyWithdraw",
                                defaultMessage: "Emergency Withdraw",
                              })}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-sub">
                        <span>
                          {formatMessage({
                            id: "app.cookieJar.maxWithdrawal",
                            defaultMessage: "Max Withdrawal",
                          })}
                          : {formatTokenAmount(jar.maxWithdrawal, jar.decimals)}
                        </span>
                        <span>
                          {formatMessage({
                            id: "app.cookieJar.withdrawalInterval",
                            defaultMessage: "Withdrawal Cooldown",
                          })}
                          : {cooldownDisplay(jar.withdrawalInterval)}
                        </span>
                        <span>
                          {formatMessage({
                            id: "app.cookieJar.balance",
                            defaultMessage: "Jar Balance",
                          })}
                          : {formatTokenAmount(jar.balance, jar.decimals)}
                        </span>
                      </div>
                    </div>
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
            </div>

            {/* Mobile drag indicator */}
            <div className="flex justify-center pb-2 pt-1 sm:hidden" aria-hidden="true">
              <div className="h-1 w-12 rounded-full bg-stroke-sub" />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Emergency Withdraw Confirm Dialog (nested) */}
      <ConfirmDialog
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

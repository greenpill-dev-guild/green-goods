import { type Address, useAppKit, useGardens, useUser } from "@green-goods/shared";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { CookieJarDepositDialog, VaultDepositDialog } from "@/components/Dialogs";
import { ImageWithFallback } from "@/components/Display";

type ActiveDialog = { kind: "vault" | "cookieJar"; gardenAddress: Address; gardenName: string };

/**
 * Public fund page — supporters deposit into a garden's vault or cookie jar.
 * Deposit-only (no withdraw) per D37.
 */
export default function FundPage() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = useGardens();
  const { open: openWalletModal } = useAppKit();
  const { primaryAddress } = useUser();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null);

  const totalGardeners = new Set(gardens.flatMap((g) => g.gardeners ?? [])).size;

  const handleConnectWallet = useCallback(() => {
    openWalletModal();
  }, [openWalletModal]);

  const handleOpenDialog = useCallback(
    (kind: "vault" | "cookieJar", gardenAddress: Address, gardenName: string) => {
      if (!primaryAddress) {
        openWalletModal();
        return;
      }
      setActiveDialog({ kind, gardenAddress, gardenName });
    },
    [primaryAddress, openWalletModal]
  );

  const closeDialog = useCallback(() => setActiveDialog(null), []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-text-strong">
        {formatMessage({ id: "public.fund.title", defaultMessage: "Fund" })}
      </h1>
      <p className="mt-2 text-sm text-text-sub">
        {formatMessage({
          id: "public.fund.description",
          defaultMessage: "Support regenerative gardens by funding their vaults",
        })}
      </p>

      {/* Aggregate Stats */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-4">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "public.fund.totalGardens", defaultMessage: "Total Gardens" })}
          </p>
          <p className="mt-1 text-2xl font-bold text-text-strong">{gardens.length}</p>
        </div>
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-4">
          <p className="text-xs text-text-soft">
            {formatMessage({
              id: "public.fund.totalGardeners",
              defaultMessage: "Total Gardeners",
            })}
          </p>
          <p className="mt-1 text-2xl font-bold text-text-strong">{totalGardeners}</p>
        </div>
      </div>

      {/* Garden Gallery with Deposit + Cookie Jar buttons */}
      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-bg-weak animate-pulse" />
          ))}
        </div>
      ) : gardens.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-stroke-soft bg-bg-white p-6 text-sm text-text-sub">
          {formatMessage({
            id: "public.fund.empty",
            defaultMessage: "Funding destinations will appear here as gardens enable them.",
          })}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gardens.map((garden) => (
            <div key={garden.id} className="rounded-xl border border-stroke-soft bg-bg-white p-4">
              {garden.bannerImage && (
                <ImageWithFallback
                  src={garden.bannerImage}
                  alt={garden.name}
                  className="h-32 w-full rounded-lg object-cover"
                />
              )}
              <h3
                className="mt-3 text-base font-semibold text-text-strong truncate"
                title={garden.name}
              >
                {garden.name}
              </h3>
              <p className="mt-1 text-sm text-text-sub line-clamp-2">{garden.description}</p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenDialog("vault", garden.id, garden.name)}
                  className="flex-1 rounded-lg bg-primary-action px-3 py-2 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover active:scale-[0.98]"
                >
                  {formatMessage({ id: "public.fund.deposit", defaultMessage: "Deposit" })}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDialog("cookieJar", garden.id, garden.name)}
                  className="flex-1 rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 text-sm font-medium text-text-strong transition-colors hover:bg-bg-weak active:scale-[0.98]"
                >
                  {formatMessage({ id: "public.fund.cookieJar", defaultMessage: "Cookie Jar" })}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connect Wallet CTA — opens AppKit modal without redirect to /login */}
      {!primaryAddress && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleConnectWallet}
            className="rounded-lg bg-primary-action px-6 py-3 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover active:scale-[0.98]"
          >
            {formatMessage({
              id: "public.fund.connectWallet",
              defaultMessage: "Connect Wallet",
            })}
          </button>
        </div>
      )}

      {activeDialog?.kind === "vault" && (
        <VaultDepositDialog
          isOpen
          onClose={closeDialog}
          gardenAddress={activeDialog.gardenAddress}
          gardenName={activeDialog.gardenName}
        />
      )}
      {activeDialog?.kind === "cookieJar" && (
        <CookieJarDepositDialog
          isOpen
          onClose={closeDialog}
          gardenAddress={activeDialog.gardenAddress}
          gardenName={activeDialog.gardenName}
        />
      )}
    </div>
  );
}

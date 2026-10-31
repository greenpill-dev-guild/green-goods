import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import { useGardenAccountSigner } from "@green-goods/shared/hooks/garden/useGardenAccountSigner";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";
import { RiCookieLine, RiErrorWarningLine, RiWifiOffLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { CookieJarDepositModal } from "./CookieJarDepositModal";
import { CookieJarPayoutCard, type JarSettingField } from "./CookieJarPayoutCard";
import { CookieJarWithdrawModal } from "./CookieJarWithdrawModal";

// Jars are funded and claimed from the PWA and from other wallets, so this panel re-reads
// them while it is open instead of waiting for a reload.
const JAR_STATE_REFRESH_MS = 15_000;

interface CookieJarPayoutPanelProps {
  gardenAddress: Address;
  gardenName: string;
  routeAction?: "deposit" | "withdraw" | null;
  /**
   * Called when the dialog `routeAction` opened closes, so the caller can drop
   * the route item: left in the URL, it reopened the dialog on a reload and
   * kept the tab the action jumped to (qa-session 2026-10-30 OBS-10).
   */
  onRouteActionClose?: () => void;
  /** Open this jar's per-claim limit editor on arrival (the low-limit alert links here). */
  routeEditLimitJar?: string | null;
  allocationCount?: number;
  /** The payout history filled its list, so the count is a lower bound. */
  allocationCountAtLeast?: boolean;
}

export const CookieJarPayoutPanel: React.FC<CookieJarPayoutPanelProps> = ({
  gardenAddress,
  gardenName,
  routeAction,
  onRouteActionClose,
  routeEditLimitJar,
  allocationCount = 0,
  allocationCountAtLeast = false,
}) => {
  const { formatMessage } = useIntl();

  const {
    jars,
    hasNoJar,
    isPaused: jarsPaused,
    error: jarsError,
    hasDetailReadFailure,
    hasUnreadDecimals,
    moduleConfigured: jarsModuleConfigured,
  } = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress),
    refetchInterval: JAR_STATE_REFRESH_MS,
  });
  // Jar settings are written by the garden account, so the gate is who can sign for it, not
  // the garden's role list: a steward's own wallet would only produce a revert.
  const signer = useGardenAccountSigner(gardenAddress);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [selectedJarAddress, setSelectedJarAddress] = useState<Address | null>(null);
  // One inline editor at a time across the jars.
  const [editing, setEditing] = useState<{ jarAddress: Address; field: JarSettingField } | null>(
    null
  );
  const handledRouteActionRef = useRef<string | null>(null);
  // Which dialog the route opened and still owns, so closing it can hand the
  // route item back; a dialog opened from a jar's own row owes the route nothing.
  const routeOwnedDialogRef = useRef<"deposit" | "withdraw" | null>(null);
  const handledRouteEditRef = useRef<string | null>(null);

  useEffect(() => {
    // Forget the handled action once the route moves on, so the next press of
    // Fund Cookie Jar opens the dialog again.
    if (!routeAction) {
      handledRouteActionRef.current = null;
      // The route no longer owns a dialog: one still open closes without touching
      // the route, so it cannot erase a later same-tab item.
      routeOwnedDialogRef.current = null;
      return;
    }
    if (handledRouteActionRef.current === routeAction) return;

    handledRouteActionRef.current = routeAction;
    routeOwnedDialogRef.current = routeAction;
    setSelectedJarAddress((jars[0]?.jarAddress as Address | undefined) ?? null);
    if (routeAction === "deposit") {
      setDepositOpen(true);
    } else {
      setWithdrawOpen(true);
    }
  }, [jars, routeAction]);

  const closeDialog = (dialog: "deposit" | "withdraw") => {
    if (dialog === "deposit") {
      setDepositOpen(false);
    } else {
      setWithdrawOpen(false);
    }
    if (routeOwnedDialogRef.current === dialog) {
      routeOwnedDialogRef.current = null;
      onRouteActionClose?.();
    }
  };

  useEffect(() => {
    // Forget the handled jar once the route moves on, so the alert can open it again later.
    if (!routeEditLimitJar) {
      handledRouteEditRef.current = null;
      return;
    }
    if (handledRouteEditRef.current === routeEditLimitJar) return;
    const jar = jars.find((candidate) => compareAddresses(candidate.jarAddress, routeEditLimitJar));
    if (!jar) return;

    handledRouteEditRef.current = routeEditLimitJar;
    setEditing({ jarAddress: jar.jarAddress, field: "limit" });
  }, [jars, routeEditLimitJar]);

  const openDeposit = (jar: CookieJar) => {
    setSelectedJarAddress(jar.jarAddress);
    setDepositOpen(true);
  };

  const openWithdraw = (jar: CookieJar) => {
    setSelectedJarAddress(jar.jarAddress);
    setWithdrawOpen(true);
  };

  if (!jarsModuleConfigured) {
    return (
      <AdminCard density="none">
        <AdminCardBody>
          <EmptyState
            icon={<RiCookieLine className="h-6 w-6" />}
            title={formatMessage({ id: "app.cookieJar.moduleNotConfigured" })}
            description={formatMessage({ id: "app.cookieJar.noJarsHint" })}
          />
        </AdminCardBody>
      </AdminCard>
    );
  }

  // A card shows amounts, and a jar's amounts need its currency's decimals: until those are
  // read they use a fallback, so the cards wait like any other unfinished read.
  const awaitingAmounts = jars.length > 0 && hasUnreadDecimals;
  if (jars.length === 0 || awaitingAmounts) {
    // A read paused offline or failed proves nothing, even beside an empty list the cache still
    // holds, so it speaks first; only a finished read that came back empty shows the garden has
    // no jar. TanStack Query reports a paused or not-yet-fetching read as not loading.
    const failed = !awaitingAmounts && (jarsError || hasDetailReadFailure);
    if (jarsPaused || failed) {
      const state = jarsPaused ? "jarsOffline" : "jarsReadFailed";
      return (
        <AdminCard density="none">
          <AdminCardBody>
            <EmptyState
              icon={
                jarsPaused ? (
                  <RiWifiOffLine className="h-6 w-6" />
                ) : (
                  <RiErrorWarningLine className="h-6 w-6" />
                )
              }
              title={formatMessage({ id: `cockpit.community.payouts.${state}.title` })}
              description={formatMessage({ id: `cockpit.community.payouts.${state}.body` })}
            />
          </AdminCardBody>
        </AdminCard>
      );
    }
    if (hasNoJar) {
      return (
        <AdminCard density="none">
          <AdminCardBody>
            <EmptyState
              icon={<RiCookieLine className="h-6 w-6" />}
              title={formatMessage({ id: "app.cookieJar.noJars" })}
              // Says how a jar appears, since funding one is impossible without it (D10).
              description={formatMessage({ id: "cockpit.community.payouts.noJarHow" })}
            />
          </AdminCardBody>
        </AdminCard>
      );
    }
    return (
      <div className="flex flex-col gap-(--gg-list-gap)" role="status" aria-live="polite">
        <span className="sr-only">{formatMessage({ id: "app.cookieJar.loading" })}</span>
        {[0, 1].map((index) => (
          <ItemRowSkeleton key={index} lead="icon" amount />
        ))}
      </div>
    );
  }

  return (
    <>
      <AdminCard density="none" className="overflow-hidden">
        <AdminCardHeader>
          <div>
            <AdminCardTitle>
              {formatMessage({
                id: "app.cookieJar.payoutTitle",
                defaultMessage: "Cookie Jars",
              })}
            </AdminCardTitle>
            <p className="mt-1 type-meta text-text-sub">
              {formatMessage(
                {
                  id: allocationCountAtLeast
                    ? "cockpit.community.payouts.totalAtLeast"
                    : "cockpit.community.payouts.total",
                },
                { count: allocationCount }
              )}
            </p>
            <p className="mt-1 type-body text-text-sub">
              {formatMessage({
                id: "app.cookieJar.payoutDescription",
                defaultMessage: "Gardeners claim rewards from cookie jars for completed work",
              })}
            </p>
          </div>
        </AdminCardHeader>

        <AdminCardBody className="space-y-3">
          <div className="flex flex-col gap-(--gg-list-gap)">
            {jars.map((jar) => (
              <CookieJarPayoutCard
                key={jar.jarAddress}
                jar={jar}
                gardenAddress={gardenAddress}
                gardenName={gardenName}
                allocationCount={allocationCount}
                allocationCountAtLeast={allocationCountAtLeast}
                signer={signer}
                editingField={editing?.jarAddress === jar.jarAddress ? editing.field : null}
                onEdit={(field) => setEditing(field ? { jarAddress: jar.jarAddress, field } : null)}
                onDeposit={() => openDeposit(jar)}
                onClaim={() => openWithdraw(jar)}
              />
            ))}
          </div>
        </AdminCardBody>
      </AdminCard>

      <CookieJarWithdrawModal
        isOpen={withdrawOpen}
        onClose={() => closeDialog("withdraw")}
        gardenAddress={gardenAddress}
        defaultJarAddress={selectedJarAddress}
      />
      <CookieJarDepositModal
        isOpen={depositOpen}
        onClose={() => closeDialog("deposit")}
        gardenAddress={gardenAddress}
        defaultJarAddress={selectedJarAddress}
        onFixLimit={(jarAddress) => {
          closeDialog("deposit");
          setEditing({ jarAddress, field: "limit" });
        }}
      />
    </>
  );
};

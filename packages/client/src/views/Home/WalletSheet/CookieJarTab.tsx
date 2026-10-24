import { Alert } from "@green-goods/shared/components/Alert";
import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useAccessibleCookieJars } from "@green-goods/shared/hooks/cookie-jar/useAccessibleCookieJars";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import { RiErrorWarningLine, RiInboxLine, RiWifiOffLine } from "@remixicon/react";
import React, { useMemo } from "react";
import { useIntl } from "react-intl";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { CookieJarRow, getClaimableNow } from "@/components/Features/Garden/CookieJarRow";
import {
  PWA_SHEET_SCROLL_CLASSNAME,
  PWA_SHEET_FOCAL_STATE_CLASSNAME,
} from "@/components/Pwa/sheetScrollStyles";

function isClaimableJar(jar: CookieJar) {
  return !jar.isPaused && getClaimableNow(jar) > 0n;
}

function compareClaimableFirst(left: CookieJar, right: CookieJar) {
  const leftClaimable = isClaimableJar(left);
  const rightClaimable = isClaimableJar(right);
  if (leftClaimable === rightClaimable) return 0;
  return leftClaimable ? -1 : 1;
}

export const CookieJarTab: React.FC = () => {
  const { formatMessage } = useIntl();
  const isOnline = useOnlineStatus();
  const {
    jars,
    isLoading,
    moduleConfigured,
    unconfirmedGardenCount,
    eligibilityErrorCount,
    hasEligibilityReadFailure,
    jarAddressErrorCount,
    hasJarAddressReadFailure,
    detailErrorCount,
    hasDetailReadFailure,
    decimalsErrorCount,
    hasDecimalsReadFailure,
  } = useAccessibleCookieJars();
  const { data: gardens = [] } = useGardens();

  // Group jars by garden
  const groupedJars = useMemo(() => {
    const groups = new Map<string, { gardenName: string; jars: CookieJar[] }>();
    for (const jar of jars) {
      const garden = gardens.find(
        (g) =>
          g.id.toLowerCase() === jar.gardenAddress.toLowerCase() ||
          g.tokenAddress.toLowerCase() === jar.gardenAddress.toLowerCase()
      );
      const gardenName = garden?.name ?? jar.gardenAddress;
      const key = jar.gardenAddress.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.jars.push(jar);
      } else {
        groups.set(key, { gardenName, jars: [jar] });
      }
    }
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        jars: [...group.jars].sort(compareClaimableFirst),
      }))
      .sort((left, right) => {
        const leftClaimable = left.jars.some(isClaimableJar);
        const rightClaimable = right.jars.some(isClaimableJar);
        if (leftClaimable === rightClaimable) return 0;
        return leftClaimable ? -1 : 1;
      });
  }, [jars, gardens]);

  if (isLoading) {
    return (
      <div className={PWA_SHEET_SCROLL_CLASSNAME}>
        <div className="space-y-2.5 p-4" role="status">
          <p className="text-xs text-text-soft-400">
            {formatMessage({
              id: "app.cookieJar.loading",
              defaultMessage: "Checking which cookie jars you can access…",
            })}
          </p>
          <div className="flex animate-pulse flex-col gap-(--gg-list-gap)" aria-hidden="true">
            {Array.from({ length: 2 }, (_, i) => (
              <ItemRowSkeleton key={i} lead="icon" amount />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!moduleConfigured) {
    return (
      <div className={PWA_SHEET_SCROLL_CLASSNAME}>
        <div className={PWA_SHEET_FOCAL_STATE_CLASSNAME}>
          <EmptyState
            placement="sheet"
            tone="warning"
            icon={<RiErrorWarningLine />}
            title={formatMessage({ id: "app.cookieJar.moduleNotConfigured" })}
          />
        </div>
      </div>
    );
  }

  const accessDiagnostic =
    hasEligibilityReadFailure && unconfirmedGardenCount > 0
      ? formatMessage(
          {
            id: "app.cookieJar.walletEligibilityUnconfirmed",
            defaultMessage:
              "{count, plural, one {We couldn't confirm cookie jar access for # garden.} other {We couldn't confirm cookie jar access for # gardens.}}",
          },
          { count: eligibilityErrorCount || unconfirmedGardenCount }
        )
      : null;
  const hasPartialReadFailure =
    hasJarAddressReadFailure || hasDetailReadFailure || hasDecimalsReadFailure;
  const readFailureCount = jarAddressErrorCount + detailErrorCount + decimalsErrorCount;
  const partialReadDiagnostic =
    hasPartialReadFailure && readFailureCount > 0
      ? formatMessage({ id: "app.cookieJar.partialReadWarning" })
      : null;
  const diagnostics = [accessDiagnostic, partialReadDiagnostic].filter(
    (message): message is string => Boolean(message)
  );
  const diagnosticBlock =
    diagnostics.length > 0 ? (
      <div className="space-y-2">
        {diagnostics.map((message) => (
          <Alert key={message} variant="warning" className="p-3">
            {message}
          </Alert>
        ))}
      </div>
    ) : null;

  if (jars.length === 0) {
    return (
      <div className={PWA_SHEET_SCROLL_CLASSNAME}>
        <div className={PWA_SHEET_FOCAL_STATE_CLASSNAME}>
          {diagnosticBlock}
          {/* Offline reads fail closed, so an empty list proves nothing — say
            offline instead of claiming there are no jars. */}
          {!isOnline ? (
            <EmptyState
              placement="sheet"
              icon={<RiWifiOffLine />}
              title={formatMessage({ id: "app.cookieJar.walletOffline" })}
            />
          ) : (
            <EmptyState
              placement="sheet"
              icon={<RiInboxLine />}
              title={formatMessage({ id: "app.cookieJar.walletEmpty" })}
              description={formatMessage({ id: "app.cookieJar.walletEmptyDescription" })}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={PWA_SHEET_SCROLL_CLASSNAME}>
      <div className="space-y-4 p-4">
        {diagnosticBlock}
        {groupedJars.map((group) => (
          <div key={group.gardenName}>
            <SheetHeading as="h4" className="mb-2 truncate" title={group.gardenName}>
              {group.gardenName}
            </SheetHeading>
            <div className="flex flex-col gap-(--gg-list-gap)">
              {group.jars.map((jar) => (
                // The heading above names the garden, so the row does not restate it (Rule 17).
                <CookieJarRow
                  key={jar.jarAddress}
                  jar={jar}
                  gardenAddress={jar.gardenAddress}
                  gardenName={group.gardenName}
                  amount="claimable"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import type { Address } from "@green-goods/shared/types/domain";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import { RiErrorWarningLine, RiInboxLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { EmptyState } from "@/components/Communication";
import { PWA_SHEET_FOCAL_STATE_CLASSNAME } from "@/components/Pwa/sheetScrollStyles";
import { CookieJarCard } from "./CookieJarCard";

export interface CookieJarTabContentProps {
  gardenAddress: Address;
  gardenName: string;
  jars: CookieJar[];
  isLoading: boolean;
  isError: boolean;
  moduleConfigured: boolean;
  hasDetailReadFailure?: boolean;
}

export function CookieJarTabContent({
  gardenAddress,
  gardenName,
  jars,
  isLoading,
  isError,
  moduleConfigured,
  hasDetailReadFailure,
}: CookieJarTabContentProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className="space-y-2.5 animate-pulse p-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 flex-1 rounded bg-bg-weak" />
            <div className="h-3 w-16 rounded bg-bg-weak" />
          </div>
        ))}
      </div>
    );
  }

  if (!moduleConfigured) {
    return (
      <div className={PWA_SHEET_FOCAL_STATE_CLASSNAME}>
        <EmptyState
          placement="sheet"
          tone="warning"
          icon={<RiErrorWarningLine />}
          title={formatMessage({ id: "app.cookieJar.moduleNotConfigured" })}
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={PWA_SHEET_FOCAL_STATE_CLASSNAME}>
        <EmptyState
          placement="sheet"
          tone="error"
          icon={<RiErrorWarningLine />}
          title={formatMessage({ id: "app.cookieJar.errorLoading" })}
        />
      </div>
    );
  }

  if (jars.length === 0) {
    return (
      <div className={PWA_SHEET_FOCAL_STATE_CLASSNAME}>
        <EmptyState
          placement="sheet"
          icon={<RiInboxLine />}
          title={formatMessage({ id: "app.cookieJar.noJars" })}
          description={formatMessage({ id: "app.cookieJar.noJarsDescription" })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {hasDetailReadFailure ? (
        <p className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-xs text-text-soft">
          {formatMessage({ id: "app.cookieJar.partialReadWarning" })}
        </p>
      ) : null}
      {jars.map((jar) => (
        <CookieJarCard
          key={jar.jarAddress}
          jar={jar}
          gardenAddress={gardenAddress}
          gardenName={gardenName}
        />
      ))}
    </div>
  );
}

import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import type { Address } from "@green-goods/shared/types/domain";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import { RiErrorWarningLine, RiInboxLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { CookieJarRow } from "@/components/Features/Garden/CookieJarRow";
import { PWA_SHEET_FOCAL_STATE_CLASSNAME } from "@/components/Pwa/sheetScrollStyles";

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
      <div className="flex animate-pulse flex-col gap-(--gg-list-gap) p-4">
        {Array.from({ length: 2 }, (_, i) => (
          <ItemRowSkeleton key={i} lead="icon" amount />
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
    <div className="flex flex-col gap-(--gg-list-gap) p-4">
      {hasDetailReadFailure ? (
        <p className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 text-xs text-text-soft">
          {formatMessage({ id: "app.cookieJar.partialReadWarning" })}
        </p>
      ) : null}
      {jars.map((jar) => (
        <CookieJarRow
          key={jar.jarAddress}
          jar={jar}
          gardenAddress={gardenAddress}
          gardenName={gardenName}
          amount="balance"
        />
      ))}
    </div>
  );
}

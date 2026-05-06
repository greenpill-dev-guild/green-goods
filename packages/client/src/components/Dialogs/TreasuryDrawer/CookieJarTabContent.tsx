import { type Address, type CookieJar } from "@green-goods/shared";
import { RiErrorWarningLine, RiInboxLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { EmptyState } from "@/components/Communication";
import { CookieJarCard } from "./CookieJarCard";

export interface CookieJarTabContentProps {
  gardenAddress: Address;
  jars: CookieJar[];
  isLoading: boolean;
  isError: boolean;
  moduleConfigured: boolean;
  hasDetailReadFailure?: boolean;
}

export function CookieJarTabContent({
  gardenAddress,
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
      <EmptyState
        tone="warning"
        icon={<RiErrorWarningLine />}
        title={formatMessage({ id: "app.cookieJar.moduleNotConfigured" })}
      />
    );
  }

  if (isError) {
    return (
      <EmptyState
        tone="error"
        icon={<RiErrorWarningLine />}
        title={formatMessage({ id: "app.cookieJar.errorLoading" })}
      />
    );
  }

  if (jars.length === 0) {
    return (
      <EmptyState
        icon={<RiInboxLine />}
        title={formatMessage({ id: "app.cookieJar.noJars" })}
        description={formatMessage({ id: "app.cookieJar.noJarsDescription" })}
      />
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
        <CookieJarCard key={jar.jarAddress} jar={jar} gardenAddress={gardenAddress} />
      ))}
    </div>
  );
}

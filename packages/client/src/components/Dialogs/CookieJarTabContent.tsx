import { type Address, type CookieJar } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { CookieJarCard } from "./CookieJarCard";

interface CookieJarTabContentProps {
  gardenAddress: Address;
  jars: CookieJar[];
  isLoading: boolean;
  isError: boolean;
  moduleConfigured: boolean;
}

export function CookieJarTabContent({
  gardenAddress,
  jars,
  isLoading,
  isError,
  moduleConfigured,
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
      <p className="p-4 text-sm text-text-soft">
        {formatMessage({ id: "app.cookieJar.moduleNotConfigured" })}
      </p>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="m-4 rounded-md border border-error-light bg-error-lighter px-3 py-2 text-xs text-error-dark"
      >
        <p>{formatMessage({ id: "app.cookieJar.errorLoading" })}</p>
      </div>
    );
  }

  if (jars.length === 0) {
    return (
      <p className="p-4 text-sm text-text-soft">{formatMessage({ id: "app.cookieJar.noJars" })}</p>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {jars.map((jar) => (
        <CookieJarCard key={jar.jarAddress} jar={jar} gardenAddress={gardenAddress} />
      ))}
    </div>
  );
}

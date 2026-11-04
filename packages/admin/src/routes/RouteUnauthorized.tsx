import type { ReactNode } from "react";
import { useIntl } from "react-intl";

/** What a gated route shows, in its place, to someone it is not for. */
export default function RouteUnauthorized({ children }: { children?: ReactNode }) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex items-center justify-center min-h-screen" data-testid="unauthorized">
      <div className="text-center">
        <h1 className="type-title-lg font-semibold text-text-strong mb-4">
          {formatMessage({ id: "app.admin.auth.unauthorized" })}
        </h1>
        <p className="text-text-sub">{formatMessage({ id: "app.admin.auth.noPermission" })}</p>
        {children}
      </div>
    </div>
  );
}

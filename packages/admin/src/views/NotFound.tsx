import { RiFileUnknowLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  const { formatMessage } = useIntl();

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="text-center">
        <RiFileUnknowLine className="mx-auto h-16 w-16 text-text-soft" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-text-strong">
          {formatMessage({ id: "app.admin.nav.notFound", defaultMessage: "Page not found" })}
        </h1>
        <p className="mt-2 text-text-sub">
          {formatMessage({
            id: "app.admin.nav.notFoundDescription",
            defaultMessage: "The page you are looking for does not exist or has been moved.",
          })}
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/dashboard">
              {formatMessage({
                id: "app.admin.nav.backToDashboard",
                defaultMessage: "Back to Dashboard",
              })}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { RiFileUnknowLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";

export default function NotFound() {
  const { formatMessage } = useIntl();

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <EmptyState
        titleAs="h1"
        icon={<RiFileUnknowLine />}
        title={formatMessage({ id: "app.admin.nav.notFound", defaultMessage: "Page not found" })}
        description={formatMessage({
          id: "app.admin.nav.notFoundDescription",
          defaultMessage: "The page you are looking for does not exist or has been moved.",
        })}
        action={
          <AdminButton asChild>
            <Link to="/hub">
              {formatMessage({
                id: "app.admin.nav.backToHub",
                defaultMessage: "Back to Hub",
              })}
            </Link>
          </AdminButton>
        }
      />
    </div>
  );
}

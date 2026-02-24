import { type Address, formatDate, type HypercertRecord } from "@green-goods/shared";
import { RiAwardLine, RiExternalLinkLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActiveListingsTable } from "@/components/hypercerts/ActiveListingsTable";

const HYPERCERTS_APP_BASE_URL = "https://app.hypercerts.org/hypercerts";

interface GardenHypercertsPanelProps {
  gardenId: string;
  gardenAddress: Address;
  hypercerts: HypercertRecord[];
  isLoading: boolean;
  canManage: boolean;
}

export const GardenHypercertsPanel: React.FC<GardenHypercertsPanelProps> = ({
  gardenId,
  gardenAddress,
  hypercerts,
  isLoading,
  canManage,
}) => {
  const { formatMessage } = useIntl();

  return (
    <Card>
      <Card.Header className="gap-2">
        <h3 className="min-w-0 truncate label-md text-text-strong sm:text-lg">
          {formatMessage({ id: "app.hypercerts.list.title" })}
        </h3>
        <Link
          to={`/gardens/${gardenId}/hypercerts`}
          className="inline-flex items-center rounded-md border border-stroke-sub px-3 py-1.5 text-xs font-medium text-text-sub transition hover:bg-bg-weak"
        >
          {formatMessage({ id: "app.garden.admin.viewAll" })}
        </Link>
      </Card.Header>
      <Card.Body>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg bg-bg-weak p-3"
              >
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-40 rounded bg-bg-soft" />
                    <div className="h-3 w-24 rounded bg-bg-soft" />
                  </div>
                  <div className="h-6 w-16 rounded bg-bg-soft" />
                </div>
              </div>
            ))}
          </div>
        ) : hypercerts.length === 0 ? (
          <EmptyState
            icon={<RiAwardLine className="h-6 w-6" />}
            title={formatMessage({ id: "app.hypercerts.list.empty.title" })}
            description={formatMessage({ id: "app.hypercerts.list.empty.description" })}
          />
        ) : (
          <>
            {canManage && (
              <div className="mb-4">
                <ActiveListingsTable gardenAddress={gardenAddress} />
              </div>
            )}
            <div className="space-y-3">
              {hypercerts.map((record) => {
                const mintedDate = record.mintedAt
                  ? formatDate(record.mintedAt * 1000, { dateStyle: "medium" })
                  : formatMessage({ id: "app.hypercerts.list.dateUnknown" });
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-lg bg-bg-weak p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center space-x-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-lighter">
                        <RiAwardLine className="h-4 w-4 text-primary-dark" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-strong">
                          {record.title?.trim() ||
                            formatMessage({ id: "app.hypercerts.list.fallbackTitle" })}
                        </p>
                        <p className="text-xs text-text-soft">
                          {formatMessage(
                            { id: "app.hypercerts.list.mintedOn" },
                            { date: mintedDate }
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/gardens/${gardenId}/hypercerts/${record.id}`}
                        className="inline-flex items-center rounded text-sm text-primary-dark transition hover:text-primary-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base/40"
                      >
                        {formatMessage({ id: "app.hypercerts.list.viewDetails" })}
                      </Link>
                      <a
                        href={`${HYPERCERTS_APP_BASE_URL}/${record.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded text-sm text-primary-dark transition hover:text-primary-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base/40"
                      >
                        <RiExternalLinkLine className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

import { ItemRow, ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { Address } from "@green-goods/shared/types/domain";
import type { HypercertRecord } from "@green-goods/shared/types/hypercerts";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { formatDate } from "@green-goods/shared/utils/time";
import { RiAwardLine, RiExternalLinkLine, RiMedalLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useNavigate } from "react-router-dom";
import { AdminIconButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { ActiveListingsTable } from "@/components/Hypercerts/ActiveListingsTable";
import { AdminCard, AdminCardBody, AdminCardHeader } from "../AdminCard";

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
  const navigate = useNavigate();
  const gardenRouteContext = { gardenId: gardenAddress ?? gardenId };

  return (
    <AdminCard density="none">
      <AdminCardHeader className="gap-2">
        <AdminCardTitle className="min-w-0 truncate">
          {formatMessage({ id: "app.hypercerts.list.title" })}
        </AdminCardTitle>
        <Link
          to={adminRoutes.gardenImpact({ ...gardenRouteContext, section: "hypercerts" })}
          className="inline-flex items-center rounded-md border border-stroke-sub px-3 py-1.5 type-label-sm text-text-sub transition hover:bg-bg-weak"
        >
          {formatMessage({ id: "app.garden.admin.viewAll" })}
        </Link>
      </AdminCardHeader>
      <AdminCardBody>
        {isLoading ? (
          <div className="flex flex-col gap-(--gg-list-gap)" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <ItemRowSkeleton key={`hypercert-skeleton-${index}`} />
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
            <ul className="flex flex-col gap-(--gg-list-gap)">
              {hypercerts.map((record) => {
                const mintedDate = record.mintedAt
                  ? formatDate(record.mintedAt * 1000, { dateStyle: "medium" })
                  : formatMessage({ id: "app.hypercerts.list.dateUnknown" });
                const title =
                  record.title?.trim() ||
                  formatMessage({ id: "app.hypercerts.list.fallbackTitle" });
                return (
                  <li key={record.id}>
                    <ItemRow
                      lead={{ kind: "icon", icon: <RiMedalLine /> }}
                      title={title}
                      details={[
                        mintedDate,
                        formatMessage(
                          { id: "app.hypercerts.list.workCount" },
                          { count: record.attestationCount ?? 0 }
                        ),
                      ]}
                      onOpen={() =>
                        navigate(adminRoutes.gardenHypercertDetail(record.id, gardenRouteContext))
                      }
                      action={
                        <AdminIconButton
                          asChild
                          size="sm"
                          label={formatMessage({ id: "app.hypercerts.list.viewExternal" })}
                        >
                          <a
                            href={`${HYPERCERTS_APP_BASE_URL}/${record.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <RiExternalLinkLine className="h-4 w-4" aria-hidden="true" />
                          </a>
                        </AdminIconButton>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </AdminCardBody>
    </AdminCard>
  );
};

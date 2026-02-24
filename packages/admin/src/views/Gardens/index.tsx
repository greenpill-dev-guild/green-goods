import { useGardenPermissions, useGardens, resolveIPFSUrl } from "@green-goods/shared";
import {
  RiAddLine,
  RiAlertLine,
  RiEyeLine,
  RiPlantLine,
  RiShieldCheckLine,
  RiUserLine,
  RiVipCrownLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function Gardens() {
  const { formatMessage } = useIntl();
  const gardenPermissions = useGardenPermissions();
  const { data: gardens = [], isLoading, error } = useGardens();

  const errorMessage = error instanceof Error ? error.message : error ? "Unknown error" : null;

  const headerDescription = errorMessage
    ? formatMessage({
        id: "admin.gardens.indexerOffline",
        defaultMessage: "Indexer offline — limited functionality available.",
      })
    : formatMessage({
        id: "admin.gardens.description",
        defaultMessage: "View all gardens. Manage gardens where you are an operator.",
      });

  const headerActions = (
    <Button asChild>
      <Link to="/gardens/create">
        <RiAddLine className="mr-2 h-4 w-4" />
        {formatMessage({ id: "admin.gardens.createGarden", defaultMessage: "Create Garden" })}
      </Link>
    </Button>
  );

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div
        className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading gardens</span>
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-48 skeleton-shimmer" style={{ animationDelay: `${i * 0.05}s` }} />
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <div
                  className="h-6 rounded skeleton-shimmer"
                  style={{ animationDelay: `${i * 0.05}s` }}
                />
                <div
                  className="h-4 w-24 rounded skeleton-shimmer"
                  style={{ animationDelay: `${i * 0.05 + 0.05}s` }}
                />
              </div>
              <div
                className="h-4 rounded skeleton-shimmer"
                style={{ animationDelay: `${i * 0.05 + 0.1}s` }}
              />
              <div
                className="h-4 w-3/4 rounded skeleton-shimmer"
                style={{ animationDelay: `${i * 0.05 + 0.1}s` }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div
                    className="h-4 w-20 rounded skeleton-shimmer"
                    style={{ animationDelay: `${i * 0.05 + 0.15}s` }}
                  />
                  <div
                    className="h-4 w-20 rounded skeleton-shimmer"
                    style={{ animationDelay: `${i * 0.05 + 0.15}s` }}
                  />
                </div>
                <div
                  className="h-8 w-20 rounded skeleton-shimmer"
                  style={{ animationDelay: `${i * 0.05 + 0.2}s` }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  } else if (errorMessage) {
    content = (
      <div className="space-y-8">
        <div className="rounded-md border border-warning-light bg-warning-lighter p-4">
          <div className="flex items-start gap-3">
            <RiAlertLine className="h-5 w-5 flex-shrink-0 text-warning-base" />
            <div>
              <h3 className="text-sm font-medium text-warning-dark">
                {formatMessage({
                  id: "admin.gardens.indexerError.title",
                  defaultMessage: "Indexer Connection Issue",
                })}
              </h3>
              <div className="mt-2 space-y-1 text-sm text-warning-dark/80">
                <p>
                  {formatMessage(
                    {
                      id: "admin.gardens.indexerError.message",
                      defaultMessage: "Unable to load gardens from indexer: {error}",
                    },
                    { error: errorMessage }
                  )}
                </p>
                <p>
                  {formatMessage({
                    id: "admin.gardens.indexerError.fallback",
                    defaultMessage:
                      "Garden management features are still available if you have direct garden addresses.",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <EmptyState
          icon={<RiPlantLine className="h-6 w-6" />}
          title={formatMessage({
            id: "admin.gardens.unavailable.title",
            defaultMessage: "Gardens Unavailable",
          })}
          description={formatMessage({
            id: "admin.gardens.unavailable.description",
            defaultMessage:
              "Cannot load gardens due to indexer connection issues. Please check back later.",
          })}
        />
      </div>
    );
  } else if (gardens.length === 0) {
    content = (
      <EmptyState
        icon={<RiPlantLine className="h-6 w-6" />}
        title={formatMessage({ id: "admin.gardens.empty.title", defaultMessage: "No gardens yet" })}
        description={formatMessage({
          id: "admin.gardens.empty.description",
          defaultMessage: "Get started by creating your first garden.",
        })}
        action={{
          label: formatMessage({
            id: "admin.gardens.empty.action",
            defaultMessage: "Create Garden",
          }),
          onClick: () => {
            window.location.href = "/gardens/create";
          },
        }}
      />
    );
  } else {
    content = (
      <div className="stagger-children grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {gardens.map((garden, index) => {
          const canManage = gardenPermissions.canManageGarden(garden);
          const isOwner = gardenPermissions.isOwnerOfGarden(garden);
          const isOperator = gardenPermissions.isOperatorOfGarden(garden);
          const isEvaluator = gardenPermissions.isEvaluatorOfGarden(garden);
          const resolvedBannerImage = garden.bannerImage
            ? resolveIPFSUrl(garden.bannerImage)
            : null;
          const isFeatured = index === 0 && gardens.length > 1;

          const roleBadge = (() => {
            if (isOwner) {
              return {
                label: formatMessage({ id: "app.roles.owner" }),
                className: "bg-feature-lighter text-feature-dark",
                Icon: RiVipCrownLine,
              };
            }
            if (isOperator) {
              return {
                label: formatMessage({ id: "app.roles.operator" }),
                className: "bg-success-lighter text-success-dark",
                Icon: RiShieldCheckLine,
              };
            }
            if (isEvaluator) {
              return {
                label: formatMessage({ id: "app.roles.evaluator" }),
                className: "bg-info-lighter text-info-dark",
                Icon: RiEyeLine,
              };
            }
            return null;
          })();

          return (
            <Card
              key={garden.id}
              data-testid="garden-card"
              variant="interactive"
              colorAccent={isFeatured ? "primary" : "success"}
              className={`overflow-hidden active:scale-[0.98] ${isFeatured ? "md:col-span-2" : ""}`}
            >
              <div className={`relative ${isFeatured ? "h-56" : "h-48"}`}>
                {resolvedBannerImage ? (
                  <img
                    src={resolvedBannerImage}
                    alt={garden.name}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      const placeholder = event.currentTarget
                        .nextElementSibling as HTMLElement | null;
                      if (placeholder) {
                        placeholder.style.display = "flex";
                      }
                      event.currentTarget.style.display = "none";
                    }}
                    loading="lazy"
                  />
                ) : null}
                <div
                  className={`absolute inset-0 items-center justify-center bg-gradient-to-br from-primary-dark via-primary-base to-primary-darker text-primary-foreground ${resolvedBannerImage ? "hidden" : "flex"}`}
                  style={{ display: resolvedBannerImage ? "none" : "flex" }}
                >
                  <div className="text-center">
                    <div className={`font-bold opacity-80 ${isFeatured ? "text-3xl" : "text-2xl"}`}>
                      {garden.name.charAt(0)}
                    </div>
                  </div>
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  {isFeatured && (
                    <span className="flex items-center rounded-full bg-primary-base px-2 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                      <RiPlantLine className="mr-1 h-3 w-3" />
                      {formatMessage({ id: "admin.gardens.featured", defaultMessage: "Featured" })}
                    </span>
                  )}
                  {roleBadge && (
                    <div
                      className={`flex items-center rounded-full px-2 py-1 text-xs font-medium ${roleBadge.className}`}
                    >
                      <roleBadge.Icon className="mr-1 h-3 w-3" />
                      {roleBadge.label}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <h3
                      className={`mb-1 font-heading font-medium text-text-strong ${isFeatured ? "text-xl" : "text-lg"}`}
                    >
                      {garden.name}
                    </h3>
                    <p className="body-sm text-text-soft">{garden.location}</p>
                  </div>
                  {!resolvedBannerImage && roleBadge && (
                    <div
                      className={`ml-2 flex items-center rounded-full px-2 py-1 text-xs font-medium ${roleBadge.className}`}
                    >
                      <roleBadge.Icon className="mr-1 h-3 w-3" />
                      {roleBadge.label}
                    </div>
                  )}
                </div>
                <p className={`mb-4 body-sm text-text-sub ${isFeatured ? "" : "line-clamp-2"}`}>
                  {garden.description}
                </p>

                <div className="mb-4 flex items-center justify-between body-sm text-text-soft">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <RiShieldCheckLine className="mr-1 h-4 w-4" />
                      <span>{garden.operators?.length ?? 0} operators</span>
                    </div>
                    <div className="flex items-center">
                      <RiUserLine className="mr-1 h-4 w-4" />
                      <span>{garden.gardeners?.length ?? 0} gardeners</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button variant="secondary" size="sm" asChild>
                    <Link to={`/gardens/${garden.id}`}>
                      <RiEyeLine className="mr-1 h-4 w-4" />
                      {canManage
                        ? formatMessage({ id: "admin.gardens.manage", defaultMessage: "Manage" })
                        : formatMessage({ id: "admin.gardens.view", defaultMessage: "View" })}
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "admin.gardens.title", defaultMessage: "Gardens" })}
        description={headerDescription}
        actions={headerActions}
      />
      <div className="mt-6 px-4 sm:px-6">{content}</div>
    </div>
  );
}

import {
  DEFAULT_CHAIN_ID,
  ImageWithFallback,
  formatDateTime,
  useRole,
  useActions,
} from "@green-goods/shared";
import { RiEditLine, RiImageLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

interface ActionDetailMediaTileProps {
  src?: string;
  alt: string;
  unavailableLabel: string;
  unavailableDescription: string;
}

function ActionDetailMediaTile({
  src,
  alt,
  unavailableLabel,
  unavailableDescription,
}: ActionDetailMediaTileProps) {
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

  if (hasError) {
    return (
      <div className="w-full h-48 rounded bg-bg-soft flex flex-col items-center justify-center px-4 text-center">
        <RiImageLine className="h-6 w-6 text-text-soft mb-2" />
        <p className="text-sm font-medium text-text-sub">{unavailableLabel}</p>
        <p className="mt-1 text-xs text-text-soft">{unavailableDescription}</p>
      </div>
    );
  }

  return (
    <ImageWithFallback
      src={src || ""}
      alt={alt}
      className="w-full h-48 object-cover rounded"
      fallbackClassName="w-full h-48 rounded bg-bg-soft text-text-soft"
      fallbackIcon={RiImageLine}
      onErrorCallback={() => setHasError(true)}
    />
  );
}

export default function ActionDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const { role } = useRole();
  const { data: actions = [], isLoading } = useActions(DEFAULT_CHAIN_ID);
  const canManageActions = role === "deployer" || role === "operator";
  const action = actions.find((a) => a.id === id);
  const imageUnavailableLabel = formatMessage({
    id: "admin.actions.imageUnavailable",
    defaultMessage: "Image unavailable",
  });
  const imageUnavailableDescription = formatMessage({
    id: "admin.actions.imageUnavailableDescription",
    defaultMessage: "This action does not currently have a valid image.",
  });

  if (isLoading) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">{formatMessage({ id: "app.actions.loading" })}</span>
        <div className="border-b border-stroke-soft bg-bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="h-7 w-48 rounded skeleton-shimmer" />
          <div
            className="mt-2 h-4 w-32 rounded skeleton-shimmer"
            style={{ animationDelay: "0.05s" }}
          />
        </div>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 sm:px-6">
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
              <div
                className="h-6 w-24 rounded skeleton-shimmer mb-4"
                style={{ animationDelay: "0.1s" }}
              />
              <div className="grid grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-48 rounded skeleton-shimmer"
                    style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
              <div
                className="h-6 w-20 rounded skeleton-shimmer mb-4"
                style={{ animationDelay: "0.15s" }}
              />
              <div className="space-y-3">
                <div
                  className="h-4 w-full rounded skeleton-shimmer"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="h-4 w-full rounded skeleton-shimmer"
                  style={{ animationDelay: "0.25s" }}
                />
                <div
                  className="h-4 w-2/3 rounded skeleton-shimmer"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
            <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
              <div
                className="h-6 w-28 rounded skeleton-shimmer mb-4"
                style={{ animationDelay: "0.2s" }}
              />
              <div className="h-16 rounded skeleton-shimmer" style={{ animationDelay: "0.25s" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="text-center py-12">
        <p className="text-text-sub">{formatMessage({ id: "app.actions.notFound" })}</p>
        <Link to="/actions" className="text-primary-base hover:underline mt-2 inline-block">
          {formatMessage({ id: "app.actions.backToActions" })}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={action.title}
        description={formatMessage({ id: "app.actions.detail.description" }, { id })}
        actions={
          canManageActions ? (
            <Link
              to={`/actions/${id}/edit`}
              className="inline-flex items-center rounded-md border border-stroke-soft px-4 py-2 text-sm font-medium text-text-strong hover:bg-bg-soft"
            >
              <RiEditLine className="mr-2 h-4 w-4" />
              {formatMessage({ id: "app.actions.edit" })}
            </Link>
          ) : undefined
        }
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Media Gallery */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">
              {formatMessage({ id: "app.actions.detail.media" })}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {action.media.length === 0 ? (
                <div className="col-span-2">
                  <ActionDetailMediaTile
                    unavailableLabel={imageUnavailableLabel}
                    unavailableDescription={imageUnavailableDescription}
                    alt={imageUnavailableLabel}
                  />
                </div>
              ) : (
                action.media.map((url, i) => (
                  <ActionDetailMediaTile
                    key={i}
                    src={url}
                    alt={formatMessage({ id: "app.actions.detail.mediaAlt" }, { index: i + 1 })}
                    unavailableLabel={imageUnavailableLabel}
                    unavailableDescription={imageUnavailableDescription}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Details Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">
              {formatMessage({ id: "app.actions.detail.details" })}
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-text-soft">
                  {formatMessage({ id: "app.actions.detail.startTime" })}
                </dt>
                <dd className="text-sm font-medium text-text-strong">
                  {formatDateTime(action.startTime)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-text-soft">
                  {formatMessage({ id: "app.actions.detail.endTime" })}
                </dt>
                <dd className="text-sm font-medium text-text-strong">
                  {formatDateTime(action.endTime)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-text-soft">
                  {formatMessage({ id: "app.actions.detail.capitals" })}
                </dt>
                <dd className="text-sm font-medium text-text-strong">
                  {formatMessage(
                    { id: "app.actions.detail.capitalsForms" },
                    { count: action.capitals.length }
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">
              {formatMessage({ id: "app.actions.detail.descriptionTitle" })}
            </h3>
            <p className="text-text-sub">
              {action.description || formatMessage({ id: "app.actions.noDescription" })}
            </p>
          </div>

          {/* Form Configuration */}
          {action.inputs && action.inputs.length > 0 && (
            <div className="rounded-lg border border-stroke-soft bg-bg-white p-6">
              <h3 className="text-lg font-semibold mb-4">
                {formatMessage({ id: "app.actions.detail.formFields" })}
              </h3>
              <ul className="space-y-2">
                {action.inputs.map((input, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-text-strong">{input.title}</span>
                    <span className="text-text-soft ml-2">({input.type})</span>
                    {input.required && <span className="text-error-base ml-1">*</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

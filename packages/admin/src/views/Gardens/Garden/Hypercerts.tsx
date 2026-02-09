import { formatDate, type HypercertRecord } from "@green-goods/shared";
import { useGardens, useGardenPermissions, useHypercerts } from "@green-goods/shared/hooks";
import { RiAddLine, RiAwardLine, RiExternalLinkLine } from "@remixicon/react";
import { Link, useParams } from "react-router-dom";
import { useIntl } from "react-intl";
import { PageHeader } from "@/components/Layout/PageHeader";

const HYPERCERTS_APP_BASE_URL = "https://app.hypercerts.org/hypercerts";

function buildHypercertUrl(hypercertId: string) {
  return `${HYPERCERTS_APP_BASE_URL}/${hypercertId}`;
}

function renderTitle(record: HypercertRecord, fallback: string) {
  return record.title?.trim() || fallback;
}

export default function Hypercerts() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const { data: gardens = [] } = useGardens();
  const garden = gardens.find((item) => item.id === id);
  const permissions = useGardenPermissions();
  const canManage = garden ? permissions.canManageGarden(garden) : false;
  const { hypercerts, isLoading } = useHypercerts({ gardenId: id });

  if (!garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.hypercerts.list.title" })}
          description={formatMessage({ id: "app.hypercerts.list.notFound" })}
          backLink={{
            to: "/gardens",
            label: formatMessage({ id: "app.hypercerts.backToGardens" }),
          }}
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.hypercerts.list.title" })}
        description={formatMessage(
          { id: "app.hypercerts.list.description" },
          { gardenName: garden.name }
        )}
        backLink={{
          to: `/gardens/${garden.id}`,
          label: formatMessage({ id: "app.hypercerts.backToGarden" }),
        }}
        actions={
          canManage ? (
            <Link
              to={`/gardens/${garden.id}/hypercerts/create`}
              className="flex items-center gap-1.5 rounded-md bg-primary-base px-3 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary-darker"
            >
              <RiAddLine className="h-4 w-4" />
              {formatMessage({ id: "app.hypercerts.list.create" })}
            </Link>
          ) : null
        }
        sticky
      />

      <div className="mx-auto mt-6 max-w-5xl px-4 sm:px-6">
        {isLoading && (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-stroke-soft bg-bg-white p-4"
              >
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-5 w-48 rounded bg-bg-soft" />
                    <div className="h-3 w-32 rounded bg-bg-soft" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-24 rounded bg-bg-soft" />
                    <div className="h-8 w-28 rounded bg-bg-soft" />
                  </div>
                </div>
                <div className="mt-3 flex gap-4">
                  <div className="h-4 w-24 rounded bg-bg-soft" />
                  <div className="h-4 w-32 rounded bg-bg-soft" />
                  <div className="h-4 w-40 rounded bg-bg-soft" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && hypercerts.length === 0 && (
          <div className="rounded-xl border border-stroke-soft bg-bg-white p-8 text-center sm:p-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-lighter">
              <RiAwardLine className="h-8 w-8 text-primary-base" />
            </div>
            <h3 className="text-lg font-semibold text-text-strong">
              {formatMessage({ id: "app.hypercerts.list.empty.title" })}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-sub">
              {formatMessage({ id: "app.hypercerts.list.empty.description" })}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-text-soft">
              {formatMessage({ id: "app.hypercerts.list.empty.hint" })}
            </p>
            {canManage && (
              <Link
                to={`/gardens/${garden.id}/hypercerts/create`}
                className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-primary-base px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker"
              >
                <RiAddLine className="h-4 w-4" />
                {formatMessage({ id: "app.hypercerts.list.empty.cta" })}
              </Link>
            )}
          </div>
        )}

        {!isLoading && hypercerts.length > 0 && (
          <div className="grid gap-4">
            {hypercerts.map((record) => {
              const mintedDate = record.mintedAt
                ? formatDate(record.mintedAt * 1000, { dateStyle: "medium" })
                : formatMessage({ id: "app.hypercerts.list.dateUnknown" });
              return (
                <div
                  key={record.id}
                  className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-text-strong">
                        {renderTitle(
                          record,
                          formatMessage({ id: "app.hypercerts.list.fallbackTitle" })
                        )}
                      </h3>
                      <p className="text-xs text-text-sub">
                        {formatMessage(
                          { id: "app.hypercerts.list.mintedOn" },
                          { date: mintedDate }
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/gardens/${garden.id}/hypercerts/${record.id}`}
                        className="rounded-md border border-stroke-sub px-3 py-1.5 text-xs font-medium text-text-sub transition hover:bg-bg-weak"
                      >
                        {formatMessage({ id: "app.hypercerts.list.viewDetails" })}
                      </Link>
                      <a
                        href={buildHypercertUrl(record.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-stroke-sub px-3 py-1.5 text-xs font-medium text-text-sub transition hover:bg-bg-weak"
                      >
                        <RiExternalLinkLine className="h-3.5 w-3.5" />
                        {formatMessage({ id: "app.hypercerts.list.viewExternal" })}
                      </a>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-text-sub sm:grid-cols-3">
                    <div>
                      <span className="font-medium text-text-strong">
                        {formatMessage({ id: "app.hypercerts.list.attestations" })}:
                      </span>{" "}
                      {record.attestationCount}
                    </div>
                    <div>
                      <span className="font-medium text-text-strong">
                        {formatMessage({ id: "app.hypercerts.list.totalUnits" })}:
                      </span>{" "}
                      {record.totalUnits.toLocaleString()}
                    </div>
                    {record.workScopes?.length ? (
                      <div>
                        <span className="font-medium text-text-strong">
                          {formatMessage({ id: "app.hypercerts.list.workScopes" })}:
                        </span>{" "}
                        {record.workScopes.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

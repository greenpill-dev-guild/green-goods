import {
  DEFAULT_CHAIN_ID,
  formatDateRange,
  getEASExplorerUrl,
  useGardenAssessments,
} from "@green-goods/shared";
import { RiAddLine, RiExternalLinkLine, RiFileList3Line } from "@remixicon/react";
import { type ReactNode } from "react";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function GardenAssessment() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const {
    data: assessments = [],
    isLoading: fetching,
    error,
  } = useGardenAssessments(id, DEFAULT_CHAIN_ID);

  const headerActions = (
    <Link
      to={`/gardens/${id}/assessments/create`}
      className="inline-flex items-center rounded-md border border-transparent bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary-base focus:ring-offset-2"
    >
      <RiAddLine className="mr-2 h-4 w-4" />
      {formatMessage({ id: "app.garden.admin.newAssessment" })}
    </Link>
  );

  let content: ReactNode;

  if (fetching) {
    content = (
      <div className="rounded-lg border border-stroke-soft bg-bg-white p-12 text-center shadow-sm">
        <p className="text-sm text-text-soft">
          {formatMessage({ id: "app.garden.admin.loadingAssessments" })}
        </p>
      </div>
    );
  } else if (error) {
    content = (
      <div className="rounded-md border border-error-light bg-error-lighter p-4" role="alert">
        <p className="text-sm text-error-dark">
          {formatMessage({ id: "app.garden.admin.assessmentsFailed" })}:{" "}
          {error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" })}
        </p>
      </div>
    );
  } else {
    content = (
      <div className="rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
        {assessments.length === 0 ? (
          <div className="py-16 text-center">
            <RiFileList3Line className="mx-auto h-12 w-12 text-text-disabled" />
            <h3 className="mt-2 text-sm font-medium text-text-strong">
              {formatMessage({ id: "app.garden.admin.noAssessments" })}
            </h3>
            <p className="mt-1 text-sm text-text-soft">
              {formatMessage({ id: "app.garden.admin.noAssessmentsDescription" })}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="min-w-full divide-y divide-stroke-soft"
              aria-label={formatMessage({ id: "app.garden.admin.assessmentsTable" })}
            >
              <thead className="bg-bg-weak">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-soft"
                  >
                    {formatMessage({ id: "app.assessment.table.title" })}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-soft"
                  >
                    {formatMessage({ id: "app.assessment.table.type" })}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-soft"
                  >
                    {formatMessage({ id: "app.assessment.table.dateRange" })}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-soft"
                  >
                    {formatMessage({ id: "app.assessment.table.capitals" })}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-soft"
                  >
                    {formatMessage({ id: "app.assessment.table.tags" })}
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">{formatMessage({ id: "app.actions.view" })}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke-soft bg-bg-white">
                {assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {assessment.title || `Assessment ${assessment.id.slice(0, 6)}`}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {assessment.assessmentType || "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {formatDateRange(
                        assessment.startDate ?? assessment.reportingPeriod.start,
                        assessment.endDate ?? assessment.reportingPeriod.end
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {assessment.capitals?.length ? assessment.capitals.join(", ") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {assessment.tags?.length ? assessment.tags.join(", ") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <a
                        href={getEASExplorerUrl(DEFAULT_CHAIN_ID, assessment.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary-dark transition hover:text-primary-darker"
                      >
                        {formatMessage({ id: "app.actions.view" })}{" "}
                        <RiExternalLinkLine className="ml-1 h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.garden.admin.assessmentsTitle" })}
        description={formatMessage({ id: "app.garden.admin.assessmentsDescription" })}
        backLink={{
          to: `/gardens/${id}`,
          label: formatMessage({ id: "app.garden.admin.backToGarden" }),
        }}
        actions={headerActions}
      />
      <div className="mt-6 px-6">{content}</div>
    </div>
  );
}

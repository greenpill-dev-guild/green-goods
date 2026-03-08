import {
  DEFAULT_CHAIN_ID,
  formatDateRange,
  getEASExplorerUrl,
  logger,
  useAdminStore,
  useGardenAssessments,
} from "@green-goods/shared";
import { RiAddLine, RiExternalLinkLine, RiFileList3Line } from "@remixicon/react";
import { type ReactNode, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Alert } from "@/components/ui/Alert";

/** EAS decoded field structure from attestation JSON */
interface EASDecodedField {
  name: string;
  value: {
    value: unknown;
  };
}

export default function GardenAssessment() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((state) => state.selectedChainId);
  const setSelectedChainId = useAdminStore((state) => state.setSelectedChainId);

  useEffect(() => {
    if (selectedChainId !== DEFAULT_CHAIN_ID) {
      setSelectedChainId(DEFAULT_CHAIN_ID);
    }
  }, [selectedChainId, setSelectedChainId]);

  const {
    data: assessments = [],
    isLoading: fetching,
    error,
  } = useGardenAssessments(id, selectedChainId);

  const parsedAssessments = useMemo(
    () =>
      assessments.map((attestation) => ({
        ...attestation,
        parsed: parseAssessment(attestation.decodedDataJson),
      })),
    [assessments]
  );

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
      <Alert variant="error">
        {formatMessage({ id: "app.garden.admin.assessmentsFailed" })}:{" "}
        {error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" })}
      </Alert>
    );
  } else {
    content = (
      <div className="rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
        {parsedAssessments.length === 0 ? (
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
                {parsedAssessments.map((attestation) => (
                  <tr key={attestation.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {attestation.parsed?.title || `Assessment ${attestation.id.slice(0, 6)}`}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {attestation.parsed?.assessmentType || "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {formatDateRange(attestation.parsed?.startDate, attestation.parsed?.endDate)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {attestation.parsed?.capitals.length
                        ? attestation.parsed.capitals.join(", ")
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-strong">
                      {attestation.parsed?.tags.length ? attestation.parsed.tags.join(", ") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <a
                        href={getEASExplorerUrl(selectedChainId, attestation.id)}
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

function parseAssessment(decodedDataJson: string | null) {
  if (!decodedDataJson) {
    return null;
  }

  try {
    const fields: EASDecodedField[] = JSON.parse(decodedDataJson);
    const readValue = (name: string): unknown =>
      fields.find((field) => field.name === name)?.value?.value;

    const toNumber = (value: unknown): number | null => {
      if (value === undefined || value === null) return null;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        if (value.startsWith("0x")) {
          try {
            return Number(BigInt(value));
          } catch {
            return null;
          }
        }
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
      }
      if (typeof value === "object" && value !== null) {
        if ("hex" in value && typeof value.hex === "string") {
          try {
            return Number(BigInt(value.hex));
          } catch {
            return null;
          }
        }
        if ("value" in value) {
          return toNumber(value.value);
        }
      }
      return null;
    };

    return {
      title: readValue("title") ?? "",
      assessmentType: readValue("assessmentType") ?? "",
      capitals: (readValue("capitals") as string[]) ?? [],
      tags: (readValue("tags") as string[]) ?? [],
      startDate: toNumber(readValue("startDate")),
      endDate: toNumber(readValue("endDate")),
    };
  } catch (error) {
    logger.error("Failed to parse assessment attestation", { error });
    return null;
  }
}

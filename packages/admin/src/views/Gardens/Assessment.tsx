import { useGardenAssessments } from "@green-goods/shared/hooks/garden";
import { useAdminStore } from "@green-goods/shared/stores";
import { RiExternalLinkLine, RiFileList3Line } from "@remixicon/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CreateAssessmentModal } from "@/components/Garden/CreateAssessmentModal";
import { PageHeader } from "@/components/Layout/PageHeader";
import { DEFAULT_CHAIN_ID } from "../../config";

const EAS_EXPLORER_URL = "https://explorer.easscan.org";

export default function GardenAssessment() {
  const { id } = useParams<{ id: string }>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const selectedChainId = useAdminStore((state) => state.selectedChainId);
  const setSelectedChainId = useAdminStore((state) => state.setSelectedChainId);

  useEffect(() => {
    if (selectedChainId !== DEFAULT_CHAIN_ID) {
      setSelectedChainId(DEFAULT_CHAIN_ID);
    }
  }, [selectedChainId, setSelectedChainId]);

  const { data: assessments = [], isLoading: fetching, error } = useGardenAssessments(id);

  const parsedAssessments = useMemo(
    () =>
      assessments.map((attestation) => ({
        ...attestation,
        parsed: parseAssessment(attestation.decodedDataJson),
      })),
    [assessments]
  );

  const headerActions = (
    <button
      onClick={() => setIsCreateModalOpen(true)}
      className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
    >
      Create Assessment
    </button>
  );

  let content: ReactNode;

  if (fetching) {
    content = (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading assessments...</p>
      </div>
    );
  } else if (error) {
    content = (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-400/40 dark:bg-red-500/10">
        <p className="text-sm text-red-800 dark:text-red-200">
          Error loading assessments: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  } else {
    content = (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {parsedAssessments.length === 0 ? (
          <div className="py-16 text-center">
            <RiFileList3Line className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              No assessments found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This garden does not have any assessments yet.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Assessment Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date Range
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Capitals
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tags
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {parsedAssessments.map((attestation) => (
                <tr key={attestation.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {attestation.parsed?.title || `Assessment ${attestation.id.slice(0, 6)}`}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {attestation.parsed?.assessmentType || "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {formatDateRange(attestation.parsed?.startDate, attestation.parsed?.endDate)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {attestation.parsed?.capitals.length
                      ? attestation.parsed.capitals.join(", ")
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {attestation.parsed?.tags.length ? attestation.parsed.tags.join(", ") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <a
                      href={`${EAS_EXPLORER_URL}/attestation/view/${attestation.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-green-600 transition hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                    >
                      View <RiExternalLinkLine className="ml-1 h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Garden Assessments"
        description="Viewing all assessments for this garden."
        backLink={{ to: `/gardens/${id}`, label: "Back to garden" }}
        actions={headerActions}
      />
      <div className="mt-6 px-6">{content}</div>
      <CreateAssessmentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        gardenId={id!}
      />
    </div>
  );
}

function parseAssessment(decodedDataJson: string | null) {
  if (!decodedDataJson) {
    return null;
  }

  try {
    const fields = JSON.parse(decodedDataJson);
    const readValue = (name: string) =>
      fields.find((field: any) => field.name === name)?.value?.value;

    const toNumber = (value: any): number | null => {
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
    console.error("Failed to parse assessment attestation", error);
    return null;
  }
}

function formatDateRange(start?: number | null, end?: number | null) {
  if (!start && !end) return "—";

  const format = (value?: number | null) => {
    if (!value) return undefined;
    const dateInMs = value > 10_000_000_000 ? value * 1000 : value;
    return new Date(dateInMs).toLocaleDateString();
  };

  const startDateLabel = format(start);
  const endDateLabel = format(end);

  if (startDateLabel && endDateLabel) {
    return `${startDateLabel} – ${endDateLabel}`;
  }
  return startDateLabel ?? endDateLabel ?? "—";
}

import {
  ActionBannerFallback,
  DEFAULT_CHAIN_ID,
  Domain,
  formatDateRange,
  getEASExplorerUrl,
  logger,
  useAdminStore,
  useGardenAssessments,
} from "@green-goods/shared";
import {
  RiAddLine,
  RiCalendarLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiPriceTag3Line,
} from "@remixicon/react";
import { type ReactNode, useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonGrid } from "@/components/ui/Skeleton";

/** EAS decoded field structure from attestation JSON */
interface EASDecodedField {
  name: string;
  value: {
    value: unknown;
  };
}

interface ParsedAssessment {
  title: unknown;
  assessmentType: unknown;
  capitals: string[];
  tags: string[];
  startDate: number | null;
  endDate: number | null;
}

const DOMAIN_BADGE_STYLES: Record<string, string> = {
  Solar: "bg-away-lighter text-away-dark",
  Agro: "bg-success-lighter text-success-dark",
  Edu: "bg-information-lighter text-information-dark",
  Waste: "bg-warning-lighter text-warning-dark",
};

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

  let content: ReactNode;

  if (fetching) {
    content = (
      <div role="status" aria-live="polite">
        <span className="sr-only">
          {formatMessage({ id: "app.garden.admin.loadingAssessments" })}
        </span>
        <SkeletonGrid count={3} columns={3} />
      </div>
    );
  } else if (error) {
    content = (
      <Alert variant="error">
        {formatMessage({ id: "app.garden.admin.assessmentsFailed" })}:{" "}
        {error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" })}
      </Alert>
    );
  } else if (parsedAssessments.length === 0) {
    content = (
      <EmptyState
        icon={<RiFileList3Line className="h-6 w-6" />}
        title={formatMessage({ id: "app.garden.admin.noAssessments" })}
        description={formatMessage({ id: "app.garden.admin.noAssessmentsDescription" })}
      />
    );
  } else {
    content = (
      <div className="stagger-children grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {parsedAssessments.map((attestation) => {
          const title =
            (attestation.parsed?.title as string) || `Assessment ${attestation.id.slice(0, 6)}`;
          const assessmentType = (attestation.parsed?.assessmentType as string) || "";
          const domainValue = guessDomainFromType(assessmentType);
          const badgeStyle = DOMAIN_BADGE_STYLES[assessmentType] ?? "bg-bg-soft text-text-sub";

          return (
            <a
              key={attestation.id}
              href={getEASExplorerUrl(selectedChainId, attestation.id)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="assessment-card"
              className="group overflow-hidden rounded-lg border border-stroke-soft bg-bg-white shadow-sm transition-shadow hover:shadow-md hover:border-primary-base"
            >
              {/* Domain-colored gradient header */}
              <div className="relative h-20 overflow-hidden">
                <ActionBannerFallback domain={domainValue} title={title} />
              </div>

              {/* Card content */}
              <div className="p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3
                    className="text-base font-medium text-text-strong group-hover:text-primary-dark line-clamp-2"
                    title={title}
                  >
                    {title}
                  </h3>
                  <RiExternalLinkLine className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled group-hover:text-primary-dark transition-colors" />
                </div>

                {/* Type badge */}
                {assessmentType && (
                  <span
                    className={`mb-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyle}`}
                  >
                    {assessmentType}
                  </span>
                )}

                {/* Date range */}
                {(attestation.parsed?.startDate || attestation.parsed?.endDate) && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-text-soft">
                    <RiCalendarLine className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {formatDateRange(attestation.parsed?.startDate, attestation.parsed?.endDate)}
                    </span>
                  </div>
                )}

                {/* Tags & Capitals */}
                {attestation.parsed?.capitals.length || attestation.parsed?.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {attestation.parsed?.capitals.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center rounded-full bg-bg-soft px-2 py-0.5 text-[11px] text-text-sub"
                      >
                        {c}
                      </span>
                    ))}
                    {attestation.parsed?.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-0.5 rounded-full bg-bg-soft px-2 py-0.5 text-[11px] text-text-sub"
                      >
                        <RiPriceTag3Line className="h-2.5 w-2.5" />
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </a>
          );
        })}
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
        actions={
          <Button size="sm" asChild>
            <Link to={`/gardens/${id}/assessments/create`}>
              <RiAddLine className="mr-1.5 h-4 w-4" />
              {formatMessage({ id: "app.garden.admin.newAssessment" })}
            </Link>
          </Button>
        }
      />
      <div className="mt-6 space-y-6 px-4 sm:px-6">{content}</div>
    </div>
  );
}

/** Map assessment type string to a Domain enum for gradient colors */
function guessDomainFromType(assessmentType: string): Domain {
  const lower = assessmentType.toLowerCase();
  if (lower.includes("solar")) return Domain.SOLAR;
  if (lower.includes("agro")) return Domain.AGRO;
  if (lower.includes("edu")) return Domain.EDU;
  if (lower.includes("waste")) return Domain.WASTE;
  return Domain.AGRO; // default
}

function parseAssessment(decodedDataJson: string | null): ParsedAssessment | null {
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

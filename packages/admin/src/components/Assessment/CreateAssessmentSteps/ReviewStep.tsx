import { useMemo } from "react";
import type { UseFormWatch } from "react-hook-form";
import { type CreateAssessmentForm, formatDateRange, ReviewRow } from "./shared";

interface ReviewStepProps {
  watch: UseFormWatch<CreateAssessmentForm>;
  evidenceFiles: File[];
}

export function ReviewStep({ watch, evidenceFiles }: ReviewStepProps) {
  const summaryValues = watch();

  const metricsSummary = useMemo(() => {
    if (!summaryValues?.metrics) return null;
    try {
      return JSON.parse(summaryValues.metrics);
    } catch {
      return null;
    }
  }, [summaryValues?.metrics]);

  return (
    <div className="space-y-3">
      <div className="space-y-4 text-sm text-text-sub">
        <ReviewRow label="Title" value={summaryValues?.title} />
        <ReviewRow label="Assessment type" value={summaryValues?.assessmentType} />
        <ReviewRow label="Description" value={summaryValues?.description} multiline />
        <ReviewRow
          label="Capitals"
          value={
            summaryValues?.capitals?.length ? summaryValues.capitals.join(", ") : "Not provided"
          }
        />
        <ReviewRow
          label="Date range"
          value={formatDateRange(summaryValues?.startDate, summaryValues?.endDate)}
        />
        <ReviewRow label="Location" value={summaryValues?.location || "Not provided"} />
        <ReviewRow
          label="Tags"
          value={summaryValues?.tags?.length ? summaryValues.tags.join(", ") : "Not provided"}
        />
        <div>
          <p className="text-xs font-semibold uppercase text-text-soft">Metrics</p>
          <div className="mt-2 rounded-lg border border-gray-100 bg-bg-weak p-3 text-xs text-text-sub/60">
            {metricsSummary ? (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-left text-text-sub">
                {JSON.stringify(metricsSummary, null, 2)}
              </pre>
            ) : (
              <span>No metrics provided</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-text-soft">Evidence media</p>
          <ul className="mt-2 space-y-1 text-xs text-text-sub">
            {evidenceFiles.length
              ? evidenceFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="">
                    {file.name}
                  </li>
                ))
              : "No files attached"}
          </ul>
        </div>
        <ReviewRow
          label="Report documents"
          value={
            summaryValues?.reportDocuments?.length
              ? summaryValues.reportDocuments.join(", ")
              : "No documents"
          }
        />
        <ReviewRow
          label="Impact attestations"
          value={
            summaryValues?.impactAttestations?.length
              ? summaryValues.impactAttestations.join(", ")
              : "No attestations"
          }
        />
      </div>
    </div>
  );
}

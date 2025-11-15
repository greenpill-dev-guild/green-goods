import type { DuplicateCheckResult } from "@green-goods/shared/modules";
import { cn } from "@green-goods/shared/utils";
import React, { useState } from "react";

interface DuplicateWorkWarningProps {
  workData: unknown;
  duplicateInfo: DuplicateCheckResult;
  onProceed: () => void;
  onCancel: () => void;
  onViewDuplicate?: (workId: string) => void;
}

export const DuplicateWorkWarning: React.FC<DuplicateWorkWarningProps> = ({
  workData,
  duplicateInfo,
  onProceed,
  onCancel,
  onViewDuplicate,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getConflictTypeInfo = (type: string) => {
    switch (type) {
      case "exact":
        return {
          icon: "🔄",
          color: "text-error-foreground bg-error-base/10",
          title: "Exact Duplicate Found",
          description: "This work appears to be identical to existing work",
          severity: "high" as const,
        };
      case "similar":
        return {
          icon: "⚠️",
          color: "text-warning-foreground bg-warning-base/10",
          title: "Similar Work Found",
          description: "This work is very similar to existing work",
          severity: "medium" as const,
        };
      default:
        return {
          icon: "❓",
          color: "text-info-foreground bg-info-base/10",
          title: "Potential Duplicate",
          description: "This work might be a duplicate",
          severity: "low" as const,
        };
    }
  };

  const info = getConflictTypeInfo(duplicateInfo.conflictType || "none");

  const formatSimilarity = (similarity?: number): string => {
    if (!similarity) return "Unknown";
    return `${Math.round(similarity * 100)}% similar`;
  };

  const formatWorkData = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  // Safely extract fields from unknown work data
  const getDisplayFields = (
    data: unknown
  ): { title?: string; gardenId?: string; type?: string } => {
    try {
      const anyData = data as any;
      const title = anyData?.title || anyData?.data?.title;
      const gardenId = anyData?.gardenId || anyData?.gardenAddress || anyData?.data?.gardenAddress;
      const type = anyData?.type || "work";
      return { title, gardenId, type };
    } catch {
      return {};
    }
  };

  const display = getDisplayFields(workData);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-neutral-border">
          <div className="flex items-start gap-4">
            <span className="text-3xl">{info.icon}</span>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-neutral-foreground">{info.title}</h2>
              <p className="text-neutral-foreground/70 mt-1">{info.description}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className={cn("p-4 rounded-lg", info.color)}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Duplicate Detection Result</span>
              <span className="text-sm opacity-75">
                {duplicateInfo.similarity && formatSimilarity(duplicateInfo.similarity)}
              </span>
            </div>

            <div className="text-sm space-y-1">
              <p>
                <strong>Current Work:</strong> {display.title || "Untitled"}
              </p>
              {duplicateInfo.existingWorkId && (
                <p>
                  <strong>Existing Work ID:</strong> {duplicateInfo.existingWorkId}
                </p>
              )}
              <p>
                <strong>Garden:</strong> {display.gardenId || "Unknown"}
              </p>
              <p>
                <strong>Type:</strong> {display.type || "work"}
              </p>
            </div>
          </div>

          {/* Recommendations */}
          <div className="space-y-3">
            <h3 className="font-semibold">What should you do?</h3>

            {info.severity === "high" && (
              <div className="p-3 bg-error-base/5 border border-error-border rounded-lg">
                <h4 className="font-medium text-error-foreground mb-2">
                  ⛔ Not Recommended to Proceed
                </h4>
                <ul className="text-sm text-error-foreground/80 space-y-1">
                  <li>• This appears to be an exact duplicate</li>
                  <li>• Submitting duplicates may waste gas fees</li>
                  <li>• Consider reviewing the existing work instead</li>
                </ul>
              </div>
            )}

            {info.severity === "medium" && (
              <div className="p-3 bg-warning-base/5 border border-warning-border rounded-lg">
                <h4 className="font-medium text-warning-foreground mb-2">⚠️ Proceed with Caution</h4>
                <ul className="text-sm text-warning-foreground/80 space-y-1">
                  <li>• This work is similar to existing work</li>
                  <li>• Verify this is intentionally different</li>
                  <li>• Consider if this adds unique value</li>
                </ul>
              </div>
            )}

            {info.severity === "low" && (
              <div className="p-3 bg-info-base/5 border border-info-border rounded-lg">
                <h4 className="font-medium text-info-foreground mb-2">
                  ℹ️ Minor Similarity Detected
                </h4>
                <ul className="text-sm text-info-foreground/80 space-y-1">
                  <li>• Some similarities found with existing work</li>
                  <li>• This is likely fine to proceed</li>
                  <li>• Review if concerned about overlap</li>
                </ul>
              </div>
            )}
          </div>

          {/* Work Details Toggle */}
          <div className="border border-neutral-border rounded-lg">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full p-3 text-left flex items-center justify-between hover:bg-neutral-base/5 transition-colors"
            >
              <span className="font-medium">Work Details</span>
              <span className="text-lg">{showDetails ? "▼" : "▶"}</span>
            </button>

            {showDetails && (
              <div className="p-3 border-t border-neutral-border">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-2">Your Work Data:</h4>
                    <pre className="text-xs bg-neutral-base/10 p-3 rounded overflow-auto max-h-40">
                      {formatWorkData(workData)}
                    </pre>
                  </div>

                  {duplicateInfo.existingWorkId && (
                    <div>
                      <h4 className="font-medium mb-2">Duplicate Information:</h4>
                      <div className="text-sm space-y-1">
                        <p>
                          <strong>Work ID:</strong> {duplicateInfo.existingWorkId}
                        </p>
                        <p>
                          <strong>Similarity:</strong> {formatSimilarity(duplicateInfo.similarity)}
                        </p>
                        <p>
                          <strong>Conflict Type:</strong> {duplicateInfo.conflictType || "unknown"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-neutral-border bg-neutral-base/5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-foreground">
              {info.severity === "high" ? "⚠️ High risk of duplicate submission" : null}
              {info.severity === "medium" ? "⚠️ Moderate risk of duplicate submission" : null}
              {info.severity === "low" ? "ℹ️ Low risk of duplicate submission" : null}
            </div>

            <div className="flex items-center gap-3">
              {/* View Duplicate Button */}
              {duplicateInfo.existingWorkId && onViewDuplicate && (
                <button
                  onClick={() => onViewDuplicate(duplicateInfo.existingWorkId!)}
                  className="px-4 py-2 text-sm border border-neutral-border rounded-lg hover:bg-neutral-base/5 transition-colors"
                  data-testid="view-duplicate-button"
                >
                  👁️ View Existing
                </button>
              )}

              {/* Cancel Button */}
              <button
                onClick={onCancel}
                className={cn(
                  "px-4 py-2 text-sm rounded-lg transition-colors",
                  info.severity === "high"
                    ? "bg-success-base text-success-foreground hover:bg-success-base/90"
                    : "border border-neutral-border hover:bg-neutral-base/5"
                )}
                data-testid="cancel-duplicate-button"
              >
                {info.severity === "high" ? "✓ Cancel (Recommended)" : "Cancel"}
              </button>

              {/* Proceed Button */}
              <button
                onClick={onProceed}
                className={cn(
                  "px-4 py-2 text-sm rounded-lg transition-colors",
                  info.severity === "high"
                    ? "bg-error-base text-error-foreground hover:bg-error-base/90"
                    : info.severity === "medium"
                      ? "bg-warning-base text-warning-foreground hover:bg-warning-base/90"
                      : "bg-primary-base text-primary-foreground hover:bg-primary-base/90"
                )}
                data-testid="proceed-duplicate-button"
              >
                {info.severity === "high" && "⚠️ Submit Anyway"}
                {info.severity === "medium" && "⚠️ Proceed with Caution"}
                {info.severity === "low" && "✓ Proceed"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

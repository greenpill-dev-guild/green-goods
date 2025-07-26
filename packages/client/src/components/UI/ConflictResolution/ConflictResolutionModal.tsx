import React, { useState } from "react";
import type {
  ConflictResolutionModalProps,
  ConflictType,
  WorkConflict,
} from "../../../types/offline";
import { cn } from "../../../utils/cn";

interface ResolutionOption {
  id: "keep_local" | "keep_remote" | "merge" | "manual";
  label: string;
  description: string;
  icon: string;
  recommended?: boolean;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflict,
  isOpen,
  onClose,
  onResolve,
}) => {
  const [selectedResolution, setSelectedResolution] = useState<string>("");
  const [manualData, setManualData] = useState<string>("");
  const [isResolving, setIsResolving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  const getConflictTypeInfo = (type: string) => {
    switch (type) {
      case "already_submitted":
        return {
          icon: "🔄",
          color: "text-warning-foreground bg-warning-base/10",
          description: "This work has already been submitted to the blockchain",
        };
      case "schema_mismatch":
        return {
          icon: "📋",
          color: "text-error-foreground bg-error-base/10",
          description: "The work schema has changed since this was created",
        };
      case "garden_mismatch":
        return {
          icon: "🌱",
          color: "text-error-foreground bg-error-base/10",
          description: "The garden configuration has changed",
        };
      case "data_conflict":
        return {
          icon: "⚡",
          color: "text-info-foreground bg-info-base/10",
          description: "There are conflicting data changes",
        };
      default:
        return {
          icon: "❓",
          color: "text-neutral-foreground bg-neutral-base/10",
          description: "Unknown conflict type",
        };
    }
  };

  const resolutionOptions: ResolutionOption[] = [
    {
      id: "keep_local",
      label: "Keep Local Version",
      description: "Use your offline version and overwrite any remote changes",
      icon: "📱",
      recommended: conflict.conflicts.some(
        (c: ConflictType) => c.type === "schema_mismatch" && c.autoResolvable
      ),
    },
    {
      id: "keep_remote",
      label: "Use Remote Version",
      description: "Discard your changes and use the version from the server",
      icon: "☁️",
      recommended: conflict.conflicts.some((c: ConflictType) => c.type === "already_submitted"),
    },
    {
      id: "merge",
      label: "Smart Merge",
      description: "Automatically combine both versions using intelligent merging",
      icon: "🔀",
      recommended: conflict.conflicts.some(
        (c: ConflictType) => c.autoResolvable && c.type === "data_conflict"
      ),
    },
    {
      id: "manual",
      label: "Manual Resolution",
      description: "Create a custom solution by editing the data manually",
      icon: "✏️",
    },
  ];

  const handleResolve = async () => {
    if (!selectedResolution) return;

    setIsResolving(true);
    try {
      const resolutionData =
        selectedResolution === "manual" ? JSON.parse(manualData || "{}") : undefined;
      await onResolve(conflict.workId, selectedResolution, resolutionData);
      onClose();
    } catch (error) {
      // Error handled by showing error message
      // You might want to show an error message here
    } finally {
      setIsResolving(false);
    }
  };

  const formatJsonData = (data: any): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const getDiffPreview = () => {
    if (!conflict.remoteData) return null;

    const localKeys = Object.keys(conflict.localData || {});
    const remoteKeys = Object.keys(conflict.remoteData || {});
    const allKeys = [...new Set([...localKeys, ...remoteKeys])];

    return allKeys.map((key) => {
      const localValue = conflict.localData?.[key];
      const remoteValue = conflict.remoteData?.[key];
      const isDifferent = JSON.stringify(localValue) !== JSON.stringify(remoteValue);

      return (
        <div
          key={key}
          className={cn(
            "flex items-start gap-4 p-2 rounded text-xs",
            isDifferent ? "bg-warning-base/5" : "bg-neutral-base/5"
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium text-neutral-foreground mb-1">{key}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-neutral-foreground/70 mb-1">Local:</div>
                <div
                  className={cn(
                    "p-2 rounded font-mono",
                    isDifferent ? "bg-info-base/10 text-info-foreground" : "bg-neutral-base/10"
                  )}
                >
                  {String(localValue || "undefined")}
                </div>
              </div>
              <div>
                <div className="text-neutral-foreground/70 mb-1">Remote:</div>
                <div
                  className={cn(
                    "p-2 rounded font-mono",
                    isDifferent
                      ? "bg-warning-base/10 text-warning-foreground"
                      : "bg-neutral-base/10"
                  )}
                >
                  {String(remoteValue || "undefined")}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-border">
          <div>
            <h2 className="text-xl font-bold">Resolve Sync Conflict</h2>
            <p className="text-sm text-neutral-foreground">Work ID: {conflict.workId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-base/10 rounded-full transition-colors"
            data-testid="conflict-modal-close"
          >
            <span className="text-lg">✕</span>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[70vh]">
          {/* Conflict Summary */}
          <div className="p-6 border-b border-neutral-border">
            <h3 className="font-semibold mb-3">Conflict Details</h3>
            <div className="space-y-2">
              {conflict.conflicts.map((c: ConflictType, index: number) => {
                const info = getConflictTypeInfo(c.type);
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-neutral-base/5"
                  >
                    <span className="text-lg">{info.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("px-2 py-1 rounded text-xs font-medium", info.color)}>
                          {c.type.replace("_", " ").toUpperCase()}
                        </span>
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-xs",
                            c.severity === "high"
                              ? "bg-error-base/10 text-error-foreground"
                              : c.severity === "medium"
                                ? "bg-warning-base/10 text-warning-foreground"
                                : "bg-info-base/10 text-info-foreground"
                          )}
                        >
                          {c.severity} severity
                        </span>
                        {c.autoResolvable && (
                          <span className="px-2 py-1 rounded text-xs bg-success-base/10 text-success-foreground">
                            Auto-resolvable
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-foreground">{info.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resolution Options */}
          <div className="p-6 border-b border-neutral-border">
            <h3 className="font-semibold mb-3">Choose Resolution Strategy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resolutionOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedResolution(option.id)}
                  className={cn(
                    "p-4 border rounded-lg text-left transition-all",
                    selectedResolution === option.id
                      ? "border-primary-base bg-primary-base/10"
                      : "border-neutral-border hover:border-neutral-border-hover hover:bg-neutral-base/5",
                    option.recommended && "ring-2 ring-success-base/20"
                  )}
                  data-testid={`resolution-${option.id}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{option.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{option.label}</h4>
                        {option.recommended && (
                          <span className="px-2 py-0.5 text-xs bg-success-base/10 text-success-foreground rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-foreground">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Resolution Editor */}
          {selectedResolution === "manual" && (
            <div className="p-6 border-b border-neutral-border">
              <h3 className="font-semibold mb-3">Manual Data Editor</h3>
              <div className="space-y-3">
                <p className="text-sm text-neutral-foreground">
                  Edit the JSON data below to create your custom resolution:
                </p>
                <textarea
                  value={manualData || formatJsonData(conflict.localData)}
                  onChange={(e) => setManualData(e.target.value)}
                  className="w-full h-40 p-3 border border-neutral-border rounded-lg font-mono text-sm"
                  placeholder="Enter your custom resolution data as JSON..."
                  data-testid="manual-data-editor"
                />
              </div>
            </div>
          )}

          {/* Data Comparison */}
          {showAdvanced && conflict.remoteData && (
            <div className="p-6 border-b border-neutral-border">
              <h3 className="font-semibold mb-3">Data Comparison</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">{getDiffPreview()}</div>
            </div>
          )}

          {/* Advanced Options Toggle */}
          {conflict.remoteData && (
            <div className="px-6 py-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-primary-foreground hover:text-primary-foreground/80 transition-colors"
              >
                {showAdvanced ? "▼ Hide" : "▶ Show"} Advanced Data Comparison
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-neutral-border bg-neutral-base/5">
          <div className="text-sm text-neutral-foreground">
            {selectedResolution
              ? `Selected: ${resolutionOptions.find((o) => o.id === selectedResolution)?.label}`
              : "Choose a resolution strategy"}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-neutral-border rounded-lg hover:bg-neutral-base/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={!selectedResolution || isResolving}
              className={cn(
                "px-4 py-2 text-sm rounded-lg transition-colors",
                selectedResolution && !isResolving
                  ? "bg-primary-base text-primary-foreground hover:bg-primary-base/90"
                  : "bg-neutral-base/20 text-neutral-foreground/50 cursor-not-allowed"
              )}
              data-testid="resolve-conflict-button"
            >
              {isResolving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Resolving...
                </span>
              ) : (
                "Resolve Conflict"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

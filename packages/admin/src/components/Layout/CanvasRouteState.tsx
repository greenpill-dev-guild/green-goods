import { Alert, cn } from "@green-goods/shared";
import { CanvasWorkspaceSelectionState } from "./CanvasWorkspaceSelectionState";

export interface CanvasWorkspaceOption {
  id: string;
  name: string;
  location?: string;
}

interface CanvasWorkspaceSelectionGateProps {
  workspaceLabel: string;
  gardens: CanvasWorkspaceOption[];
  onSelectGarden: (garden: CanvasWorkspaceOption) => void;
}

interface CanvasRouteErrorStateProps {
  message: string;
  variant?: "error" | "warning" | "info" | "success";
  /** Match the hosting route's content width (e.g. "max-w-6xl") so the alert
   * aligns with the header above it instead of stretching full-bleed. */
  maxWidthClassName?: string;
}

export function CanvasWorkspaceSelectionGate({
  workspaceLabel,
  gardens,
  onSelectGarden,
}: CanvasWorkspaceSelectionGateProps) {
  return (
    <CanvasWorkspaceSelectionState
      workspaceLabel={workspaceLabel}
      gardens={gardens}
      onSelectGarden={onSelectGarden}
    />
  );
}

export function CanvasWorkspaceLoadingState() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" role="status" aria-live="polite">
      <div className="h-36 rounded-lg skeleton-shimmer" />
      <div className="h-36 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
      <div
        className="h-64 rounded-lg skeleton-shimmer sm:col-span-2"
        style={{ animationDelay: "0.1s" }}
      />
    </div>
  );
}

export function CanvasRouteErrorState({
  message,
  variant = "error",
  maxWidthClassName,
}: CanvasRouteErrorStateProps) {
  return (
    <div className={cn("mt-6", maxWidthClassName && `mx-auto w-full ${maxWidthClassName}`)}>
      <Alert variant={variant}>{message}</Alert>
    </div>
  );
}

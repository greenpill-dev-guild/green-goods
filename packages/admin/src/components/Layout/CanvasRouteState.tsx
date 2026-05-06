import { Alert } from "@green-goods/shared";
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

export function CanvasRouteErrorState({ message, variant = "error" }: CanvasRouteErrorStateProps) {
  return (
    <div className="mt-6">
      <Alert variant={variant}>{message}</Alert>
    </div>
  );
}

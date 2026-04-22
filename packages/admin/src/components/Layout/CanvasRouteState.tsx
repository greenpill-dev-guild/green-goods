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

interface CanvasWorkspaceLoadingStateProps {
  maxWidthClassName?: string;
}

interface CanvasRouteErrorStateProps {
  message: string;
  variant?: "error" | "warning" | "info" | "success";
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

export function CanvasWorkspaceLoadingState({
  maxWidthClassName = "max-w-[1400px]",
}: CanvasWorkspaceLoadingStateProps) {
  return (
    <div className="mt-6 px-4 sm:px-6">
      <div className={`mx-auto w-full ${maxWidthClassName}`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="status" aria-live="polite">
          <div className="h-36 rounded-lg skeleton-shimmer" />
          <div className="h-36 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
          <div
            className="h-64 rounded-lg skeleton-shimmer sm:col-span-2"
            style={{ animationDelay: "0.1s" }}
          />
        </div>
      </div>
    </div>
  );
}

export function CanvasRouteErrorState({
  message,
  variant = "error",
  maxWidthClassName = "max-w-[1400px]",
}: CanvasRouteErrorStateProps) {
  return (
    <div className="mt-6 px-4 sm:px-6">
      <div className={`mx-auto w-full ${maxWidthClassName}`}>
        <Alert variant={variant}>{message}</Alert>
      </div>
    </div>
  );
}

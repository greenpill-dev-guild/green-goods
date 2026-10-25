import { EmptyState, type EmptyStateTone } from "@green-goods/shared/components/ListPrimitives";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine, RiErrorWarningLine, RiInformationLine } from "@remixicon/react";
import type { ReactNode } from "react";
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
  /** Match the hosting route's content width (e.g. "max-w-6xl") so the state
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

const ROUTE_STATE_TONE: Record<
  NonNullable<CanvasRouteErrorStateProps["variant"]>,
  { tone: EmptyStateTone; icon: ReactNode }
> = {
  error: { tone: "error", icon: <RiErrorWarningLine /> },
  warning: { tone: "warning", icon: <RiErrorWarningLine /> },
  info: { tone: "neutral", icon: <RiInformationLine /> },
  success: { tone: "neutral", icon: <RiCheckLine /> },
};

/** A route whose workspace could not open, as the state block in the route's content width. */
export function CanvasRouteErrorState({
  message,
  variant = "error",
  maxWidthClassName,
}: CanvasRouteErrorStateProps) {
  const { tone, icon } = ROUTE_STATE_TONE[variant];
  return (
    <div
      className={cn("mt-6", maxWidthClassName && `mx-auto w-full ${maxWidthClassName}`)}
      // A failure announces itself; any other state is read out politely, as the alert box was.
      role={tone === "error" ? undefined : "status"}
    >
      <EmptyState tone={tone} icon={icon} title={message} />
    </div>
  );
}

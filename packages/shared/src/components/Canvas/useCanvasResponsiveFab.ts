import { type ComponentType, useMemo } from "react";
import { useIntl } from "react-intl";
import { useFabConfig } from "./FabContext";
import type { FabConfig } from "./NavigationBar";

export interface CanvasMobilePrimaryAction {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

export interface UseCanvasResponsiveFabOptions {
  fab: FabConfig | null;
  isDesktop: boolean;
  blocked?: boolean;
  allowMobilePrimaryAction?: boolean;
}

export function useCanvasResponsiveFab({
  fab,
  isDesktop,
  blocked = false,
  allowMobilePrimaryAction = true,
}: UseCanvasResponsiveFabOptions): CanvasMobilePrimaryAction | null {
  const { formatMessage } = useIntl();
  useFabConfig(isDesktop && !blocked ? fab : null);

  return useMemo(() => {
    if (isDesktop || blocked || !allowMobilePrimaryAction || !fab) return null;

    const primaryAction = fab.actions[0];
    if (!primaryAction) return null;

    return {
      icon: primaryAction.icon,
      label: formatMessage({
        id: primaryAction.labelId,
        defaultMessage: primaryAction.label,
      }),
      onClick: () => fab.onAction(primaryAction.id),
    };
  }, [allowMobilePrimaryAction, blocked, fab, formatMessage, isDesktop]);
}

import { adminRoutes, useAdminGardenContext, useGardenDetailData } from "@green-goods/shared";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Manage Members is a route-driven action flow — same pattern as the Hub
 * create flows (useAdminGardenContext resolves the garden from the URL, not
 * a possibly-stale Zustand selection). `useGardenDetailData` already does its
 * own id-based garden resolution plus `canManage`/`roleMembers`, so this
 * controller is a thin wrapper: resolve garden context, decide where "close"
 * goes.
 */
export function useManageMembersController() {
  const navigate = useNavigate();
  const { activeGardenId } = useAdminGardenContext();
  const { garden, canManage, roleMembers } = useGardenDetailData(activeGardenId ?? undefined);
  const gardenRouteContext = useMemo(() => ({ gardenId: garden?.id }), [garden?.id]);

  const handleCancel = () => {
    navigate(adminRoutes.gardenOverview(gardenRouteContext));
  };

  return {
    garden,
    canManage,
    roleMembers,
    handleCancel,
  };
}

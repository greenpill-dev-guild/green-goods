import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { type LeftSheetConfig, useLeftSheetConfig } from "@/components/Layout";
import HypercertDetail from "@/views/Garden/HypercertDetail";

interface GardenSheetDescriptorProps {
  hypercertId: string | undefined;
  closeTo: string;
}

/**
 * Declares the Garden workspace's left sheet: hypercert detail, route-backed
 * (deep-linkable) — close navigates to `closeTo`. Membership flows no longer
 * live here; Manage Members / Add Members are community-owned dialogs at
 * /community/members.
 */
export function GardenSheetDescriptor({ hypercertId, closeTo }: GardenSheetDescriptorProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  const config = useMemo<LeftSheetConfig | null>(() => {
    if (hypercertId) {
      return {
        title: formatMessage({ id: "app.hypercerts.detail.title", defaultMessage: "Hypercert" }),
        content: <HypercertDetail layout="sheet" hypercertId={hypercertId} />,
        onClose: () => navigate(closeTo),
        size: "lg",
        tone: "garden",
      };
    }

    return null;
  }, [closeTo, formatMessage, hypercertId, navigate]);

  useLeftSheetConfig(config);

  return null;
}

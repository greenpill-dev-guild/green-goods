import { useLeftSheetConfig, type LeftSheetConfig } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import HypercertDetail from "@/views/Garden/HypercertDetail";

interface GardenSheetDescriptorProps {
  hypercertId: string | undefined;
  onCloseHypercertSheet: () => void;
}

export function GardenSheetDescriptor({
  hypercertId,
  onCloseHypercertSheet,
}: GardenSheetDescriptorProps) {
  const { formatMessage } = useIntl();

  const gardenLeftSheetConfig = useMemo<LeftSheetConfig | null>(
    () =>
      hypercertId
        ? {
            title: formatMessage({
              id: "app.hypercerts.detail.title",
              defaultMessage: "Hypercert",
            }),
            content: <HypercertDetail layout="sheet" hypercertId={hypercertId} />,
            onClose: onCloseHypercertSheet,
          }
        : null,
    [formatMessage, hypercertId, onCloseHypercertSheet]
  );

  useLeftSheetConfig(gardenLeftSheetConfig);

  return null;
}

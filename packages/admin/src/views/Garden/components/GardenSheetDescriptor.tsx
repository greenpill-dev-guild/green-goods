import { useRouteBackedLeftSheetConfig } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import HypercertDetail from "@/views/Garden/HypercertDetail";

interface GardenSheetDescriptorProps {
  hypercertId: string | undefined;
  closeTo: string;
}

export function GardenSheetDescriptor({ hypercertId, closeTo }: GardenSheetDescriptorProps) {
  const { formatMessage } = useIntl();

  const gardenLeftSheetConfig = useMemo(
    () =>
      hypercertId
        ? {
            title: formatMessage({
              id: "app.hypercerts.detail.title",
              defaultMessage: "Hypercert",
            }),
            content: <HypercertDetail layout="sheet" hypercertId={hypercertId} />,
            closeTo,
          }
        : null,
    [closeTo, formatMessage, hypercertId]
  );

  useRouteBackedLeftSheetConfig(gardenLeftSheetConfig);

  return null;
}

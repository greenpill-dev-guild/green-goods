import { toastService, useAdminStore, useGardens } from "@green-goods/shared";
import { useEffect } from "react";
import { useIntl } from "react-intl";
import { Outlet } from "react-router-dom";

export function RequireSpecificGarden() {
  const intl = useIntl();
  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const setSelectedGarden = useAdminStore((s) => s.setSelectedGarden);
  const { data: gardens = [] } = useGardens();

  useEffect(() => {
    if (selectedGarden === null && gardens.length > 0) {
      setSelectedGarden(gardens[0]);
      toastService.info({
        message: intl.formatMessage({
          id: "cockpit.community.requiresGarden",
          defaultMessage: "Community requires a specific garden.",
        }),
      });
    }
  }, [selectedGarden, gardens, setSelectedGarden, intl]);

  return <Outlet />;
}

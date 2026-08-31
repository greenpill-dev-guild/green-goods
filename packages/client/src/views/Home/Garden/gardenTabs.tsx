import { GardenTab } from "@green-goods/shared/hooks/garden/useGardenTabs";
import { RiFileChartFill, RiGroupFill, RiHammerFill, RiHandHeartLine } from "@remixicon/react";
import type { IntlShape } from "react-intl";

import type { StandardTab } from "@/components/Navigation";

/**
 * The garden's sections, in reading order.
 *
 * Pool is absent, not disabled, when the garden has no pool: a tab beside "no
 * pool here yet" invites a member to open something that does not exist.
 */
export function buildGardenTabs(intl: IntlShape, options: { hasPool: boolean }): StandardTab[] {
  return [
    {
      id: GardenTab.Work,
      label: intl.formatMessage({ id: "app.garden.work", defaultMessage: "Work" }),
      icon: <RiHammerFill className="w-4 h-4" />,
    },
    ...(options.hasPool
      ? [
          {
            id: GardenTab.Pool,
            label: intl.formatMessage({ id: "app.garden.pool", defaultMessage: "Pool" }),
            icon: <RiHandHeartLine className="w-4 h-4" />,
          },
        ]
      : []),
    {
      id: GardenTab.Insights,
      label: intl.formatMessage({ id: "app.garden.insights", defaultMessage: "Insights" }),
      icon: <RiFileChartFill className="w-4 h-4" />,
    },
    {
      id: GardenTab.Gardeners,
      label: intl.formatMessage({ id: "app.garden.gardeners", defaultMessage: "Gardeners" }),
      icon: <RiGroupFill className="w-4 h-4" />,
    },
  ];
}

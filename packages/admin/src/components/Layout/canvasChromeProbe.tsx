import { useFabConfigValue } from "@green-goods/shared/components/Canvas/FabContext";
import type {
  NavigationBarProps,
  ToolbarSlot,
} from "@green-goods/shared/components/Canvas/NavigationBar";
import { NavigationBar } from "@/components/Shell";
import { useCanvasChromeProbe } from "@green-goods/shared/hooks/admin-ui/useCanvasChromeProbe";
import { memo, useMemo } from "react";

const StableNavigationBar = memo(NavigationBar);
StableNavigationBar.displayName = "StableNavigationBar";

export const ProfiledNavigationBar = memo(function ProfiledNavigationBar(
  props: NavigationBarProps
) {
  const profileDetail = useMemo(
    () => ({
      activePath: props.activePath,
      slotIds: props.slots.map((slot) => slot.id),
      hasFab: Boolean(props.fab),
    }),
    [props.activePath, props.fab, props.slots]
  );
  useCanvasChromeProbe("NavigationBar", profileDetail);

  return <StableNavigationBar {...props} />;
});
ProfiledNavigationBar.displayName = "ProfiledNavigationBar";

/** Bridge: reads FAB config from FabContext and passes it to NavigationBar. */
export const FabAwareNavigationBar = memo(function FabAwareNavigationBar(props: {
  slots: ToolbarSlot[];
  activePath: string;
  onNavigate: (path: string) => void;
}) {
  const fabConfig = useFabConfigValue();
  useCanvasChromeProbe("FabAwareNavigationBar", {
    activePath: props.activePath,
    hasFab: Boolean(fabConfig),
    slotIds: props.slots.map((slot) => slot.id),
  });

  return <ProfiledNavigationBar {...props} fab={fabConfig} />;
});
FabAwareNavigationBar.displayName = "FabAwareNavigationBar";

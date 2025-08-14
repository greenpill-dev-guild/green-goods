import { useEffect, useMemo, useState } from "react";
import { useRouteLoaderData } from "react-router-dom";
import { getActions } from "@/modules/greengoods";

export function useGarden(_id: string) {
  // Prefer data from the route loader with id "garden" if available
  const routeData = useRouteLoaderData("garden") as { garden?: Garden } | null;
  const garden = useMemo(() => {
    if (routeData?.garden) return routeData.garden;
    return undefined;
  }, [routeData]);
  return { garden } as { garden: Garden | undefined };
}

export function useGardens() {
  const homeData = useRouteLoaderData("home") as { actions?: Promise<Action[]> } | null;
  const [actions, setActions] = useState<Action[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (homeData?.actions) {
          const vals = await homeData.actions;
          if (!cancelled) setActions(vals);
          return;
        }
        const vals = await getActions();
        if (!cancelled) setActions(vals);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [homeData?.actions]);
  return { actions } as { actions: Action[] };
}

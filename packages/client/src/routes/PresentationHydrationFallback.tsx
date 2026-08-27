import { HydrationFallback } from "@green-goods/shared/components/HydrationFallback";
import { getClientRoutePresentationMode } from "./presentationMode";

/**
 * The static HTML owns website startup so React does not replace the
 * editorial skeleton with an app-style spinner while lazy routes resolve.
 */
export function PresentationHydrationFallback() {
  if (getClientRoutePresentationMode() === "website") return null;

  return <HydrationFallback appName="Green Goods" message="Green Goods is loading." />;
}

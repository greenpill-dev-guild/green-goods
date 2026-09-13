import { useOfflineContentPreparation } from "@green-goods/shared/hooks/offline/useOfflineContent";

/** Background preparation loads after the app shell is available. */
export default function OfflineContentPreparation() {
  useOfflineContentPreparation();
  return null;
}

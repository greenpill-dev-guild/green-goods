import { useAnalyticsIdentity } from "@green-goods/shared/hooks/analytics/useAnalyticsIdentity";
import { useWalletReconnectPrompt } from "@green-goods/shared/hooks/auth/useAuth";
import { useApp } from "@green-goods/shared/providers/App";

export function WalletRuntimeEffects({ analyticsIdentity }: { analyticsIdentity: boolean }) {
  useWalletReconnectPrompt();
  return analyticsIdentity ? <WalletAnalyticsIdentity /> : null;
}

function WalletAnalyticsIdentity() {
  const { locale, isPwaPresentation } = useApp();
  useAnalyticsIdentity({ app: "client", isPwa: isPwaPresentation, locale });
  return null;
}

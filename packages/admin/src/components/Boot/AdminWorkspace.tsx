import { AppProvider } from "@green-goods/shared/providers/App";
import { useEffect } from "react";
import App from "@/App.tsx";
import "@/styles/admin-workspace.css";

/** The workspace loads independently without replacing the wallet or auth providers. */
export default function AdminWorkspace({ onReady }: { onReady?: () => void }) {
  useEffect(() => onReady?.(), [onReady]);
  return (
    <AppProvider
      posthogKey={import.meta.env.VITE_POSTHOG_ADMIN_KEY}
      allowPosthogKeyFallback={false}
    >
      <App />
    </AppProvider>
  );
}

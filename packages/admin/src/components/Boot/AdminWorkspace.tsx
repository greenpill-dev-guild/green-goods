import { AdminUploadPolicyProvider } from "@green-goods/shared/components/Dialog/WorkUploadConsentDialog";
import { AppProvider } from "@green-goods/shared/providers/App";
import { useEffect } from "react";
import App from "@/App.tsx";
import { AdminUploadConsentDialog } from "../AdminUploadConsentDialog";
import "@/styles/admin-workspace.css";

/** The workspace loads independently without replacing the wallet or auth providers. */
export default function AdminWorkspace({ onReady }: { onReady?: () => void }) {
  useEffect(() => onReady?.(), [onReady]);
  return (
    <AppProvider
      posthogKey={import.meta.env.VITE_POSTHOG_ADMIN_KEY}
      allowPosthogKeyFallback={false}
    >
      <AdminUploadPolicyProvider
        renderPrompt={(prompt) => <AdminUploadConsentDialog prompt={prompt} kind="admin-file" />}
      >
        <App />
      </AdminUploadPolicyProvider>
    </AppProvider>
  );
}

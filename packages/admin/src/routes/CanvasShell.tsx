import { useAdminAccessState } from "@green-goods/shared/hooks/admin-ui/useAdminAccessState";
import { ensureBaseLists } from "@green-goods/shared/hooks/blockchain/prefetch";
import { useCommitmentCompletionRefresh } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentCompletionRefresh";
import { useEffect } from "react";
import { ScrollRestoration } from "react-router-dom";
import { AdminAccessStateRenderer } from "@/components/Layout/AdminAccessStateRenderer";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";

export default function CanvasShell() {
  const accessState = useAdminAccessState();

  useEffect(() => {
    ensureBaseLists();
  }, []);

  // The admin mounts no queue provider, so the shell carries the refresh that
  // follows a sent commitment act: it outlives the dialog the act was sent from.
  useCommitmentCompletionRefresh();

  return (
    <AdminAccessStateRenderer
      state={accessState}
      ready={
        <>
          <CanvasLayout />
          <ScrollRestoration />
        </>
      }
    />
  );
}

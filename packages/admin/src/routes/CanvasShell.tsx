import { ensureBaseLists, useAdminAccessState } from "@green-goods/shared";
import { useEffect } from "react";
import { ScrollRestoration } from "react-router-dom";
import { AdminAccessStateRenderer } from "@/components/Layout/AdminAccessStateRenderer";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";

export default function CanvasShell() {
  const accessState = useAdminAccessState();

  useEffect(() => {
    ensureBaseLists();
  }, []);

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

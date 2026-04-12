import { ensureBaseLists } from "@green-goods/shared";
import { useEffect } from "react";
import { ScrollRestoration } from "react-router-dom";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";

export default function CanvasShell() {
  useEffect(() => {
    ensureBaseLists();
  }, []);

  return (
    <>
      <CanvasLayout />
      <ScrollRestoration />
    </>
  );
}

import { ensureBaseLists } from "@green-goods/shared";
import { useEffect } from "react";
import { ScrollRestoration } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";

export default function DashboardShell() {
  useEffect(() => {
    ensureBaseLists();
  }, []);

  return (
    <>
      <DashboardLayout />
      <ScrollRestoration />
    </>
  );
}

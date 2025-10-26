import { ScrollRestoration } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";

export default function DashboardShell() {
  return (
    <>
      <DashboardLayout />
      <ScrollRestoration />
    </>
  );
}

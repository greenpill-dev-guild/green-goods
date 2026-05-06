import { Outlet, ScrollRestoration } from "react-router-dom";
import { SiteHeader } from "@/components/Navigation/SiteHeader";

/**
 * PublicShell — layout wrapper for public routes (no auth required).
 *
 * Provides the SiteHeader (top navigation) and a main content area.
 * Used for the public-facing website experience (browser mode).
 */
export default function PublicShell() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-white-0">
      <SiteHeader />
      <main className="vt-main flex-1">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}

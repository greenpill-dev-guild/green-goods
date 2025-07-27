import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { CircleLoader } from "@/components/UI/Loader";

// Enhanced loading component with accessibility
const RouteLoader = ({ message = "Loading..." }: { message?: string }) => (
  <div 
    className="w-full h-full grid place-items-center min-h-[50vh]"
    role="status"
    aria-live="polite"
    aria-label={message}
  >
    <CircleLoader />
    <span className="sr-only">{message}</span>
  </div>
);

export default function Views() {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <Suspense fallback={<RouteLoader message="Loading page content..." />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

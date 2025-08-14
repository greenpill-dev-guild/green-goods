import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { AppErrorBoundary } from "@/components/UI/ErrorBoundary/AppErrorBoundary";
// import { CircleLoader } from "@/components/UI/Loader";

import { queryClient } from "@/modules/react-query";
import "@/modules/service-worker"; // Initialize service worker
import { router } from "@/router";
import { BadgesProvider } from "@/providers/badges";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <BadgesProvider>
          <RouterProvider router={router} />
        </BadgesProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;

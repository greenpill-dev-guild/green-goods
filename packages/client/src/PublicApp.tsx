import { queryClient } from "@green-goods/shared/config/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { AppErrorBoundary } from "@/components/Errors/AppErrorBoundary";
import { createPublicRouter } from "@/router";

const publicRouter = createPublicRouter();

export function PublicApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <RouterProvider router={publicRouter} />
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

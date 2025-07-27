import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet, useLoaderData, Navigate } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { AppBar } from "@/components/Layout/AppBar";
import { CircleLoader } from "@/components/UI/Loader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SocialPreview } from "@/components/SocialPreview";
import { GardensProvider } from "@/providers/garden";
import { WorkProvider } from "@/providers/work";
import { DeviceRedirect } from "@/components/DeviceRedirect";

// Lazy imports with better loading states
const Landing = lazy(() => import("@/views/Landing"));
const Login = lazy(() => import("@/views/Login"));
const Home = lazy(() => import("@/views/Home"));
const Garden = lazy(() => import("@/views/Garden"));
const Profile = lazy(() => import("@/views/Profile"));

// Nested route components
const HomeGarden = lazy(() =>
  import("@/views/Home/Garden").then((module) => ({ default: module.Garden }))
);
const GardenWorkApproval = lazy(() =>
  import("@/views/Home/WorkApproval").then((module) => ({ default: module.GardenWorkApproval }))
);
const GardenAssessment = lazy(() =>
  import("@/views/Home/Assessment").then((module) => ({ default: module.GardenAssessment }))
);

// Route data loaders for pre-fetching
export const gardenLoader = async ({ params, request }: { params: any; request: Request }) => {
  const { gardenId } = params;
  const url = new URL(request.url);
  const isSharedLink = url.searchParams.get('shared') === 'true';
  
  // Return data needed for social preview and pre-loading
  return {
    gardenId,
    isSharedLink,
    timestamp: Date.now()
  };
};

export const workLoader = async ({ params, request }: { params: any; request: Request }) => {
  const { gardenId, workId } = params;
  const url = new URL(request.url);
  const isSharedLink = url.searchParams.get('shared') === 'true';
  
  return {
    gardenId,
    workId,
    isSharedLink,
    timestamp: Date.now()
  };
};

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

// Main app layout with providers
const AppLayout = () => (
  <GardensProvider>
    <WorkProvider>
      <div role="main" className="flex flex-col h-[calc(100lvh-69px)]">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Suspense fallback={<RouteLoader message="Loading page content..." />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
      <AppBar />
    </WorkProvider>
  </GardensProvider>
);

// Shared content layout for deep linking
const SharedContentLayout = () => {
  const data = useLoaderData() as { isSharedLink?: boolean };
  
  return (
    <div className="min-h-screen bg-white">
      <SocialPreview />
      <DeviceRedirect />
      {data?.isSharedLink && (
        <div className="bg-green-50 border-b border-green-200 p-4 text-center">
          <p className="text-sm text-green-800">
            This content is best viewed in the Green Goods mobile app
          </p>
        </div>
      )}
      <main role="main" className="container mx-auto px-4 py-6">
        <Suspense fallback={<RouteLoader message="Loading shared content..." />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
};

// Garden detail page component for shared links
const SharedGardenView = () => {
  const data = useLoaderData() as { gardenId: string; isSharedLink: boolean };
  
  return (
    <GardensProvider>
      <div className="space-y-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex space-x-2 text-sm text-gray-600">
            <li><a href="/" className="hover:text-green-600">Home</a></li>
            <li>/</li>
            <li className="font-medium">Garden</li>
          </ol>
        </nav>
        
        <article>
          <header>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Garden Details</h1>
          </header>
          <Suspense fallback={<RouteLoader message="Loading garden details..." />}>
            <div id={`garden-${data.gardenId}`}>
              <Home />
            </div>
          </Suspense>
        </article>
      </div>
    </GardensProvider>
  );
};

// Work detail page component for shared links
const SharedWorkView = () => {
  const data = useLoaderData() as { gardenId: string; workId: string; isSharedLink: boolean };
  
  return (
    <GardensProvider>
      <WorkProvider>
        <div className="space-y-6">
          <nav aria-label="Breadcrumb">
            <ol className="flex space-x-2 text-sm text-gray-600">
              <li><a href="/" className="hover:text-green-600">Home</a></li>
              <li>/</li>
              <li><a href={`/garden/${data.gardenId}`} className="hover:text-green-600">Garden</a></li>
              <li>/</li>
              <li className="font-medium">Work</li>
            </ol>
          </nav>
          
          <article>
            <header>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Work Details</h1>
            </header>
            <Suspense fallback={<RouteLoader message="Loading work details..." />}>
              <div id={`work-${data.workId}`}>
                <GardenWorkApproval />
              </div>
            </Suspense>
          </article>
        </div>
      </WorkProvider>
    </GardensProvider>
  );
};

export const createAppRouter = (_queryClient: QueryClient, authState: any) => {
  const { isDownloaded, isAuthenticated, ready } = authState;

  return createBrowserRouter([
    {
      path: "/",
      element: <ErrorBoundary />,
      children: [
        // Landing page for non-downloaded apps
        {
          path: "landing",
          element: (
            <Suspense fallback={<RouteLoader message="Loading landing page..." />}>
              <Landing />
              <Toaster />
            </Suspense>
          ),
        },
        
        // Login page
        {
          path: "login", 
          element: isDownloaded ? (
            !isAuthenticated && !ready ? (
              <RouteLoader message="Initializing authentication..." />
            ) : !isAuthenticated ? (
              <Suspense fallback={<RouteLoader message="Loading login..." />}>
                <Login />
              </Suspense>
            ) : (
              <Navigate to="/" replace />
            )
          ) : (
            <Navigate to="/landing" replace />
          ),
        },

        // Shared content routes (for deep linking)
        {
          path: "share",
          element: <SharedContentLayout />,
          children: [
            {
              path: "garden/:gardenId",
              element: <SharedGardenView />,
              loader: gardenLoader,
            },
            {
              path: "garden/:gardenId/work/:workId",
              element: <SharedWorkView />,
              loader: workLoader,
            },
          ],
        },

        // Main authenticated app routes
        {
          path: "/",
          element: isDownloaded ? (
            isAuthenticated ? (
              <AppLayout />
            ) : (
              <Navigate to="/login" replace />
            )
          ) : (
            <Navigate to="/landing" replace />
          ),
          children: [
            {
              index: true,
              element: <Navigate to="/home" replace />,
            },
            {
              path: "home",
              element: (
                <Suspense fallback={<RouteLoader message="Loading dashboard..." />}>
                  <Home />
                </Suspense>
              ),
              children: [
                {
                  path: ":id",
                  element: (
                    <Suspense fallback={<RouteLoader message="Loading garden..." />}>
                      <HomeGarden />
                    </Suspense>
                  ),
                  children: [
                    {
                      path: "work/:workId",
                      element: (
                        <Suspense fallback={<RouteLoader message="Loading work details..." />}>
                          <GardenWorkApproval />
                        </Suspense>
                      ),
                    },
                    {
                      path: "assessments/:assessmentId",
                      element: (
                        <Suspense fallback={<RouteLoader message="Loading assessment..." />}>
                          <GardenAssessment />
                        </Suspense>
                      ),
                    },
                  ],
                },
              ],
            },
            {
              path: "garden",
              element: (
                <Suspense fallback={<RouteLoader message="Loading garden workspace..." />}>
                  <Garden />
                </Suspense>
              ),
            },
            {
              path: "profile",
              element: (
                <Suspense fallback={<RouteLoader message="Loading profile..." />}>
                  <Profile />
                </Suspense>
              ),
            },
          ],
        },
      ],
    },
  ]);
};
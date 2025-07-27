import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
} from "react-router-dom";

import { CircleLoader } from "@/components/UI/Loader";
import { AppLayout } from "@/layouts/AppLayout";

// Lazy-loaded route components
const Landing = lazy(() => import("@/views/Landing"));
const Login = lazy(() => import("@/views/Login"));
const AppViews = lazy(() => import("@/views"));

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppLayout />}>
      {/* Landing */}
      <Route
        path="/landing"
        element={
          <Suspense
            fallback={
              <div className="w-full h-full grid place-items-center">
                <CircleLoader />
              </div>
            }
          >
            <Landing />
          </Suspense>
        }
      />
      {/* Login */}
      <Route
        path="/login"
        element={
          <Suspense
            fallback={
              <div className="w-full h-full grid place-items-center">
                <CircleLoader />
              </div>
            }
          >
            <Login />
          </Suspense>
        }
      />
      {/* Main App – everything else */}
      <Route
        path="/*"
        element={
          <Suspense
            fallback={
              <div className="w-full h-full grid place-items-center">
                <CircleLoader />
              </div>
            }
          >
            <AppViews />
          </Suspense>
        }
      />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  )
);
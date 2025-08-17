import { Toaster } from "react-hot-toast";
import { Outlet } from "react-router-dom";

export default function Root() {
  return (
    <>
      <Outlet />
      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 20000 }}
        toastOptions={{
          duration: 3500,
          style: {
            background: "var(--color-bg-white-0)",
            color: "var(--color-text-strong-950)",
            border: "1px solid var(--color-stroke-soft-200)",
            boxShadow: "var(--shadow-regular-md)",
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "14px",
            lineHeight: "20px",
          },
          success: {
            style: {
              borderLeft: "4px solid var(--color-success-base)",
            },
            iconTheme: {
              primary: "var(--color-success-base)",
              secondary: "var(--color-white)",
            },
            duration: 3000,
          },
          error: {
            style: {
              borderLeft: "4px solid var(--color-error-base)",
            },
            iconTheme: {
              primary: "var(--color-error-base)",
              secondary: "var(--color-white)",
            },
            duration: 4500,
          },
          loading: {
            style: {
              borderLeft: "4px solid var(--color-information-base)",
            },
            duration: 60000,
          },
        }}
      />
    </>
  );
}

import { RiSeedlingLine } from "@remixicon/react";

interface AdminLoadingScreenProps {
  label: string;
  locale: string;
}

/** Provider-free so startup and route/access checks keep the same first frame. */
export function AdminLoadingScreen({ label, locale }: AdminLoadingScreenProps) {
  return (
    <div
      className="admin-loading-screen flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        textAlign: "center",
      }}
      lang={locale}
      role="status"
      aria-label={label}
      aria-busy="true"
      data-component="AdminLoadingScreen"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-white shadow-[var(--m3-elevation-1)]">
        <RiSeedlingLine className="h-7 w-7 text-text-sub" aria-hidden="true" />
      </div>
      <div
        className="mt-5 h-5 w-5 animate-spin rounded-full border-2 border-stroke-sub border-t-primary-base motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="mt-3 text-body-sm text-text-sub">{label}</p>
    </div>
  );
}

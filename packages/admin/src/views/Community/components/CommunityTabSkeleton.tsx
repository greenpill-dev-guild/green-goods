import type { CommunityWorkspace } from "@green-goods/shared";
import { useIntl } from "react-intl";

export type CommunityTabSkeletonProps = Pick<CommunityWorkspace, "mode">;

export function CommunityTabSkeleton({ mode }: CommunityTabSkeletonProps) {
  const { formatMessage } = useIntl();
  const mainSkeleton =
    mode === "members" ? (
      <>
        <div className="h-12 rounded-lg skeleton-shimmer" />
        <div className="h-10 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.06s" }} />
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-16 rounded-lg skeleton-shimmer"
            style={{ animationDelay: `${0.1 + index * 0.04}s` }}
          />
        ))}
      </>
    ) : mode === "coordination" ? (
      <>
        <div className="h-28 rounded-lg skeleton-shimmer" />
        <div className="h-6 w-40 rounded-md skeleton-shimmer" style={{ animationDelay: "0.08s" }} />
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-20 rounded-lg skeleton-shimmer"
            style={{ animationDelay: `${0.12 + index * 0.05}s` }}
          />
        ))}
      </>
    ) : mode === "endowment" ? (
      <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-20 rounded-lg skeleton-shimmer" />
          <div className="h-20 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.06s" }} />
          <div className="h-20 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-64 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.14s" }} />
          <div className="h-64 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.18s" }} />
        </div>
        <div className="h-40 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.22s" }} />
      </>
    ) : (
      <>
        <div className="h-10 w-48 rounded-md skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="h-52 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.06s" }} />
          <div className="h-52 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
        </div>
      </>
    );
  const railSkeleton =
    mode === "members" ? (
      <>
        <div className="h-12 rounded-lg skeleton-shimmer" />
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="h-9 rounded-md skeleton-shimmer"
            style={{ animationDelay: `${0.08 + index * 0.04}s` }}
          />
        ))}
      </>
    ) : (
      <>
        <div className="h-28 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.16s" }} />
        <div className="h-28 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.22s" }} />
      </>
    );

  return (
    <div className="garden-tab-shell" role="status" aria-live="polite">
      <span className="sr-only">
        {formatMessage({ id: "app.garden.detail.community.loading" })}
      </span>
      <div className="garden-tab-layout">
        <div className="garden-tab-main space-y-4">{mainSkeleton}</div>
        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky space-y-4">{railSkeleton}</div>
        </aside>
      </div>
    </div>
  );
}

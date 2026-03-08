import { SkeletonGrid } from "@/components/ui/Skeleton";
import RequireRole from "./RequireRole";

export default function RequireActionManager() {
  return (
    <RequireRole
      allowedRoles={["deployer", "operator"]}
      loadingFallback={
        <div className="p-6 space-y-6" data-testid="content-skeleton">
          <div className="h-9 w-48 rounded-md skeleton-shimmer" />
          <SkeletonGrid count={4} columns={2} />
        </div>
      }
    />
  );
}

import RequireRole from "./RequireRole";

export default function RequireOperatorOrDeployer() {
  return <RequireRole allowedRoles={["deployer", "operator", "user"]} />;
}

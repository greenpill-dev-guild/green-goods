import RequireRole from "./RequireRole";

export default function RequireDeployer() {
  return <RequireRole allowedRoles={["deployer"]} />;
}

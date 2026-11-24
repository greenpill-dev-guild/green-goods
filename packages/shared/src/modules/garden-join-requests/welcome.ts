import type {
  GardenJoinRequestQueueItem,
  ResolveGardenJoinRequestInput,
} from "../../public-contracts/join-requests";
import type { Address } from "../../types/domain";

export async function welcomeGardenJoinRequest<Resolution>({
  request,
  assignRole,
  resolveRequest,
  failureMessage,
}: {
  request: Pick<GardenJoinRequestQueueItem, "id" | "revision" | "accountAddress">;
  assignRole: (
    address: Address,
    options: { trackMemberAnalytics: false }
  ) => Promise<{ success: boolean; error?: { name: string; message: string } }>;
  resolveRequest: (id: string, input: ResolveGardenJoinRequestInput) => Promise<Resolution>;
  failureMessage: string;
}): Promise<Resolution> {
  const assignment = await assignRole(request.accountAddress, { trackMemberAnalytics: false });
  if (!assignment.success) {
    // Preserve cancellation identity so each surface can dismiss it without an error notice.
    throw Object.assign(new Error(assignment.error?.message ?? failureMessage), assignment.error);
  }

  return resolveRequest(request.id, { action: "welcome", expectedRevision: request.revision });
}

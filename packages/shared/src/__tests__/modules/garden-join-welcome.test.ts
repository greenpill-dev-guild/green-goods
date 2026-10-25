import { describe, expect, it, vi } from "vitest";
import { welcomeGardenJoinRequest } from "../../modules/garden-join-requests/welcome";

const request = {
  id: "request-1",
  revision: 3,
  accountAddress: "0x2222222222222222222222222222222222222222" as const,
};
const failureMessage = "Membership could not be added.";

describe("welcomeGardenJoinRequest", () => {
  it("assigns the role before resolving the exact request revision, preserving pending confirmation", async () => {
    const events: string[] = [];
    const assignRole = vi.fn(async () => {
      events.push("assign");
      return { success: true };
    });
    const resolution = { pendingOnchainMembership: true };
    const resolveRequest = vi.fn(async () => {
      events.push("resolve");
      return resolution;
    });
    await expect(
      welcomeGardenJoinRequest({ request, assignRole, resolveRequest, failureMessage })
    ).resolves.toBe(resolution);
    expect(events).toEqual(["assign", "resolve"]);
    expect(assignRole).toHaveBeenCalledWith(request.accountAddress, {
      trackMemberAnalytics: false,
    });
    expect(resolveRequest).toHaveBeenCalledWith(request.id, {
      action: "welcome",
      expectedRevision: 3,
    });
  });

  it.each([
    { name: "OperationFailed", message: "Role assignment failed." },
    { name: "UserRejected", message: "User rejected the request." },
  ])("does not resolve after a returned $name outcome", async (error) => {
    const assignRole = vi.fn(async () => ({ success: false, error }));
    const resolveRequest = vi.fn();
    await expect(
      welcomeGardenJoinRequest({ request, assignRole, resolveRequest, failureMessage })
    ).rejects.toMatchObject(error);
    expect(resolveRequest).not.toHaveBeenCalled();
  });

  it("uses the surface's fallback when assignment fails without an error", async () => {
    const assignRole = vi.fn(async () => ({ success: false }));
    const resolveRequest = vi.fn();
    await expect(
      welcomeGardenJoinRequest({ request, assignRole, resolveRequest, failureMessage })
    ).rejects.toThrow(failureMessage);
    expect(resolveRequest).not.toHaveBeenCalled();
  });

  it("propagates a resolution failure without retrying the role assignment", async () => {
    const assignRole = vi.fn(async () => ({ success: true }));
    const error = new Error("Request revision changed");
    const resolveRequest = vi.fn().mockRejectedValue(error);
    await expect(
      welcomeGardenJoinRequest({ request, assignRole, resolveRequest, failureMessage })
    ).rejects.toBe(error);
    expect(assignRole).toHaveBeenCalledOnce();
  });
});

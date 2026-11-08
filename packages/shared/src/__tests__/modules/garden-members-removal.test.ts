import { describe, expect, it, vi } from "vitest";
import type { GardenMemberRow } from "../../modules/garden/members-batch";
import {
  createRoleRemovalChain,
  readHeldRoles,
  type RoleRemovalChain,
  type RoleRemovalSendResult,
  removeGardenRolesOneByOne,
} from "../../modules/garden/members-removal";
import type { Address } from "../../types/domain";
import { simulateTransaction } from "../../utils/blockchain/simulation";

vi.mock("../../utils/blockchain/simulation", () => ({ simulateTransaction: vi.fn() }));
vi.mock("../../modules/garden/members-batch", () => ({
  createGardenMembersChain: () => ({
    hatsModule: async () => "0x9999999999999999999999999999999999999999",
    wearsRole: async () => true,
  }),
}));

const ADA = "0x1111111111111111111111111111111111111111" as Address;
const BEN = "0x2222222222222222222222222222222222222222" as Address;
const CY = "0x3333333333333333333333333333333333333333" as Address;
const hash = `0x${"ab".repeat(32)}` as const;

const evaluatorOf = (address: Address): GardenMemberRow => ({ address, role: "evaluator" });

/**
 * A chain where every pair is held until a send for it goes through. `sends` scripts each
 * pair's send; `readsAfterError` scripts what a read returns after a send that did not end
 * cleanly, or that left a proposal waiting.
 */
function fakeChain({
  gone = [],
  refused = {},
  sends = {},
  readsAfterError = {},
}: {
  gone?: Address[];
  refused?: Record<string, string>;
  sends?: Record<string, RoleRemovalSendResult | Error>;
  readsAfterError?: Record<string, boolean | Error>;
} = {}) {
  const removed = new Set(gone.map((address) => address.toLowerCase()));
  const errored = new Set<string>();
  const chain = {
    wearsRole: vi.fn(async ({ address }: GardenMemberRow) => {
      const key = address.toLowerCase();
      if (errored.has(key) && key in readsAfterError) {
        const answer = readsAfterError[key];
        if (answer instanceof Error) throw answer;
        return answer;
      }
      return !removed.has(key);
    }),
    refusal: vi.fn(async ({ address }: GardenMemberRow) => refused[address.toLowerCase()] ?? null),
    removeRole: vi.fn(async ({ address }: GardenMemberRow) => {
      const key = address.toLowerCase();
      const scripted = sends[key] ?? { success: true, hash };
      if (scripted instanceof Error) {
        errored.add(key);
        throw scripted;
      }
      if (scripted.success && scripted.confirmation !== "pending") removed.add(key);
      else errored.add(key);
      return scripted;
    }),
    onGone: vi.fn(),
  } satisfies RoleRemovalChain;
  return chain;
}

const statuses = (outcomes: readonly { status: string }[]) =>
  outcomes.map((outcome) => outcome.status);

describe("modules/garden/members-removal", () => {
  it("sends each pair with its own signature, in order, and reports each landing", async () => {
    const chain = fakeChain();
    const events: string[] = [];
    const outcomes = await removeGardenRolesOneByOne([evaluatorOf(ADA), evaluatorOf(BEN)], chain, {
      onSending: (row) => events.push(`sending ${row.address}`),
      onSettled: (row, outcome) => events.push(`${outcome.status} ${row.address}`),
    });

    expect(chain.removeRole).toHaveBeenCalledTimes(2);
    expect(events).toEqual([
      `sending ${ADA}`,
      `removed ${ADA}`,
      `sending ${BEN}`,
      `removed ${BEN}`,
    ]);
    expect(outcomes[0]).toEqual({ status: "removed", transactionHash: hash });
  });

  it("leaves out a pair already gone or refused, without asking the wallet, and goes on", async () => {
    const chain = fakeChain({ gone: [ADA], refused: { [BEN.toLowerCase()]: "NotGardenAdmin" } });
    const outcomes = await removeGardenRolesOneByOne(
      [evaluatorOf(ADA), evaluatorOf(BEN), evaluatorOf(CY)],
      chain
    );

    expect(statuses(outcomes)).toEqual(["alreadyRemoved", "refused", "removed"]);
    expect(outcomes[1]).toEqual({ status: "refused", reason: "NotGardenAdmin" });
    expect(chain.removeRole).toHaveBeenCalledTimes(1);
    // The roster catches up with a role a read proved gone.
    expect(chain.onGone).toHaveBeenCalledWith(evaluatorOf(ADA));
  });

  it("stops at a declined signature and sends nothing after it", async () => {
    const chain = fakeChain({
      sends: {
        [BEN.toLowerCase()]: { success: false, error: { name: "UserRejected", message: "No" } },
      },
    });
    const outcomes = await removeGardenRolesOneByOne(
      [evaluatorOf(ADA), evaluatorOf(BEN), evaluatorOf(CY)],
      chain
    );

    expect(statuses(outcomes)).toEqual(["removed", "declined", "notSent"]);
    expect(chain.removeRole).toHaveBeenCalledTimes(2);
  });

  it("reads the chain after an unclear send: gone counts, held or unread stops the run", async () => {
    const landed = await removeGardenRolesOneByOne(
      [evaluatorOf(ADA), evaluatorOf(BEN)],
      fakeChain({
        sends: { [ADA.toLowerCase()]: new Error("receipt timed out") },
        readsAfterError: { [ADA.toLowerCase()]: false },
      })
    );
    expect(statuses(landed)).toEqual(["removed", "removed"]);

    const held = await removeGardenRolesOneByOne(
      [evaluatorOf(ADA), evaluatorOf(BEN)],
      fakeChain({
        sends: {
          [ADA.toLowerCase()]: { success: false, error: { name: "Error", message: "reverted" } },
        },
      })
    );
    expect(held).toEqual([{ status: "failed", reason: "reverted" }, { status: "notSent" }]);

    const unread = await removeGardenRolesOneByOne(
      [evaluatorOf(ADA), evaluatorOf(BEN)],
      fakeChain({
        sends: { [ADA.toLowerCase()]: new Error("receipt timed out") },
        readsAfterError: { [ADA.toLowerCase()]: new Error("rpc down") },
      })
    );
    expect(statuses(unread)).toEqual(["unknown", "notSent"]);
  });

  it("counts a proposal that has not run as unconfirmed, and signs nothing after it", async () => {
    const proposal = { success: true, hash, confirmation: "pending" } as const;
    const waiting = await removeGardenRolesOneByOne(
      [evaluatorOf(ADA), evaluatorOf(BEN)],
      fakeChain({ sends: { [ADA.toLowerCase()]: proposal } })
    );
    expect(statuses(waiting)).toEqual(["unknown", "notSent"]);

    // A proposal that already ran shows on chain, so it counts.
    const ran = await removeGardenRolesOneByOne(
      [evaluatorOf(ADA)],
      fakeChain({
        sends: { [ADA.toLowerCase()]: proposal },
        readsAfterError: { [ADA.toLowerCase()]: false },
      })
    );
    expect(ran).toEqual([{ status: "removed", transactionHash: hash }]);
  });

  it("names a refusal only when the simulation reached the chain", async () => {
    const chain = createRoleRemovalChain({
      gardenAddress: CY,
      chainId: 42161,
      account: ADA,
      removeByRole: {
        gardener: vi.fn(),
        steward: vi.fn(),
        evaluator: vi.fn(),
        owner: vi.fn(),
        funder: vi.fn(),
        community: vi.fn(),
      },
    });
    vi.mocked(simulateTransaction)
      .mockResolvedValueOnce({
        success: false,
        error: { name: "NotGardenAdmin", message: "Not a garden admin", raw: "NotGardenAdmin" },
      })
      .mockResolvedValueOnce({
        success: false,
        error: { name: "NetworkError", message: "Network error.", raw: "failed to fetch" },
      });

    await expect(chain.refusal(evaluatorOf(BEN))).resolves.toBe("Not a garden admin");
    // A dropped connection refuses nothing: the run sends, and the send simulates again.
    await expect(chain.refusal(evaluatorOf(BEN))).rejects.toThrow("Network error.");
  });

  it("answers a check per pair, with null where the read failed", async () => {
    const chain = fakeChain({ gone: [BEN] });
    chain.wearsRole.mockImplementationOnce(async () => {
      throw new Error("rpc down");
    });
    const held = await readHeldRoles([evaluatorOf(ADA), evaluatorOf(BEN), evaluatorOf(CY)], chain);

    expect(held).toEqual([null, false, true]);
  });
});

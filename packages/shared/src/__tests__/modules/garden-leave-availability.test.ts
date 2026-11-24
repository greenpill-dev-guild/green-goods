import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractFunctionRevertedError, encodeErrorResult } from "viem";
import { HATS_MODULE_ABI } from "../../utils/blockchain/abis/hats";
import { readGardenLeaveAvailability } from "../../modules/garden/garden-leave-availability";
const fake = vi.hoisted(() => ({ module: vi.fn(), code: vi.fn(), simulate: vi.fn() }));
vi.mock("@wagmi/core", () => ({
  getPublicClient: () => ({ getCode: fake.code }),
  simulateContract: fake.simulate,
}));
vi.mock("../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../utils/blockchain/garden-hats", () => ({ fetchHatsModuleAddress: fake.module }));
const garden = "0x1111111111111111111111111111111111111111";
const account = "0x2222222222222222222222222222222222222222";
const module = "0x3333333333333333333333333333333333333333";
beforeEach(() => {
  vi.resetAllMocks();
  fake.module.mockResolvedValue(module);
  fake.code.mockResolvedValue("0x6000");
  fake.simulate.mockResolvedValue({});
});
describe("read-only leave availability", () => {
  it("requires code and rehearses the actual garden module as the current account on its chain", async () => {
    await expect(readGardenLeaveAvailability(garden, account, 42161)).resolves.toBe("available");
    expect(fake.module).toHaveBeenCalledWith(garden, 42161, { throwOnError: true });
    expect(fake.code).toHaveBeenCalledWith({ address: module });
    expect(fake.simulate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: module,
        account,
        chainId: 42161,
        functionName: "leaveGarden",
        args: [garden],
      })
    );
  });
  it("keeps an absent module unavailable without rehearsing or signing", async () => {
    fake.module.mockResolvedValue(undefined);
    await expect(readGardenLeaveAvailability(garden, account, 42161)).resolves.toBe("unavailable");
    expect(fake.simulate).not.toHaveBeenCalled();
  });
  it("keeps a module without code unavailable", async () => {
    fake.code.mockResolvedValue("0x");
    await expect(readGardenLeaveAvailability(garden, account, 42161)).resolves.toBe("unavailable");
    expect(fake.simulate).not.toHaveBeenCalled();
  });
  it("recognizes an old module's missing entrypoint as unavailable", async () => {
    fake.simulate.mockRejectedValue(
      new ContractFunctionRevertedError({
        abi: HATS_MODULE_ABI,
        functionName: "leaveGarden",
        data: "0x",
      })
    );
    await expect(readGardenLeaveAvailability(garden, account, 42161)).resolves.toBe("unavailable");
  });
  it.each([
    "module",
    "code",
    "simulate",
  ] as const)("fails closed when the %s read is unavailable", async (stage) => {
    fake[stage].mockRejectedValue(new Error("RPC unavailable"));
    await expect(readGardenLeaveAvailability(garden, account, 42161)).resolves.toBe("unknown");
  });
  it.each([
    "OwnerCannotLeave",
    "NotGardenMember",
  ] as const)("accepts only an ABI-decoded %s as capability evidence", async (errorName) => {
    const data =
      errorName === "OwnerCannotLeave"
        ? encodeErrorResult({ abi: HATS_MODULE_ABI, errorName, args: [garden] })
        : encodeErrorResult({ abi: HATS_MODULE_ABI, errorName });
    fake.simulate.mockRejectedValue(
      new ContractFunctionRevertedError({ abi: HATS_MODULE_ABI, functionName: "leaveGarden", data })
    );
    await expect(readGardenLeaveAvailability(garden, account, 42161)).resolves.toBe("available");
  });
  it("does not accept an error message naming a supported error as capability evidence", async () => {
    fake.simulate.mockRejectedValue(new Error("OwnerCannotLeave"));
    await expect(readGardenLeaveAvailability(garden, account, 42161)).resolves.toBe("unknown");
  });
});

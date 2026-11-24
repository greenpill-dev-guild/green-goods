/**
 * Gas headroom tests: the limit a send sets for a call whose contract runs best-effort work inside
 * try/catch, where a bare estimate can stop below what that work needs.
 */

import { encodeFunctionData } from "viem";
import { describe, expect, it, vi } from "vitest";
import { createMockContractCall } from "../../../__tests__/test-utils/transaction-fakes";
import { MOCK_ADDRESSES } from "../../../__tests__/test-utils/mock-factories";
import { walletGasLimit, withGasHeadroom } from "../gas-headroom";

const ACCOUNT = MOCK_ADDRESSES.deployer;

describe("gas headroom", () => {
  it.each([
    { name: "no call asks for any", calls: [{}, {}], gas: 200_000n },
    { name: "one call asks for 50%", calls: [{ gasHeadroomPercent: 50 }], gas: 300_000n },
    {
      name: "calls ask for different amounts",
      calls: [{ gasHeadroomPercent: 10 }, {}, { gasHeadroomPercent: 50 }],
      gas: 300_000n,
    },
  ])("adds the most any call asks for to the estimate when $name", ({ calls, gas }) => {
    expect(withGasHeadroom(200_000n, calls)).toBe(gas);
  });

  it.each([-1, 1.5, Number.NaN])("refuses a headroom of %s percent", (gasHeadroomPercent) => {
    expect(() => withGasHeadroom(200_000n, [{ gasHeadroomPercent }])).toThrow(
      "invalid-gas-headroom"
    );
  });

  it("leaves the limit of a call that asks for no headroom to the wallet", async () => {
    const estimate = vi.fn(async () => 1_000_000n);

    await expect(
      walletGasLimit(createMockContractCall(), ACCOUNT, 42161, estimate)
    ).resolves.toBeUndefined();
    expect(estimate).not.toHaveBeenCalled();
  });

  it("estimates the encoded call from its signer and adds the headroom", async () => {
    const call = createMockContractCall({ gasHeadroomPercent: 50, value: 3n });
    const estimate = vi.fn(async () => 1_000_000n);

    await expect(walletGasLimit(call, ACCOUNT, 42161, estimate)).resolves.toBe(1_500_000n);
    expect(estimate).toHaveBeenCalledWith({
      account: ACCOUNT,
      chainId: 42161,
      to: call.address,
      data: encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args }),
      value: 3n,
    });
  });
});

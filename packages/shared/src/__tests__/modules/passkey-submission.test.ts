/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";
import type { EASConfig } from "../../config/blockchain";
import {
  submitApprovalWithPasskey,
  submitBatchApprovalsWithPasskey,
  submitWorkWithPasskey,
  type PasskeySubmissionDeps,
} from "../../modules/work/passkey-submission";
import type { Address } from "../../types/domain";
import {
  createFakeSmartAccountClient,
  type FakeSmartAccountClient,
} from "../test-utils/transaction-fakes";
import {
  createMockWorkApprovalDraft,
  createMockWorkDraft,
  MOCK_TX_HASH,
} from "../test-utils/mock-factories";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const WORK_UID = `0x${"22".repeat(32)}`;
const ENCODED = `0x${"33".repeat(32)}` as const;
const EAS_CONFIG = {
  EAS: { address: "0x4444444444444444444444444444444444444444" },
  WORK: { uid: `0x${"55".repeat(32)}`, schema: "" },
  WORK_APPROVAL: { uid: `0x${"66".repeat(32)}`, schema: "" },
  ASSESSMENT: { uid: `0x${"00".repeat(32)}`, schema: "" },
  ASSESSMENT_V3: { uid: `0x${"00".repeat(32)}`, schema: "" },
  SCHEMA_REGISTRY: { address: "0x7777777777777777777777777777777777777777" },
} satisfies EASConfig;

function workParams(client: FakeSmartAccountClient | null = createFakeSmartAccountClient()) {
  return {
    client,
    draft: createMockWorkDraft({ title: "" }),
    gardenAddress: GARDEN,
    actionUID: 7,
    actionTitle: "Plant trees",
    chainId: 11155111,
    images: [] as File[],
  };
}

function approvalParams(client: FakeSmartAccountClient | null = createFakeSmartAccountClient()) {
  return {
    client,
    draft: createMockWorkApprovalDraft({ workUID: WORK_UID }),
    gardenAddress: GARDEN,
    chainId: 11155111,
  };
}

function dependencies(overrides: Partial<PasskeySubmissionDeps> = {}) {
  return {
    simulate: vi.fn().mockResolvedValue(undefined),
    encodeWork: vi.fn().mockResolvedValue(ENCODED),
    encodeApproval: vi.fn().mockReturnValue(ENCODED),
    assertSmartAccountsAllowed: vi.fn(),
    easConfig: EAS_CONFIG,
    ...overrides,
  } satisfies PasskeySubmissionDeps;
}

describe("passkey work submission", () => {
  it("simulates, encodes, checks safety, and sends in order", async () => {
    const client = createFakeSmartAccountClient();
    const deps = dependencies();

    await expect(submitWorkWithPasskey(workParams(client), deps)).resolves.toBe(MOCK_TX_HASH);

    expect(deps.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ accountAddress: client.account!.address })
    );
    expect(deps.encodeWork).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Plant trees", actionUID: 7 }),
      11155111,
      { gardenAddress: GARDEN, authMode: "passkey" }
    );
    expect(deps.assertSmartAccountsAllowed).toHaveBeenCalledOnce();
    expect(client.sendTransaction).toHaveBeenCalledOnce();
    expect((deps.simulate as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]).toBeLessThan(
      (deps.encodeWork as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    );
  });

  it("stops before encoding when simulation fails", async () => {
    const failure = new Error("simulation failed");
    const deps = dependencies({ simulate: vi.fn().mockRejectedValue(failure) });

    await expect(submitWorkWithPasskey(workParams(), deps)).rejects.toBe(failure);

    expect(deps.encodeWork).not.toHaveBeenCalled();
    expect(deps.assertSmartAccountsAllowed).not.toHaveBeenCalled();
  });

  it("rejects a missing client before invoking dependencies", async () => {
    const deps = dependencies();

    await expect(submitWorkWithPasskey(workParams(null), deps)).rejects.toThrow(
      "Passkey client is not available"
    );

    expect(deps.simulate).not.toHaveBeenCalled();
  });

  it("rejects a client whose account is not ready", async () => {
    const client = { ...createFakeSmartAccountClient(), account: undefined } as never;

    await expect(submitWorkWithPasskey(workParams(client), dependencies())).rejects.toThrow(
      "Passkey session is not ready"
    );
  });

  it("keeps the production config and safety adapters behind injected work ports", async () => {
    const client = createFakeSmartAccountClient();

    await expect(
      submitWorkWithPasskey(workParams(client), {
        simulate: vi.fn().mockResolvedValue(undefined),
        encodeWork: vi.fn().mockResolvedValue(ENCODED),
      })
    ).resolves.toBe(MOCK_TX_HASH);

    expect(client.sendTransaction).toHaveBeenCalledOnce();
  });

  it("uses the production work encoder when none is injected", async () => {
    await expect(
      submitWorkWithPasskey(workParams(), {
        simulate: vi.fn().mockResolvedValue(undefined),
        assertSmartAccountsAllowed: vi.fn(),
        easConfig: EAS_CONFIG,
      })
    ).rejects.toThrow("IPFS upload service is not configured");
  });

  it("uses the production simulation adapter when none is injected", async () => {
    await expect(
      submitWorkWithPasskey(workParams(), {
        encodeWork: vi.fn().mockResolvedValue(ENCODED),
        assertSmartAccountsAllowed: vi.fn(),
        easConfig: EAS_CONFIG,
      })
    ).rejects.toThrow("getWagmiConfig() called before AppKit initialization");
  });
});

describe("passkey approval submission", () => {
  it("encodes, checks safety, and submits one approval", async () => {
    const client = createFakeSmartAccountClient();
    const deps = dependencies();

    await expect(submitApprovalWithPasskey(approvalParams(client), deps)).resolves.toBe(
      MOCK_TX_HASH
    );

    expect(deps.encodeApproval).toHaveBeenCalledWith(approvalParams().draft, 11155111);
    expect(deps.assertSmartAccountsAllowed).toHaveBeenCalledOnce();
    expect(client.sendTransaction).toHaveBeenCalledOnce();
  });

  it("rejects a missing smart account", async () => {
    await expect(submitApprovalWithPasskey(approvalParams(null), dependencies())).rejects.toThrow(
      "Passkey client is not available"
    );
  });

  it("uses the production approval adapters when dependencies are omitted", async () => {
    const client = createFakeSmartAccountClient();

    await expect(submitApprovalWithPasskey(approvalParams(client))).resolves.toBe(MOCK_TX_HASH);
    expect(client.sendTransaction).toHaveBeenCalledOnce();
  });
});

describe("passkey batch approval submission", () => {
  function batch(client: FakeSmartAccountClient | null = createFakeSmartAccountClient()) {
    return {
      client,
      approvals: [
        { draft: createMockWorkApprovalDraft({ workUID: WORK_UID }), gardenAddress: GARDEN },
        {
          draft: createMockWorkApprovalDraft({ workUID: `0x${"44".repeat(32)}` }),
          gardenAddress: GARDEN,
        },
      ],
      chainId: 11155111,
    };
  }

  it("encodes every approval and sends one batch transaction", async () => {
    const client = createFakeSmartAccountClient();
    const deps = dependencies();

    await expect(submitBatchApprovalsWithPasskey(batch(client), deps)).resolves.toBe(MOCK_TX_HASH);

    expect(deps.encodeApproval).toHaveBeenCalledTimes(2);
    expect(deps.assertSmartAccountsAllowed).toHaveBeenCalledOnce();
    expect(client.sendTransaction).toHaveBeenCalledOnce();
  });

  it("rejects an empty batch before requiring a client", async () => {
    await expect(
      submitBatchApprovalsWithPasskey(
        { client: null, approvals: [], chainId: 11155111 },
        dependencies()
      )
    ).rejects.toThrow("No approvals provided. At least one approval is required.");
  });

  it("honors an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      submitBatchApprovalsWithPasskey({ ...batch(), signal: controller.signal }, dependencies())
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("honors cancellation triggered while encoding", async () => {
    const controller = new AbortController();
    const deps = dependencies({
      encodeApproval: vi.fn(() => {
        controller.abort();
        return ENCODED;
      }),
    });
    const client = createFakeSmartAccountClient();

    await expect(
      submitBatchApprovalsWithPasskey({ ...batch(client), signal: controller.signal }, deps)
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(client.sendTransaction).not.toHaveBeenCalled();
  });

  it("honors cancellation triggered while checking the smart account", async () => {
    const controller = new AbortController();
    const account = createFakeSmartAccountClient().account;
    const client = {
      ...createFakeSmartAccountClient(),
      get account() {
        controller.abort();
        return account;
      },
    } as FakeSmartAccountClient;

    await expect(
      submitBatchApprovalsWithPasskey(
        { ...batch(client), signal: controller.signal },
        dependencies()
      )
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("uses the production batch adapters when dependencies are omitted", async () => {
    const client = createFakeSmartAccountClient();

    await expect(submitBatchApprovalsWithPasskey(batch(client))).resolves.toBe(MOCK_TX_HASH);
    expect(client.sendTransaction).toHaveBeenCalledOnce();
  });
});

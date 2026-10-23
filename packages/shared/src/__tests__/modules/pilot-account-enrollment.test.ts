import { createSmartAccountClient, type SmartAccountClient } from "permissionless";
import { custom, encodeFunctionData, type Hex } from "viem";
import { gnosis } from "viem/chains";
import {
  entryPoint07Address,
  getUserOperationHash,
  type UserOperation,
} from "viem/account-abstraction";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPilotAccountEnrollment,
  getPilotProofMaxCost,
} from "../../modules/auth/pilot-account-enrollment";
import {
  PILOT_PROOF_CALL_ABI,
  PILOT_ROOT_NONCE_KEY,
  getPilotProofExecutionCallData,
  type PilotAccountProof,
  PilotProofExecutionFailedError,
} from "../../modules/auth/pilot-account-proof";
import { LEGACY_PASSKEY_PROFILE, PILOT_PASSKEY_PROFILE } from "../../modules/auth/account-profile";
import { defaultPasskeyAdapters } from "../../workflows/auth-passkey-adapters";

vi.mock("../../config/pimlico", () => ({
  createPublicClientForChain: (chainId: number) => ({ chain: { id: chainId } }),
}));
vi.mock("../../modules/transactions/local-fork-safety", () => ({
  assertLocalArbitrumForkSmartAccountsDisabled: async () => {},
}));

const OLD = "0x1111111111111111111111111111111111111111" as const;
const NEW = "0x2222222222222222222222222222222222222222" as const;
const TRANSACTION = `0x${"ab".repeat(32)}` as Hex;
const credential = {
  id: "deadbeef",
  signingId: "3q2-7w",
  publicKey: "0x1234" as const,
  raw: undefined as unknown as PublicKeyCredential,
};
const request: UserOperation<"0.7"> = {
  sender: NEW,
  nonce: PILOT_ROOT_NONCE_KEY << 64n,
  callData: getPilotProofExecutionCallData(NEW),
  callGasLimit: 50_000n,
  verificationGasLimit: 60_000n,
  preVerificationGas: 40_000n,
  maxFeePerGas: 1_000_000_000n,
  maxPriorityFeePerGas: 1n,
  paymaster: "0x3333333333333333333333333333333333333333",
  paymasterData: "0x1234",
  paymasterVerificationGasLimit: 20_000n,
  paymasterPostOpGasLimit: 30_000n,
  signature: "0x",
};
const hash = (operation = request) =>
  getUserOperationHash({
    userOperation: operation,
    entryPointAddress: entryPoint07Address,
    entryPointVersion: "0.7",
    chainId: 100,
  });

function harness() {
  const records = new Map<string, string>();
  const storage = {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => {
      records.set(key, value);
    },
    removeItem: (key: string) => {
      records.delete(key);
    },
  };
  let active: {
    credential: typeof credential;
    address: Hex;
    chainId: number;
    userName: string;
  } | null = { credential, address: OLD, chainId: 42161, userName: "ada" };
  let operation = { ...request };
  let now = 1_000;
  const selectSession = vi.fn();
  const sign = vi.fn(async () => "0x1234" as Hex);
  const sent = vi.fn();
  const wait = vi.fn(async () => ({
    userOpHash: hash(),
    logs: [],
    sender: NEW,
    success: true,
    receipt: { status: "success", transactionHash: TRANSACTION },
  }));
  const clients = new Map(
    [42161, 42220, 100].map((chainId) => [
      chainId,
      {
        chain: { id: chainId },
        account: {
          address: NEW,
          entryPoint: { address: entryPoint07Address, version: "0.7" },
          signUserOperation: sign,
          getFactoryArgs: async () => ({}),
        },
        prepareUserOperation: vi.fn(async () => ({ ...operation })),
        sendUserOperation: async ({
          account,
          calls,
        }: {
          account: { signUserOperation(input: UserOperation<"0.7">): Promise<Hex> };
          calls: unknown;
        }) => {
          await account.signUserOperation(operation);
          // The real sender's before-broadcast hook must persist the identity before the RPC send.
          expect(records.has(`greengoods_pilot_proof:100:${NEW}`)).toBe(true);
          sent(calls);
          return hash(operation);
        },
        waitForUserOperationReceipt: wait,
      } as unknown as SmartAccountClient,
    ])
  );
  const profileWrites = vi.fn();
  const addressWrites = vi.fn();
  const metadataWrites = vi.fn();
  const assertion = vi.fn(async () => true);
  const getCredential = vi.fn(async () => ({ id: "3q2-7w" }) as PublicKeyCredential);
  const proof = {
    accountAddress: NEW,
    chainId: 100,
    transactionHash: TRANSACTION,
    userOperationHash: hash(),
    blockNumber: 10n,
    nonce: 1n,
  } as PilotAccountProof;
  const discover = vi.fn(async ({ transactionHash }: { transactionHash?: Hex }) =>
    transactionHash ? proof : null
  );
  const adapters = {
    ...defaultPasskeyAdapters,
    session: {
      ...defaultPasskeyAdapters.session,
      getStoredRpId: () => "greengoods.app",
      getStoredUsername: () => "ada",
      getStoredAccountProfile: () => LEGACY_PASSKEY_PROFILE,
      setStoredAccountProfile: profileWrites,
      setStoredProfileAddress: metadataWrites,
      setStoredCredential: vi.fn(),
      setStoredSmartAccountAddress: addressWrites,
    },
    randomChallenge: () => new Uint8Array([1, 2, 3]),
    getWebAuthnCredential: getCredential,
    verifyAssertion: assertion,
    buildSmartAccount: vi.fn(async (_credential, chainId) => ({
      address: NEW,
      client: clients.get(chainId)!,
    })),
  };
  const enrollment = createPilotAccountEnrollment({
    adapters,
    getSession: () => active,
    selectSession,
    storage,
    discoverProof:
      discover as unknown as typeof import("../../modules/auth/pilot-account-proof").discoverPilotAccountProof,
    now: () => now,
  });
  return {
    enrollment,
    adapters,
    records,
    profileWrites,
    addressWrites,
    metadataWrites,
    selectSession,
    sign,
    sent,
    wait,
    assertion,
    getCredential,
    discover,
    proof,
    clients,
    changeOperation: (next: UserOperation<"0.7">) => {
      operation = next;
    },
    expire: () => {
      now += 60_001;
    },
    logout: () => {
      active = null;
    },
  };
}

describe("pilot account enrollment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prepares with the original passkey without signing a transaction or replacing the account", async () => {
    const h = harness();
    await expect(h.enrollment.prepare()).resolves.toMatchObject({
      previousAddress: OLD,
      address: NEW,
      enrolled: false,
    });
    expect(h.assertion).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: credential.publicKey, rpId: "greengoods.app" })
    );
    for (const chain of [42161, 42220, 100])
      expect(h.adapters.buildSmartAccount).toHaveBeenCalledWith(
        expect.objectContaining({ id: "deadbeef", signingId: "3q2-7w" }),
        chain,
        "greengoods.app",
        undefined,
        PILOT_PASSKEY_PROFILE
      );
    expect(h.profileWrites).not.toHaveBeenCalled();
    expect(h.sign).not.toHaveBeenCalled();
  });

  it("leaves the old session unchanged when the credential assertion is cancelled or invalid", async () => {
    const h = harness();
    h.assertion.mockResolvedValue(false);
    await expect(h.enrollment.prepare()).rejects.toThrow("verification failed or was cancelled");
    expect(h.adapters.buildSmartAccount).not.toHaveBeenCalled();
    expect(h.profileWrites).not.toHaveBeenCalled();
    expect(h.addressWrites).not.toHaveBeenCalled();
  });

  it("discovers an existing pilot profile without any prompt or selection", async () => {
    const h = harness();
    h.discover.mockResolvedValue(h.proof);
    await expect(h.enrollment.findExisting()).resolves.toMatchObject({
      enrolled: true,
      address: NEW,
    });
    expect(h.getCredential).not.toHaveBeenCalled();
    expect(h.profileWrites).not.toHaveBeenCalled();
    await expect(h.enrollment.confirm()).rejects.toThrow("Prepare the pilot account first");
  });

  it("counts every gas component and refuses native-funded or over-ceiling proofs", () => {
    expect(getPilotProofMaxCost(request)).toBe(200_000_000_000_000n);
    expect(() => getPilotProofMaxCost({ ...request, paymaster: undefined })).toThrow(
      "fully sponsored"
    );
    expect(() =>
      getPilotProofMaxCost({ ...request, paymasterPostOpGasLimit: 10_000_001n })
    ).toThrow("0.01 xDAI");
  });

  it("requires a fresh matching quote before opening a transaction signature prompt", async () => {
    const h = harness();
    await h.enrollment.prepare();
    const quote = await h.enrollment.quote();
    h.expire();
    await expect(h.enrollment.confirm(quote.operationHash)).rejects.toThrow(
      "fresh pilot proof quote"
    );
    expect(h.sign).not.toHaveBeenCalled();
    expect(h.sent).not.toHaveBeenCalled();
  });

  it("refuses changed sponsor, nonce or fee data before WebAuthn signs", async () => {
    const h = harness();
    await h.enrollment.prepare();
    const quote = await h.enrollment.quote();
    h.changeOperation({ ...request, nonce: request.nonce + 1n });
    await expect(h.enrollment.confirm(quote.operationHash)).rejects.toThrow("quote changed");
    expect(h.sign).not.toHaveBeenCalled();
    expect(h.sent).not.toHaveBeenCalled();
  });

  it("records the pending operation before send and selects only after receipt proof", async () => {
    const h = harness();
    await h.enrollment.prepare();
    const quote = await h.enrollment.quote();
    await h.enrollment.confirm(quote.operationHash);
    expect(h.sent).toHaveBeenCalledWith([
      {
        to: NEW,
        value: 0n,
        data: encodeFunctionData({ abi: PILOT_PROOF_CALL_ABI, functionName: "rootValidator" }),
      },
    ]);
    expect(h.discover).toHaveBeenLastCalledWith(
      expect.objectContaining({
        transactionHash: TRANSACTION,
        accountAddress: NEW,
        canonicalCredentialId: "3q2-7w",
      })
    );
    expect(h.metadataWrites).toHaveBeenCalledWith(
      LEGACY_PASSKEY_PROFILE,
      credential,
      OLD,
      "greengoods.app",
      "ada"
    );
    expect(h.profileWrites).toHaveBeenCalledWith(PILOT_PASSKEY_PROFILE);
    expect(h.selectSession).toHaveBeenCalledWith(
      expect.objectContaining({ smartAccountAddress: NEW, accountProfile: PILOT_PASSKEY_PROFILE })
    );
    expect(h.records.size).toBe(0);
  });

  it("preserves account prototypes through the installed SDK prepare/sign/send boundary", async () => {
    const h = harness();
    const inherited = {
      getFactoryArgs() {
        return {};
      },
      async getNonce() {
        return request.nonce;
      },
      async getStubSignature() {
        return "0x1234";
      },
      async encodeCalls() {
        return request.callData;
      },
    };
    const account = Object.assign(Object.create(inherited), {
      address: NEW,
      type: "smart",
      source: "kernelSmartAccount",
      entryPoint: { address: entryPoint07Address, version: "0.7" },
      signUserOperation: h.sign,
    });
    let broadcasts = 0;
    const actualClient = createSmartAccountClient({
      account,
      chain: gnosis,
      bundlerTransport: custom({
        request: async ({ method }) => {
          if (method === "eth_estimateUserOperationGas")
            return {
              callGasLimit: "0xc350",
              verificationGasLimit: "0xea60",
              preVerificationGas: "0x9c40",
              paymasterVerificationGasLimit: "0x4e20",
              paymasterPostOpGasLimit: "0x7530",
            };
          if (method === "eth_sendUserOperation") {
            expect(h.records.has(`greengoods_pilot_proof:100:${NEW}`)).toBe(true);
            broadcasts++;
            return hash();
          }
          throw new Error(`Unexpected test RPC ${method}`);
        },
      }),
      paymaster: {
        getPaymasterData: async () => ({
          paymaster: request.paymaster!,
          paymasterData: "0x1234",
          paymasterVerificationGasLimit: 20_000n,
          paymasterPostOpGasLimit: 30_000n,
        }),
        getPaymasterStubData: async () => ({
          paymaster: request.paymaster!,
          paymasterData: "0x1234",
          isFinal: true,
          paymasterVerificationGasLimit: 20_000n,
          paymasterPostOpGasLimit: 30_000n,
        }),
      },
      userOperation: {
        estimateFeesPerGas: async () => ({
          maxFeePerGas: request.maxFeePerGas,
          maxPriorityFeePerGas: request.maxPriorityFeePerGas,
        }),
      },
    });
    h.clients.set(
      100,
      Object.assign(Object.create(actualClient), { waitForUserOperationReceipt: h.wait })
    );
    await h.enrollment.prepare();
    const quote = await h.enrollment.quote();
    await h.enrollment.confirm(quote.operationHash);
    expect(broadcasts).toBe(1);
    expect(h.sign).toHaveBeenCalledTimes(1);
    expect(h.profileWrites).toHaveBeenCalledWith(PILOT_PASSKEY_PROFILE);
  });

  it("preserves uncertain broadcasts, blocks duplicate sends and reconciles without signing again", async () => {
    const h = harness();
    await h.enrollment.prepare();
    const quote = await h.enrollment.quote();
    h.wait.mockRejectedValueOnce(new Error("timeout"));
    await expect(h.enrollment.confirm(quote.operationHash)).rejects.toThrow("timeout");
    expect(h.profileWrites).not.toHaveBeenCalled();
    expect(h.records.size).toBe(1);
    await expect(h.enrollment.quote()).rejects.toThrow("Reconcile");
    await h.enrollment.reconcile();
    expect(h.sent).toHaveBeenCalledTimes(1);
    expect(h.sign).toHaveBeenCalledTimes(1);
    expect(h.profileWrites).toHaveBeenCalledWith(PILOT_PASSKEY_PROFILE);
  });

  it("revokes a prepared enrollment on sign-out or cancellation", async () => {
    const h = harness();
    await h.enrollment.prepare();
    const quote = await h.enrollment.quote();
    h.logout();
    await expect(h.enrollment.confirm(quote.operationHash)).rejects.toThrow("session changed");
    expect(h.sign).not.toHaveBeenCalled();
    expect(h.profileWrites).not.toHaveBeenCalled();
  });

  it("restores the original active profile and address if the profile commit fails", async () => {
    const h = harness();
    await h.enrollment.prepare();
    const quote = await h.enrollment.quote();
    h.profileWrites.mockImplementationOnce(() => {
      throw new Error("Storage quota");
    });
    await expect(h.enrollment.confirm(quote.operationHash)).rejects.toThrow("Storage quota");
    expect(h.profileWrites).toHaveBeenLastCalledWith(LEGACY_PASSKEY_PROFILE);
    expect(h.addressWrites).toHaveBeenLastCalledWith(OLD);
    expect(h.selectSession).not.toHaveBeenCalled();
    expect(h.records.size).toBe(1);
    await h.enrollment.reconcile();
    expect(h.sent).toHaveBeenCalledTimes(1);
    expect(h.selectSession).toHaveBeenCalledWith(
      expect.objectContaining({ smartAccountAddress: NEW })
    );
  });

  it("reconciles a known inner execution failure then permits a fresh proof at the next nonce", async () => {
    const h = harness();
    await h.enrollment.prepare();
    const first = await h.enrollment.quote();
    h.wait.mockRejectedValueOnce(new Error("timeout"));
    await expect(h.enrollment.confirm(first.operationHash)).rejects.toThrow("timeout");
    h.discover.mockRejectedValueOnce(new PilotProofExecutionFailedError());
    await expect(h.enrollment.reconcile()).rejects.toMatchObject({ pending: false });
    expect(h.records.size).toBe(0);
    expect(h.profileWrites).not.toHaveBeenCalled();
    const next = { ...request, nonce: request.nonce + 1n };
    h.changeOperation(next);
    h.wait.mockResolvedValue({
      userOpHash: hash(next),
      logs: [],
      sender: NEW,
      success: true,
      receipt: { status: "success", transactionHash: TRANSACTION },
    });
    const second = await h.enrollment.quote();
    expect(second.nonce).toBe(next.nonce.toString());
    await h.enrollment.confirm(second.operationHash);
    expect(h.sent).toHaveBeenCalledTimes(2);
    expect(h.profileWrites).toHaveBeenCalledWith(PILOT_PASSKEY_PROFILE);
  });
});

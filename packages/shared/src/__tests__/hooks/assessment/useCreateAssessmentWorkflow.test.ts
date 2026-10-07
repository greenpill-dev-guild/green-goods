/**
 * @vitest-environment happy-dom
 */

import type { QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssessmentWorkflowParams } from "../../../types/domain";
import type { TransactionSender } from "../../../modules/transactions/types";
import { useAssessmentSubmissionStore } from "../../../stores/useAssessmentSubmissionStore";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { EASABI } from "../../../utils/blockchain/contracts";

const GARDEN_ID = "0x1111111111111111111111111111111111111111" as const;
const OPERATOR_ADDRESS = "0x2222222222222222222222222222222222222222" as const;
const EAS_ADDRESS = "0x3333333333333333333333333333333333333333";
const ASSESSMENT_UID = `0x${"44".repeat(32)}`;
const ATTESTATION_UID = `0x${"55".repeat(32)}`;
const ASSESSMENT_SCHEMA =
  "string title,string description,string assessmentConfigCID,uint8 domain,uint256 startDate,uint256 endDate,string location";

const mocks = vi.hoisted(() => ({
  authMode: "wallet" as "wallet" | "passkey",
  primaryAddress: "0x7777777777777777777777777777777777777777",
  sender: null as TransactionSender | null,
  getReceipt: vi.fn(),
  walletAddress: "0x2222222222222222222222222222222222222222" as string | undefined,
  walletClient: {
    account: { address: "0x2222222222222222222222222222222222222222" },
    transport: { request: vi.fn() },
  } as
    | { account: { address: string }; transport: { request: ReturnType<typeof vi.fn> } }
    | undefined,
  chainId: 11155111,
  ipfsStatus: "success",
  assessmentUid: `0x${"44".repeat(32)}`,
  assessmentSchema:
    "string title,string description,string assessmentConfigCID,uint8 domain,uint256 startDate,uint256 endDate,string location",
  saveDraft: vi.fn(),
  clearDraft: vi.fn(),
  peekDraft: vi.fn(),
  loadDraft: vi.fn(),
  uploadFile: vi.fn(),
  uploadJson: vi.fn(),
  send: vi.fn(),
  assertOwnership: vi.fn(),
  ensureChain: vi.fn(),
  readyWalletClient: vi.fn(),
  trackStarted: vi.fn(),
  trackSuccess: vi.fn(),
  trackFailed: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  easConstructor: vi.fn(),
  easConnect: vi.fn(),
  easAttest: vi.fn(),
  waitForAttestation: vi.fn(),
  schemaConstructor: vi.fn(),
  schemaEncode: vi.fn(),
  browserProviderConstructor: vi.fn(),
  getSigner: vi.fn(),
  scheduleIndexerRefetch: vi.fn(),
  cancelIndexerRefetch: vi.fn(),
  progressiveCallback: undefined as undefined | (() => void),
}));

vi.mock("../../../providers/Auth", () => ({
  useAuthState: () => ({ authMode: mocks.authMode }),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () =>
    mocks.authMode === "passkey" ? mocks.primaryAddress : mocks.walletAddress,
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: mocks.walletAddress }),
}));

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: { selectedChainId: number }) => unknown) =>
    selector({ selectedChainId: mocks.chainId }),
}));

vi.mock("../../../hooks/assessment/useAssessmentDraft", () => ({
  useAssessmentDraft: () => ({
    draftKey: `assessment_draft_${GARDEN_ID}_${OPERATOR_ADDRESS}`,
    isLoading: false,
    lastSavedAt: null,
    saveDraft: mocks.saveDraft,
    clearDraft: mocks.clearDraft,
    peekDraft: mocks.peekDraft,
    loadDraft: mocks.loadDraft,
  }),
}));

vi.mock("../../../modules/data/ipfs/client", () => ({
  getIpfsInitStatus: () => ({ status: mocks.ipfsStatus }),
}));

vi.mock("../../../modules/data/ipfs/upload", () => ({
  uploadFileToIPFS: mocks.uploadFile,
  uploadJSONToIPFS: mocks.uploadJson,
}));

// The wallet client comes from the guard when the workflow signs, not from wagmi at render.
// The network check and its retry run for real in the command test, so here they pass through.
vi.mock("../../../modules/transactions/chain-guard", () => ({
  ensureAppKitWalletChain: mocks.ensureChain,
  readyWalletClient: mocks.readyWalletClient,
  retryOnWalletChainMismatch: (request: () => Promise<unknown>) => request(),
  WalletChainMismatchError: Error,
}));

vi.mock("../../../modules/app/analytics-events", () => ({
  trackAdminAssessmentCreateStarted: mocks.trackStarted,
  trackAdminAssessmentCreateSuccess: mocks.trackSuccess,
  trackAdminAssessmentCreateFailed: mocks.trackFailed,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    info: mocks.toastInfo,
    error: mocks.toastError,
  },
}));

vi.mock("../../../utils/blockchain/contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/blockchain/contracts")>()),
  getNetworkContracts: () => ({ eas: EAS_ADDRESS }),
  createClients: () => ({
    publicClient: {
      waitForTransactionReceipt: mocks.getReceipt,
      getTransactionReceipt: mocks.getReceipt,
    },
  }),
}));

vi.mock("../../../config/blockchain", () => ({
  getEASConfig: () => ({
    ASSESSMENT: { uid: mocks.assessmentUid, schema: mocks.assessmentSchema },
  }),
}));

vi.mock("../../../utils/blockchain/vaults", () => ({
  isZeroBytes32: (value: string) => /^0x0{64}$/i.test(value),
}));

vi.mock("../../../hooks/utils/useTimeout", () => ({
  useProgressiveInvalidation: (callback: () => void) => {
    mocks.progressiveCallback = callback;
    return {
      start: mocks.scheduleIndexerRefetch,
      cancel: mocks.cancelIndexerRefetch,
    };
  },
}));

vi.mock("ethers", () => ({
  ethers: {
    BrowserProvider: class BrowserProvider {
      constructor(transport: unknown) {
        mocks.browserProviderConstructor(transport);
      }

      getSigner(address: string) {
        return mocks.getSigner(address);
      }
    },
  },
}));

vi.mock("@ethereum-attestation-service/eas-sdk", () => ({
  EAS: class EAS {
    constructor(address: string) {
      mocks.easConstructor(address);
    }

    connect(signer: unknown) {
      mocks.easConnect(signer);
      return this;
    }

    attest(params: unknown) {
      return mocks.easAttest(params);
    }
  },
  SchemaEncoder: class SchemaEncoder {
    constructor(schema: string) {
      mocks.schemaConstructor(schema);
    }

    encodeData(data: unknown) {
      return mocks.schemaEncode(data);
    }
  },
}));

import { useCreateAssessmentWorkflow } from "../../../hooks/assessment/useCreateAssessmentWorkflow";

function createParams(overrides: Partial<AssessmentWorkflowParams> = {}): AssessmentWorkflowParams {
  return {
    gardenId: GARDEN_ID,
    title: "Watershed restoration assessment",
    description: "Verified outcomes from the summer restoration work",
    assessmentType: "domain-2",
    capitals: ["natural", "social"],
    metrics: { treesPlanted: 80, survivalRate: 0.95 },
    evidenceMedia: [],
    reportDocuments: ["bafy-report", ""],
    impactAttestations: [`  0x${"AB".repeat(32)}  `],
    startDate: 1_700_000_000,
    endDate: 1_700_086_400,
    location: "Portland, OR",
    tags: ["watershed", "restoration"],
    ...overrides,
  };
}

function renderWorkflow(queryClient: QueryClient) {
  return renderHookWithProviders(() => useCreateAssessmentWorkflow({ gardenId: GARDEN_ID }), {
    queryClient,
  });
}

async function startReady(
  result: ReturnType<typeof renderWorkflow>["result"],
  params = createParams()
) {
  let accepted = false;
  act(() => {
    accepted = result.current.startCreation(params);
  });

  expect(accepted).toBe(true);
  expect(result.current.state.matches("ready")).toBe(true);
  await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledWith(params));
}

async function submitAndWaitFor(
  result: ReturnType<typeof renderWorkflow>["result"],
  expectedState: "success" | "error" | "pending"
) {
  act(() => {
    result.current.submitCreation();
  });
  await waitFor(() =>
    expect(
      result.current.state.matches(expectedState),
      `Expected ${expectedState}, received ${String(result.current.state.value)}: ${result.current.state.context.error ?? ""}`
    ).toBe(true)
  );
}

describe("useCreateAssessmentWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAssessmentSubmissionStore.setState({ pending: {} });
    mocks.authMode = "wallet";
    mocks.send.mockReset().mockResolvedValue({ hash: `0x${"66".repeat(32)}`, sponsored: false });
    mocks.assertOwnership.mockReset();
    mocks.sender = {
      authMode: "wallet",
      supportsSponsorship: false,
      supportsBatching: false,
      sendContractCall: mocks.send,
      assertOwnership: mocks.assertOwnership,
    };
    mocks.getReceipt.mockReset().mockResolvedValue({
      transactionHash: `0x${"66".repeat(32)}`,
      status: "success",
      logs: [
        {
          address: EAS_ADDRESS,
          topics: encodeEventTopics({
            abi: EASABI,
            eventName: "Attested",
            args: { recipient: GARDEN_ID, attester: OPERATOR_ADDRESS, schemaUID: ASSESSMENT_UID },
          }),
          data: encodeAbiParameters([{ type: "bytes32" }], [ATTESTATION_UID as `0x${string}`]),
        },
      ],
    });
    mocks.primaryAddress = "0x7777777777777777777777777777777777777777";
    mocks.walletAddress = OPERATOR_ADDRESS;
    mocks.walletClient = {
      account: { address: OPERATOR_ADDRESS },
      transport: { request: vi.fn() },
    };
    mocks.chainId = 11155111;
    mocks.ipfsStatus = "success";
    mocks.assessmentUid = ASSESSMENT_UID;
    mocks.assessmentSchema = ASSESSMENT_SCHEMA;
    mocks.progressiveCallback = undefined;
    mocks.saveDraft.mockResolvedValue({ id: "saved-draft" });
    mocks.clearDraft.mockResolvedValue(undefined);
    mocks.peekDraft.mockResolvedValue(null);
    mocks.uploadFile.mockResolvedValue({ cid: "bafy-evidence" });
    mocks.uploadJson
      .mockResolvedValueOnce({ cid: "bafy-metrics" })
      .mockResolvedValueOnce({ cid: "bafy-config" });
    mocks.ensureChain.mockResolvedValue(undefined);
    mocks.readyWalletClient.mockImplementation(async () => mocks.walletClient);
    mocks.getSigner.mockResolvedValue({ address: OPERATOR_ADDRESS });
    mocks.schemaEncode.mockReturnValue("0xencoded-assessment");
    mocks.waitForAttestation.mockResolvedValue(ATTESTATION_UID);
    mocks.easAttest.mockResolvedValue({ wait: mocks.waitForAttestation });
  });

  it.each([
    "wallet",
    "passkey",
  ] as const)("restores an accepted %s assessment and never resends while evidence is unavailable", async (mode) => {
    mocks.authMode = mode;
    const account = mode === "passkey" ? mocks.primaryAddress : OPERATOR_ADDRESS;
    mocks.sender = {
      authMode: mode,
      supportsBatching: false,
      supportsSponsorship: mode === "passkey",
      assertOwnership: mocks.assertOwnership,
      sendContractCall: mocks.send,
    };
    mocks.send.mockResolvedValueOnce({
      hash: "0xSafeProposal",
      sponsored: false,
      confirmation: "pending",
    });
    const client = createTestQueryClient();
    const first = renderWorkflow(client);
    await startReady(first.result);
    await submitAndWaitFor(first.result, "pending");
    expect(mocks.trackFailed).not.toHaveBeenCalled();
    act(() => {
      first.result.current.reset();
      first.result.current.retry();
      first.result.current.submitCreation();
    });
    expect(first.result.current.startCreation(createParams())).toBe(false);
    expect(mocks.send).toHaveBeenCalledOnce();
    const saved = sessionStorage.getItem("green-goods:assessment-submissions")!;
    first.unmount();
    useAssessmentSubmissionStore.setState({ pending: {} });
    sessionStorage.setItem("green-goods:assessment-submissions", saved);
    await useAssessmentSubmissionStore.persist.rehydrate();
    const restored = renderWorkflow(client);
    await waitFor(() => expect(restored.result.current.isPending).toBe(true));
    act(() => restored.result.current.checkConfirmation());
    await waitFor(() => expect(restored.result.current.state.matches("pending")).toBe(true));
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    const txHash = `0x${"66".repeat(32)}` as const;
    mocks.sender!.reconcileBroadcast = vi
      .fn()
      .mockResolvedValue({ status: "confirmed", transactionHash: txHash });
    mocks.getReceipt.mockResolvedValue({
      status: "success",
      transactionHash: txHash,
      logs: [
        {
          address: EAS_ADDRESS,
          topics: encodeEventTopics({
            abi: EASABI,
            eventName: "Attested",
            args: {
              recipient: GARDEN_ID,
              attester: account as `0x${string}`,
              schemaUID: ASSESSMENT_UID as `0x${string}`,
            },
          }),
          data: encodeAbiParameters([{ type: "bytes32" }], [ATTESTATION_UID as `0x${string}`]),
        },
      ],
    });
    act(() => restored.result.current.checkConfirmation());
    await waitFor(() => expect(restored.result.current.state.matches("success")).toBe(true));
    expect(restored.result.current.state.context.txHash).toBe(ATTESTATION_UID);
    expect(mocks.send).toHaveBeenCalledOnce();
    await waitFor(() => expect(mocks.clearDraft).toHaveBeenCalled());
    client.clear();
  });

  it("reconciles a canonical assessment receipt that was initially unavailable", async () => {
    mocks.getReceipt.mockRejectedValueOnce(new Error("RPC unavailable"));
    const client = createTestQueryClient();
    const { result } = renderWorkflow(client);
    await startReady(result);
    await submitAndWaitFor(result, "pending");
    act(() => result.current.checkConfirmation());
    await waitFor(() => expect(result.current.state.matches("success")).toBe(true));
    expect(result.current.state.context.txHash).toBe(ATTESTATION_UID);
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.trackFailed).not.toHaveBeenCalled();
    client.clear();
  });

  it("permits another assessment only after the accepted proposal is confirmed reverted", async () => {
    mocks.send.mockResolvedValueOnce({
      hash: "0xProposal",
      sponsored: false,
      confirmation: "pending",
    });
    const client = createTestQueryClient();
    const { result } = renderWorkflow(client);
    await startReady(result);
    await submitAndWaitFor(result, "pending");
    mocks.sender!.reconcileBroadcast = vi.fn().mockResolvedValue({ status: "reverted" });
    act(() => result.current.checkConfirmation());
    await waitFor(() => expect(result.current.state.matches("error")).toBe(true));
    expect(result.current.state.context.error).toContain("reverted");
    expect(Object.keys(useAssessmentSubmissionStore.getState().pending)).toHaveLength(0);
    expect(mocks.send).toHaveBeenCalledOnce();
    act(() => result.current.reset());
    mocks.uploadJson.mockResolvedValue({ cid: "bafy-retry" });
    await startReady(result);
    await submitAndWaitFor(result, "success");
    expect(mocks.send).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it.each([
    undefined,
    OPERATOR_ADDRESS,
  ])("creates with the passkey smart account even when Wagmi address is %s", async (walletAddress) => {
    mocks.authMode = "passkey";
    mocks.walletAddress = walletAddress;
    const send = vi.fn().mockResolvedValue({ hash: `0x${"66".repeat(32)}`, sponsored: true });
    const assertOwnership = vi.fn();
    mocks.sender = {
      authMode: "passkey",
      supportsBatching: false,
      supportsSponsorship: true,
      sendContractCall: send,
      assertOwnership,
    };
    mocks.getReceipt.mockResolvedValue({
      status: "success",
      logs: [
        {
          address: EAS_ADDRESS,
          topics: encodeEventTopics({
            abi: EASABI,
            eventName: "Attested",
            args: {
              recipient: GARDEN_ID,
              attester: mocks.primaryAddress,
              schemaUID: ASSESSMENT_UID,
            },
          }),
          data: encodeAbiParameters([{ type: "bytes32" }], [ATTESTATION_UID as `0x${string}`]),
        },
      ],
    });
    const queryClient = createTestQueryClient();
    const { result } = renderWorkflow(queryClient);
    await startReady(result);
    await submitAndWaitFor(result, "success");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        account: mocks.primaryAddress,
        chainId: 11155111,
        functionName: "attest",
        address: EAS_ADDRESS,
      }),
      expect.objectContaining({ assertOwnership: expect.any(Function) })
    );
    expect(assertOwnership).toHaveBeenCalledWith(mocks.primaryAddress, 11155111);
    expect(result.current.state.context.txHash).toBe(ATTESTATION_UID);
    expect(mocks.readyWalletClient).not.toHaveBeenCalled();
    expect(mocks.ensureChain).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("retains the draft and refuses uploads while the passkey sender is still connecting", async () => {
    mocks.authMode = "passkey";
    mocks.walletAddress = undefined;
    mocks.sender = null;
    const queryClient = createTestQueryClient();
    const { result } = renderWorkflow(queryClient);
    await startReady(result);
    await submitAndWaitFor(result, "error");
    expect(result.current.state.context.error).toContain("still connecting");
    expect(mocks.uploadJson).not.toHaveBeenCalled();
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    expect(mocks.readyWalletClient).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("reports confirmed execution separately from an unavailable attestation read", async () => {
    mocks.authMode = "passkey";
    mocks.sender = {
      authMode: "passkey",
      supportsBatching: false,
      supportsSponsorship: true,
      assertOwnership: vi.fn(),
      sendContractCall: vi
        .fn()
        .mockResolvedValue({ hash: `0x${"66".repeat(32)}`, sponsored: true }),
    };
    mocks.getReceipt.mockRejectedValueOnce(new Error("RPC request details"));
    const queryClient = createTestQueryClient();
    const { result } = renderWorkflow(queryClient);
    await startReady(result);
    await submitAndWaitFor(result, "pending");
    expect(result.current.state.context.error).toContain("Transaction submitted");
    expect(result.current.canRetry).toBe(false);
    act(() => result.current.retry());
    expect(mocks.sender?.sendContractCall).toHaveBeenCalledOnce();
    expect(result.current.state.context.error).toContain(
      "Check its confirmation before trying again"
    );
    expect(result.current.state.context.error).not.toContain("RPC request details");
    expect(mocks.trackSuccess).not.toHaveBeenCalled();
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("refuses to start when upload storage is unavailable", () => {
    mocks.ipfsStatus = "skipped_no_config";
    const queryClient = createTestQueryClient();
    const { result } = renderWorkflow(queryClient);

    let accepted = true;
    act(() => {
      accepted = result.current.startCreation(createParams());
    });

    expect(accepted).toBe(false);
    expect(result.current.state.matches("idle")).toBe(true);
    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.objectContaining({ context: "assessment submission" })
    );
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    queryClient.clear();
  });

  // The machine validates as it starts, and in its invalid state it ignores the
  // Submit that follows. Answers it refuses must not come back as started.
  it("does not report answers the send refuses as started", () => {
    const queryClient = createTestQueryClient();
    const { result } = renderWorkflow(queryClient);

    let accepted = true;
    act(() => {
      accepted = result.current.startCreation(
        createParams({ startDate: 1_700_086_400, endDate: 1_700_000_000 })
      );
    });

    expect(accepted).toBe(false);
    expect(result.current.state.matches("invalid")).toBe(true);
    expect(mocks.loggerError).toHaveBeenCalled();
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("surfaces a missing steward address before the wallet is asked anything", async () => {
    mocks.walletAddress = undefined;
    const queryClient = createTestQueryClient();
    const { result } = renderWorkflow(queryClient);

    await startReady(result);
    await submitAndWaitFor(result, "error");

    expect(result.current.state.context.error).toBe(
      "Sign in to your account before submitting an assessment."
    );
    expect(result.current.canRetry).toBe(true);
    expect(mocks.ensureChain).not.toHaveBeenCalled();
    expect(mocks.readyWalletClient).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    queryClient.clear();
  });

  // The uploads can run for minutes. A wallet that changed hands meanwhile must
  // not sign what the steward prepared.
  it("does not attest when the signed-in account changes after uploads", async () => {
    mocks.assertOwnership
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Account changed before submission"));
    const queryClient = createTestQueryClient();
    const { result } = renderWorkflow(queryClient);

    await startReady(result);
    await submitAndWaitFor(result, "error");

    expect(result.current.state.context.error).toBe("Account changed before submission");
    expect(mocks.uploadJson).toHaveBeenCalledTimes(2);
    expect(mocks.send).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("rejects submission when the assessment schema identifier is not deployed", async () => {
    mocks.assessmentUid = `0x${"00".repeat(32)}`;
    const queryClient = createTestQueryClient();
    const { result } = renderWorkflow(queryClient);

    await startReady(result);
    await submitAndWaitFor(result, "error");

    expect(result.current.state.context.error).toBe("EAS configuration missing for chain 11155111");
    expect(mocks.trackFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        gardenId: GARDEN_ID,
        error: "EAS configuration missing for chain 11155111",
      })
    );
    expect(mocks.schemaEncode).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("keeps successful evidence uploads, attests in order, clears the draft, and invalidates caches", async () => {
    const goodFile = new File(["good"], "good.jpg", { type: "image/jpeg" });
    const failedFile = new File(["bad"], "bad.jpg", { type: "image/jpeg" });
    mocks.uploadFile.mockImplementation(async (file: File) => {
      if (file.name === "bad.jpg") throw new Error("pinning failed");
      return { cid: "bafy-good-evidence" };
    });
    const params = createParams({ evidenceMedia: [goodFile, failedFile] });
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    const { result } = renderWorkflow(queryClient);

    await startReady(result, params);
    await submitAndWaitFor(result, "success");
    await waitFor(() => expect(mocks.clearDraft).toHaveBeenCalledOnce());
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(3));

    expect(mocks.assertOwnership).toHaveBeenCalledWith(OPERATOR_ADDRESS, 11155111);
    expect(mocks.trackStarted).toHaveBeenCalledWith({
      gardenId: GARDEN_ID,
      assessmentType: "domain-2",
      chainId: 11155111,
    });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "Some evidence media uploads failed",
      expect.objectContaining({ failedCount: 1, totalCount: 2 })
    );
    expect(mocks.toastInfo).toHaveBeenCalledWith(
      expect.objectContaining({ context: "assessment creation" })
    );
    expect(mocks.uploadJson).toHaveBeenNthCalledWith(1, params.metrics);
    expect(mocks.uploadJson).toHaveBeenNthCalledWith(2, {
      assessmentType: "domain-2",
      capitals: ["natural", "social"],
      metricsCid: "bafy-metrics",
      evidenceMediaCids: ["bafy-good-evidence"],
      reportDocuments: ["bafy-report"],
      impactAttestations: [`0x${"ab".repeat(32)}`],
      tags: ["watershed", "restoration"],
    });
    expect(mocks.schemaConstructor).toHaveBeenCalledWith(ASSESSMENT_SCHEMA);
    expect(mocks.schemaEncode).toHaveBeenCalledWith([
      { name: "title", value: params.title, type: "string" },
      { name: "description", value: params.description, type: "string" },
      { name: "assessmentConfigCID", value: "bafy-config", type: "string" },
      { name: "domain", value: 2, type: "uint8" },
      { name: "startDate", value: 1_700_000_000, type: "uint256" },
      { name: "endDate", value: 1_700_086_400, type: "uint256" },
      { name: "location", value: "Portland, OR", type: "string" },
    ]);
    const [beforeUploads, , afterUploads] = mocks.assertOwnership.mock.invocationCallOrder;
    expect(beforeUploads).toBeLessThan(mocks.uploadFile.mock.invocationCallOrder[0]);
    expect(afterUploads).toBeGreaterThan(mocks.uploadJson.mock.invocationCallOrder[1]);
    expect(afterUploads).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        account: OPERATOR_ADDRESS,
        chainId: 11155111,
        address: EAS_ADDRESS,
        functionName: "attest",
        args: [
          {
            schema: ASSESSMENT_UID,
            data: {
              recipient: GARDEN_ID,
              expirationTime: 0n,
              revocable: false,
              refUID: `0x${"00".repeat(32)}`,
              value: 0n,
              data: "0xencoded-assessment",
            },
          },
        ],
      }),
      expect.objectContaining({ assertOwnership: expect.any(Function) })
    );
    expect(mocks.trackSuccess).toHaveBeenCalledWith({
      gardenId: GARDEN_ID,
      assessmentType: "domain-2",
      chainId: 11155111,
      attestationUid: ATTESTATION_UID,
    });
    expect(mocks.assertOwnership.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.trackStarted.mock.invocationCallOrder[0]
    );
    expect(mocks.trackStarted.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.uploadFile.mock.invocationCallOrder[0]
    );
    expect(mocks.schemaEncode.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.send.mock.invocationCallOrder[0]
    );
    expect(mocks.clearDraft).toHaveBeenCalledBefore(mocks.peekDraft);
    expect(invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ["greengoods", "assessments", "byGarden", GARDEN_ID, 11155111],
      ["greengoods", "gardens", 11155111],
      ["greengoods", "gardens", "detail", GARDEN_ID, 11155111],
    ]);
    expect(mocks.scheduleIndexerRefetch).toHaveBeenCalledOnce();
    queryClient.clear();
  });

  it("propagates a metrics upload failure without attesting or clearing the draft", async () => {
    const uploadError = new Error("metrics upload unavailable");
    mocks.uploadJson.mockReset();
    mocks.uploadJson.mockRejectedValueOnce(uploadError);
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    const { result } = renderWorkflow(queryClient);

    await startReady(result);
    await submitAndWaitFor(result, "error");

    expect(result.current.state.context.error).toBe("metrics upload unavailable");
    expect(result.current.canRetry).toBe(true);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "Failed to upload assessment metrics JSON",
      expect.objectContaining({ error: uploadError })
    );
    expect(mocks.trackFailed).toHaveBeenCalledWith(
      expect.objectContaining({ error: "metrics upload unavailable" })
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("exposes attestation errors and retries the same workflow to success", async () => {
    mocks.send.mockRejectedValueOnce(new Error("User rejected signature"));
    mocks.uploadJson
      .mockResolvedValueOnce({ cid: "bafy-retry-metrics" })
      .mockResolvedValueOnce({ cid: "bafy-retry-config" });
    const queryClient = createTestQueryClient();
    const { result } = renderWorkflow(queryClient);

    await startReady(result);
    await submitAndWaitFor(result, "error");

    expect(result.current.state.context.error).toBe("User rejected signature");
    expect(result.current.state.context.retryCount).toBe(1);
    expect(result.current.canRetry).toBe(true);
    expect(mocks.trackFailed).toHaveBeenCalledWith(
      expect.objectContaining({ error: "User rejected signature" })
    );

    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.state.matches("success")).toBe(true));
    await waitFor(() => expect(mocks.clearDraft).toHaveBeenCalledOnce());

    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.trackStarted).toHaveBeenCalledTimes(2);
    expect(mocks.trackSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ attestationUid: ATTESTATION_UID })
    );
    expect(mocks.saveDraft).toHaveBeenCalledOnce();
    queryClient.clear();
  });
});

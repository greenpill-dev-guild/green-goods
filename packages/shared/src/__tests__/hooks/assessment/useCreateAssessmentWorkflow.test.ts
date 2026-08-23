/**
 * @vitest-environment jsdom
 */

import { QueryClient } from "@tanstack/react-query";
import { act, createTestWrapper, renderHook, waitFor } from "@green-goods/shared/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssessmentWorkflowParams } from "../../../types/domain";

const GARDEN_ID = "0x1111111111111111111111111111111111111111" as const;
const OPERATOR_ADDRESS = "0x2222222222222222222222222222222222222222" as const;
const EAS_ADDRESS = "0x3333333333333333333333333333333333333333";
const ASSESSMENT_UID = `0x${"44".repeat(32)}`;
const ATTESTATION_UID = `0x${"55".repeat(32)}`;
const ASSESSMENT_SCHEMA =
  "string title,string description,string assessmentConfigCID,uint8 domain,uint256 startDate,uint256 endDate,string location";

const mocks = vi.hoisted(() => ({
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
  ensureChain: vi.fn(),
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

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: mocks.walletAddress }),
  useWalletClient: () => ({ data: mocks.walletClient }),
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

vi.mock("../../../modules/data/ipfs", () => ({
  getIpfsInitStatus: () => ({ status: mocks.ipfsStatus }),
  uploadFileToIPFS: mocks.uploadFile,
  uploadJSONToIPFS: mocks.uploadJson,
}));

vi.mock("../../../modules/transactions/chain-guard", () => ({
  ensureAppKitWalletChain: mocks.ensureChain,
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

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({ eas: EAS_ADDRESS }),
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWorkflow(queryClient: QueryClient) {
  return renderHook(() => useCreateAssessmentWorkflow({ gardenId: GARDEN_ID }), {
    wrapper: createTestWrapper(queryClient),
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
  expectedState: "success" | "error"
) {
  act(() => {
    result.current.submitCreation();
  });
  await waitFor(() => expect(result.current.state.matches(expectedState)).toBe(true));
}

describe("useCreateAssessmentWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.getSigner.mockResolvedValue({ address: OPERATOR_ADDRESS });
    mocks.schemaEncode.mockReturnValue("0xencoded-assessment");
    mocks.waitForAttestation.mockResolvedValue(ATTESTATION_UID);
    mocks.easAttest.mockResolvedValue({ wait: mocks.waitForAttestation });
  });

  it("refuses to start when upload storage is unavailable", () => {
    mocks.ipfsStatus = "skipped_no_config";
    const queryClient = createQueryClient();
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
    expect(mocks.easAttest).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it.each([
    {
      name: "steward address",
      prepare: () => {
        mocks.walletAddress = undefined;
      },
      error: "Wallet not connected",
    },
    {
      name: "wallet client",
      prepare: () => {
        mocks.walletClient = undefined;
      },
      error: "No wallet client available",
    },
  ])("surfaces a missing $name prerequisite", async ({ prepare, error }) => {
    prepare();
    const queryClient = createQueryClient();
    const { result } = renderWorkflow(queryClient);

    await startReady(result);
    await submitAndWaitFor(result, "error");

    expect(result.current.state.context.error).toBe(error);
    expect(result.current.canRetry).toBe(true);
    expect(mocks.ensureChain).not.toHaveBeenCalled();
    expect(mocks.easAttest).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("rejects submission when the assessment schema identifier is not deployed", async () => {
    mocks.assessmentUid = `0x${"00".repeat(32)}`;
    const queryClient = createQueryClient();
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
    expect(mocks.easAttest).not.toHaveBeenCalled();
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
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    const { result } = renderWorkflow(queryClient);

    await startReady(result, params);
    await submitAndWaitFor(result, "success");
    await waitFor(() => expect(mocks.clearDraft).toHaveBeenCalledOnce());
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(3));

    expect(mocks.ensureChain).toHaveBeenCalledWith(11155111);
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
    expect(mocks.easConstructor).toHaveBeenCalledWith(EAS_ADDRESS);
    expect(mocks.easConnect).toHaveBeenCalledWith({ address: OPERATOR_ADDRESS });
    expect(mocks.easAttest).toHaveBeenCalledWith({
      schema: ASSESSMENT_UID,
      data: {
        recipient: GARDEN_ID,
        expirationTime: 0n,
        revocable: false,
        data: "0xencoded-assessment",
      },
    });
    expect(mocks.trackSuccess).toHaveBeenCalledWith({
      gardenId: GARDEN_ID,
      assessmentType: "domain-2",
      chainId: 11155111,
      attestationUid: ATTESTATION_UID,
    });
    expect(mocks.ensureChain.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.trackStarted.mock.invocationCallOrder[0]
    );
    expect(mocks.trackStarted.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.uploadFile.mock.invocationCallOrder[0]
    );
    expect(mocks.schemaEncode.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.easAttest.mock.invocationCallOrder[0]
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
    const queryClient = createQueryClient();
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
    expect(mocks.easAttest).not.toHaveBeenCalled();
    expect(mocks.clearDraft).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it("exposes attestation errors and retries the same workflow to success", async () => {
    mocks.waitForAttestation
      .mockRejectedValueOnce(new Error("User rejected signature"))
      .mockResolvedValueOnce(ATTESTATION_UID);
    mocks.uploadJson
      .mockResolvedValueOnce({ cid: "bafy-retry-metrics" })
      .mockResolvedValueOnce({ cid: "bafy-retry-config" });
    const queryClient = createQueryClient();
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

    expect(mocks.easAttest).toHaveBeenCalledTimes(2);
    expect(mocks.trackStarted).toHaveBeenCalledTimes(2);
    expect(mocks.trackSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ attestationUid: ATTESTATION_UID })
    );
    expect(mocks.saveDraft).toHaveBeenCalledOnce();
    queryClient.clear();
  });
});

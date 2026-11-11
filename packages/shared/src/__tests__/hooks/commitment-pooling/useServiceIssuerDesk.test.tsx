import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useServiceIssuerDesk } from "../../../hooks/commitment-pooling/useServiceIssuerDesk";
import { createTestQueryClient } from "../../test-utils/query-client";
import { issuerDeskFixture } from "../../fixtures/issuer-desk";
import { logger } from "../../../modules/app/logger";
import {
  decodeServiceIssuerDesk,
  encodeServiceIssuerDesk,
} from "../../../modules/commitment-pooling/service-issuer-desk-protocol";
import type { ServiceIssuerDeskCommand } from "../../../public-contracts/service-issuer-desk";
import type { TransactionSender } from "../../../modules/transactions/types";

const mocks = vi.hoisted(() => ({
  user: {
    primaryAddress: "0x1111111111111111111111111111111111111111",
    authMode: "wallet",
    passkeyAccountProfile: null,
  },
  sender: null as TransactionSender | null,
  sign: vi.fn(async () => "0x1234"),
}));
vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => mocks.user }));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));
vi.mock("../../../modules/commitment-pooling/service-issuer-chain", () => ({
  serviceIssuerChain: { code: async () => "0x" },
}));
vi.mock("wagmi", () => ({ useSignMessage: () => ({ signMessageAsync: mocks.sign }) }));
function fixture() {
  const owner = privateKeyToAccount(generatePrivateKey());
  mocks.user.primaryAddress = owner.address;
  const record = issuerDeskFixture(owner.address);
  const sender: TransactionSender = {
    authMode: "wallet",
    supportsBatching: false,
    supportsSponsorship: false,
    assertOwnership: vi.fn(),
    sendContractCall: vi.fn(),
    signTypedData: vi.fn(async ({ data }) => owner.signTypedData(data)),
  };
  mocks.sender = sender;
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, request) => {
    const command = decodeServiceIssuerDesk(
      JSON.parse(request!.body as string).command
    ) as ServiceIssuerDeskCommand;
    return Response.json({
      ok: true,
      payload: encodeServiceIssuerDesk(
        command.action === "list"
          ? { ok: true, records: [record] }
          : {
              ok: true,
              record:
                command.action === "approve"
                  ? { ...record, revision: 2, approval: command.approval }
                  : record,
            }
      ),
    });
  });
  vi.stubGlobal("fetch", fetch);
  const cache = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  );
  return { record, sender, fetch, wrapper };
}
beforeEach(() => mocks.sign.mockReset().mockResolvedValue("0x1234"));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("member issuer desk hook", () => {
  it("loads only on explicit request and presents a durable member receipt", async () => {
    const f = fixture();
    const { result } = renderHook(() => useServiceIssuerDesk(), f);
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
    expect(result.current.loaded).toBe(false);
    await act(async () => {
      await result.current.load.mutateAsync();
    });
    await waitFor(() => expect(result.current.records).toEqual([f.record]));
    expect(result.current.canSign).toBe(true);
  });
  it("rechecks the saved revision before asking for a typed approval", async () => {
    const f = fixture();
    vi.spyOn(logger, "error").mockImplementation(() => {});
    f.fetch.mockResolvedValueOnce(
      Response.json({
        ok: true,
        payload: encodeServiceIssuerDesk({ ok: true, record: { ...f.record, revision: 5 } }),
      })
    );
    const { result } = renderHook(() => useServiceIssuerDesk(), f);
    await act(async () => {
      await expect(result.current.approve.mutateAsync(f.record)).rejects.toThrow("Draft changed");
    });
    expect(f.sender.signTypedData).not.toHaveBeenCalled();
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
  });
  it("signs and stores exact approval without deploying or sending a token transaction", async () => {
    const f = fixture();
    const { result } = renderHook(() => useServiceIssuerDesk(), f);
    await act(async () => {
      await result.current.approve.mutateAsync(f.record);
    });
    expect(f.sender.signTypedData).toHaveBeenCalledOnce();
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(result.current.records[0].approval?.member).toBe(f.record.draft.member)
    );
    expect(result.current.records[0].revision).toBe(2);
  });
  it("surfaces a rejected approval without caching an optimistic signed record", async () => {
    const f = fixture();
    const log = vi.spyOn(logger, "error").mockImplementation(() => {});
    const fetch = f.fetch.getMockImplementation()!;
    f.fetch.mockImplementation(async (url, request) => {
      const command = decodeServiceIssuerDesk(
        JSON.parse(request!.body as string).command
      ) as ServiceIssuerDeskCommand;
      return command.action === "approve"
        ? Response.json({ ok: false, errorCode: "revision_conflict" }, { status: 409 })
        : fetch(url, request);
    });
    const { result } = renderHook(() => useServiceIssuerDesk(), f);
    await act(async () => {
      await expect(result.current.approve.mutateAsync(f.record)).rejects.toThrow(
        "revision_conflict"
      );
    });
    await waitFor(() => expect(result.current.approve.isError).toBe(true));
    expect(log).toHaveBeenCalled();
    expect(result.current.records).toEqual([]);
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
  });
});

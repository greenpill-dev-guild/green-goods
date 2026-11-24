/** @vitest-environment happy-dom */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../types/domain";
import { AuthStateContext, type AuthStateValue } from "../../providers/authContext";
import { createTestWrapper } from "../test-utils/render-helpers";

const hooks = vi.hoisted(() => ({ protocol: vi.fn(), ens: vi.fn() }));
vi.mock("../../hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: hooks.protocol,
}));
vi.mock("../../hooks/blockchain/useEnsName", () => ({ useEnsName: hooks.ens }));

import { AddressDisplay } from "../../components/AddressDisplay";

const first = "0x1111111111111111111111111111111111111111" as Address;
const second = "0x2222222222222222222222222222222222222222" as Address;

describe("AddressDisplay protocol identity", () => {
  beforeEach(() => {
    hooks.protocol.mockReset().mockReturnValue({ data: null });
    hooks.ens.mockReset().mockReturnValue({ data: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("loads stored passkey names for public rows with no ENS and batches the requested addresses", async () => {
    vi.stubEnv("VITE_PASSKEY_SERVER_ENABLED", "true");
    vi.stubEnv("VITE_API_BASE_URL", "https://agent.example");
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({ jsonrpc: "2.0", id: 1, result: ["maya", null] })
      );
    try {
      render(
        <>
          <AddressDisplay address={first} interactive={false} />
          <AddressDisplay address={second} interactive={false} />
        </>,
        { wrapper: createTestWrapper() }
      );

      expect(await screen.findByText("maya")).toBeInTheDocument();
      expect(screen.getByTitle(second)).toHaveTextContent("0x22...222");
      expect(request).toHaveBeenCalledTimes(1);
      expect(JSON.parse(request.mock.calls[0]?.[1]?.body as string)).toMatchObject({
        method: "pks_getDisplayNames",
        params: [{ addresses: [first, second] }],
      });
    } finally {
      request.mockRestore();
    }
  });

  it("keeps ENS as the label without querying the passkey directory", async () => {
    vi.stubEnv("VITE_PASSKEY_SERVER_ENABLED", "true");
    const request = vi.spyOn(globalThis, "fetch");
    try {
      hooks.ens.mockReturnValue({ data: "maya.eth" });
      render(<AddressDisplay address={first} interactive={false} />, {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(screen.getByText("maya.eth")).toBeInTheDocument());
      expect(request).not.toHaveBeenCalled();
    } finally {
      request.mockRestore();
    }
  });

  it("prefers the viewed account's registered protocol name over generic ENS", () => {
    hooks.protocol.mockImplementation((address: Address) => ({
      data: address === first ? "river.greengoods.eth" : "forest.greengoods.eth",
    }));
    hooks.ens.mockReturnValue({ data: "other.eth" });

    const { rerender } = render(<AddressDisplay address={first} interactive={false} />, {
      wrapper: createTestWrapper(),
    });
    expect(screen.getByText("river")).toBeInTheDocument();
    // A display on its own reads its name on its own; a list's rows read theirs in a batch.
    expect(hooks.protocol).toHaveBeenCalledWith(first, { list: false });

    rerender(<AddressDisplay address={second} interactive={false} />);
    expect(screen.getByText("forest")).toBeInTheDocument();
    expect(screen.queryByText("river")).not.toBeInTheDocument();
  });

  it("uses generic ENS while protocol registration is absent", () => {
    hooks.ens.mockReturnValue({ data: "ordinary.eth" });
    render(<AddressDisplay address={first} interactive={false} />, {
      wrapper: createTestWrapper(),
    });
    expect(screen.getByText("ordinary.eth")).toBeInTheDocument();
  });

  it("keeps the address when neither name is registered", () => {
    render(<AddressDisplay address={second} interactive={false} />, {
      wrapper: createTestWrapper(),
    });
    expect(screen.getByTitle(second)).toHaveTextContent("0x22...222");
  });

  it("uses the signed-in passkey name only for the account it belongs to", () => {
    const state = {
      authMode: "passkey",
      isAuthenticated: true,
      userName: "maya",
      smartAccountAddress: first,
    } as AuthStateValue;
    const { rerender } = render(
      <AuthStateContext.Provider value={state}>
        <AddressDisplay address={first} interactive={false} />
        <AddressDisplay address={second} interactive={false} />
      </AuthStateContext.Provider>,
      { wrapper: createTestWrapper() }
    );
    expect(screen.getByText("maya")).toBeInTheDocument();
    expect(screen.getByTitle(second)).toHaveTextContent("0x22...222");

    hooks.ens.mockReturnValue({ data: "maya.eth" });
    rerender(
      <AuthStateContext.Provider value={state}>
        <AddressDisplay address={first} interactive={false} />
      </AuthStateContext.Provider>
    );
    expect(screen.getByText("maya.eth")).toBeInTheDocument();
    expect(screen.queryByText("maya")).not.toBeInTheDocument();
  });

  it("keeps generic ENS visible when the protocol lookup fails", () => {
    hooks.protocol.mockReturnValue({ data: null, isError: true });
    hooks.ens.mockReturnValue({ data: "ordinary.eth" });
    render(<AddressDisplay address={first} interactive={false} />, {
      wrapper: createTestWrapper(),
    });
    expect(screen.getByText("ordinary.eth")).toBeInTheDocument();
  });

  it("hands the name it resolves to a caller that renders it, with no popover or copy", () => {
    hooks.protocol.mockReturnValue({ data: "river.greengoods.eth" });
    hooks.ens.mockReturnValue({ data: "other.eth" });
    render(
      <AddressDisplay address={first}>{(name) => <h3>{`Row for ${name}`}</h3>}</AddressDisplay>,
      { wrapper: createTestWrapper() }
    );
    expect(screen.getByRole("heading")).toHaveTextContent("Row for river");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses a public role label until the account has a name", () => {
    const { rerender } = render(
      <AddressDisplay address={first} interactive={false} fallbackLabel="Garden participant" />,
      { wrapper: createTestWrapper() }
    );
    expect(screen.getByText("Garden participant")).toHaveAttribute("title", first);
    hooks.protocol.mockReturnValue({ data: "river.greengoods.eth" });
    rerender(
      <AddressDisplay address={first} interactive={false} fallbackLabel="Garden participant" />
    );
    expect(screen.getByText("river")).toBeInTheDocument();
    expect(screen.queryByText("Garden participant")).not.toBeInTheDocument();
  });
});

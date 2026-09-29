/** @vitest-environment happy-dom */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../types/domain";
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

  it("prefers the viewed account's registered protocol name over generic ENS", () => {
    hooks.protocol.mockImplementation((address: Address) => ({
      data: address === first ? "river.greengoods.eth" : "forest.greengoods.eth",
    }));
    hooks.ens.mockReturnValue({ data: "other.eth" });

    const { rerender } = render(<AddressDisplay address={first} interactive={false} />, {
      wrapper: createTestWrapper(),
    });
    expect(screen.getByText("river")).toBeInTheDocument();
    expect(hooks.protocol).toHaveBeenCalledWith(first);

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

  it("keeps generic ENS visible when the protocol lookup fails", () => {
    hooks.protocol.mockReturnValue({ data: null, isError: true });
    hooks.ens.mockReturnValue({ data: "ordinary.eth" });
    render(<AddressDisplay address={first} interactive={false} />, {
      wrapper: createTestWrapper(),
    });
    expect(screen.getByText("ordinary.eth")).toBeInTheDocument();
  });
});

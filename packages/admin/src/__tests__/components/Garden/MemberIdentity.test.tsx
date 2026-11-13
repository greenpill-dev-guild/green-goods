import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberIdentity } from "../../../components/Garden/MemberIdentity";
import { renderWithProviders as render } from "../../test-utils";

vi.mock("@green-goods/shared/components/AddressDisplay", () => ({
  AddressDisplay: ({ children }: { children: (name: string) => unknown }) => children("rosa.eth"),
}));
const address = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";

describe("MemberIdentity", () => {
  const write = vi.fn();
  beforeEach(() => {
    write.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: write },
    });
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  });

  it("keeps the full address beside a visible labeled copy action", () => {
    render(<MemberIdentity address={address} />);
    expect(screen.getByText(address)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Address" })).toHaveTextContent("Copy Address");
  });

  it("copies the account address rather than its resolved name and confirms success", async () => {
    render(<MemberIdentity address={address} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Address" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument());
    expect(write).toHaveBeenCalledWith(address);
    expect(screen.getByRole("status")).toHaveTextContent("Address copied");
  });

  it("shows copy failure without claiming success and allows retry", async () => {
    write.mockRejectedValueOnce(new Error("clipboard denied"));
    render(<MemberIdentity address={address} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Address" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy");
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy Address" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("clears copy feedback when the displayed account changes", async () => {
    const { rerender } = render(<MemberIdentity address={address} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Address" }));
    await screen.findByRole("button", { name: "Copied" });
    rerender(<MemberIdentity address={other} />);
    expect(await screen.findByRole("button", { name: "Copy Address" })).toBeInTheDocument();
    expect(screen.getByText(other)).toBeInTheDocument();
  });
});

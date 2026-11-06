/**
 * PersonRow Tests
 * @vitest-environment happy-dom
 *
 * A person row names someone the way the shared address display does, shows their highest
 * role as its one chip, and leads with their photo, the surface's own picture or a glyph, which
 * also holds the circle while the photo is still being looked up. Layout is measured in a real
 * browser by the PersonRow stories.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";
import { createTestWrapper } from "../../test-utils/render-helpers";

const hooks = vi.hoisted(() => ({ protocol: vi.fn(), ens: vi.fn(), avatar: vi.fn() }));
vi.mock("../../../hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: hooks.protocol,
}));
vi.mock("../../../hooks/blockchain/useEnsName", () => ({ useEnsName: hooks.ens }));
vi.mock("../../../hooks/profile/useProfileAvatar", () => ({
  useResolvedProfileAvatar: hooks.avatar,
}));

import { PersonRow } from "../../../components/Cards/PersonRow/PersonRow";

const person = "0x1111111111111111111111111111111111111111" as Address;

const renderRow = (props: Partial<Parameters<typeof PersonRow>[0]> = {}) =>
  render(<PersonRow address={person} {...props} />, { wrapper: createTestWrapper() });

describe("PersonRow", () => {
  beforeEach(() => {
    hooks.protocol.mockReset().mockReturnValue({ data: null });
    hooks.ens.mockReset().mockReturnValue({ data: null });
    hooks.avatar.mockReset().mockReturnValue({ avatarUri: null, isLoading: false });
  });

  it("names the person as the address display does and shows only their highest role", () => {
    hooks.protocol.mockReturnValue({ data: "river.greengoods.eth" });
    hooks.ens.mockReturnValue({ data: "other.eth" });
    renderRow({ roles: ["gardener", "owner", "steward"], details: ["3 roles"], onOpen: vi.fn() });

    expect(screen.getByRole("button")).toHaveAccessibleName(/^river\s*Owner\s*3 roles$/);
    // A list's rows read their Green Goods names together, in one batch.
    expect(hooks.protocol).toHaveBeenCalledWith(person, { list: true });
  });

  it("shows no chip for someone the list holds no role for, as a pasted address", () => {
    renderRow({ onOpen: vi.fn() });

    expect(screen.getByRole("button")).toHaveAccessibleName("0x11...111");
  });

  it("reads a name the person never published from the caller, then their short address", () => {
    const { rerender } = renderRow({ fallbackName: "Member 7" });
    expect(screen.getByText("Member 7")).toBeInTheDocument();

    rerender(<PersonRow address={person} />);
    expect(screen.getByText("0x11...111")).toBeInTheDocument();
  });

  it("leads with their photo, the surface's picture or a glyph, never a blank while it loads", () => {
    hooks.avatar.mockReturnValue({ avatarUri: "/images/avatar.png", isLoading: false });
    const { container, rerender } = renderRow({
      fallbackAvatar: "/images/avatar.png",
      chainId: 42161,
    });
    expect(container.querySelector("img")).toHaveAttribute("src", "/images/avatar.png");
    // A list's rows read their photos together, on the batch route.
    expect(hooks.avatar).toHaveBeenCalledWith(person, "/images/avatar.png", 42161, { list: true });

    // A photo still downloading keeps the surface's picture behind it until it has loaded.
    const photo = "https://images.example/photo.webp";
    const sources = () =>
      [...container.querySelectorAll(".gg-item-row-avatar img")].map((img) =>
        img.getAttribute("src")
      );
    hooks.avatar.mockReturnValue({ avatarUri: photo, isLoading: false });
    rerender(<PersonRow address={person} fallbackAvatar="/images/avatar.png" />);
    expect(sources()).toEqual(["/images/avatar.png", photo]);
    fireEvent.load(container.querySelector(`img[src="${photo}"]`) as HTMLImageElement);
    expect(sources()).toEqual([photo]);

    const avatar = () => container.querySelector(".gg-item-row-avatar");
    hooks.avatar.mockReturnValue({ avatarUri: null, isLoading: false });
    rerender(<PersonRow address={person} />);
    expect(container.querySelector("img")).toBeNull();
    expect(avatar()?.querySelector("svg")).not.toBeNull();

    // A photo still being looked up keeps the glyph, as in the cockpit, never an empty circle.
    hooks.avatar.mockReturnValue({ avatarUri: null, isLoading: true });
    rerender(<PersonRow address={person} />);
    expect(avatar()?.querySelector("svg")).not.toBeNull();
  });
});

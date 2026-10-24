/**
 * PersonRow Tests
 * @vitest-environment happy-dom
 *
 * A person row names someone the way the shared address display does, shows their highest
 * role as its one chip, and leads with their photo, the surface's own picture, a glyph, or
 * nothing while the photo is still being looked up. Layout is measured in a real browser by
 * the PersonRow stories.
 */

import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";

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
const messages = {
  "app.roles.owner": "Owner",
  "app.roles.steward": "Steward",
  "app.roles.gardener": "Gardener",
};

const renderRow = (props: Partial<Parameters<typeof PersonRow>[0]> = {}) =>
  render(
    <IntlProvider locale="en" messages={messages}>
      <PersonRow address={person} {...props} />
    </IntlProvider>
  );

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
  });

  it("shows no chip for someone the list holds no role for, as a pasted address", () => {
    renderRow({ onOpen: vi.fn() });

    expect(screen.getByRole("button")).toHaveAccessibleName("0x11...111");
  });

  it("reads a name the person never published from the caller, then their short address", () => {
    const { rerender } = renderRow({ fallbackName: "Member 7" });
    expect(screen.getByText("Member 7")).toBeInTheDocument();

    rerender(
      <IntlProvider locale="en" messages={messages}>
        <PersonRow address={person} />
      </IntlProvider>
    );
    expect(screen.getByText("0x11...111")).toBeInTheDocument();
  });

  it("leads with their photo, the surface's picture, a glyph, or nothing while it loads", () => {
    hooks.avatar.mockReturnValue({ avatarUri: "/images/avatar.png", isLoading: false });
    const { container, rerender } = renderRow({
      fallbackAvatar: "/images/avatar.png",
      chainId: 42161,
    });
    expect(container.querySelector("img")).toHaveAttribute("src", "/images/avatar.png");
    // A list's rows read their photos together, on the batch route.
    expect(hooks.avatar).toHaveBeenCalledWith(person, "/images/avatar.png", 42161, { list: true });

    const avatar = () => container.querySelector(".gg-item-row-avatar");
    hooks.avatar.mockReturnValue({ avatarUri: null, isLoading: false });
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <PersonRow address={person} />
      </IntlProvider>
    );
    expect(container.querySelector("img")).toBeNull();
    expect(avatar()?.querySelector("svg")).not.toBeNull();

    hooks.avatar.mockReturnValue({ avatarUri: null, isLoading: true });
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <PersonRow address={person} />
      </IntlProvider>
    );
    expect(avatar()).toBeEmptyDOMElement();
  });
});

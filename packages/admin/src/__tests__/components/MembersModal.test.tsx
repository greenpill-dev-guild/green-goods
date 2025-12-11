/**
 * MembersModal Component Tests
 *
 * Tests for the garden members modal component.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock AddressDisplay component
vi.mock("../AddressDisplay", () => ({
  AddressDisplay: ({ address, className }: { address: string; className?: string }) =>
    createElement("span", { className, "data-testid": "address-display" }, address.slice(0, 10)),
}));

import { MembersModal } from "../../components/Garden/MembersModal";

describe("components/Garden/MembersModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: "Garden Members",
    members: ["0xMember1", "0xMember2", "0xMember3"],
    canManage: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset body overflow
    document.body.style.overflow = "";
  });

  describe("rendering", () => {
    it("renders when isOpen is true", () => {
      render(createElement(MembersModal, defaultProps));

      expect(screen.getByText("Garden Members")).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      render(createElement(MembersModal, { ...defaultProps, isOpen: false }));

      expect(screen.queryByText("Garden Members")).not.toBeInTheDocument();
    });

    it("shows member count", () => {
      render(createElement(MembersModal, defaultProps));

      expect(screen.getByText("3 members")).toBeInTheDocument();
    });

    it("shows singular 'member' for single member", () => {
      render(createElement(MembersModal, { ...defaultProps, members: ["0xSingle"] }));

      expect(screen.getByText("1 member")).toBeInTheDocument();
    });

    it("displays all members", () => {
      render(createElement(MembersModal, defaultProps));

      const addressDisplays = screen.getAllByTestId("address-display");
      expect(addressDisplays).toHaveLength(3);
    });
  });

  describe("empty state", () => {
    it("shows empty message when no members", () => {
      render(createElement(MembersModal, { ...defaultProps, members: [] }));

      expect(screen.getByText("No members found")).toBeInTheDocument();
    });

    it("shows 0 members count", () => {
      render(createElement(MembersModal, { ...defaultProps, members: [] }));

      expect(screen.getByText("0 members")).toBeInTheDocument();
    });
  });

  describe("close functionality", () => {
    it("calls onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(createElement(MembersModal, { ...defaultProps, onClose }));

      await user.click(screen.getByLabelText("Close modal"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when backdrop is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(createElement(MembersModal, { ...defaultProps, onClose }));

      // Click the backdrop (the dialog container)
      const dialog = screen.getByRole("dialog");
      await user.click(dialog);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape key is pressed", () => {
      const onClose = vi.fn();

      render(createElement(MembersModal, { ...defaultProps, onClose }));

      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("member management", () => {
    it("shows remove buttons when canManage is true", () => {
      const onRemove = vi.fn();

      render(
        createElement(MembersModal, {
          ...defaultProps,
          canManage: true,
          onRemove,
        })
      );

      const removeButtons = screen.getAllByLabelText(/Remove/);
      expect(removeButtons).toHaveLength(3);
    });

    it("does not show remove buttons when canManage is false", () => {
      render(createElement(MembersModal, defaultProps));

      expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument();
    });

    it("calls onRemove with member address when remove button clicked", async () => {
      const onRemove = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        createElement(MembersModal, {
          ...defaultProps,
          canManage: true,
          onRemove,
        })
      );

      const removeButtons = screen.getAllByLabelText(/Remove/);
      await user.click(removeButtons[0]);

      expect(onRemove).toHaveBeenCalledWith("0xMember1");
    });

    it("disables remove buttons when isLoading is true", () => {
      const onRemove = vi.fn();

      render(
        createElement(MembersModal, {
          ...defaultProps,
          canManage: true,
          onRemove,
          isLoading: true,
        })
      );

      const removeButtons = screen.getAllByLabelText(/Remove/);
      removeButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe("color schemes", () => {
    it("applies blue color scheme by default", () => {
      const { container } = render(createElement(MembersModal, defaultProps));

      // Check for blue-related classes
      expect(container.querySelector(".bg-information-lighter")).toBeInTheDocument();
    });

    it("applies green color scheme when specified", () => {
      const { container } = render(
        createElement(MembersModal, { ...defaultProps, colorScheme: "green" })
      );

      expect(container.querySelector(".bg-success-lighter")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(createElement(MembersModal, defaultProps));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "members-modal-title");
    });

    it("prevents body scroll when open", () => {
      render(createElement(MembersModal, defaultProps));

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when closed", () => {
      const { rerender } = render(createElement(MembersModal, defaultProps));

      expect(document.body.style.overflow).toBe("hidden");

      rerender(createElement(MembersModal, { ...defaultProps, isOpen: false }));

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("custom icon", () => {
    it("renders custom icon when provided", () => {
      const customIcon = createElement("span", { "data-testid": "custom-icon" }, "🌱");

      render(createElement(MembersModal, { ...defaultProps, icon: customIcon }));

      expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });
  });
});

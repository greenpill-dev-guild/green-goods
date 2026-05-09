/**
 * DraftDialog Component Tests
 *
 * Tests the draft resume dialog that asks users whether to continue
 * a previous work submission or start fresh.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: (descriptor: { defaultMessage?: string }, values?: Record<string, unknown>) => {
      let msg = descriptor.defaultMessage ?? "";
      if (values) {
        for (const [key, val] of Object.entries(values)) {
          msg = msg.replace(`{${key}}`, String(val));
        }
      }
      return msg;
    },
  }),
}));

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/Actions", () => ({
  Button: ({ label, onClick }: { label: string; onClick?: () => void }) =>
    createElement("button", { onClick, type: "button" }, label),
}));

import { DraftDialog } from "../../components/Dialogs/DraftDialog";

describe("DraftDialog", () => {
  const defaultProps = {
    isOpen: true,
    onContinue: vi.fn(),
    onStartFresh: vi.fn(),
    imageCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders when isOpen is true", () => {
      render(createElement(DraftDialog, defaultProps));

      expect(screen.getByText("Continue Previous Work?")).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      render(createElement(DraftDialog, { ...defaultProps, isOpen: false }));

      expect(screen.queryByText("Continue Previous Work?")).not.toBeInTheDocument();
    });

    it("shows description without image info when imageCount is 0", () => {
      render(createElement(DraftDialog, defaultProps));

      expect(
        screen.getByText(
          "You have an unfinished work submission. Would you like to continue where you left off?"
        )
      ).toBeInTheDocument();
    });

    it("shows description with singular image info when imageCount is 1", () => {
      render(createElement(DraftDialog, { ...defaultProps, imageCount: 1 }));

      expect(screen.getByText(/with 1 image/)).toBeInTheDocument();
    });

    it("shows description with plural image info when imageCount > 1", () => {
      render(createElement(DraftDialog, { ...defaultProps, imageCount: 3 }));

      expect(screen.getByText(/with 3 images/)).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("shows Continue Draft button", () => {
      render(createElement(DraftDialog, defaultProps));

      expect(screen.getByText("Continue Draft")).toBeInTheDocument();
    });

    it("shows Start Fresh button", () => {
      render(createElement(DraftDialog, defaultProps));

      expect(screen.getByText("Start Fresh")).toBeInTheDocument();
    });

    it("calls onContinue when Continue Draft is clicked", async () => {
      const onContinue = vi.fn();
      const user = userEvent.setup();

      render(createElement(DraftDialog, { ...defaultProps, onContinue }));

      await user.click(screen.getByText("Continue Draft"));
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it("calls onStartFresh when Start Fresh is clicked", async () => {
      const onStartFresh = vi.fn();
      const user = userEvent.setup();

      render(createElement(DraftDialog, { ...defaultProps, onStartFresh }));

      await user.click(screen.getByText("Start Fresh"));
      expect(onStartFresh).toHaveBeenCalledTimes(1);
    });
  });

  describe("close behavior", () => {
    it("has a close button", () => {
      render(createElement(DraftDialog, defaultProps));

      expect(screen.getByLabelText("Close")).toBeInTheDocument();
    });

    it("calls onContinue when close button is clicked (default dismissal)", async () => {
      const onContinue = vi.fn();
      const user = userEvent.setup();

      render(createElement(DraftDialog, { ...defaultProps, onContinue }));

      await user.click(screen.getByLabelText("Close"));
      expect(onContinue).toHaveBeenCalledTimes(1);
    });
  });
});

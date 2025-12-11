/**
 * FormWizard Component Tests
 *
 * Tests for the multi-step form wizard component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("./StepIndicator", () => ({
  StepIndicator: ({ steps, currentStep }: { steps: any[]; currentStep: number }) =>
    createElement(
      "div",
      { "data-testid": "step-indicator" },
      `Step ${currentStep + 1} of ${steps.length}`
    ),
}));

import { FormWizard } from "../../components/Form/FormWizard";

describe("components/Form/FormWizard", () => {
  const mockSteps = [
    { id: "details", label: "Details" },
    { id: "team", label: "Team" },
    { id: "review", label: "Review" },
  ];

  const defaultProps = {
    steps: mockSteps,
    currentStep: 0,
    onCancel: vi.fn(),
    children: createElement("div", null, "Step Content"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders step indicator", () => {
      render(createElement(FormWizard, defaultProps));

      expect(screen.getByTestId("step-indicator")).toBeInTheDocument();
      expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    });

    it("renders children content", () => {
      render(createElement(FormWizard, defaultProps));

      expect(screen.getByText("Step Content")).toBeInTheDocument();
    });

    it("shows Cancel button", () => {
      render(createElement(FormWizard, defaultProps));

      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  describe("first step behavior", () => {
    it("does not show Back button on first step", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 0,
          onBack: vi.fn(),
        })
      );

      expect(screen.queryByText("Back")).not.toBeInTheDocument();
    });

    it("shows Continue button on first step", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 0,
          onNext: vi.fn(),
        })
      );

      expect(screen.getByText("Continue")).toBeInTheDocument();
    });

    it("does not show Submit button on first step", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 0,
          onSubmit: vi.fn(),
        })
      );

      expect(screen.queryByText("Submit")).not.toBeInTheDocument();
    });
  });

  describe("middle step behavior", () => {
    it("shows Back button on middle step", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 1,
          onBack: vi.fn(),
        })
      );

      expect(screen.getByText("Back")).toBeInTheDocument();
    });

    it("shows Continue button on middle step", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 1,
          onNext: vi.fn(),
        })
      );

      expect(screen.getByText("Continue")).toBeInTheDocument();
    });
  });

  describe("last step behavior", () => {
    it("shows Back button on last step", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 2,
          onBack: vi.fn(),
        })
      );

      expect(screen.getByText("Back")).toBeInTheDocument();
    });

    it("shows Submit button on last step", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 2,
          onSubmit: vi.fn(),
        })
      );

      expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    it("does not show Continue button on last step", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 2,
          onNext: vi.fn(),
          onSubmit: vi.fn(),
        })
      );

      expect(screen.queryByText("Continue")).not.toBeInTheDocument();
    });
  });

  describe("button interactions", () => {
    it("calls onNext when Continue is clicked", async () => {
      const onNext = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 0,
          onNext,
        })
      );

      await user.click(screen.getByText("Continue"));
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("calls onBack when Back is clicked", async () => {
      const onBack = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 1,
          onBack,
        })
      );

      await user.click(screen.getByText("Back"));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when Cancel is clicked", async () => {
      const onCancel = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(FormWizard, {
          ...defaultProps,
          onCancel,
        })
      );

      await user.click(screen.getByText("Cancel"));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onSubmit when Submit is clicked", async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 2,
          onSubmit,
        })
      );

      await user.click(screen.getByText("Submit"));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("disabled states", () => {
    it("disables Continue when nextDisabled is true", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 0,
          onNext: vi.fn(),
          nextDisabled: true,
        })
      );

      expect(screen.getByText("Continue")).toBeDisabled();
    });

    it("disables all buttons when isSubmitting is true", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 2,
          onBack: vi.fn(),
          onSubmit: vi.fn(),
          isSubmitting: true,
        })
      );

      expect(screen.getByText("Back")).toBeDisabled();
      expect(screen.getByText("Cancel")).toBeDisabled();
    });

    it("shows loading state on Submit when isSubmitting is true", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 2,
          onSubmit: vi.fn(),
          isSubmitting: true,
        })
      );

      expect(screen.getByText("Submitting…")).toBeInTheDocument();
    });
  });

  describe("custom labels", () => {
    it("uses custom nextLabel", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 0,
          onNext: vi.fn(),
          nextLabel: "Next Step",
        })
      );

      expect(screen.getByText("Next Step")).toBeInTheDocument();
    });

    it("uses custom submitLabel", () => {
      render(
        createElement(FormWizard, {
          ...defaultProps,
          currentStep: 2,
          onSubmit: vi.fn(),
          submitLabel: "Create Garden",
        })
      );

      expect(screen.getByText("Create Garden")).toBeInTheDocument();
    });
  });
});

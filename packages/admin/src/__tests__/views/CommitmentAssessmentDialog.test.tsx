/** @vitest-environment jsdom */

import type { CommitmentDialogController } from "@green-goods/shared";
import { commitmentDialogControllerFixture } from "@green-goods/shared/testing";
import { describe, expect, it, vi } from "vitest";
import { CommitmentAssessmentDialog } from "@/views/Garden/Pool/CommitmentDialog/CommitmentAssessmentDialog";
import { fireEvent, renderWithProviders, screen, waitFor } from "../test-utils";

const UID = `0x${"ab".repeat(32)}` as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const AUTHOR = "0x1111111111111111111111111111111111111111" as const;
const assessment: CommitmentDialogController["assessments"][number] = {
  id: UID,
  authorAddress: AUTHOR,
  gardenAddress: GARDEN,
  title: "North beds baseline",
  description: "Soil and canopy baseline",
  assessmentConfigCID: "bafy-assessment",
  domain: 0,
  startDate: 1,
  endDate: 2,
  location: "North beds",
  createdAt: 1_700_000_000,
};

function renderDialog(overrides: Partial<Parameters<typeof CommitmentAssessmentDialog>[0]> = {}) {
  const onClose = vi.fn();
  const onAssessmentUIDChange = vi.fn();
  const attachAssessment = vi.fn().mockResolvedValue(undefined);
  const base = commitmentDialogControllerFixture();
  renderWithProviders(
    <CommitmentAssessmentDialog
      open="attach-assessment"
      onClose={onClose}
      tone="garden"
      acts={{ ...base.acts, attachAssessment }}
      assessments={[assessment]}
      assessmentsLoading={false}
      assessmentUID={null}
      onAssessmentUIDChange={onAssessmentUIDChange}
      actDisabled={false}
      isActing={false}
      {...overrides}
    />
  );
  return { attachAssessment, onAssessmentUIDChange, onClose };
}

describe("CommitmentAssessmentDialog", () => {
  it("stays closed outside the attach-assessment state", () => {
    renderDialog({ open: null });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders loading and empty outcomes", () => {
    const { unmount } = renderWithProviders(
      <CommitmentAssessmentDialog {...renderProps({ assessmentsLoading: true, assessments: [] })} />
    );
    expect(screen.getByRole("status", { name: "Loading assessments" })).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <CommitmentAssessmentDialog
        {...renderProps({ assessmentsLoading: false, assessments: [] })}
      />
    );
    expect(screen.getByTestId("attach-assessment-empty")).toHaveTextContent(
      /no current assessment/i
    );
  });

  it("reports the controlled assessment choice", () => {
    const { onAssessmentUIDChange } = renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /north beds baseline/i }));
    expect(onAssessmentUIDChange).toHaveBeenCalledWith(UID);
  });

  it("attaches the selected assessment and closes", async () => {
    const { attachAssessment, onClose } = renderDialog({ assessmentUID: UID });
    fireEvent.click(screen.getByRole("button", { name: "Attach" }));
    await waitFor(() => expect(attachAssessment).toHaveBeenCalledWith(UID));
    expect(onClose).toHaveBeenCalled();
  });

  it("disables attach without a selection or while acts are disabled", () => {
    const { rerender } = renderWithProviders(
      <CommitmentAssessmentDialog {...renderProps({ assessmentUID: null })} />
    );
    expect(screen.getByRole("button", { name: "Attach" })).toBeDisabled();
    rerender(
      <CommitmentAssessmentDialog {...renderProps({ assessmentUID: UID, actDisabled: true })} />
    );
    expect(screen.getByRole("button", { name: "Attach" })).toBeDisabled();
  });

  it("closes from Cancel", () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});

function renderProps(
  overrides: Partial<Parameters<typeof CommitmentAssessmentDialog>[0]> = {}
): Parameters<typeof CommitmentAssessmentDialog>[0] {
  const base = commitmentDialogControllerFixture();
  return {
    open: "attach-assessment",
    onClose: vi.fn(),
    tone: "garden",
    acts: base.acts,
    assessments: [assessment],
    assessmentsLoading: false,
    assessmentUID: null,
    onAssessmentUIDChange: vi.fn(),
    actDisabled: false,
    isActing: false,
    ...overrides,
  };
}

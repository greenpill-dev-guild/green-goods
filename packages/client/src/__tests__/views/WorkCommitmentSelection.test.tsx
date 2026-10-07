import { fireEvent, render, screen, within } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@green-goods/shared/i18n/en";
import {
  WorkCommitmentSelection,
  type WorkCommitmentChoice,
} from "@/views/Garden/WorkCommitmentSelection";

const choices: WorkCommitmentChoice[] = [
  {
    key: "9:0",
    commitmentId: 9n,
    requirementIndex: 0,
    title: "Restore the north beds",
    actionTitle: "Plant seedlings",
    requiredCount: 3,
    approvedCount: 1,
    dueDate: 1791331200n,
  },
  {
    key: "9:1",
    commitmentId: 9n,
    requirementIndex: 1,
    title: "Restore the north beds",
    actionTitle: "Plant seedlings",
    requiredCount: 2,
    approvedCount: 0,
  },
];
function mount(selectedKey: string | null = null, error: unknown = null) {
  const onSelectedKeyChange = vi.fn();
  render(
    <IntlProvider locale="en" messages={en}>
      <WorkCommitmentSelection
        choices={choices}
        selectedKey={selectedKey}
        onSelectedKeyChange={onSelectedKeyChange}
        isLoading={false}
        intentStatus="none"
        error={error}
      />
    </IntlProvider>
  );
  return onSelectedKeyChange;
}

describe("WorkCommitmentSelection", () => {
  it("shows action and progress to distinguish repeated promise requirements", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Choose a Promise" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("1 of 3 approved")).toBeInTheDocument();
    expect(within(dialog).getByText("0 of 2 approved")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("radio", { name: /Requirement 2.*Plant seedlings/ })
    ).toBeInTheDocument();
  });
  it("keeps the exact incoming requirement selected and returns a deliberate choice", () => {
    const changed = mount("9:1");
    fireEvent.click(screen.getByRole("button", { name: "Choose a Promise" }));
    expect(screen.getByRole("radio", { name: /Requirement 2.*Plant seedlings/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Requirement 1.*Plant seedlings/ }));
    expect(changed).toHaveBeenCalledWith("9:0");
    // Choosing keeps the radios available for subsequent keyboard movement.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("lets the person explicitly continue without a promise", () => {
    const changed = mount("9:1");
    fireEvent.click(screen.getByRole("button", { name: "Choose a Promise" }));
    fireEvent.click(screen.getByRole("radio", { name: "Not for a Promise" }));
    expect(changed).toHaveBeenCalledWith(null);
  });
  it("does not permit stale choices when eligibility cannot be read", () => {
    mount(null, new Error("offline"));
    expect(screen.getByRole("button", { name: "Choose a Promise" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Eligible promises could not be read");
  });
});

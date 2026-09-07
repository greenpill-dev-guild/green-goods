/** @vitest-environment jsdom */

import { useWorkForm } from "@green-goods/shared/hooks/work/useWorkForm";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { WorkDetails } from "../../views/Garden/Details";

const messages = {
  "app.garden.details.title": "Enter Details",
  "app.garden.submit.tab.details.instruction": "Provide detailed information and feedback",
  "app.garden.details.feedbackPlaceholder": "Provide feedback or any observations",
  "app.garden.details.timeSpent": "Time Spent (hours)",
  "app.garden.details.timeSpentPlaceholder": "e.g., 1.5 for 1h 30m",
  "app.garden.details.timeSpentHint": "Enter hours spent on this work (decimals OK)",
  "app.garden.details.shareLocation": "Share Location",
  "app.garden.details.locationHint": "Share your location to auto-fill coordinates",
  "app.garden.details.locationCaptured": "Location captured",
  "app.garden.details.locationDenied": "Location access denied",
  "app.garden.details.feedback": "Feedback",
  "app.garden.details.selectRange": "Select Date Range",
  "app.common.add": "Add",
  "app.common.remove": "Remove",
};

function GateHarness({ inputs }: { inputs: WorkInput[] }) {
  const form = useWorkForm(inputs);
  return (
    <IntlProvider locale="en" messages={messages}>
      <WorkDetails
        inputs={inputs}
        register={form.register}
        control={form.control}
        setValue={form.setValue}
      />
      <button type="button" disabled={!form.formState.isValid}>
        Review Work
      </button>
    </IntlProvider>
  );
}

describe("WorkDetails Review gate", () => {
  it("keeps Review blocked until required scalar and single-choice fields are complete", async () => {
    const user = userEvent.setup();
    const view = render(
      <GateHarness
        inputs={[
          {
            key: "capacity",
            title: "Capacity",
            placeholder: "Enter capacity",
            type: "number",
            required: true,
            options: [],
          },
          {
            key: "sessionType",
            title: "Session Type",
            placeholder: "Select format",
            type: "select",
            required: true,
            options: ["Workshop", "Lecture"],
          },
        ]}
      />
    );

    const review = screen.getByRole("button", { name: "Review Work" });
    expect(review).toBeDisabled();

    const capacity = view.container.querySelector<HTMLInputElement>('input[name="capacity"]');
    expect(capacity).not.toBeNull();
    await user.type(capacity!, "10");
    expect(review).toBeDisabled();

    await user.click(screen.getByLabelText("Session Type*"));
    await user.click(screen.getByRole("option", { name: "Workshop" }));

    await waitFor(() => expect(review).toBeEnabled());
  });

  it("validates required chip selections through react-hook-form", async () => {
    const user = userEvent.setup();
    render(
      <GateHarness
        inputs={[
          {
            key: "serviceTags",
            title: "Services",
            placeholder: "",
            type: "multi-select",
            required: true,
            options: ["Charging", "Internet"],
          },
        ]}
      />
    );

    const review = screen.getByRole("button", { name: "Review Work" });
    expect(review).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Charging" }));

    await waitFor(() => expect(review).toBeEnabled());
  });

  it("requires and accepts a complete repeater row", async () => {
    const user = userEvent.setup();
    const view = render(
      <GateHarness
        inputs={[
          {
            key: "categoryBreakdown",
            title: "Category Breakdown",
            placeholder: "Add categories",
            type: "repeater",
            required: true,
            options: [],
            repeaterFields: [
              {
                key: "category",
                title: "Category",
                placeholder: "Select category",
                type: "select",
                required: true,
                options: ["Plastic", "Metal"],
              },
              {
                key: "weightKg",
                title: "Weight",
                placeholder: "Enter weight",
                type: "number",
                required: true,
                options: [],
              },
            ],
          },
        ]}
      />
    );

    const review = screen.getByRole("button", { name: "Review Work" });
    expect(review).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(review).toBeDisabled();
    await user.click(screen.getByLabelText("Category*"));
    await user.click(screen.getByRole("option", { name: "Plastic" }));
    expect(review).toBeDisabled();
    const weight = view.container.querySelector<HTMLInputElement>(
      'input[name="categoryBreakdown.0.weightKg"]'
    );
    expect(weight).not.toBeNull();
    await user.type(weight!, "5");

    await waitFor(() => expect(review).toBeEnabled());
  });
});

/**
 * @vitest-environment jsdom
 */

import type { ActionInstructionConfig } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailsConfigSection } from "../../components/Action/DetailsConfigSection";

type DetailsConfig = ActionInstructionConfig["uiConfig"]["details"];

const EMPTY_CONFIG: DetailsConfig = {
  title: "Enter details",
  description: "",
  feedbackPlaceholder: "",
  inputs: [],
};

const POPULATED_CONFIG: DetailsConfig = {
  title: "Enter details",
  description: "Describe the work",
  feedbackPlaceholder: "Anything else?",
  inputs: [
    {
      key: "species",
      title: "Species planted",
      placeholder: "Choose species",
      type: "select",
      required: false,
      options: ["Maize", "Beans"],
    },
    {
      key: "notes",
      title: "Notes",
      placeholder: "Observations",
      type: "textarea",
      required: false,
      options: [],
    },
  ],
};

function DetailsHarness({ initial }: { initial: DetailsConfig }) {
  const [config, setConfig] = useState(initial);

  return (
    <IntlProvider locale="en" messages={{}}>
      <output data-testid="details-state">{JSON.stringify(config)}</output>
      <DetailsConfigSection config={config} onChange={setConfig} />
    </IntlProvider>
  );
}

function currentConfig(): DetailsConfig {
  return JSON.parse(screen.getByTestId("details-state").textContent ?? "") as DetailsConfig;
}

describe("DetailsConfigSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("edits section copy and creates the first input", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_725_000_000_000);
    render(<DetailsHarness initial={EMPTY_CONFIG} />);

    fireEvent.change(screen.getByLabelText("Section Title"), {
      target: { value: "Work details" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Tell us what happened" },
    });
    fireEvent.change(screen.getByLabelText("Feedback Placeholder"), {
      target: { value: "Share observations" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Your First Input Field" }));

    expect(currentConfig()).toMatchObject({
      title: "Work details",
      description: "Tell us what happened",
      feedbackPlaceholder: "Share observations",
      inputs: [
        {
          key: "field_1725000000000",
          title: "",
          placeholder: "",
          type: "text",
          required: false,
          options: [],
        },
      ],
    });
    expect(screen.getByText("Input #1")).toBeInTheDocument();
  });

  it("edits, reorders, and removes input fields", () => {
    render(<DetailsHarness initial={POPULATED_CONFIG} />);

    fireEvent.change(screen.getAllByLabelText("Field Key")[0], { target: { value: "crop" } });
    fireEvent.change(screen.getAllByLabelText("Label")[0], { target: { value: "Crop planted" } });
    fireEvent.change(screen.getAllByLabelText("Placeholder")[0], {
      target: { value: "Choose a crop" },
    });
    fireEvent.click(screen.getAllByLabelText("Required field")[0]);

    fireEvent.click(screen.getAllByTitle("Move Down")[0]);
    expect(currentConfig().inputs.map((input) => input.key)).toEqual(["notes", "crop"]);

    fireEvent.click(screen.getAllByTitle("Move Up")[1]);
    expect(currentConfig().inputs.map((input) => input.key)).toEqual(["crop", "notes"]);

    fireEvent.click(screen.getAllByTitle("Delete")[1]);
    expect(currentConfig().inputs).toHaveLength(1);
    expect(currentConfig().inputs[0]).toMatchObject({
      key: "crop",
      title: "Crop planted",
      placeholder: "Choose a crop",
      required: true,
    });
  });

  it("manages select options and clears them when the field type changes", () => {
    render(<DetailsHarness initial={POPULATED_CONFIG} />);

    const options = document.getElementById("field-options-species");
    expect(options).not.toBeNull();
    const optionControls = within(options as HTMLElement);

    fireEvent.change(optionControls.getAllByRole("textbox")[0], {
      target: { value: "Corn" },
    });
    fireEvent.change(optionControls.getByPlaceholderText("Add option..."), {
      target: { value: "  Amaranth  " },
    });
    fireEvent.keyDown(optionControls.getByPlaceholderText("Add option..."), { key: "Enter" });
    expect(currentConfig().inputs[0].options).toEqual(["Corn", "Beans", "Amaranth"]);

    fireEvent.click(optionControls.getAllByRole("button")[0]);
    expect(currentConfig().inputs[0].options).toEqual(["Beans", "Amaranth"]);

    fireEvent.change(screen.getAllByLabelText("Field Type")[0], { target: { value: "number" } });
    expect(currentConfig().inputs[0]).toMatchObject({ type: "number", options: [] });
    expect(document.getElementById("field-options-species")).not.toBeInTheDocument();
  });
});

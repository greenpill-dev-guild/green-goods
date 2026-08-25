/**
 * @vitest-environment jsdom
 */

import type { ActionInstructionConfig } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { MediaConfigSection } from "../../components/Action/MediaConfigSection";

type MediaConfig = ActionInstructionConfig["uiConfig"]["media"];

const POPULATED_CONFIG: MediaConfig = {
  title: "Capture media",
  description: "Photograph the work",
  minImageCount: 1,
  maxImageCount: 4,
  required: true,
  needed: ["Wide shot", "Close-up"],
  optional: ["Team photo", "Site context"],
};

function MediaHarness({ initial = POPULATED_CONFIG }: { initial?: MediaConfig }) {
  const [config, setConfig] = useState(initial);

  return (
    <IntlProvider locale="en" messages={{}}>
      <output data-testid="media-state">{JSON.stringify(config)}</output>
      <MediaConfigSection config={config} onChange={setConfig} />
    </IntlProvider>
  );
}

function currentConfig(): MediaConfig {
  return JSON.parse(screen.getByTestId("media-state").textContent ?? "") as MediaConfig;
}

describe("MediaConfigSection", () => {
  it("edits copy, image limits, and required state", () => {
    render(<MediaHarness />);

    fireEvent.change(screen.getByLabelText("Section Title"), {
      target: { value: "Evidence photos" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Show the completed work" },
    });
    fireEvent.change(screen.getByLabelText("Min Images"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Max Images"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Media is required"));

    expect(currentConfig()).toMatchObject({
      title: "Evidence photos",
      description: "Show the completed work",
      minImageCount: 0,
      maxImageCount: 1,
      required: false,
    });
  });

  it("adds and edits required and optional shot types", () => {
    render(<MediaHarness />);
    const needed = document.getElementById("media-needed");
    const optional = document.getElementById("media-optional");
    expect(needed).not.toBeNull();
    expect(optional).not.toBeNull();
    const neededControls = within(needed as HTMLElement);
    const optionalControls = within(optional as HTMLElement);

    fireEvent.change(neededControls.getAllByRole("textbox")[0], {
      target: { value: "Before photo" },
    });
    fireEvent.change(neededControls.getByPlaceholderText("e.g., Front view, Side view"), {
      target: { value: "  After photo  " },
    });
    fireEvent.keyDown(neededControls.getByPlaceholderText("e.g., Front view, Side view"), {
      key: "Enter",
    });

    fireEvent.change(optionalControls.getAllByRole("textbox")[0], {
      target: { value: "Volunteer photo" },
    });
    fireEvent.change(optionalControls.getByPlaceholderText("e.g., Close-up, Detail shot"), {
      target: { value: "  Location panorama  " },
    });
    fireEvent.click(optionalControls.getByRole("button", { name: "Add" }));

    expect(currentConfig()).toMatchObject({
      needed: ["Before photo", "Close-up", "After photo"],
      optional: ["Volunteer photo", "Site context", "Location panorama"],
    });
  });

  it("removes shot types and ignores empty additions", () => {
    render(<MediaHarness />);
    const needed = within(document.getElementById("media-needed") as HTMLElement);
    const optional = within(document.getElementById("media-optional") as HTMLElement);

    fireEvent.click(needed.getAllByRole("button")[0]);
    fireEvent.click(optional.getAllByRole("button")[0]);
    expect(currentConfig()).toMatchObject({
      needed: ["Close-up"],
      optional: ["Site context"],
    });

    fireEvent.change(needed.getByPlaceholderText("e.g., Front view, Side view"), {
      target: { value: "   " },
    });
    fireEvent.click(needed.getByRole("button", { name: "Add" }));
    fireEvent.change(optional.getByPlaceholderText("e.g., Close-up, Detail shot"), {
      target: { value: "   " },
    });
    fireEvent.keyDown(optional.getByPlaceholderText("e.g., Close-up, Detail shot"), {
      key: "Enter",
    });

    expect(currentConfig()).toMatchObject({
      needed: ["Close-up"],
      optional: ["Site context"],
    });
  });
});

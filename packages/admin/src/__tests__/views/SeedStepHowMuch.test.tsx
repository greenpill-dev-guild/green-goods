/** @vitest-environment jsdom */

import type { Action } from "@green-goods/shared";
import {
  COMMITMENT_COMPOSER_DEFAULTS,
  type CommitmentComposerValues,
  useCommitmentComposerForm,
} from "@green-goods/shared/commitment-pooling";
import { useState } from "react";
import { useFieldArray } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { SeedStepHowMuch } from "@/views/Garden/Pool/Seed/SeedStepHowMuch";
import { fireEvent, renderWithProviders, screen, waitFor } from "../test-utils";

function action(id: string, title: string): Action {
  return {
    id,
    slug: title.toLowerCase().replaceAll(" ", "-"),
    startTime: 0,
    endTime: 0,
    title,
    description: "",
    capitals: [],
    media: [],
    domain: null,
    createdAt: 0,
    inputs: [],
  };
}

const actions = [action("42161-1", "Plant seedlings"), action("42161-0x1", "Invalid hex")];

function Harness({
  kind = "GARDEN_WORK",
  busy = false,
}: {
  kind?: CommitmentComposerValues["kind"];
  busy?: boolean;
}) {
  const form = useCommitmentComposerForm({
    ...COMMITMENT_COMPOSER_DEFAULTS,
    kind,
    title: "Prepare the beds",
    unitLabel: "",
    targetUnits: 0,
    dueInDays: 0,
  });
  const requirements = useFieldArray({ control: form.control, name: "requirements" });
  const values = form.watch();
  const [result, setResult] = useState("unchecked");

  return (
    <>
      <SeedStepHowMuch
        form={form}
        values={values}
        noteId="seed-how"
        busy={busy}
        errorOf={(field) => form.formState.errors[field]?.message as string | undefined}
        requirements={requirements}
        actions={actions}
        chainId={42161}
      />
      <button
        type="button"
        onClick={async () => {
          const valid = await form.trigger([
            "unitLabel",
            "targetUnits",
            "dueInDays",
            "requirements",
          ]);
          setResult(valid ? "valid" : "invalid");
        }}
      >
        Validate
      </button>
      <output data-testid="validation-result">{result}</output>
    </>
  );
}

describe("SeedStepHowMuch", () => {
  it("uses the real composer validation for amount, unit, due date, and requirements", async () => {
    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    expect(await screen.findByText("Say what you are counting")).toBeInTheDocument();
    expect(screen.getByText("How many?")).toBeInTheDocument();
    expect(screen.getByText("Give it an end")).toBeInTheDocument();
    expect(screen.getByTestId("validation-result")).toHaveTextContent("invalid");

    fireEvent.change(screen.getByLabelText(/^unit/i), { target: { value: "plots" } });
    fireEvent.change(screen.getByLabelText(/^target/i), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText(/due in/i), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    await waitFor(() =>
      expect(screen.getByTestId("validation-result")).toHaveTextContent("invalid")
    );

    fireEvent.click(screen.getByRole("button", { name: "Add action" }));

    const actionSelect = screen.getByLabelText("Action");
    expect(screen.queryByRole("option", { name: "Invalid hex" })).not.toBeInTheDocument();
    fireEvent.change(actionSelect, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => expect(screen.getByTestId("validation-result")).toHaveTextContent("valid"));
  });

  it("adds and removes requirement rows and switches contributor policy", async () => {
    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));
    expect(screen.getByTestId("seed-requirements")).toBeInTheDocument();
    expect(screen.getByLabelText("Count")).toHaveValue("1");
    fireEvent.click(screen.getByRole("radio", { name: /^Lead-managed team/ }));
    expect(screen.getByRole("radio", { name: /^Lead-managed team/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByLabelText("Action")).not.toBeInTheDocument());
  });

  it("explains proof-only commitments and disables controls while busy", () => {
    renderWithProviders(<Harness kind="SERVICE" busy />);
    expect(screen.getByText(/confirmed by proof/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^unit/i)).toBeDisabled();
    expect(screen.getByRole("radio", { name: /^Open team/ })).toBeDisabled();
  });
});

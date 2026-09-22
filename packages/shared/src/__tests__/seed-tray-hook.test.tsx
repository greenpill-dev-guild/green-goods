/** @vitest-environment jsdom */

/**
 * useSeedTray — the seeding tray bound to the wizard's one form.
 *
 * The form only ever holds one row. What this proves is what happens to the
 * rows it is not holding: their answers survive the form being handed another
 * row, a late default never overwrites a copied answer, and a row is sent under
 * the id it was given however many times it takes.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type SeedTrayRow, useSeedTray } from "../hooks/admin-ui/pool/useSeedTray";
import {
  applyLateComposerDefaults,
  type CommitmentComposerValues,
  useCommitmentComposerForm,
} from "../hooks/commitment-pooling/useCommitmentComposerForm";

type CreateRow = (row: SeedTrayRow) => Promise<unknown>;

function setup(createRow: CreateRow = vi.fn(async () => "job")) {
  const view = renderHook(() => {
    const form = useCommitmentComposerForm({ kind: "SEASON_CAMPAIGN" });
    return { form, tray: useSeedTray({ form, createRow }) };
  });
  const write = (answers: Partial<CommitmentComposerValues>) =>
    act(() => {
      for (const [field, value] of Object.entries(answers)) {
        view.result.current.form.setValue(field as keyof CommitmentComposerValues, value as never, {
          shouldDirty: true,
        });
      }
    });
  return { view, write, createRow };
}

const rides = { title: "Market rides", unitLabel: "rides", targetUnits: 4 };

describe("useSeedTray", () => {
  it("adds another like this: the row is kept and its answers carry over as the steward's own", async () => {
    const { view, write } = setup();
    write({ ...rides, direction: "REQUEST" });

    await act(() => view.result.current.tray.addAnother());

    const { form, tray } = view.result.current;
    expect(tray.others.map((row) => row.values.title)).toEqual(["Market rides"]);
    expect(tray.size).toBe(2);
    expect(form.getValues("title")).toBe("Market rides");
    // A default that arrives late must not undo an answer the copy carried over.
    act(() => applyLateComposerDefaults(form, { direction: "OFFER", cycleId: "12" }));
    expect(form.getValues("direction")).toBe("REQUEST");
    // A field nobody answered still follows it.
    expect(form.getValues("cycleId")).toBe("12");
  });

  it("moves nothing while the answers in the form break the composer's rules", async () => {
    const { view, createRow } = setup();

    await act(() => view.result.current.tray.addAnother());
    let outcome: string | undefined;
    await act(async () => {
      outcome = await view.result.current.tray.sendAll();
    });

    expect(view.result.current.tray.others).toEqual([]);
    expect(outcome).toBe("invalid");
    expect(createRow).not.toHaveBeenCalled();
  });

  it("takes an earlier row back into the form and keeps the one that was there", async () => {
    const { view, write } = setup();
    write(rides);
    await act(() => view.result.current.tray.addAnother());
    write({ title: "Clinic rides" });
    const first = view.result.current.tray.others[0]!.clientCommitmentId;

    await act(() => view.result.current.tray.edit(first));

    expect(view.result.current.form.getValues("title")).toBe("Market rides");
    expect(view.result.current.tray.others.map((row) => row.values.title)).toEqual([
      "Clinic rides",
    ]);

    // Dropping the row in the form hands back the one that is left.
    act(() => view.result.current.tray.removeCurrent());
    expect(view.result.current.form.getValues("title")).toBe("Clinic rides");
    expect(view.result.current.tray.size).toBe(1);
  });

  it("sends each row under the id it was given, keeps what failed, and sends that one again as itself", async () => {
    const sentIds: string[] = [];
    const createRow = vi.fn(async (row: SeedTrayRow) => {
      sentIds.push(row.clientCommitmentId);
      if (row.values.title === "Clinic rides" && sentIds.length <= 3) {
        throw new Error("execution reverted");
      }
    });
    const { view, write } = setup(createRow);
    write(rides);
    await act(() => view.result.current.tray.addAnother());
    write({ title: "Clinic rides" });
    await act(() => view.result.current.tray.addAnother());
    write({ title: "School rides" });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await view.result.current.tray.sendAll();
    });

    expect(outcome).toBe("left");
    expect(createRow.mock.calls.map(([row]) => row.values.title)).toEqual([
      "Market rides",
      "Clinic rides",
      "School rides",
    ]);
    const { form, tray } = view.result.current;
    expect(tray.lastSend).toEqual({ sent: 2, left: 1 });
    expect(tray.size).toBe(1);
    expect(tray.currentNotSent).toBe(true);
    // The row that is left is the one in the form, ready to be changed or sent again.
    expect(form.getValues("title")).toBe("Clinic rides");

    await act(async () => {
      outcome = await view.result.current.tray.sendAll();
    });
    expect(outcome).toBe("sent");
    // The same id as its first send: a second send can never be a second commitment.
    expect(sentIds[3]).toBe(sentIds[1]);
    expect(new Set(sentIds.slice(0, 3)).size).toBe(3);
  });
});

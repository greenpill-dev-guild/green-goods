/** @vitest-environment happy-dom */

/**
 * useSeedTray — the seeding tray bound to the wizard's one form.
 *
 * The form only ever holds one row. What this proves is what happens to the
 * rows it is not holding (their answers survive the form being handed another
 * row, and a late default never overwrites a copied answer), and what a Create
 * fixes: each copy's id, the set's one deadline and group, and the payload a
 * retry sends again. How copies are sent is `creation-send`'s, proven over the
 * real queue in its own test; here it is scripted.
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSeedTray, type SeedCopyTerms } from "../hooks/admin-ui/pool/useSeedTray";
import {
  applyLateComposerDefaults,
  type CommitmentComposerValues,
  useCommitmentComposerForm,
} from "../hooks/commitment-pooling/useCommitmentComposerForm";
import type { CreationCopy, CreationSendInput } from "../modules/commitment-pooling/creation-send";
import type { SeedCopyProgress } from "../modules/commitment-pooling/seed-sets";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const send = vi.hoisted(() => ({
  script: (copy: CreationCopy): Partial<SeedCopyProgress> => ({ status: "created" }),
  calls: [] as CreationCopy[][],
}));

vi.mock("../modules/commitment-pooling/creation-send", () => ({
  creationSendMode: vi.fn(async () => "bundle"),
  sendCreationCopies: vi.fn(async (input: CreationSendInput) => {
    send.calls.push([...input.copies]);
    return input.copies.map((copy) => {
      const progress = {
        clientCommitmentId: copy.clientCommitmentId,
        txHash: null,
        jobId: null,
        status: "created",
        ...send.script(copy),
      } as SeedCopyProgress;
      input.onCopy?.(progress);
      return progress;
    });
  }),
}));
vi.mock("../modules/job-queue/default-instance", () => ({ jobQueue: {} }));
vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({ authMode: "wallet" }),
}));

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;

function setup() {
  const buildCopy = vi.fn((values: CommitmentComposerValues, copy: SeedCopyTerms) => ({
    clientCommitmentId: copy.clientCommitmentId,
    dueDate: copy.dueDate,
    title: values.title,
    displayGroupId: copy.displayGroup?.id ?? null,
  })) as unknown as ReturnType<typeof vi.fn> & Parameters<typeof useSeedTray>[0]["buildCopy"];
  const view = renderHookWithProviders(() => {
    const form = useCommitmentComposerForm({ kind: "SEASON_CAMPAIGN" });
    return { form, tray: useSeedTray({ form, chainId: 42161, owner: STEWARD, buildCopy }) };
  });
  const write = (answers: Partial<CommitmentComposerValues>) =>
    act(() => {
      for (const [field, value] of Object.entries(answers)) {
        view.result.current.form.setValue(field as keyof CommitmentComposerValues, value as never, {
          shouldDirty: true,
        });
      }
    });
  const create = async () => {
    let outcome: string | undefined;
    await act(async () => {
      outcome = await view.result.current.tray.sendAll();
    });
    return outcome;
  };
  return { view, write, create, buildCopy };
}

const rides = { title: "Market rides", unitLabel: "rides", targetUnits: 4 };
const surveys = { title: "Household water survey", unitLabel: "survey", targetUnits: 1, count: 10 };
const payloadOf = (copy: CreationCopy) =>
  copy.payload as unknown as { dueDate: bigint; title: string; displayGroupId: string | null };

beforeEach(() => {
  send.calls = [];
  send.script = () => ({ status: "created" });
});

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
    const { view, create, buildCopy } = setup();

    await act(() => view.result.current.tray.addAnother());

    expect(view.result.current.tray.others).toEqual([]);
    expect(await create()).toBe("invalid");
    expect(buildCopy).not.toHaveBeenCalled();
    expect(send.calls).toEqual([]);
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

  it("fixes a row's copies at its first Create: an id each, one deadline and one group", async () => {
    const { view, write, create, buildCopy } = setup();
    write(surveys);
    expect(view.result.current.tray.size).toBe(10);

    expect(await create()).toBe("sent");

    const [copies] = send.calls;
    expect(copies).toHaveLength(10);
    expect(new Set(copies!.map((copy) => copy.clientCommitmentId)).size).toBe(10);
    expect(new Set(copies!.map((copy) => payloadOf(copy).dueDate)).size).toBe(1);
    const groups = new Set(copies!.map((copy) => payloadOf(copy).displayGroupId));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toEqual(expect.any(String));
    expect(buildCopy).toHaveBeenCalledTimes(10);
    expect(view.result.current.tray.copies?.map((copy) => copy.status)).toEqual(
      Array(10).fill("created")
    );
  });

  it("retries only the copies that didn't send, with the payloads they were built with", async () => {
    const { view, write, create, buildCopy } = setup();
    write(surveys);
    let failing = 3;
    send.script = () =>
      failing-- > 0 ? { status: "not-sent", miss: "declined" } : { status: "created" };

    expect(await create()).toBe("left");
    expect(view.result.current.tray.retryCount).toBe(3);

    expect(await create()).toBe("sent");
    const [first, retry] = send.calls;
    expect(retry).toEqual(first!.slice(0, 3));
    // Nothing rebuilt: a retry sends what the first Create fixed, deadline included.
    expect(buildCopy).toHaveBeenCalledTimes(10);
    expect(view.result.current.tray.retryCount).toBe(0);
    // The wallet is asked about the retried three, not the whole set.
    expect(view.result.current.tray.pass?.map((copy) => copy.clientCommitmentId)).toEqual(
      retry!.map((copy) => copy.clientCommitmentId)
    );
  });

  it("locks a row once some of it exists: its answers can't be changed or removed", async () => {
    const { view, write, create } = setup();
    write(rides);
    await act(() => view.result.current.tray.addAnother());
    write({ ...surveys });
    send.script = (copy) =>
      payloadOf(copy).title === "Market rides" ? { status: "created" } : { status: "later" };
    await create();
    const [marketRow] = view.result.current.tray.others;

    expect(view.result.current.tray.currentLocked).toBe(true);
    expect(view.result.current.tray.isLocked(marketRow!.clientCommitmentId)).toBe(true);
    act(() => view.result.current.tray.remove(marketRow!.clientCommitmentId));
    act(() => view.result.current.tray.removeCurrent());
    expect(view.result.current.tray.others).toHaveLength(1);
    expect(view.result.current.tray.size).toBe(11);
  });

  it("keeps a row's answers editable while nothing of it exists", async () => {
    const { view, write, create, buildCopy } = setup();
    write({ ...surveys, count: 2 });
    send.script = () => ({ status: "not-sent", miss: "declined" });
    await create();
    expect(view.result.current.tray.currentLocked).toBe(false);
    const declined = send.calls[0]!.map((copy) => copy.clientCommitmentId);

    write({ title: "Rain barrel survey" });
    send.script = () => ({ status: "created" });
    expect(await create()).toBe("sent");

    const rebuilt = send.calls[1]!;
    expect(rebuilt.map((copy) => payloadOf(copy).title)).toEqual([
      "Rain barrel survey",
      "Rain barrel survey",
    ]);
    expect(rebuilt.map((copy) => copy.clientCommitmentId)).not.toEqual(declined);
    expect(buildCopy).toHaveBeenCalledTimes(4);
  });
});

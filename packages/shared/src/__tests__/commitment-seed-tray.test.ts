/**
 * The seeding tray — several commitments composed in one sitting, sent one by one.
 *
 * The rule with teeth is identity: a row gets its id when it joins the tray and
 * keeps it through every edit and every send. The queue dedupes a creation by
 * that id and the chain by the key derived from it, so however many times a row
 * is sent it can only ever become one commitment. An id minted at send time is
 * how a retry becomes a second commitment.
 */

import { describe, expect, it, vi } from "vitest";

import { COMMITMENT_COMPOSER_DEFAULTS } from "../hooks/commitment-pooling/useCommitmentComposerForm";
import type { CommitmentSendReport } from "../hooks/commitment-pooling/useCommitmentJobs";
import {
  addAnotherRow,
  advanceSeedRow,
  keepCurrentRow,
  otherTrayRows,
  removeTrayRow,
  type SeedTrayRow,
  selectSeedTrayCapacity,
  selectSeedTrayRoom,
  sendSeedTray,
  type SeedRowProgress,
  settleSeedTray,
  startSeedPass,
  startSeedTray,
  takeUpRow,
} from "../modules/commitment-pooling/seed-tray";
import type { Address } from "../types/domain";

const STEWARD = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;
const SOMEONE_ELSE = "0x2222222222222222222222222222222222222222" as Address;

const answers = (title: string, direction: "OFFER" | "REQUEST" = "OFFER") => ({
  ...COMMITMENT_COMPOSER_DEFAULTS,
  title,
  direction,
  unitLabel: "rides",
  targetUnits: 4,
});

const ids = (rows: readonly SeedTrayRow[]) => rows.map((row) => row.clientCommitmentId);

/** Three kept rows a, b, c with c in hand. */
function trayOfThree() {
  let tray = startSeedTray("a");
  tray = addAnotherRow(tray, answers("First"), "b");
  tray = addAnotherRow(tray, answers("Second"), "c");
  return keepCurrentRow(tray, answers("Third"));
}

describe("the seeding tray", () => {
  it("keeps one id for a row through every change to its answers", () => {
    let tray = startSeedTray("a");
    expect(tray.rows).toEqual([]);

    tray = keepCurrentRow(tray, answers("Market rides"));
    tray = keepCurrentRow(tray, answers("Market rides, mornings"));

    expect(tray.rows).toEqual([
      { clientCommitmentId: "a", values: answers("Market rides, mornings") },
    ]);
  });

  it("adds another like the one in hand: the first is kept, the next has an id of its own", () => {
    const tray = addAnotherRow(startSeedTray("a"), answers("Market rides"), "b");

    expect(ids(tray.rows)).toEqual(["a"]);
    expect(tray.currentId).toBe("b");
    // The copy is only a row once its own answers are kept.
    expect(ids(keepCurrentRow(tray, answers("Clinic rides")).rows)).toEqual(["a", "b"]);
  });

  it("takes an earlier row back in hand without losing the one being written", () => {
    const writing = addAnotherRow(startSeedTray("a"), answers("First"), "b");
    const tray = takeUpRow(writing, answers("Second"), "a");

    expect(tray.currentId).toBe("a");
    expect(ids(tray.rows)).toEqual(["a", "b"]);
    expect(ids(otherTrayRows(tray))).toEqual(["b"]);
    // A row that is not in the tray cannot be taken up.
    expect(takeUpRow(writing, answers("Second"), "zz").currentId).toBe("b");
  });

  it("removes a row, hands back the newest when the one in hand goes, and never removes the last", () => {
    const tray = trayOfThree();

    expect(ids(removeTrayRow(tray, "a").rows)).toEqual(["b", "c"]);

    const withoutCurrent = removeTrayRow(tray, "c");
    expect(ids(withoutCurrent.rows)).toEqual(["a", "b"]);
    expect(withoutCurrent.currentId).toBe("b");

    const last = keepCurrentRow(startSeedTray("a"), answers("Only"));
    expect(removeTrayRow(last, "a")).toBe(last);
  });

  it("sends every row in order, and neither a refusal nor a declined prompt stops the rest", async () => {
    const rows = trayOfThree().rows;

    const reverted = vi.fn(async (row: SeedTrayRow) => {
      if (row.clientCommitmentId === "b") throw new Error("execution reverted");
    });
    expect(await sendSeedTray(rows, reverted)).toEqual({ sent: ["a", "c"], failed: ["b"] });

    // The rows are separate commitments: declining one at the wallet skips that
    // one, and the steward is still asked about the next.
    const declined = vi.fn(async (row: SeedTrayRow) => {
      if (row.clientCommitmentId === "a") throw new Error("User rejected the request.");
    });
    expect(await sendSeedTray(rows, declined)).toEqual({ sent: ["b", "c"], failed: ["a"] });
    expect(declined.mock.calls.map(([row]) => row.clientCommitmentId)).toEqual(["a", "b", "c"]);
  });

  // How a row ends is the only thing the done screen says about it, so every
  // way a send can go is read here once: what it reported, then whether it
  // resolved or rejected.
  it.each<[string, CommitmentSendReport[], "resolves" | "rejects", Partial<SeedRowProgress>]>([
    [
      "created, linked to the transaction that carried it",
      [
        { stage: "wallet" },
        { stage: "confirming", txHash: "0xabc" },
        { stage: "landed", txHash: "0xabc" },
      ],
      "resolves",
      { status: "created", txHash: "0xabc" },
    ],
    [
      "created under the hash it was broadcast with when the queue returns none",
      [
        { stage: "confirming", txHash: "0xabc" },
        { stage: "landed", txHash: null },
      ],
      "resolves",
      { status: "created", txHash: "0xabc" },
    ],
    ["sent later when no wallet was asked", [{ stage: "queued" }], "resolves", { status: "later" }],
    ["sent later when the send resolves without saying how", [], "resolves", { status: "later" }],
    [
      "not sent when the wallet was declined",
      [{ stage: "wallet" }],
      "rejects",
      { status: "not-sent" },
    ],
    [
      "not sent when the chain refused what was broadcast",
      [{ stage: "wallet" }, { stage: "confirming", txHash: "0xabc" }],
      "rejects",
      { status: "not-sent", txHash: "0xabc" },
    ],
  ])("ends a row as %s", async (_outcome, reports, ending, expected) => {
    const rows = keepCurrentRow(startSeedTray("a"), answers("Market rides")).rows;
    let pass = startSeedPass(rows);
    expect(pass).toEqual([
      { clientCommitmentId: "a", title: "Market rides", status: "waiting", txHash: null },
    ]);

    await sendSeedTray(
      rows,
      async (_row, report) => {
        for (const event of reports) report(event);
        if (ending === "rejects") throw new Error("execution reverted");
      },
      (id, event) => {
        pass = advanceSeedRow(pass, id, event);
      }
    );

    expect(pass[0]).toMatchObject(expected);
  });

  it("follows the pass one row at a time, and a row that ended stays ended", async () => {
    const rows = trayOfThree().rows;
    let pass = startSeedPass(rows);
    const atEachPrompt: string[][] = [];

    await sendSeedTray(
      rows,
      async (row, report) => {
        report({ stage: "wallet" });
        atEachPrompt.push(pass.map((each) => each.status));
        if (row.clientCommitmentId === "b") throw new Error("User rejected the request.");
        report({ stage: "landed", txHash: `0x${row.clientCommitmentId}` });
      },
      (id, event) => {
        pass = advanceSeedRow(pass, id, event);
      }
    );

    // While one row is at the wallet, the ones before it have ended and the rest wait.
    expect(atEachPrompt).toEqual([
      ["wallet", "waiting", "waiting"],
      ["created", "wallet", "waiting"],
      ["created", "not-sent", "wallet"],
    ]);
    // A late report never reopens a row that ended.
    const late = advanceSeedRow(pass, "b", { type: "report", report: { stage: "wallet" } });
    expect(late[1]?.status).toBe("not-sent");
    expect(advanceSeedRow(pass, "a", { type: "start" })[0]?.status).toBe("created");
  });

  it("settles a send: what was sent leaves, what failed stays marked, and the hand moves to what is left", () => {
    const tray = trayOfThree();

    const left = settleSeedTray(tray, { sent: ["a", "c"], failed: ["b"] });
    expect(left?.rows).toEqual([
      { clientCommitmentId: "b", values: answers("Second"), notSent: true },
    ]);
    expect(left?.currentId).toBe("b");

    // Changing a row's answers clears the mark; keeping them as they were does not.
    expect(keepCurrentRow(left!, answers("Second")).rows[0]?.notSent).toBe(true);
    expect(keepCurrentRow(left!, answers("Second try")).rows[0]?.notSent).toBeUndefined();

    expect(settleSeedTray(tray, { sent: ["a", "b", "c"], failed: [] })).toBeNull();
  });

  it("counts the room a steward has left, which only an offer uses up", () => {
    const exposures = [
      { provider: SOMEONE_ELSE, openCommitmentCount: 9n },
      { provider: STEWARD.toUpperCase().replace("0X", "0x") as Address, openCommitmentCount: 1n },
    ];
    const room = selectSeedTrayRoom({ cap: 4n, exposures, viewer: STEWARD, queuedOffers: 1 });
    expect(room).toBe(2);
    // Never below nothing, and nobody's count means none are open.
    expect(selectSeedTrayRoom({ cap: 1n, exposures, viewer: STEWARD, queuedOffers: 3 })).toBe(0);
    expect(selectSeedTrayRoom({ cap: 4n, exposures: [], viewer: STEWARD, queuedOffers: 0 })).toBe(
      4
    );
    // Until the chain's numbers are read, the room is not known and nothing is refused.
    expect(
      selectSeedTrayRoom({ cap: 4n, exposures: null, viewer: STEWARD, queuedOffers: 0 })
    ).toBeNull();
    expect(
      selectSeedTrayRoom({ cap: undefined, exposures, viewer: STEWARD, queuedOffers: 0 })
    ).toBeNull();

    // A request is charged to whoever takes it up, so it takes none of the steward's room.
    const others: SeedTrayRow[] = [
      { clientCommitmentId: "a", values: answers("Offer one") },
      { clientCommitmentId: "b", values: answers("A request", "REQUEST") },
    ];
    expect(selectSeedTrayCapacity({ room, others, currentDirection: "OFFER" })).toEqual({
      offers: 2,
      full: true,
      over: false,
    });
    expect(selectSeedTrayCapacity({ room: 1, others, currentDirection: "OFFER" }).over).toBe(true);
    expect(selectSeedTrayCapacity({ room: 1, others, currentDirection: "REQUEST" })).toEqual({
      offers: 1,
      full: true,
      over: false,
    });
    expect(selectSeedTrayCapacity({ room: null, others, currentDirection: "OFFER" })).toEqual({
      offers: 2,
      full: false,
      over: false,
    });
  });
});

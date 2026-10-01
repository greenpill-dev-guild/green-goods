/**
 * Where an account's username stands (PRD-1026): every state of the Account
 * tab's Username card, including a change carried across the release's wait.
 */

import { describe, expect, it } from "vitest";
import {
  selectUsernameCard,
  type UsernameCardInput,
  type UsernameCardState,
} from "../../modules/ens/username";
import type { Address, ENSRegistrationData } from "../../types/domain";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;

const active = (owner: Address): ENSRegistrationData => ({
  status: "active",
  registration: { owner, nameType: 0, registeredAt: "1" },
});
const RELEASING: ENSRegistrationData = { status: "pending", release: { owner: OWNER } };
const CLEARED: ENSRegistrationData = { status: "available", release: { owner: OWNER } };
const CHANGE = { from: "ines", to: "ines-duarte", releasedAt: 1 };

const BASE: UsernameCardInput = {
  owner: OWNER,
  isMember: true,
  nameLoading: false,
  slug: "ines",
  claimedHere: false,
  claiming: null,
  status: active(OWNER),
  statusError: false,
  change: null,
  changeTargetFree: undefined,
};

/** One row of the table: a case, what differs from BASE, and the state it reads as. */
const row = (label: string, input: Partial<UsernameCardInput>, expected: UsernameCardState) =>
  [label, input, expected] as const;

describe("selectUsernameCard", () => {
  it.each([
    row("waits for an account", { owner: undefined }, { kind: "loading" }),
    row("waits for membership", { isMember: undefined }, { kind: "loading" }),
    row("reads a resolving name as ready", {}, { kind: "ready", slug: "ines" }),
    row(
      "reads a name on its way to Ethereum as setting up",
      { status: { status: "pending" } },
      { kind: "setting-up", slug: "ines", claimedHere: false }
    ),
    row(
      "says a name claimed here was claimed",
      { status: { status: "pending" }, claimedHere: true },
      { kind: "setting-up", slug: "ines", claimedHere: true }
    ),
    row(
      "says a slow setup is taking longer",
      { status: { status: "timed_out" } },
      { kind: "taking-longer", slug: "ines" }
    ),
    row(
      "calls a failed check with nothing known unknown, not a failed name",
      { status: undefined, statusError: true },
      { kind: "unknown", slug: "ines" }
    ),
    row(
      "keeps the last known status when a later check fails",
      { statusError: true },
      { kind: "ready", slug: "ines" }
    ),
    row("waits on the first check", { status: undefined }, { kind: "checking", slug: "ines" }),
    row(
      "holds on a claim in flight even when a read already calls the name taken",
      { claiming: "ines-duarte", slug: null, status: undefined },
      { kind: "claiming", slug: "ines-duarte" }
    ),
    row(
      "asks for a first name",
      { slug: null, status: undefined },
      { kind: "choose", after: "none", taken: null }
    ),
    row(
      "keeps a first name locked outside a garden",
      { slug: null, isMember: false },
      { kind: "locked" }
    ),
    row("waits for the account's own name", { slug: null, nameLoading: true }, { kind: "loading" }),
    row(
      "asks again when a stale lookup points at another account's name",
      { status: active(OTHER) },
      { kind: "choose", after: "released", taken: null }
    ),
    row(
      "shows a release started elsewhere as step 1, with no new name",
      { status: RELEASING },
      { kind: "releasing", from: "ines", to: null }
    ),
    row(
      "carries a change on step 1 while the old name releases",
      { change: CHANGE, status: RELEASING },
      { kind: "releasing", from: "ines", to: "ines-duarte" }
    ),
    row(
      "stays on step 1 while a check fails, never guessing the release cleared",
      { change: CHANGE, slug: null, status: undefined, statusError: true },
      { kind: "releasing", from: "ines", to: "ines-duarte" }
    ),
    row(
      "offers the new name's claim once the old one cleared",
      { change: CHANGE, slug: null, status: CLEARED, changeTargetFree: true },
      { kind: "claimable", to: "ines-duarte" }
    ),
    row(
      "asks again when the new name was taken while waiting",
      { change: CHANGE, slug: null, status: CLEARED, changeTargetFree: false },
      { kind: "choose", after: "taken", taken: "ines-duarte" }
    ),
    row(
      "asks for another name after Choose Another",
      { change: { ...CHANGE, to: null }, slug: null, status: CLEARED },
      { kind: "choose", after: "released", taken: null }
    ),
    row(
      "locks the claim when the account left every garden meanwhile",
      { change: CHANGE, slug: null, status: CLEARED, isMember: false },
      { kind: "locked" }
    ),
    row(
      "ends a change once the account holds some other name",
      { change: CHANGE, slug: "ines-d" },
      { kind: "ready", slug: "ines-d" }
    ),
  ])("%s", (_, input, expected) => {
    expect(selectUsernameCard({ ...BASE, ...input })).toEqual(expected);
  });
});

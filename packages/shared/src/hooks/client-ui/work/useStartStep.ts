import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  WorkablePromise,
  WorkLinkChoice,
} from "../../../modules/commitment-pooling/work-link-intent";
import {
  answerStartStep,
  gardenActionDomains,
  listGardenActions,
  listStartPromises,
  type StartPromisesRead,
  startPromiseKind,
  type WorkLinkStatus,
} from "../../../modules/work/submission-flow";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import { WorkTab } from "../../../stores/workFlowTypes";
import type { Action, Address, Garden } from "../../../types/domain";
import { parseActionUID } from "../../../utils/action/parsers";
import { compareAddresses } from "../../../utils/blockchain/address";

/** Which of Start's screens shows: the promises, one promise's own screen, or the actions. */
export type StartScreen =
  | { kind: "promises" }
  | { kind: "promise"; promise: WorkablePromise }
  | { kind: "actions" };

interface StartStepOptions {
  actions: Action[];
  /** The chain's actions are still being read, so what the garden offers is not known yet. */
  actionsLoading: boolean;
  /** The gardens the member can submit work to; the flow's garden is found among them. */
  gardens: Garden[];
  gardenAddress: Address | null;
  gardenSettled: boolean;
  activeTab: WorkTab;
  /** The draft is still being reconciled with the page, or its prompt waits: nothing moves. */
  holding: boolean;
  hasDraft: boolean;
  link: { status: WorkLinkStatus; atEntry: boolean; hasParams: boolean };
  /** The member's promises in the flow's garden (`useWorkablePromises`). */
  promises: {
    data: WorkablePromise[] | undefined;
    isPending: boolean;
    isError: boolean;
    fetchStatus: "fetching" | "paused" | "idle";
    refetch: () => unknown;
  };
  /** The garden's Open asks the step lists beside the member's promises (step 17). */
  openAsks?: number;
  setActiveTab: (tab: WorkTab) => void;
  changeTab: (tab: WorkTab) => Promise<void>;
  selectLinkIntent: (choice: WorkLinkChoice) => void;
  clearLinkIntent: () => void;
  openEvidence: (promise: WorkablePromise) => void;
}

/** How far the one automatic skip has got: Start opens once per visit, then it is the member's. */
type AutoSkip = "unknown" | "allowed" | "spent";

/**
 * The Start step of logging work (DL-131): what it offers, which of its screens shows, and its
 * one automatic move. With promises the member could work on, the step lists them; a promise with
 * actions opens its own screen, an evidence-only one opens the evidence flow at once, and Log Work
 * on Its Own leads to the garden's actions. Choosing an action moves on, and the domain chips only
 * filter, so the step has no forward act. When its answer is known (`answerStartStep`) the flow
 * opens on Media instead, once, as the step is first shown in a visit: the garden's only action is
 * the flow's own pick (`startSkipAction`), and a promise link names its action itself.
 */
export function useStartStep({
  actions,
  actionsLoading,
  gardens,
  gardenAddress,
  gardenSettled,
  activeTab,
  holding,
  hasDraft,
  link,
  promises,
  openAsks = 0,
  setActiveTab,
  changeTab,
  selectLinkIntent,
  clearLinkIntent,
  openEvidence,
}: StartStepOptions) {
  const garden = gardens.find((each) => compareAddresses(each.id, gardenAddress)) ?? null;
  const { offered, domains, listed } = useMemo(() => {
    const offeredActions = listGardenActions(actions, garden, Date.now());
    const uids = new Set(offeredActions.map((action) => parseActionUID(action.id) as number));
    return {
      offered: offeredActions,
      domains: gardenActionDomains(garden, offeredActions),
      listed: listStartPromises(promises.data ?? [], uids),
    };
  }, [actions, garden, promises.data]);

  // A read paused by the connection or one that failed says nothing about what is owed.
  const read: StartPromisesRead = promises.data
    ? { status: "ready", count: listed.length }
    : promises.isError || promises.fetchStatus === "paused"
      ? { status: "unknown" }
      : { status: "loading" };
  const answer = answerStartStep({
    link,
    gardenSettled,
    promises: read,
    openAsks,
    actionUIDs:
      actionsLoading && actions.length === 0
        ? null
        : offered.map((action) => parseActionUID(action.id) as number),
  });
  const skipAction = answer.kind === "skip" ? answer.actionUID : null;

  const autoSkip = useRef<AutoSkip>("unknown");
  useLayoutEffect(() => {
    if (holding) return;
    const store = useWorkFlowStore.getState();
    const preset = store.startSkipAction;
    // The flow's own pick belongs to its garden: until the work has a draft, another garden
    // takes it back, and Start opens again for that garden.
    if (
      preset &&
      !hasDraft &&
      store.actionUID === preset.actionUID &&
      !compareAddresses(preset.garden, gardenAddress)
    ) {
      useWorkFlowStore.setState({ startSkipAction: null });
      store.setActionUID(null);
      setActiveTab(WorkTab.Intro);
      autoSkip.current = "unknown";
      return;
    }
    if (autoSkip.current === "unknown")
      autoSkip.current = activeTab === WorkTab.Intro ? "allowed" : "spent";
    if (activeTab !== WorkTab.Intro) autoSkip.current = "spent";
    // A garden still being chosen, or settling this commit, decides nothing yet.
    if (autoSkip.current !== "allowed" || !gardenSettled || answer.kind === "wait") return;
    // The step's first answer in this visit decides; once Start has shown, it is the member's.
    autoSkip.current = "spent";
    if (answer.kind !== "skip") return;
    if (skipAction !== null && gardenAddress) {
      store.setActionUID(skipAction);
      useWorkFlowStore.setState({
        startSkipAction: { garden: gardenAddress, actionUID: skipAction },
      });
    }
    setActiveTab(WorkTab.Media);
  }, [
    holding,
    hasDraft,
    gardenAddress,
    gardenSettled,
    activeTab,
    answer.kind,
    skipAction,
    setActiveTab,
  ]);

  const [screen, setScreen] = useState<
    { kind: "promises" } | { kind: "promise"; commitmentId: bigint } | { kind: "actions" }
  >({ kind: "promises" });
  const hasPromises = listed.length > 0 || openAsks > 0;
  const root: StartScreen = hasPromises ? { kind: "promises" } : { kind: "actions" };
  const open =
    screen.kind === "promise"
      ? listed.find((each) => each.commitmentId === screen.commitmentId)
      : null;
  // A screen that no longer has anything to show gives way to the step's first one.
  const shown: StartScreen = open
    ? { kind: "promise", promise: open }
    : screen.kind === "actions" && hasPromises
      ? { kind: "actions" }
      : root;

  /** The member's own pick: it replaces anything the flow chose for them. */
  const pickAction = (uid: number) => {
    useWorkFlowStore.setState({ startSkipAction: null });
    useWorkFlowStore.getState().setActionUID(uid);
  };

  return {
    /** Start's answer is known, so the flow's path opens on Media (decision 17). */
    skipped: answer.kind === "skip",
    /** The step waits for an answer before it shows anything, so nothing moves under the thumb. */
    waiting: answer.kind === "wait",
    /** The garden's actions on offer, and the domains its chips filter by (one: no chips). */
    actions: offered,
    domains,
    /** The member's promises the step lists, each with what they can do on it here. */
    promises: listed,
    /** The member's promises could not be read: the step offers the actions and a retry. */
    promisesFailed: promises.isError && !promises.data,
    retryPromises: () => void promises.refetch(),
    screen: shown,
    /** Opens a listed promise: its own screen, or the evidence flow when that is all it takes. */
    pickPromise: (promise: WorkablePromise) => {
      if (startPromiseKind(promise) === "evidence") openEvidence(promise);
      else setScreen({ kind: "promise", commitmentId: promise.commitmentId });
    },
    logWorkOnItsOwn: () => setScreen({ kind: "actions" }),
    /** An action with no promise: a link that no longer holds is taken off, and the flow moves on. */
    chooseAction: async (uid: number) => {
      if (link.hasParams) clearLinkIntent();
      pickAction(uid);
      await changeTab(WorkTab.Media);
    },
    /** One of a promise's actions: the work is linked to that requirement, and the flow moves on. */
    choosePromiseAction: async (choice: WorkLinkChoice) => {
      useWorkFlowStore.setState({ startSkipAction: null });
      selectLinkIntent(choice);
      await changeTab(WorkTab.Media);
    },
    addEvidence: openEvidence,
    /** Back through the step's own screens; false on its first one, where Back leaves the flow. */
    back: () => {
      if (shown.kind === root.kind) return false;
      setScreen({ kind: "promises" });
      return true;
    },
  };
}

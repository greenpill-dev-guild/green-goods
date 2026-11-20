import {
  SERVICE_ISSUER_ROUTES,
  useCommitmentMutation,
  useVoucherAwards,
} from "@green-goods/shared/commitment-pooling";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import {
  useVoucherConsole,
  useVoucherStart,
  type VoucherStartProgress,
} from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import type {
  IssuerSafeThreshold,
  VoucherAsk,
  VoucherBooking,
  VoucherConsoleSnapshot,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type {
  CommitmentReadModel,
  PoolClaimRequestRow,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { VoucherAwardRecord } from "@green-goods/shared/public-contracts/voucher-awards";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, mocked, screen, userEvent, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import {
  pinChainClock,
  useChainClockReader,
} from "../../../../../shared/.storybook/chainClockMock";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { daysAgo, STORYBOOK_NOW_SECONDS } from "../../../../../shared/.storybook/fixtures";
import {
  JourneyBand,
  type JourneyFlow,
  JourneyPlayer,
  type JourneyStepNote,
  useJourneyEmbed,
} from "../../../../../shared/.storybook/journeyPlayer";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { VoucherIssuerCard } from "../../Community/components/VoucherIssuerOnboarding";
import {
  type VoucherIssuerStory,
  voucherIssuerStory,
} from "../../Community/components/voucherIssuerStoryFixtures";
import { GardenPoolTab } from "./index";
import { STORY_GARDEN, STORY_PRICE_SEED } from "./poolStoryFixtures";
import { STORY_CYCLES, storyPool } from "./poolStoryPools";
import {
  nameVoucherMembers,
  STORY_GREEN_GOODS_CLAIMS,
  STORY_GREEN_GOODS_COMMITMENTS,
  STORY_GREEN_GOODS_SAFE,
  STORY_GREEN_GOODS_VOUCHERS,
  STORY_LINA_ASK,
  STORY_LINA_ENDED,
  STORY_MARA_ACCESS_ASK,
  STORY_HUB_DAY_TITLES,
  STORY_MARA_VISIT,
  STORY_MARA_VISITED,
  STORY_MAYA_ASK,
  STORY_TECH_AND_SUN_CLAIMS,
  STORY_TECH_AND_SUN_COMMITMENTS,
  STORY_TECH_AND_SUN_SAFE,
  STORY_TECH_AND_SUN_SHORT,
  STORY_TECH_AND_SUN_VOUCHERS,
  storyHubDay,
  storyVoucherConsole,
  voucherConsoleSeeds,
} from "./poolStoryVouchers";
import { awardStoryRecord } from "./voucherAwardStoryFixtures";

const VOUCHER = 1_000_000n;
/** Accept and Start's two start sends, landed. */
const STORY_START_DONE: VoucherStartProgress = {
  record: "done",
  send: "done",
  fee: 41_000_000_000_000n,
  hashes: { record: `0x${"b1".repeat(32)}`, send: `0x${"b2".repeat(32)}` },
};
/** The steward's own acts on the console, each leading to the step that follows it. */
type HubAct = "approve" | "accept" | "report" | "propose" | "retry" | "raise" | "send" | "award";

/** One step of a Hub journey: what the console reads, and who moves it on from here. */
interface HubStep extends JourneyStepNote {
  commitments: readonly CommitmentReadModel[];
  claims: readonly PoolClaimRequestRow[];
  vouchers: VoucherConsoleSnapshot;
  acts?: Partial<Record<HubAct, number>>;
  /** Whose rows move the walk on; the steward's acts on anyone else's land where they are. */
  actor?: Address;
  /** Community's Voucher Issuers card in this state, in place of the Promises tab. */
  issuers?: VoucherIssuerStory;
}

const LINA_OFFER = STORY_TECH_AND_SUN_COMMITMENTS[2];
const [LINA_CLAIM, KWESI_CLAIM] = STORY_TECH_AND_SUN_CLAIMS as [
  PoolClaimRequestRow,
  PoolClaimRequestRow,
];
const TAS = STORY_TECH_AND_SUN_VOUCHERS;
const TAS_RESERVE = TAS.reserve!;
const KWESI_ASK = TAS.asks[1]!;

const withSetup = (ask: VoucherAsk, change: Partial<NonNullable<VoucherAsk["setup"]>>) => ({
  ...ask,
  setup: { ...ask.setup!, ...change },
});
const kept = (offer: CommitmentReadModel): CommitmentReadModel => ({
  ...offer,
  onchainState: "FULFILLED",
  derivedState: "FULFILLED",
  state: "FULFILLED",
});

// Flow 1, Tech and Sun: Lina's hub day from her ask to the voucher back in the reserve.
const LINA = STORY_LINA_ASK.buyer;
const MARA = STORY_MARA_VISIT.holder;
const LINA_APPROVED = withSetup(STORY_LINA_ASK, { approvedAt: daysAgo(0) });
const LINA_READY = withSetup(LINA_APPROVED, { depositedUnits: VOUCHER, depositConfirmed: true });
const linaBooking = (visit: VoucherBooking): VoucherBooking => ({
  ...visit,
  commitmentId: LINA_OFFER!.commitmentId,
  holder: LINA,
  setupId: `0x${"d7".repeat(32)}`,
});
/** Lina's hub day, four days out, then once it has happened. */
const LINA_VISIT = linaBooking(STORY_MARA_VISIT);
const LINA_VISITED = linaBooking(STORY_MARA_VISITED);
/** Two neighbors booked earlier, beside Mara: the list counts them, and they wait on no one. */
const OTHERS_BOOKED = [STORY_GREEN_GOODS_CLAIMS[0]!.claim.claimant, STORY_MAYA_ASK.buyer];
/**
 * The twenty hub days Tech and Sun made together, one row in the list: Lina asked for the
 * first, Kwesi the second, Mara and two neighbors booked three more.
 */
const hubDays = (lina: "open" | "taken" | "kept"): CommitmentReadModel[] =>
  Array.from({ length: 20 }, (_, index) => {
    const id = 41 + index;
    const holder =
      id === 41 && lina !== "open" ? LINA : id === 43 ? MARA : (OTHERS_BOOKED[id - 44] ?? null);
    if (!holder) return storyHubDay(id);
    const copy = storyHubDay(id, {
      onchainState: "ACCEPTED",
      derivedState: "ACTIVE",
      state: "ACCEPTED",
      counterparty: holder,
    });
    return id === 41 && lina === "kept" ? kept(copy) : copy;
  });
/** Tech and Sun's read: Kwesi's deposit to accept and Mara's visit to report, beside Lina's. */
const hubDayRead = (
  lina: { ask?: VoucherAsk; booking?: VoucherBooking },
  reserve = TAS_RESERVE
): HubStep["vouchers"] => ({
  ...TAS,
  asks: [...(lina.ask ? [lina.ask] : []), KWESI_ASK],
  bookings: [STORY_MARA_VISITED, ...(lina.booking ? [lina.booking] : [])],
  reserve,
});
/** Lina's and Kwesi's asks, on the hub days as the list has them. */
const onHubDay = (row: PoolClaimRequestRow, id: number): PoolClaimRequestRow => ({
  ...row,
  commitment: storyHubDay(id),
});
const LINA_ASKED = onHubDay(LINA_CLAIM, 41);
const KWESI_ASKED = onHubDay(KWESI_CLAIM, 42);
const HUB_DAY_ASKED = {
  commitments: hubDays("open"),
  claims: [LINA_ASKED, KWESI_ASKED],
  actor: LINA,
};
const HUB_DAY_BOOKED = { commitments: hubDays("taken"), claims: [KWESI_ASKED], actor: LINA };

const HUB_DAY: HubStep[] = [
  {
    caption:
      "Everything that waits on you is in Review Promises: Lina's booking to approve, Kwesi's deposit to accept and Mara's visit to report. The 20 hub days are one row in the list.",
    ...HUB_DAY_ASKED,
    vouchers: hubDayRead({ ask: STORY_LINA_ASK }),
    acts: { approve: 1 },
  },
  {
    caption:
      "Approved. Lina's row keeps its place with its outcome for this visit. Nothing is yours to do until she deposits.",
    ...HUB_DAY_ASKED,
    vouchers: hubDayRead({ ask: LINA_APPROVED }),
    next: "Lina deposits her voucher",
  },
  {
    caption: "Lina deposited. Her booking is back in the queue, this time to accept.",
    ...HUB_DAY_ASKED,
    vouchers: hubDayRead({ ask: LINA_READY }),
    acts: { accept: 3 },
  },
  {
    caption:
      "Accepted. Her booking is under way, and the list counts it booked. Nothing more is yours until her visit.",
    ...HUB_DAY_BOOKED,
    vouchers: hubDayRead({ booking: LINA_VISIT }),
    next: "Lina visits the hub",
  },
  {
    caption:
      "The visit day has passed. Report Visit waits in Review Promises with the other acts, not in the list.",
    ...HUB_DAY_BOOKED,
    vouchers: hubDayRead({ booking: LINA_VISITED }),
    acts: { report: 5 },
  },
  {
    caption: "Reported. Nothing moves until Lina confirms her visit.",
    ...HUB_DAY_BOOKED,
    vouchers: hubDayRead({ booking: LINA_VISITED }),
    next: "Lina confirms her visit",
  },
  {
    caption: "Kept. Lina's voucher is back in your reserve, and her booking has left the queue.",
    commitments: hubDays("kept"),
    claims: [KWESI_ASKED],
    actor: LINA,
    vouchers: hubDayRead({}, { ...TAS_RESERVE, inReserve: TAS_RESERVE.inReserve + VOUCHER }),
  },
  {
    caption:
      "Side state. Lina's seven days to be accepted ran out before her deposit was confirmed.",
    ...HUB_DAY_ASKED,
    vouchers: hubDayRead({
      ask: withSetup(LINA_APPROVED, { acceptBy: STORYBOOK_NOW_SECONDS - 3_600 }),
    }),
  },
  {
    caption:
      "Side state. The transfer to your reserve didn't go through. Anyone can retry the same one.",
    ...HUB_DAY_BOOKED,
    vouchers: hubDayRead({
      booking: { ...LINA_VISITED, stage: { kind: "transfer-failed", units: VOUCHER } },
    }),
    acts: { retry: 6 },
  },
];

// Flow 2, Tech and Sun: rewards another garden promised in its vouchers, drawn from its reserve.
const EARN_OPEN = {
  commitments: STORY_TECH_AND_SUN_COMMITMENTS,
  claims: STORY_TECH_AND_SUN_CLAIMS,
};
const SHORT_RESERVE = STORY_TECH_AND_SUN_SHORT.reserve!;
const EARN: HubStep[] = [
  {
    caption:
      "Riverside Commons promised 2 of your vouchers for mapping its water lines. Your Reserve holds 8, with 2 of Riverside's allowance of 4 left.",
    ...EARN_OPEN,
    vouchers: TAS,
    next: "Riverside's stewards confirm Lina's work",
  },
  {
    caption:
      "Her work is confirmed and the 2 vouchers left your reserve under the allowance. Nothing here needed your signature.",
    ...EARN_OPEN,
    vouchers: {
      ...TAS,
      reserve: {
        ...TAS_RESERVE,
        inReserve: 6n * VOUCHER,
        promised: 1n * VOUCHER,
        allowance: { ...TAS_RESERVE.allowance, left: 0n },
      },
    },
    next: "Another reward comes due",
  },
  {
    caption:
      "Riverside's allowance is used up, so the next reward waits. It is unchanged, not lost. Raising the allowance sends it.",
    ...EARN_OPEN,
    vouchers: { ...TAS, reserve: { ...SHORT_RESERVE, inReserve: 6n * VOUCHER } },
    acts: { raise: 3 },
  },
  {
    caption: "Raised to 6. The waiting reward was delivered once, and the reserve holds 4.",
    ...EARN_OPEN,
    vouchers: {
      ...TAS,
      reserve: {
        ...TAS_RESERVE,
        inReserve: 4n * VOUCHER,
        promised: 1n * VOUCHER,
        allowance: { ...TAS_RESERVE.allowance, limit: 6n * VOUCHER, left: 0n },
      },
    },
  },
];

// Flow 3, Green Goods: Lina exchanged for 10 Green Goods vouchers and books Claude access.
const GG = STORY_GREEN_GOODS_VOUCHERS;
const [LINA_ACCESS, KWESI_ACCESS, RAFA_OFFER] = STORY_GREEN_GOODS_COMMITMENTS;
const RAFA_CLAIM = STORY_GREEN_GOODS_CLAIMS[0]!;
const RAFA_ASK = GG.asks[0]!;
const KWESI_SEAT = GG.bookings[1]!;
const LINA_ACCESS_OFFER: CommitmentReadModel = {
  ...LINA_ACCESS!,
  onchainState: "OFFERED",
  derivedState: "OFFERED",
  state: "OFFERED",
  counterparty: null,
};
const LINA_ACCESS_CLAIM: PoolClaimRequestRow = {
  claim: {
    ...RAFA_CLAIM.claim,
    id: `${DEFAULT_CHAIN_ID}-${LINA_ACCESS!.commitmentId}-${LINA}`,
    commitmentId: LINA_ACCESS!.commitmentId,
    claimant: LINA,
    requestedBy: LINA,
  },
  commitment: LINA_ACCESS_OFFER,
};
const LINA_ACCESS_READY: VoucherAsk = {
  ...STORY_MARA_ACCESS_ASK,
  commitmentId: LINA_ACCESS!.commitmentId,
  buyer: LINA,
};
const LINA_ACCESS_ASKED = withSetup(LINA_ACCESS_READY, {
  approvedAt: null,
  depositedUnits: 0n,
  depositConfirmed: false,
});
const LINA_SEAT: VoucherBooking = {
  ...STORY_LINA_ENDED,
  service: { kind: "access", daysUsed: 0, daysOf: 30 },
  stage: { kind: "in-progress" },
};
const ACCESS_ASKED = {
  commitments: [LINA_ACCESS_OFFER, KWESI_ACCESS!, RAFA_OFFER!],
  claims: [LINA_ACCESS_CLAIM, RAFA_CLAIM],
};
const ACCESS_TAKEN = { commitments: STORY_GREEN_GOODS_COMMITMENTS, claims: [RAFA_CLAIM] };
const accessAsks = (lina: VoucherAsk): HubStep["vouchers"] => ({
  ...GG,
  asks: [lina, RAFA_ASK],
  bookings: [KWESI_SEAT],
});
const accessBooked = (lina: VoucherBooking): HubStep["vouchers"] => ({
  ...GG,
  bookings: [lina, KWESI_SEAT],
});

const ACCESS: HubStep[] = [
  {
    caption:
      "Lina exchanged in the shared pool and agreed to Claude access for 10 Green Goods vouchers. Your Safe signs 2 of 5 to approve.",
    ...ACCESS_ASKED,
    vouchers: accessAsks(LINA_ACCESS_ASKED),
    acts: { approve: 1 },
  },
  {
    caption: "Your approval is with the Safe. It lets her deposit once a second owner has signed.",
    ...ACCESS_ASKED,
    vouchers: accessAsks(LINA_ACCESS_ASKED),
    next: "A second owner signs, and Lina deposits",
  },
  {
    caption: "Her 10 vouchers are confirmed in escrow. Accepting starts her 30 days.",
    ...ACCESS_ASKED,
    vouchers: accessAsks(LINA_ACCESS_READY),
    acts: { accept: 3 },
  },
  {
    caption: "Accepted. Her access is under way beside Kwesi's.",
    ...ACCESS_TAKEN,
    vouchers: accessBooked(LINA_SEAT),
    next: "Her seat stops after 12 days",
  },
  {
    caption:
      "Her access ended early, 12 of 30 days used. Propose what comes back, within your terms: up to 6 of her 10.",
    ...ACCESS_TAKEN,
    vouchers: accessBooked(STORY_LINA_ENDED),
    acts: { propose: 5 },
  },
  {
    caption: "Proposed: 6 back to Lina. Nothing moves until she approves the split.",
    ...ACCESS_TAKEN,
    vouchers: accessBooked({
      ...STORY_LINA_ENDED,
      stage: { kind: "ended-early", returnLimit: 6n * VOUCHER, returnCeiling: 6n * VOUCHER },
    }),
    next: "Lina approves the split",
  },
  {
    caption:
      "Your 4 arrived. The 6 back to Lina didn't go through, so the booking needs recovery. Anyone can retry it.",
    ...ACCESS_TAKEN,
    vouchers: accessBooked({
      ...STORY_LINA_ENDED,
      stage: { kind: "return-failed", units: 6n * VOUCHER },
    }),
    acts: { retry: 7 },
  },
  {
    caption: "Both transfers arrived: 6 back with Lina, 4 in your reserve.",
    commitments: [KWESI_ACCESS!, RAFA_OFFER!],
    claims: [RAFA_CLAIM],
    vouchers: {
      ...GG,
      bookings: [KWESI_SEAT],
      reserve: { ...GG.reserve!, inReserve: GG.reserve!.inReserve + 4n * VOUCHER, openBookings: 1 },
    },
  },
];

// Flow 4: a member becomes an issuer in Community, then Tech and Sun awards vouchers for past work.
const AWARD_ASSET = SERVICE_ISSUER_ROUTES[0]!.assets[0]!;
const AWARD_SAFE: IssuerSafeThreshold = {
  ...STORY_TECH_AND_SUN_SAFE,
  safe: AWARD_ASSET.ownerReserve,
};
const awardIssuer = { ...TAS.issuer!, safe: AWARD_ASSET.ownerReserve };
const awardConsole = (inReserve: bigint): HubStep["vouchers"] => ({
  ...TAS,
  issuer: awardIssuer,
  reserve: { ...TAS_RESERVE, issuer: awardIssuer, inReserve },
});
const issuerStep = (
  issuers: VoucherIssuerStory,
  caption: string,
  rest: Pick<HubStep, "next" | "acts"> = {}
): HubStep => ({ caption, issuers, ...EARN_OPEN, vouchers: TAS, ...rest });

const SETUP: HubStep[] = [
  issuerStep(
    "prepareDraft",
    "In Community, Teo's draft sits with the listed issuers. He wants to issue lesson vouchers. Open his draft, check it, and send it to him.",
    { acts: { send: 1 } }
  ),
  issuerStep(
    "awaitingTeo",
    "Sent. Only Teo can approve his own terms, from his own account. You can remind him.",
    { next: "Teo approves from his account" }
  ),
  issuerStep("approved", "Teo signed. His approval shows the exact terms he agreed to.", {
    next: "Prepare the owner Safe's drafts",
  }),
  issuerStep(
    "ownerSafeDrafts",
    "The exchange pool's owner Safe lists his token. Its drafts are ready to copy for the signers.",
    { next: "The Safe registers Teo's token" }
  ),
  issuerStep(
    "registered",
    "Registered. His token waits for its holding cap, so nobody can exchange for it yet.",
    { next: "The Safe sets the cap" }
  ),
  issuerStep("listed", "Listed. Teo's lesson vouchers can be exchanged and booked.", {
    next: "Go to Tech and Sun's Promises tab",
  }),
  {
    caption:
      "Your Reserve can also award vouchers for past work. Open Award Vouchers, name the member and the contribution, then review, prepare and send.",
    ...EARN_OPEN,
    vouchers: awardConsole(TAS_RESERVE.inReserve),
    acts: { award: 7 },
  },
  {
    caption:
      "Awarded. 2 vouchers left your reserve, and the member's wallet shows the award's receipt.",
    ...EARN_OPEN,
    vouchers: awardConsole(TAS_RESERVE.inReserve - 2n * VOUCHER),
  },
];

interface HubFlow {
  title: string;
  who: string;
  garden: string;
  steps: readonly HubStep[];
  /** Where the main path ends; the steps after it are side states. */
  mainSteps: number;
}

const FLOWS = {
  hubDay: {
    title: "Redeem a hub day",
    who: "Tech and Sun's steward, a signer on its Safe",
    garden: "Tech and Sun",
    steps: HUB_DAY,
    mainSteps: 7,
  },
  earn: {
    title: "Earn vouchers",
    who: "Tech and Sun's steward, whose reserve pays the rewards",
    garden: "Tech and Sun",
    steps: EARN,
    mainSteps: EARN.length,
  },
  access: {
    title: "Exchange then redeem",
    who: "a Green Goods steward, one of five Safe owners",
    garden: "Green Goods Community Garden",
    steps: ACCESS,
    mainSteps: ACCESS.length,
  },
  setup: {
    title: "Setup and awards",
    who: "a steward: Green Goods' in Community, then Tech and Sun's",
    garden: "Tech and Sun",
    steps: SETUP,
    mainSteps: SETUP.length,
  },
} satisfies Record<string, HubFlow>;
type FlowId = keyof typeof FLOWS;

/**
 * The Promises tab as the steward sees it, driven by the journey: the steward's own acts run
 * through the tab's real rows and dialogs, and an act on the walk's own person moves it on within
 * the same visit, so the row keeps its outcome. The band's button plays everyone else, and each
 * of its steps is a later visit to the tab. Nothing signs, reads a chain or downloads a Safe file.
 */
function HubJourneyPage({ journey, start }: { journey: FlowId; start: number }) {
  const flow: HubFlow = FLOWS[journey];
  const [index, setIndex] = useState(Math.min(start, flow.steps.length - 1));
  // Each band step is a later visit to the tab, so it starts with nothing decided.
  const [visit, setVisit] = useState(0);
  const go = useCallback((next: number) => {
    setIndex(next);
    setVisit((current) => current + 1);
  }, []);
  useEffect(() => go(Math.min(start, flow.steps.length - 1)), [start, flow.steps.length, go]);
  const embedded = useJourneyEmbed(index, flow.steps.length, go);
  const step = flow.steps[index]!;
  const lead =
    (act: HubAct) =>
    async (person?: Address): Promise<undefined> => {
      const target = step.acts?.[act];
      const theirs = !step.actor || !person || person.toLowerCase() === step.actor.toLowerCase();
      if (target !== undefined && theirs) setIndex(target);
    };
  // The real pool console reads the step's promises and asks from the query cache; only the
  // sends are stood in for, so accepting a booking moves the walk on instead of signing.
  const client = useQueryClient();
  useLayoutEffect(() => {
    for (const [key, data] of stepSeeds(step)) client.setQueryData(key, data);
  }, [client, step]);
  mocked(useCommitmentMutation).mockReturnValue({
    isPending: false,
    mutateAsync: async (input: { action: string; buyer?: Address }) => {
      if (input.action === "acceptServiceClaim") await lead("accept")(input.buyer);
      return "0x0";
    },
  } as unknown as ReturnType<typeof useCommitmentMutation>);
  // Accept and Start's start lands at once: the walk shows its sends done, never a live read.
  mocked(useVoucherStart).mockReturnValue({
    start: async () => "started",
    progress: STORY_START_DONE,
    reset: () => undefined,
  });
  // A zero chain time defers to the console's own clock, the story's time.
  pinChainClock(0);
  // The award desk's records live with the journey: prepared, then confirmed once sent.
  const [awards, setAwards] = useState<VoucherAwardRecord[]>([]);
  const mutation = <Input, Output>(mutateAsync: (input: Input) => Promise<Output>) => ({
    isPending: false,
    mutateAsync,
  });
  const sendAward = async (record: VoucherAwardRecord) => {
    const sent = {
      ...record,
      state: "confirmed" as const,
      transactionHash: `0x${"b".repeat(64)}` as const,
    };
    setAwards([sent]);
    await lead("award")();
    return { record: sent, operation: null };
  };
  mocked(useVoucherAwards).mockReturnValue({
    records: awards,
    isLimited: false,
    directSigningAvailable: true,
    load: mutation(async () => undefined),
    prepare: mutation(async (award: VoucherAwardRecord["award"]) => {
      const prepared = {
        ...awardStoryRecord,
        award,
        safe: { ...awardStoryRecord.safe, threshold: 1 },
      };
      setAwards([prepared]);
      return prepared;
    }),
    send: mutation(sendAward),
    recover: mutation(sendAward),
    reconcile: mutation(async () => awards[0]),
  } as unknown as ReturnType<typeof useVoucherAwards>);
  mocked(useVoucherConsole).mockReturnValue(
    storyVoucherConsole(step.vouchers, {
      approveBooking: (ask) => lead("approve")(ask.buyer),
      reportVisit: (booking) => lead("report")(booking.holder),
      proposeReturn: (booking) => lead("propose")(booking.holder),
      retryTransfer: (booking) => lead("retry")(booking.holder),
      raiseAllowance: () => lead("raise")(),
    })
  );
  return (
    <div className="min-h-dvh" data-tone="garden" data-workspace="garden">
      {embedded ? null : (
        <JourneyBand
          who={`You are ${flow.who}`}
          index={index}
          count={flow.steps.length}
          step={step}
          onGo={go}
        />
      )}
      {step.issuers ? (
        <div className="max-w-xl p-4" data-tone="community">
          <VoucherIssuerCard
            canPrepare
            {...voucherIssuerStory(step.issuers)}
            onSend={() => void lead("send")()}
            onRemind={() => undefined}
          />
        </div>
      ) : (
        <div className="p-4">
          <GardenPoolTab
            key={visit}
            garden={{ id: STORY_GARDEN, name: flow.garden }}
            chainId={DEFAULT_CHAIN_ID}
            canManage
          />
        </div>
      )}
    </div>
  );
}

/**
 * The tab's dialogs guard a dirty close through a data router. Every path draws the journey: a
 * row opens its promise in the workspace's inspector, which this walk leaves out.
 */
function HubVoucherJourney({ journey, start }: { journey: FlowId; start: number }) {
  // The first step's reads are in the cache before the tab mounts, so nothing reads a chain.
  const client = useQueryClient();
  useState(() => {
    const steps = FLOWS[journey].steps;
    for (const [key, data] of stepSeeds(steps[Math.min(start, steps.length - 1)]!)) {
      client.setQueryData(key, data);
    }
    return true;
  });
  const router = useMemo(
    () =>
      createMemoryRouter(
        [{ path: "*", element: <HubJourneyPage journey={journey} start={start} /> }],
        { initialEntries: ["/garden/pool"] }
      ),
    [journey, start]
  );
  return <RouterProvider router={router} />;
}

/** One step's promises and asks, under the registry keys the pool console reads. */
function stepSeeds(step: HubStep): ReadonlyArray<readonly [QueryKey, unknown]> {
  return [
    [
      queryKeys.commitmentPooling.commitments(DEFAULT_CHAIN_ID, {
        chainId: DEFAULT_CHAIN_ID,
        poolId: 7n,
      }),
      [...step.commitments],
    ],
    [queryKeys.commitmentPooling.poolClaims(DEFAULT_CHAIN_ID, 7n, "PENDING"), [...step.claims]],
  ];
}

/** The pool itself, its cycles, the G$ price and the offers' titles (hub days made together fold). */
const POOL_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  STORY_PRICE_SEED,
  [queryKeys.commitmentPooling.pools(DEFAULT_CHAIN_ID, STORY_GARDEN), [storyPool()]],
  [queryKeys.commitmentPooling.cycles(DEFAULT_CHAIN_ID, 7n, {}), STORY_CYCLES],
  ...[...STORY_HUB_DAY_TITLES].map(
    ([cid, metadata]) => [queryKeys.commitmentPooling.metadata(cid), metadata] as const
  ),
];

const ISSUER_CATALOG = voucherIssuerStory("issuers").routes[0]!;
const SAFE_SEEDS = [
  voucherConsoleSeeds(TAS, STORY_TECH_AND_SUN_SAFE)[1],
  voucherConsoleSeeds(GG, STORY_GREEN_GOODS_SAFE)[1],
  voucherConsoleSeeds(awardConsole(0n), AWARD_SAFE)[1],
  // The Safes the issuer card reads: the exchange pool's owner and the source adapter's.
  ...(
    [
      [100, ISSUER_CATALOG.pools[0]!.limiter.owner, 2, 5],
      [42161, ISSUER_CATALOG.adapterSource.owner, 3, 4],
    ] as const
  ).map(
    ([chain, safe, threshold, owners]) =>
      [
        queryKeys.commitmentPooling.issuerSafeThreshold(chain, safe),
        { safe, status: "observed", threshold, owners },
      ] as const
  ),
];

/**
 * The voucher pilot from the issuing garden's side, on the real Promises tab with fictional
 * people: approve and accept a booking, report the visit, pay rewards from the reserve, and
 * settle access that ended early. Walkthrough frames every flow beside its narration.
 */
const meta: Meta<typeof HubVoucherJourney> = {
  title: "Admin/Pool/Voucher Journeys",
  component: HubVoucherJourney,
  parameters: { layout: "fullscreen" },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient([...STORYBOOK_ADMIN_SHELL_SEEDS, ...POOL_SEEDS, ...SAFE_SEEDS]),
  ],
  beforeEach: () => {
    const restoreNames = nameVoucherMembers();
    const restoreConsole = resetHookMocks(
      useCommitmentMutation,
      useChainClockReader,
      useVoucherConsole,
      useVoucherAwards
    );
    return () => {
      restoreNames();
      restoreConsole();
    };
  },
  argTypes: { journey: { control: false }, start: { control: { type: "number", min: 0 } } },
  args: { start: 0 },
};
export default meta;
type Story = StoryObj<typeof HubVoucherJourney>;

const flowNote = (id: FlowId): JourneyFlow => {
  const flow: HubFlow = FLOWS[id];
  const story = {
    hubDay: "redeem-hub-day",
    earn: "earn-vouchers",
    access: "exchange-then-redeem",
    setup: "setup-and-awards",
  };
  return {
    id,
    title: flow.title,
    who: flow.who,
    story: `admin-pool-voucher-journeys--${story[id]}`,
    steps: flow.steps.slice(0, flow.mainSteps),
    sideStates: flow.steps.slice(flow.mainSteps).map((step, at) => ({
      label: step.caption.replace(/^Side state\. /, ""),
      step: flow.mainSteps + at,
    })),
  };
};

/** Every Hub flow in one place: the panel narrates, the stage is the story it names. */
export const Walkthrough: StoryObj = {
  render: () => (
    <JourneyPlayer
      surface="Hub"
      flows={[flowNote("setup"), flowNote("earn"), flowNote("hubDay"), flowNote("access")]}
      widths={[
        { label: "1280", width: 1280 },
        { label: "1024", width: 1024 },
        { label: "768", width: 768 },
        { label: "375", width: 375 },
      ]}
      counterpart={{
        label: "Open the App Side",
        story: "client-commitments-voucher-journeys--walkthrough",
      }}
    />
  ),
};

/** Lina's hub day from her ask to the voucher in Tech and Sun's reserve. */
export const RedeemHubDay: Story = { args: { journey: "hubDay" } };

/** Rewards another garden promised in Tech and Sun's vouchers, and the allowance that pays them. */
export const EarnVouchers: Story = { args: { journey: "earn" } };

/** Green Goods' side of Lina's Claude access, through the return when it ends early. */
export const ExchangeThenRedeem: Story = { args: { journey: "access" } };

/** A member becomes an issuer in Community; then an award for past work from Your Reserve. */
export const SetupAndAwards: Story = { args: { journey: "setup" } };

/** The steward's own act moves the walk on: approving Lina's booking through its dialog. */
export const ApproveMovesTheWalkOn: Story = {
  args: { journey: "hubDay" },
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Approve…" }));
    await userEvent.click(await screen.findByRole("button", { name: "Approve Booking" }));
    await expect(await canvas.findByText("Step 2 of 9", { exact: false })).toBeVisible();
  },
};

/** The real pool console accepts a confirmed deposit through the tab's own dialog. */
export const AcceptMovesTheWalkOn: Story = {
  args: { journey: "hubDay", start: 2 },
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Two deposits are confirmed on this step; Lina's, the first row, moves the walk on.
    const [accept] = await canvas.findAllByRole("button", { name: "Accept and Start…" });
    await userEvent.click(accept!);
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(await dialog.findByRole("button", { name: /^Accept / }));
    await expect(await canvas.findByText("Step 4 of 9", { exact: false })).toBeVisible();
  },
};

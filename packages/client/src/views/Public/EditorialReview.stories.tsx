import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import {
  type PublicGardenSummary,
  usePublicGardens,
} from "@green-goods/shared/hooks/public/usePublicGardens";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, within, mocked, fn } from "storybook/test";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import {
  withClientAppRuntime,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { PUBLIC_HISTORY_PAGE_SIZE } from "@green-goods/shared/commitment-pooling/public";
import { PUBLIC_IMPACT_RECORD_FETCH_CAP } from "@green-goods/shared/public-contracts/public-impact";
import { STORYBOOK_NOW_SECONDS } from "../../../../shared/.storybook/fixtures";
import { publicCuration } from "../../content/publicCuration";
import PublicShell from "../../routes/PublicShell";
import ActionsPage from "./Actions";
import Fund from "./Fund";
import GardenDetail from "./GardenDetail";
import Gardens from "./Gardens";
import Home from "./Home";
import Impact from "./Impact";

// Display fixtures for reviewing copy and layout. Banners and TAS/GreenSofa payment
// methods were checked against beta; counts and dates remain illustrative.
const names = ["TAS HUB", "GreenSofa", "Vida Verde", "Rifai Sicilia"];
const locations = ["Nigeria", "", "Venezuela", "Sicily"];
const banners = [
  "https://greengoods.mypinata.cloud/ipfs/bafybeigckq7d42p4e6qyy34ybn46smlorg3sn36cnwp4rxqf5ubknlqfqa?img-width=800&img-format=auto",
  "https://pbs.twimg.com/profile_banners/1722965526626861056/1766404363/1500x500",
  "https://greengoods.mypinata.cloud/ipfs/bafkreihwqyxtwe7m75swzzpxec2rdjmoqvc5o7jgjysnp3zvdiivrl4mnu?img-width=800&img-format=auto",
  "https://greengoods.mypinata.cloud/ipfs/bafkreifuih6bn66fb5apasgpw7bubnxiy7fq3ayoayv52uhqkpnrlvzp4i?img-width=800&img-format=auto",
];
const gardens: PublicGardenSummary[] = publicCuration.featuredGardens.map((id, index) => ({
  id,
  address: id.toLowerCase() as Address,
  name: names[index],
  slug: names[index].toLowerCase().replaceAll(" ", "-"),
  location: locations[index],
  bannerImage: banners[index],
  description: "",
  lastActivityAt: STORYBOOK_NOW_SECONDS - 45 * 24 * 60 * 60,
  actionCount: [16, 2, 2, 3][index],
  gardenerCount: 4,
  stewards: ["0x1111111111111111111111111111111111111111"],
  evaluators: [],
}));
const rifai = gardens[3];
const paymentJarAddresses: Record<string, [Address, Address]> = {
  [gardens[0].address]: [
    "0x91cDcD4B620d82cCC97EC5aE7Ee7B4b833d16021",
    "0x69C56D8f7b6c7feaA9Bf2D91285ED2b141B84cCa",
  ],
  [gardens[1].address]: [
    "0x2788FCeFfA4eb5367457E71955685BDF6c6BCAa2",
    "0xB4A2c09E7ef6edC5f06cbA28Cc16687c61B9ECa6",
  ],
};
const paymentCurrencies: Address[] = [
  "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
];
const record = {
  id: "work:review-fixture",
  kind: "work" as const,
  gardenId: rifai.id,
  gardenName: rifai.name,
  title: "Maintenance Activity",
  domain: 1,
  summary: "Workday at Sharewood Forest pruning olive trees and weeding.",
  media: ["/images/hero-garden.webp"],
  createdAt: STORYBOOK_NOW_SECONDS - 45 * 24 * 60 * 60,
  sourceAvailable: false,
};

const seeds = [
  [queryKeys.actions.byChain(DEFAULT_CHAIN_ID), []],
  [queryKeys.public.gardens(DEFAULT_CHAIN_ID), gardens],
  [
    queryKeys.public.stats(DEFAULT_CHAIN_ID),
    {
      gardenCount: gardens.length,
      contributorCount: 16,
      fieldNoteCount: 23,
      attestationCount: 2,
    },
  ],
  [queryKeys.vaults.byChain(DEFAULT_CHAIN_ID), []],
  [
    queryKeys.public.impactEvidence(DEFAULT_CHAIN_ID, 1, PUBLIC_IMPACT_RECORD_FETCH_CAP),
    {
      records: [record],
      page: 1,
      pageSize: PUBLIC_IMPACT_RECORD_FETCH_CAP,
      totalFetchedRecords: 1,
      partialData: false,
      sourceLimitReached: false,
      status: "ready",
    },
  ],
  [
    queryKeys.public.commitmentImpact(DEFAULT_CHAIN_ID),
    {
      commitmentsMade: 0n,
      commitmentsFulfilled: 0n,
      confirmedDisbursementTotal: 0n,
      confirmedDisbursementUsdCents: 0n,
      unavailableSources: {
        commitmentPools: false,
        confirmedSettlement: false,
        fundingValuation: false,
      },
      partialData: false,
    },
  ],
  [
    queryKeys.public.gardenDetail(rifai.slug, DEFAULT_CHAIN_ID),
    {
      garden: rifai,
      gardenerCount: 4,
      assessmentCount: 0,
      totalFieldNotes: 1,
      unlisted: false,
      partialData: false,
      unavailableSources: { works: false, assessments: false },
      fieldNotes: [
        {
          id: "review-fixture",
          title: record.title,
          feedback: record.summary,
          metadata: "",
          media: record.media,
          actionUID: 1,
          createdAt: record.createdAt,
          gardenAddress: rifai.address,
          gardenerAddress: rifai.stewards[0],
        },
      ],
    },
  ],
  [queryKeys.hypercerts.list(rifai.id, DEFAULT_CHAIN_ID), []],
  [
    queryKeys.public.gardenDetail(
      `commitment-pool:${rifai.address}:${PUBLIC_HISTORY_PAGE_SIZE}`,
      DEFAULT_CHAIN_ID
    ),
    {
      pool: null,
      openSeason: null,
      openCampaigns: [],
      finishedCycles: [],
      finishedCycleTotal: 0,
      poolUnitSummaries: [],
      cycleUnitSummaries: [],
      hasCommitmentCertificates: false,
      partialData: false,
      unavailableSources: { commitmentPool: false, cycleMetadata: false },
    },
  ],
] as const;

function ReviewPage({ route }: { route: string }) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<PublicShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/gardens" element={<Gardens />} />
          <Route path="/gardens/:id" element={<GardenDetail />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/actions" element={<ActionsPage />} />
          <Route path="/fund" element={<Fund />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const meta = {
  title: "Client/Public/EditorialReview",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [withClientAppRuntime, withSeededQueryClient(seeds)],
  beforeEach: () => {
    mocked(usePublicGardens).mockReturnValue({
      data: gardens,
      isLoading: false,
      isError: false,
      refetch: fn(),
    } as unknown as ReturnType<typeof usePublicGardens>);
    mocked(useGardenCookieJars).mockImplementation((gardenAddress) => {
      const addresses = gardenAddress
        ? paymentJarAddresses[gardenAddress.toLowerCase()]
        : undefined;
      return {
        jars: (addresses ?? []).map((jarAddress, index) => ({
          jarAddress,
          gardenAddress: gardenAddress as Address,
          assetAddress: paymentCurrencies[index],
          currency: paymentCurrencies[index],
          decimals: 18,
          balance: 0n,
          maxWithdrawal: 0n,
          withdrawalInterval: 0n,
          minDeposit: 0n,
          isPaused: false,
          emergencyWithdrawalEnabled: false,
        })),
        isLoading: false,
        error: addresses ? null : new Error("Payment data is not included in this fixture"),
        hasNoJar: false,
        refetch: fn(),
      } as unknown as ReturnType<typeof useGardenCookieJars>;
    });
    return resetHookMocks(usePublicGardens, useGardenCookieJars);
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Homepage: Story = { render: () => <ReviewPage route="/" /> };
export const Directory: Story = { render: () => <ReviewPage route="/gardens" /> };
export const Funding: Story = {
  render: () => <ReviewPage route="/fund" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { name: "Find a Garden to support." })
    ).toBeInTheDocument();
  },
};
export const Garden: Story = { render: () => <ReviewPage route="/gardens/rifai-sicilia" /> };
export const Evidence: Story = { render: () => <ReviewPage route="/impact" /> };
export const Actions: Story = { render: () => <ReviewPage route="/actions" /> };

import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withRouter } from "../../../../../shared/.storybook/decorators";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import {
  HubAssessmentList,
  type HubAssessmentListItem,
  HubHypercertList,
  type HubHypercertListItem,
} from "./HubRecordLists";

// Each end of a reporting period is stored as UTC midnight of the picked day.
const utcDay = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / 1000;

const ASSESSMENTS: HubAssessmentListItem[] = [
  {
    id: "0xabc1",
    title: "Eastern ridge baseline",
    description: "Where the ridge stands before the planting season, and what the season aims for.",
    domain: 1,
    startDate: utcDay(2025, 10, 1),
    endDate: utcDay(2025, 12, 31),
    createdAt: daysAgo(2),
  },
  {
    id: "0xabc2",
    title: "Workshop cohort plan",
    description: "",
    domain: 2,
    startDate: utcDay(2025, 7, 1),
    endDate: utcDay(2025, 9, 30),
    createdAt: daysAgo(40),
  },
  {
    // An attestation with no period and a domain the cockpit does not know.
    id: "0xabc3",
    title: "",
    description: "An early assessment recorded before reporting periods were kept.",
    domain: 9,
    startDate: null,
    endDate: null,
    createdAt: daysAgo(200),
  },
];

const HYPERCERTS: HubHypercertListItem[] = [
  {
    id: "42161-1002",
    title: "Eastern ridge canopy, autumn 2025",
    description: "Native saplings planted and checked for survival along the eastern ridge.",
    workScopes: ["planting", "maintenance", "survival checks", "nursery"],
    mintedAt: daysAgo(3),
  },
  {
    id: "42161-1001",
    title: "",
    description: null,
    workScopes: [],
    mintedAt: daysAgo(90),
  },
];

const meta: Meta<typeof HubAssessmentList> = {
  title: "Admin/Workflows/Hub/HubRecordLists",
  component: HubAssessmentList,
  tags: ["autodocs"],
  decorators: [withRouter()],
  parameters: {
    docs: {
      description: {
        component:
          "The Hub's two record tabs: the garden's assessments and its minted hypercerts. Each card opens its record and carries no status pill, since a record waits on no one. An empty tab says what it holds and when it is needed, and offers the create flow to a reader who can use it; a search that finds nothing says so instead.",
      },
    },
  },
  args: {
    items: ASSESSMENTS,
    isLoading: false,
    hasDataError: false,
    searchQuery: "",
    createHref: "/hub/assess/create",
    selectedAssessmentId: undefined,
    onClearSearch: fn(),
    onOpenAssessment: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HubAssessmentList>;

export const Assessments: Story = {};

export const AssessmentSelected: Story = {
  args: { selectedAssessmentId: "0xabc2" },
};

export const AssessmentsLoading: Story = {
  args: { items: [], isLoading: true },
};

export const NoAssessments: Story = {
  args: { items: [] },
};

/** A reader who cannot create an assessment gets the explanation without the act. */
export const NoAssessmentsReadOnly: Story = {
  args: { items: [], createHref: undefined },
};

export const NoSearchResults: Story = {
  args: { items: [], searchQuery: "riverbank" },
};

export const DataError: Story = {
  args: { items: [], hasDataError: true },
};

const hypercertArgs = {
  isLoading: false,
  hasDataError: false,
  searchQuery: "",
  createHref: "/hub/certify/create",
  onClearSearch: fn(),
  onOpenHypercert: fn(),
};

export const Hypercerts: Story = {
  render: () => <HubHypercertList {...hypercertArgs} items={HYPERCERTS} />,
};

export const NoHypercerts: Story = {
  render: () => <HubHypercertList {...hypercertArgs} items={[]} />,
};

/** Evaluators see the tab but cannot mint, so the empty state offers no act. */
export const NoHypercertsReadOnly: Story = {
  render: () => <HubHypercertList {...hypercertArgs} items={[]} createHref={undefined} />,
};

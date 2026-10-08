import type { Meta, StoryObj } from "@storybook/react";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { StewardAccessRequestController } from "@green-goods/shared/hooks/admin-ui/layout/useStewardAccessRequestController";
import type { GardenJoinRequestSelfRecord } from "@green-goods/shared/public-contracts/join-requests";
import type { Garden } from "@green-goods/shared/types/domain";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { STORYBOOK_PRIMARY_ADMIN_GARDEN } from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentityRole,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { CanvasGardenAccessState } from "./CanvasGardenAccessState";
import { AdminAccessHomeShell } from "./CanvasLayout";
import { StewardAccessRequest } from "./StewardAccessRequest";

const garden: Garden = {
  ...STORYBOOK_PRIMARY_ADMIN_GARDEN,
  name: "Comunidad Verde",
  location: "Quito, Ecuador",
};
const anotherGarden: Garden = {
  ...garden,
  id: "0x2222222222222222222222222222222222222222",
  name: "Jardim Botafogo",
  location: "Rio de Janeiro, Brazil",
};
const gardens: Garden[] = [
  garden,
  anotherGarden,
  ...[
    "Seed Commons",
    "Urban Roots",
    "River Gardens",
    "Forest Collective",
    "Orchard Commons",
    "Community Nursery",
  ].map((name, index) => ({
    ...garden,
    id: `0x${String(index + 3).padStart(40, "0")}`,
    name,
    location: "Community garden",
  })),
];
const request: GardenJoinRequestSelfRecord = {
  id: "steward-story-1",
  kind: "steward_access",
  state: "pending",
  revision: 1,
  requestedVia: "admin_access",
  requestedAt: "2026-10-07T12:00:00.000Z",
  expiresAt: "2026-10-21T12:00:00.000Z",
  canAskAgain: false,
};
type Stage =
  | "idle"
  | "choose"
  | "review"
  | "pending"
  | "granted"
  | "declined"
  | "error"
  | "unavailable";

/** Real view with deterministic presentation fixtures; callbacks never sign or assign a role. */
function RequestFixture({ stage }: { stage: Stage }) {
  const [open, setOpen] = useState(stage !== "idle");
  const [step, setStep] = useState<"choose" | "review">(
    stage === "idle" || stage === "choose" ? "choose" : "review"
  );
  const [selectedGarden, setGarden] = useState<Garden | null>(step === "review" ? garden : null);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [requests, setRequests] = useState<Record<string, GardenJoinRequestSelfRecord>>(() => {
    if (stage === "pending") return { [garden.id]: request };
    if (stage === "granted")
      return { [garden.id]: { ...request, state: "welcomed", canAskAgain: true } };
    if (stage === "declined")
      return {
        [garden.id]: {
          ...request,
          state: "declined",
          reason: "The garden is not adding new stewards this season.",
        },
      };
    return {};
  });
  const currentRequest = selectedGarden ? (requests[selectedGarden.id] ?? null) : null;
  const controller = {
    accountAddress: "0x1234567890123456789012345678901234567890",
    available: stage !== "unavailable",
    serviceLoading: false,
    serviceError: null,
    retryAvailability: fn(async () => undefined),
    busy: false,
    open,
    setOpen,
    step,
    setStep,
    search,
    setSearch,
    note,
    setNote,
    selectedGarden,
    candidates: gardens.filter((candidate) =>
      candidate.name.toLowerCase().includes(search.toLowerCase())
    ),
    invalidLink: false,
    catalogLoading: false,
    catalogError: false,
    reloadGardens: fn(),
    request: currentRequest,
    hasCheckedStatus: false,
    outcomeUnknown: false,
    canRefreshStatus: Boolean(currentRequest),
    error: stage === "error" ? new Error("The request service could not be reached.") : null,
    activity: null,
    selectGarden: (value: Garden) => {
      setGarden(value);
      setStep("review");
      setNote("");
    },
    send: async () => {
      if (selectedGarden) setRequests((current) => ({ ...current, [selectedGarden.id]: request }));
      setNote("");
    },
    check: async () => undefined,
    withdraw: async () => {
      if (selectedGarden)
        setRequests((current) => {
          const next = { ...current };
          delete next[selectedGarden.id];
          return next;
        });
      setStep("review");
    },
  } satisfies StewardAccessRequestController;
  return (
    <AdminAccessHomeShell showProfile>
      <main id="main-content" tabIndex={-1} className="main-scroll-area h-full overflow-y-auto">
        <CanvasGardenAccessState
          onCreateGarden={fn()}
          canCreateGarden={false}
          stewardAccess={<StewardAccessRequest controller={controller} showStatus />}
        />
      </main>
    </AdminAccessHomeShell>
  );
}

const meta = {
  title: "Admin/Workflows/Steward Access Request",
  component: StewardAccessRequest,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentityRole("user"),
    withRouter(["/"]),
    withSeededQueryClient([
      [queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), []],
      [
        queryKeys.role.stewardGardens(
          "0x1234567890123456789012345678901234567890",
          DEFAULT_CHAIN_ID
        ),
        [],
      ],
      [
        queryKeys.role.deploymentPermissions(
          "0x1234567890123456789012345678901234567890",
          DEFAULT_CHAIN_ID
        ),
        { isOwner: false, isInAllowlist: false, canDeploy: false },
      ],
      [queryKeys.ens.name("0x1234567890123456789012345678901234567890"), null],
      [queryKeys.ens.avatar("0x1234567890123456789012345678901234567890"), null],
      [queryKeys.ens.protocolName("0x1234567890123456789012345678901234567890"), null],
      [
        queryKeys.profileAvatars.record(
          DEFAULT_CHAIN_ID,
          "0x1234567890123456789012345678901234567890"
        ),
        null,
      ],
      [queryKeys.gardenJoinRequests.availability(), { enabled: false, supportedKinds: [] }],
    ]),
    withCanvasFrame({ workspace: "home", heightClassName: "h-[720px]" }),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Real request view with typed, deterministic presentation fixtures. Sending and withdrawal change fixture state only; no signatures, requests or on-chain role assignments are made.",
      },
    },
  },
} satisfies Meta<typeof StewardAccessRequest>;
export default meta;
type Story = StoryObj<typeof StewardAccessRequest>;
export const NoAccess: Story = { render: () => <RequestFixture stage="idle" /> };
export const ChooseGarden: Story = { render: () => <RequestFixture stage="choose" /> };
export const ReviewRequest: Story = { render: () => <RequestFixture stage="review" /> };
export const PendingReview: Story = { render: () => <RequestFixture stage="pending" /> };
export const Granted: Story = { render: () => <RequestFixture stage="granted" /> };
export const Declined: Story = { render: () => <RequestFixture stage="declined" /> };
export const ServiceError: Story = { render: () => <RequestFixture stage="error" /> };
export const ApiUnavailable: Story = { render: () => <RequestFixture stage="unavailable" /> };

/** Guard the rendered geometry, including states with different body/action content. */
async function verifyStableRequestGeometry() {
  const surface = await within(document.body).findByRole("dialog", {
    name: "Request Steward Access",
  });
  const body = surface.querySelector<HTMLElement>('[data-slot="body"]')!;
  const footer = surface.querySelector<HTMLElement>('[data-slot="actions"]')!;
  const geometry = () => ({
    height: surface.getBoundingClientRect().height,
    top: surface.getBoundingClientRect().top,
    bodyTop: body.getBoundingClientRect().top,
    footerTop: footer.getBoundingClientRect().top,
  });
  await waitFor(() => {
    expect(geometry().height).toBeGreaterThan(window.innerHeight * 0.75);
    // Compare layout after the entrance scale/slide has settled.
    expect(geometry().height).toBeCloseTo(Number.parseFloat(getComputedStyle(surface).height), 0);
  });
  const initial = geometry();
  const assertStable = async () => {
    await waitFor(() => {
      const current = geometry();
      for (const key of Object.keys(initial) as Array<keyof typeof initial>)
        expect(Math.abs(current[key] - initial[key])).toBeLessThan(1);
      expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 1);
    });
  };
  const picker = within(surface).getByRole("list");
  expect(picker.clientHeight).toBeGreaterThan(256);
  expect(picker.scrollHeight).toBeGreaterThan(picker.clientHeight);
  const search = within(surface).getByLabelText("Garden name or link");
  await userEvent.type(search, "No matching garden");
  await expect(
    within(surface).getByText("No matching gardens. Try another name or paste the garden link.")
  ).toBeVisible();
  await assertStable();
  await userEvent.clear(search);
  await userEvent.click(
    within(surface).getByRole("button", { name: "Comunidad Verde Quito, Ecuador" })
  );
  await expect(within(surface).getByText("Review Your Request")).toBeVisible();
  await assertStable();
  await userEvent.click(within(surface).getByRole("button", { name: "Send Request" }));
  await expect(within(surface).getByText("Pending review")).toBeVisible();
  await assertStable();
  await userEvent.click(within(surface).getByRole("button", { name: "Change Garden" }));
  await expect(within(surface).getByLabelText("Garden name or link")).toBeVisible();
  await assertStable();
}

export const StableFlowGeometry: Story = {
  tags: ["storybook-ci"],
  render: () => <RequestFixture stage="choose" />,
  play: verifyStableRequestGeometry,
};
export const MobileStableFlowGeometry: Story = {
  ...StableFlowGeometry,
  parameters: {
    viewport: {
      options: {
        stewardPhone: {
          name: "Steward phone 390 × 844",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
      },
    },
  },
  globals: { viewport: { value: "stewardPhone" } },
};

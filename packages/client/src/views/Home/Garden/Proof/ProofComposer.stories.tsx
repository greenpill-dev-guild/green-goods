import { useActions, useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useProofComposerController } from "@green-goods/shared/hooks/client-ui/commitment/useProofComposerController";
import { useCommitmentCycle } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { Route, Routes } from "react-router-dom";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import {
  AUTUMN_PLANTING,
  JOURNEY_CYCLE_NAMES,
  JOURNEY_GARDEN,
  JOURNEY_NAMES,
  PROMISE_PAGE_SEEDS,
  type ProofStage,
  proofFlowFixture,
} from "../../../../../../shared/.storybook/clientJourneyFixtures";
import {
  withAppPage,
  withClientAppRuntime,
  withProofToast,
  withRouter,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import { ProofComposer } from "./ProofComposer";

/** The flow reads its garden and promise from the route, as the app mounts it. */
const withProofRoute: Decorator = (Story) => (
  <Routes>
    <Route path="/home/:id/commitments/:commitmentId/proof" element={<Story />} />
  </Routes>
);

/** The controller for one frame, and the names and season its promise sheet reads. */
const atStage = (stage: ProofStage) => () => {
  mocked(useProofComposerController).mockReturnValue(proofFlowFixture(stage));
  mocked(useCommitmentCycle).mockReturnValue({
    cycle: AUTUMN_PLANTING,
  } as unknown as ReturnType<typeof useCommitmentCycle>);
  mocked(useGardens).mockReturnValue({
    data: [{ id: JOURNEY_GARDEN, name: "Riverside Commons Garden" }],
  } as unknown as ReturnType<typeof useGardens>);
  mocked(useActions).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActions>);
  mocked(useGreenGoodsEnsName).mockImplementation(
    (address) =>
      ({ data: address ? (JOURNEY_NAMES[address.toLowerCase()] ?? null) : null }) as ReturnType<
        typeof useGreenGoodsEnsName
      >
  );
  mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
  return resetHookMocks(
    useProofComposerController,
    useCommitmentCycle,
    useGardens,
    useActions,
    useGreenGoodsEnsName,
    useEnsName
  );
};

const atRecovery = (kind: "loading" | "restoreFailed" | "saveFailed") => () => {
  const cleanup = atStage("mediaAdded")();
  mocked(useProofComposerController).mockReturnValue({
    ...proofFlowFixture("mediaAdded"),
    status:
      kind === "loading"
        ? "restoringDraft"
        : kind === "restoreFailed"
          ? "draftRestoreFailed"
          : "ready",
    draftPersistence: kind === "saveFailed" ? "failed" : "saving",
    retryDraftRestore: fn(),
    retryDraftSave: fn(),
  });
  return cleanup;
};

type Canvas = ReturnType<typeof within>;
// A click leaves focus on the forward act, where a finger's tap would not ring it.
const blur = () => (document.activeElement as HTMLElement | null)?.blur();
const toDetails = async (canvas: Canvas) => {
  await userEvent.click(canvas.getByRole("button", { name: "Details" }));
  blur();
};
const toReview = async (canvas: Canvas) => {
  await toDetails(canvas);
  await userEvent.click(canvas.getByRole("button", { name: "Review Proof" }));
  blur();
};

/**
 * Adding proof, in Submit Work's page (D6, D16): Media, Details and Review with
 * the promise pinned under the heading, and Submit Work's bar. Amara leads the
 * fence repair and Dele helps; fictional data from the design frames.
 */
const meta: Meta<typeof ProofComposer> = {
  title: "Client/Commitments/ProofComposer",
  component: ProofComposer,
  parameters: { layout: "fullscreen" },
  decorators: [
    withProofRoute,
    withRouter([`/home/${JOURNEY_GARDEN}/commitments/9/proof`]),
    withSeededQueryClient([...JOURNEY_CYCLE_NAMES, ...PROMISE_PAGE_SEEDS]),
    withAppPage,
    // The top bar reads the queue for its offline state.
    withClientAppRuntime,
  ],
};

export default meta;
type Story = StoryObj<typeof ProofComposer>;

const inLocale =
  (locale: "es" | "pt"): Decorator =>
  (Story) => (
    <IntlProvider locale={locale} messages={locale === "es" ? es : pt}>
      <Story />
    </IntlProvider>
  );

const recoveryInLocale =
  (locale: "es" | "pt", kind: "restoreFailed" | "saveFailed"): Story["play"] =>
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const messages = locale === "es" ? es : pt;
    if (kind === "restoreFailed") {
      await expect(canvas.getByText(messages["app.proof.draft.restoreFailed.title"])).toBeVisible();
      await userEvent.click(
        canvas.getByRole("button", { name: messages["app.proof.draft.restoreRetry"] })
      );
      await expect(
        mocked(useProofComposerController).mock.results.at(-1)?.value.retryDraftRestore
      ).toHaveBeenCalledOnce();
    } else {
      const remove = messages["app.garden.upload.removeMedia"].replace("{index}", "2");
      await expect(canvas.getByRole("button", { name: remove })).toBeVisible();
      await expect(
        canvas.getByRole("button", { name: messages["app.proof.next.details"] })
      ).toBeDisabled();
      await userEvent.click(
        canvas.getByRole("button", { name: messages["app.proof.draft.saveRetry"] })
      );
      await expect(
        mocked(useProofComposerController).mock.results.at(-1)?.value.retryDraftSave
      ).toHaveBeenCalledOnce();
      await expect(canvas.getByRole("button", { name: remove })).toBeVisible();
    }
  };

/** Nothing added yet: no tap box; the bar's photo, camera and voice tools add proof (O1). */
export const Media: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("media"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Show What Was Done" })).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Nothing added yet");
    // The heading leads and the promise follows it (O9).
    const heading = canvas.getByRole("heading", { name: "Show What Was Done" });
    const pinned = canvas.getByTestId("pinned-promise");
    await expect(
      heading.compareDocumentPosition(pinned) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    for (const tool of ["Choose from Your Photos", "Take a Photo", "Record a voice note"]) {
      await expect(canvas.getByRole("button", { name: tool })).toBeVisible();
    }
    await expect(canvas.getByRole("button", { name: "Details" })).toBeEnabled();
  },
};

/** Two photos and a voice note: the pill turns green and says what counts. */
export const MediaAdded: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("mediaAdded"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Proof added: 2 photos, 1 voice note"
    );
    await expect(canvas.getByRole("button", { name: "Remove media 2" })).toBeVisible();
  },
};

/** Recording a voice note: the tool fills with the error colour, and Details waits. */
export const Recording: Story = {
  beforeEach: atStage("recording"),
};

/** Details: who did this, a few words with a hint that tells the truth, and links. */
export const Details: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("details"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toDetails(canvas);
    await expect(canvas.getByRole("heading", { name: "Enter Details" })).toBeVisible();
    await expect(
      canvas.getByText("Optional: you already added 2 photos and 1 voice note.")
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Review Proof" })).toBeEnabled();
  },
};

/** Nothing added: the hint turns amber and Review Proof waits, saying why. */
export const DetailsEmpty: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("detailsEmpty"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toDetails(canvas);
    const review = canvas.getByRole("button", { name: "Review Proof" });
    await expect(review).toBeDisabled();
    await expect(review).toHaveAccessibleDescription(
      "Add a photo, a voice note, a link or a few words first."
    );
  },
};

/** A link on its own is proof enough. */
export const DetailsLink: Story = {
  beforeEach: atStage("detailsLink"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toDetails(canvas);
    await expect(canvas.getByText("Optional: your link is enough.")).toBeVisible();
  },
};

/** Back later: the pinned card opens the promise's latest state without leaving the step. */
export const ProofForSheet: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("details"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toDetails(canvas);
    await userEvent.click(canvas.getByRole("button", { name: /^Proof for / }));
    const page = within(canvasElement.ownerDocument.body);
    const body = await page.findByRole("region", { name: "Promise details" });
    // A read-only body that scrolls takes focus, so a keyboard can scroll it.
    await expect(body).toHaveAttribute("tabindex", "0");
    await expect(within(body).getByRole("region", { name: "Where this stands" })).toBeVisible();
  },
};

/** Review: Submit Work's sections, then what happens next; with a team the switch starts off. */
export const Review: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("review"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toReview(canvas);
    await expect(canvas.getByRole("heading", { name: "Review Proof" })).toBeVisible();
    const send = canvas.getByRole("switch", { name: "Send for confirmation too" });
    await expect(send).not.toBeChecked();
    await expect(canvas.getByRole("button", { name: "Add This Proof" })).toBeEnabled();
  },
};

/** Also sending it: the act reads Add and Send, and the line says it takes two signatures. */
export const ReviewSend: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("reviewSend"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toReview(canvas);
    await expect(canvas.getByRole("switch", { name: "Send for confirmation too" })).toBeChecked();
    await expect(canvas.getByRole("button", { name: "Add and Send" })).toBeVisible();
    await expect(
      canvas.getByText("You'll be asked to sign twice: once for the proof, once to send it.")
    ).toBeVisible();
  },
};

/** Dele's review: anyone on the team adds proof, only the lead sends, so no switch. */
export const ReviewTeammate: Story = {
  tags: ["storybook-ci"],
  beforeEach: atStage("reviewTeammate"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toReview(canvas);
    await expect(canvas.queryByRole("switch")).toBeNull();
    await expect(canvas.getByText(/leads this one and sends it to/)).toBeVisible();
  },
};

/** Offline: the existing warning over the same Review. */
export const ReviewOffline: Story = {
  beforeEach: atStage("reviewOffline"),
  play: async ({ canvasElement }) => {
    await toReview(within(canvasElement));
  },
};

/** Add This Proof: the page stays still, the act spins, and the toast says what is happening. */
export const Signing: Story = {
  tags: ["storybook-ci"],
  decorators: [withProofToast("adding")],
  beforeEach: atStage("signing"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toReview(canvas);
    await expect(canvas.getByRole("button", { name: /Add This Proof/ })).toHaveAttribute(
      "aria-busy",
      "true"
    );
    await expect(
      await within(canvasElement.ownerDocument.body).findByText("Adding proof…")
    ).toBeVisible();
  },
};

/** Add and Send: the same, and the toast says there are two signatures. */
export const SigningSend: Story = {
  decorators: [withProofToast("addingSendToo")],
  beforeEach: atStage("signingSend"),
  play: async ({ canvasElement }) => {
    await toReview(within(canvasElement));
  },
};

/** Reading the device draft: the form waits instead of flashing empty. */
export const DraftRestoring: Story = {
  tags: ["storybook-ci"],
  beforeEach: atRecovery("loading"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Restoring your proof…");
    await expect(canvas.queryByRole("button", { name: "Details" })).toBeNull();
  },
};

/** A rejected read leaves durable content untouched and offers same-key restore. */
export const DraftRestoreFailed: Story = {
  tags: ["storybook-ci"],
  beforeEach: atRecovery("restoreFailed"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Couldn’t restore your proof")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Restore draft" }));
    await expect(
      mocked(useProofComposerController).mock.results.at(-1)?.value.retryDraftRestore
    ).toHaveBeenCalledOnce();
    await expect(canvas.queryByRole("button", { name: "Details" })).toBeNull();
  },
};

/** Current media stays available for removal; retry saves current edits, not an old draft. */
export const DraftSaveFailed: Story = {
  tags: ["storybook-ci"],
  beforeEach: atRecovery("saveFailed"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Remove media 2" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Details" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Details" })).toHaveAccessibleDescription(
      "Save your latest changes before continuing."
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save latest changes" }));
    await expect(
      mocked(useProofComposerController).mock.results.at(-1)?.value.retryDraftSave
    ).toHaveBeenCalledOnce();
    await expect(canvas.getByRole("button", { name: "Remove media 2" })).toBeVisible();
  },
};

export const DraftRestoreFailedSpanish: Story = {
  ...DraftRestoreFailed,
  decorators: [inLocale("es")],
  play: recoveryInLocale("es", "restoreFailed"),
};

export const DraftRestoreFailedPortuguese: Story = {
  ...DraftRestoreFailed,
  decorators: [inLocale("pt")],
  play: recoveryInLocale("pt", "restoreFailed"),
};

export const DraftSaveFailedSpanish: Story = {
  ...DraftSaveFailed,
  decorators: [inLocale("es")],
  play: recoveryInLocale("es", "saveFailed"),
};

export const DraftSaveFailedPortuguese: Story = {
  ...DraftSaveFailed,
  decorators: [inLocale("pt")],
  play: recoveryInLocale("pt", "saveFailed"),
};

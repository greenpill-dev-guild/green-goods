import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../../../shared/src/i18n/en.json";
import { resolveIPFSUrl } from "../../../../shared/src/modules/data/ipfs/resolve";
import { GardenSettingsEditor } from "./GardenSettingsEditor";

const gardenAddress = "0xAbCdEf1234567890aBcDeF1234567890aBcDeF12" as `0x${string}`;

const {
  mockUpdateName,
  mockUpdateDescription,
  mockUpdateLocation,
  mockUpdateBannerImage,
  mockSetOpenJoining,
  mockSetMaxGardeners,
  mockUploadFileToIPFS,
} = vi.hoisted(() => ({
  mockUpdateName: vi.fn().mockResolvedValue("0x1"),
  mockUpdateDescription: vi.fn().mockResolvedValue("0x1"),
  mockUpdateLocation: vi.fn().mockResolvedValue("0x1"),
  mockUpdateBannerImage: vi.fn().mockResolvedValue("0x1"),
  mockSetOpenJoining: vi.fn().mockResolvedValue("0x1"),
  mockSetMaxGardeners: vi.fn().mockResolvedValue("0x1"),
  mockUploadFileToIPFS: vi.fn().mockResolvedValue({ cid: "bafysettingsbanner" }),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();

  const asMutation = (mutateAsync: (params: unknown) => Promise<unknown>) => () => ({
    mutateAsync,
    isPending: false,
  });

  return {
    ...actual,
    useUpdateGardenName: asMutation(mockUpdateName),
    useUpdateGardenDescription: asMutation(mockUpdateDescription),
    useUpdateGardenLocation: asMutation(mockUpdateLocation),
    useUpdateGardenBannerImage: asMutation(mockUpdateBannerImage),
    useSetOpenJoining: asMutation(mockSetOpenJoining),
    useSetMaxGardeners: asMutation(mockSetMaxGardeners),
    uploadFileToIPFS: mockUploadFileToIPFS,
    imageCompressor: {
      ...actual.imageCompressor,
      shouldCompress: () => false,
    },
  };
});

const GARDEN = {
  name: "Rio Rainforest Lab",
  description: "Community-driven restoration.",
  location: "Rio de Janeiro, Brazil",
  bannerImage: "",
  openJoining: false,
  maxGardeners: 0,
};

function renderEditor(overrides: Partial<Parameters<typeof GardenSettingsEditor>[0]> = {}) {
  const Providers = ({ children }: { children: ReactNode }) => (
    <IntlProvider locale="en" messages={enMessages}>
      {children}
    </IntlProvider>
  );

  return render(
    <GardenSettingsEditor
      gardenAddress={gardenAddress}
      garden={GARDEN}
      canManage
      isOwner
      {...overrides}
    />,
    { wrapper: Providers }
  );
}

function allMutations() {
  return [
    mockUpdateName,
    mockUpdateDescription,
    mockUpdateLocation,
    mockUpdateBannerImage,
    mockSetOpenJoining,
    mockSetMaxGardeners,
  ];
}

describe("GardenSettingsEditor explicit save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:banner-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("keeps field edits local until Save and reports the dirty state", async () => {
    const user = userEvent.setup();
    renderEditor();

    const nameInput = screen.getByLabelText(/Name/);
    await user.clear(nameInput);
    await user.type(nameInput, "New Garden Name");

    for (const mutation of allMutations()) {
      expect(mutation).not.toHaveBeenCalled();
    }
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("saves only the dirty fields with trimmed values", async () => {
    const user = userEvent.setup();
    renderEditor();

    const nameInput = screen.getByLabelText(/Name/);
    await user.clear(nameInput);
    await user.type(nameInput, "  Renamed Garden  ");

    const locationInput = screen.getByLabelText("Location");
    await user.clear(locationInput);
    await user.type(locationInput, "Lisbon, Portugal");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockUpdateName).toHaveBeenCalledWith({
        gardenAddress,
        value: "Renamed Garden",
      });
    });
    expect(mockUpdateLocation).toHaveBeenCalledWith({
      gardenAddress,
      value: "Lisbon, Portugal",
    });
    expect(mockUpdateDescription).not.toHaveBeenCalled();
    expect(mockSetOpenJoining).not.toHaveBeenCalled();
    expect(mockSetMaxGardeners).not.toHaveBeenCalled();
    expect(mockUpdateBannerImage).not.toHaveBeenCalled();
  });

  it("resets the draft on Cancel without writing", async () => {
    const user = userEvent.setup();
    renderEditor();

    const nameInput = screen.getByLabelText(/Name/);
    await user.clear(nameInput);
    await user.type(nameInput, "Throwaway Edit");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText(/Name/)).toHaveValue(GARDEN.name);
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    for (const mutation of allMutations()) {
      expect(mutation).not.toHaveBeenCalled();
    }
  });

  it("previews a selected banner locally and uploads to IPFS only on Save", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["banner"], "banner.png", { type: "image/png" });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByText("Preview — uploads on save")).toBeInTheDocument();
    expect(mockUploadFileToIPFS).not.toHaveBeenCalled();
    expect(mockUpdateBannerImage).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockUploadFileToIPFS).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateBannerImage).toHaveBeenCalledWith({
      gardenAddress,
      value: resolveIPFSUrl("bafysettingsbanner"),
    });
  });

  it("toggling open joining stays local until Save", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("switch", { name: "Open Joining" }));
    expect(mockSetOpenJoining).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(mockSetOpenJoining).toHaveBeenCalledWith({ gardenAddress, value: true });
    });
  });

  it("blocks Save while the name is empty and explains why", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.clear(screen.getByLabelText(/Name/));

    expect(screen.getByText("Garden name is required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("renders read-only without a footer when the viewer cannot edit", () => {
    renderEditor({ canManage: false, isOwner: false });

    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeDisabled();
    expect(screen.getByLabelText("Location")).toBeDisabled();
  });
});

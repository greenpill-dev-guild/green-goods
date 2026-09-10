// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@green-goods/shared/i18n/en.json";
import WorkDetail from "../../views/Public/WorkDetail";

const { read, refetch } = vi.hoisted(() => ({ read: vi.fn(), refetch: vi.fn() }));
vi.mock("@green-goods/shared/hooks/public/usePublicGardenDetail", () => ({
  usePublicGardenDetail: read,
}));
vi.mock("../../views/Public/GardenDetailAtoms", () => ({
  NoteAuthor: () => <span>Gardener</span>,
  formatNoteDate: () => "September 9",
}));
vi.mock("../../components/Public/PublicFooter", () => ({ PublicFooter: () => null }));
vi.mock("../../components/Public/PublicInstallCta", () => ({
  PublicInstallCta: ({ destination }: { destination: string }) => (
    <a href={destination}>Open work</a>
  ),
}));
vi.mock("../../components/Display/Image/ImageWithFallback", () => ({
  ImageWithFallback: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
const garden = `0x${"1".repeat(40)}`;
const work = `0x${"2".repeat(64)}`;
const note = {
  id: work,
  title: "Planting trees",
  feedback: "We planted three trees.",
  media: ["/photo.jpg"],
  createdAt: 1700000000,
  gardenerAddress: garden,
};
function show(data: unknown, isError = false, isLoading = false) {
  read.mockReturnValue({ data, isError, isLoading, refetch });
  return render(
    <IntlProvider locale="en" messages={messages}>
      <MemoryRouter initialEntries={[`/gardens/${garden}/work/${work}`]}>
        <Routes>
          <Route path="/gardens/:id/work/:workId" element={<WorkDetail />} />
        </Routes>
      </MemoryRouter>
    </IntlProvider>
  );
}
afterEach(cleanup);
describe("public shared work", () => {
  it("shows the public field note and preserves its app destination", () => {
    show({
      garden: { name: "Community Garden" },
      fieldNotes: [note],
      unavailableSources: { works: false },
    });
    expect(screen.getByRole("heading", { name: "Planting trees", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("We planted three trees.")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "/photo.jpg");
    expect(screen.getByRole("link", { name: "Open work" })).toHaveAttribute(
      "href",
      `/home/${garden}/work/${work}`
    );
  });
  it("does not expose note data without a public garden", () => {
    show({ garden: null, fieldNotes: [note], unavailableSources: { works: false } });
    expect(screen.queryByText("We planted three trees.")).not.toBeInTheDocument();
    expect(screen.getByText(/may require sign-in/)).toBeInTheDocument();
  });
  it("offers retry for a failed read instead of declaring the record private or absent", () => {
    show(undefined, true);
    expect(screen.getByText("Field notes could not be loaded right now.")).toBeInTheDocument();
    expect(screen.queryByText(/may require sign-in/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalled();
  });
  it("announces loading without flashing an access error", () => {
    show(undefined, false, true);
    expect(screen.getByRole("status")).toHaveTextContent("Loading shared work");
    expect(screen.queryByText(/may require sign-in/)).not.toBeInTheDocument();
  });
});

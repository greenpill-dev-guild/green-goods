import { cn } from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiCornerDownLeftLine,
  RiSearchLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { expect, userEvent, waitFor, within } from "storybook/test";

// ─── Mock CommandPalette ─────────────────────────────────────────────
// The real component uses useNavigate, useGardens, and useActions which
// require full provider stacks. This isolated version accepts props instead.

interface SearchResult {
  id: string;
  label: string;
  href: string;
  category: "pages" | "gardens" | "actions";
}

interface MockCommandPaletteProps {
  /** Start in open state */
  defaultOpen?: boolean;
  /** Mock garden names for search results */
  gardens?: string[];
  /** Mock action titles for search results */
  actions?: string[];
  /** Called when a result is selected */
  onSelect?: (result: SearchResult) => void;
}

const STATIC_ROUTES: Omit<SearchResult, "category">[] = [
  { id: "page-dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "page-gardens", label: "Gardens", href: "/gardens" },
  { id: "page-endowments", label: "Endowments", href: "/endowments" },
  { id: "page-actions", label: "Actions", href: "/actions" },
  { id: "page-contracts", label: "Contracts", href: "/contracts" },
  { id: "page-deployment", label: "Deployment", href: "/deployment" },
];

function MockCommandPalette({
  defaultOpen = false,
  gardens = [],
  actions = [],
  onSelect,
}: MockCommandPaletteProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { formatMessage } = useIntl();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const results = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();
    const items: SearchResult[] = [];

    for (const route of STATIC_ROUTES) {
      if (!lowerQuery || route.label.toLowerCase().includes(lowerQuery)) {
        items.push({ ...route, category: "pages" });
      }
    }

    for (const name of gardens) {
      if (!lowerQuery || name.toLowerCase().includes(lowerQuery)) {
        items.push({
          id: `garden-${name}`,
          label: name,
          href: `/gardens/${name}`,
          category: "gardens",
        });
      }
    }

    for (const title of actions) {
      if (!lowerQuery || title.toLowerCase().includes(lowerQuery)) {
        items.push({
          id: `action-${title}`,
          label: title,
          href: `/actions/${title}`,
          category: "actions",
        });
      }
    }

    return items;
  }, [query, gardens, actions]);

  const grouped = useMemo(() => {
    const groups: { category: string; label: string; items: SearchResult[] }[] = [];
    const categoryLabels: Record<string, { id: string; defaultMessage: string }> = {
      pages: { id: "app.admin.nav.searchPages", defaultMessage: "Pages" },
      gardens: {
        id: "app.admin.nav.searchGardens",
        defaultMessage: "Gardens",
      },
      actions: {
        id: "app.admin.nav.searchActions",
        defaultMessage: "Actions",
      },
    };

    for (const cat of ["pages", "gardens", "actions"] as const) {
      const items = results.filter((r) => r.category === cat);
      if (items.length > 0) {
        groups.push({
          category: cat,
          label: formatMessage(categoryLabels[cat]),
          items,
        });
      }
    }
    return groups;
  }, [results, formatMessage]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }, []);

  const selectResult = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      onSelect?.(result);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(results.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1));
      } else if (e.key === "Enter" && results[activeIndex]) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      }
    },
    [results, activeIndex, selectResult]
  );

  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  let flatIndex = 0;

  return (
    <>
      <button
        onClick={() => handleOpenChange(true)}
        aria-label={formatMessage({
          id: "app.admin.nav.search",
          defaultMessage: "Search",
        })}
        className="min-h-11 min-w-11 p-2 rounded-md text-text-soft hover:text-text-sub hover:bg-bg-weak transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
      >
        <RiSearchLine className="h-5 w-5" />
      </button>

      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-stroke-sub bg-bg-white shadow-xl animate-fade-in-up"
            aria-label={formatMessage({
              id: "app.admin.nav.commandPalette",
              defaultMessage: "Command palette",
            })}
            onKeyDown={handleKeyDown}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <div className="flex items-center gap-3 border-b border-stroke-soft px-4">
              <RiSearchLine className="h-5 w-5 shrink-0 text-text-soft" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={formatMessage({
                  id: "app.admin.nav.searchPlaceholder",
                  defaultMessage: "Search pages, gardens, actions...",
                })}
                className="flex-1 bg-transparent py-3 text-sm text-text-strong placeholder:text-text-soft outline-none"
              />
            </div>

            <div ref={listRef} className="max-h-72 overflow-y-auto p-2" role="listbox">
              {results.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-soft">
                  {formatMessage({
                    id: "app.admin.nav.searchNoResults",
                    defaultMessage: "No results found",
                  })}
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.category} role="group" aria-label={group.label}>
                    <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-soft">
                      {group.label}
                    </div>
                    {group.items.map((result) => {
                      const index = flatIndex++;
                      const isActive = index === activeIndex;
                      return (
                        <button
                          key={result.id}
                          role="option"
                          aria-selected={isActive}
                          data-index={index}
                          onClick={() => selectResult(result)}
                          onMouseMove={() => setActiveIndex(index)}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-sm text-left transition-colors",
                            isActive
                              ? "bg-primary-alpha-16 text-primary-darker"
                              : "text-text-sub hover:bg-bg-weak"
                          )}
                        >
                          {result.label}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-stroke-soft px-4 py-2 text-xs text-text-soft">
              <span className="flex items-center gap-1">
                <RiArrowUpLine className="h-3 w-3" aria-hidden="true" />
                <RiArrowDownLine className="h-3 w-3" aria-hidden="true" />
                <span>
                  {formatMessage({
                    id: "app.admin.nav.searchNavigate",
                    defaultMessage: "Navigate",
                  })}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <RiCornerDownLeftLine className="h-3 w-3" aria-hidden="true" />
                <span>
                  {formatMessage({
                    id: "app.admin.nav.searchSelect",
                    defaultMessage: "Select",
                  })}
                </span>
              </span>
              <span className="ml-auto">
                Esc{" "}
                {formatMessage({
                  id: "app.admin.nav.searchClose",
                  defaultMessage: "to close",
                })}
              </span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────

const meta: Meta<typeof MockCommandPalette> = {
  title: "Admin/Layout/CommandPalette",
  component: MockCommandPalette,
  tags: ["autodocs"],
  args: {
    defaultOpen: false,
    gardens: ["Community Forest", "Urban Rooftop", "Riverside Restoration"],
    actions: ["Plant Trees", "Remove Invasive Species", "Water Quality Test"],
  },
  argTypes: {
    defaultOpen: {
      control: "boolean",
      description: "Whether the palette starts in the open state",
    },
    gardens: {
      control: "object",
      description: "Mock garden names to populate search results",
    },
    actions: {
      control: "object",
      description: "Mock action titles to populate search results",
    },
    onSelect: {
      action: "selected",
      description: "Callback when a search result is selected",
    },
  },
};

export default meta;
type Story = StoryObj<typeof MockCommandPalette>;

export const Default: Story = {};

export const Open: Story = {
  args: {
    defaultOpen: true,
  },
};

export const NoResults: Story = {
  args: {
    defaultOpen: true,
    gardens: [],
    actions: [],
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-text-sub-600 mb-2">Closed state (search icon button)</p>
        <MockCommandPalette />
      </div>
      <div>
        <p className="text-xs text-text-sub-600 mb-2">
          Open with results (click the icon above to see the palette)
        </p>
        <MockCommandPalette
          defaultOpen={true}
          gardens={["Community Forest", "Urban Rooftop"]}
          actions={["Plant Trees"]}
        />
      </div>
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    defaultOpen: true,
    gardens: ["Community Forest", "Urban Rooftop"],
    actions: ["Plant Trees"],
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4 min-h-[400px]">
        <Story />
      </div>
    ),
  ],
};

export const Interactive: Story = {
  args: {
    gardens: ["Community Forest", "Urban Rooftop"],
    actions: ["Plant Trees"],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click the search button to open the palette
    const trigger = canvas.getByRole("button", { name: /search/i });
    await userEvent.click(trigger);

    // Verify the palette opened with the search input
    await waitFor(
      () => {
        const body = within(document.body);
        expect(body.getByPlaceholderText(/search pages, gardens, actions/i)).toBeVisible();
      },
      { timeout: 2000 }
    );

    // Verify categories appear
    const body = within(document.body);
    expect(body.getByText("Pages")).toBeVisible();
    expect(body.getByText("Gardens")).toBeVisible();

    // Type a search query to filter
    const input = body.getByPlaceholderText(/search pages, gardens, actions/i);
    await userEvent.type(input, "forest");

    // Only matching results should appear
    await waitFor(() => {
      expect(body.getByText("Community Forest")).toBeVisible();
    });
  },
};

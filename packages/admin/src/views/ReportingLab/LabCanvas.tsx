/**
 * Garden reporting lab (proposed component): the cockpit's frame around a walkthrough
 * screen, laid out as CanvasLayout lays out the app: the canvas grid in the workspace's
 * tone, the AppBar with its GardenChip and icons, the MainSheet's scrolling main area, and
 * the NavigationBar. The shell pieces are the shipped ones; only the routing is left out,
 * so a nav press or an AppBar icon does nothing here.
 */
import { GardenChip } from "@green-goods/shared/components/Canvas/GardenChip";
import { useMediaQuery } from "@green-goods/shared/hooks/ui/useMediaQuery";
import type { ReactNode } from "react";
import { AppBar, MainSheet } from "@/components/Shell";
import { NavigationBar } from "@/components/Shell/NavigationBar";
import { LAB_NAV_SLOTS, type LabGarden } from "./labShell";

export type LabWorkspace = "hub" | "garden" | "community";

interface LabCanvasProps {
  workspace: LabWorkspace;
  gardens: readonly LabGarden[];
  gardenId: string;
  onSelectGarden?: (gardenId: string) => void;
  /** The main area's scroll position, for a screen that opens partway down its page. */
  mainRef?: (node: HTMLElement | null) => void;
  children: ReactNode;
}

const ignore = () => undefined;

export function LabCanvas({
  workspace,
  gardens,
  gardenId,
  onSelectGarden,
  mainRef,
  children,
}: LabCanvasProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const selected = gardens.find((garden) => garden.id === gardenId) ?? null;

  return (
    <div
      data-component="LabCanvas"
      data-tone={workspace}
      className="admin-m3 h-full min-h-0 workspace-canvas workspace-canvas-grid"
    >
      <div data-region="canvas-area-top" className="canvas-area-top">
        <AppBar
          gardenChip={
            <GardenChip
              gardens={[...gardens]}
              selectedGarden={selected}
              onSelectGarden={(garden) => (garden ? onSelectGarden?.(garden.id) : undefined)}
              showCreateGardenAction={false}
            />
          }
          onOpenSearch={ignore}
          onOpenNotifications={ignore}
          onOpenSettings={isDesktop ? ignore : undefined}
          onOpenProfile={isDesktop ? ignore : undefined}
        />
      </div>
      <MainSheet>
        <main
          ref={mainRef}
          id="main-content"
          data-region="main-scroll-area"
          tabIndex={-1}
          className="main-scroll-area mx-auto h-full w-full overflow-y-auto pt-2 sm:pt-3"
          style={{
            maxWidth: "var(--admin-main-max-width, 1400px)",
            paddingInline: "var(--admin-main-inline-gutter, 1.25rem)",
            paddingBottom: isDesktop
              ? "var(--admin-main-bottom-clearance-desktop, 6.25rem)"
              : "var(--admin-main-bottom-clearance-mobile, calc(env(safe-area-inset-bottom) + 9.5rem))",
          }}
        >
          {children}
        </main>
      </MainSheet>
      <div data-region="canvas-area-bottom" className="canvas-area-bottom">
        <NavigationBar slots={LAB_NAV_SLOTS} activePath={`/${workspace}`} onNavigate={ignore} />
      </div>
    </div>
  );
}

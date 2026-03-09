import { useIntl } from "react-intl";
import { PageTransition } from "../ui/PageTransition";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
  const intl = useIntl();

  return (
    <div className="flex flex-1 min-h-0 bg-bg-weak">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary-base focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        {intl.formatMessage({
          id: "app.admin.layout.skipToContent",
          defaultMessage: "Skip to content",
        })}
      </a>
      <Sidebar />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto main-scroll-area"
          style={{
            overscrollBehaviorY: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <PageTransition />
        </main>
      </div>
    </div>
  );
}

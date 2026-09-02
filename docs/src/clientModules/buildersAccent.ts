import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

// Category index pages have no docs-doc-id-* class, so the CSS accent override
// keyed on it misses them. They also mount at /category/* without the /builders
// prefix — today every generated-index category belongs to the builders sidebar
// (community categories use doc landings), and the planned real landing pages
// retire /category/* URLs entirely.
function syncBuildersRouteClass(pathname: string): void {
  document.body?.classList.toggle(
    "gg-builders-route",
    pathname.startsWith("/builders") || pathname.startsWith("/category/"),
  );
}

if (ExecutionEnvironment.canUseDOM) {
  syncBuildersRouteClass(window.location.pathname);
}

export function onRouteDidUpdate({location}: {location: {pathname: string}}): void {
  if (ExecutionEnvironment.canUseDOM) {
    syncBuildersRouteClass(location.pathname);
  }
}

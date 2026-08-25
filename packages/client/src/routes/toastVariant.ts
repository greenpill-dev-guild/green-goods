export type ClientToastViewportVariant = "default" | "editorial";

const PUBLIC_EDITORIAL_ROUTE_PREFIXES = [
  "/actions",
  "/cookies",
  "/fund",
  "/gardens",
  "/glossary",
  "/impact",
  "/landing",
  "/vaults",
] as const;

export function getClientToastViewportVariant(pathname: string): ClientToastViewportVariant {
  if (pathname === "/" || pathname === "") {
    return "editorial";
  }

  const normalizedPathname =
    pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  return PUBLIC_EDITORIAL_ROUTE_PREFIXES.some(
    (prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`)
  )
    ? "editorial"
    : "default";
}

export type PublicSurfaceState = "loading" | "error" | "empty" | "ready";

export function selectPublicSurfaceState(input: {
  isLoading: boolean;
  isError: boolean;
  itemCount: number;
}): PublicSurfaceState {
  if (input.isLoading) return "loading";
  if (input.isError) return "error";
  if (input.itemCount === 0) return "empty";
  return "ready";
}

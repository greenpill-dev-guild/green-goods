import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderHookOptions, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-client";

interface RenderHookWithQueryClientOptions<TProps>
  extends Omit<RenderHookOptions<TProps>, "wrapper"> {
  queryClient?: QueryClient;
}

/** Render a query hook without adding unrelated providers to its test boundary. */
export function renderHookWithQueryClient<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options: RenderHookWithQueryClientOptions<TProps> = {}
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(hook, { ...renderOptions, wrapper: Wrapper });
}

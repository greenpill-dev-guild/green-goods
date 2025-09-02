import React from "react";
import { useGardenSubscriptions } from "@/hooks/useGardenSubscriptions";

interface SubscriptionsProviderProps {
  children: React.ReactNode;
}

export function SubscriptionsProvider({ children }: SubscriptionsProviderProps) {
  // Initialize subscriptions
  useGardenSubscriptions();

  return <>{children}</>;
}
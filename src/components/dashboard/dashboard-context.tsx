"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Dashboard-level context shared by every module card.
 *
 * Used to thread the package id + the "regenerate with edited prompt"
 * handler down to <ModuleFooter> without forcing every card component
 * to forward three more props through their bag. Cards stay unchanged.
 *
 * Returns null outside the provider; consumers (ModuleFooter) skip the
 * Phase 2 affordance when the context isn't available — important for
 * tests that render cards in isolation without the provider wrapper.
 */
type DashboardContextValue = {
  packageId: string;
  onRegenerateEditedPrompt: (module: string, editedPrompt: string) => void;
  /** Module key currently regenerating via the edited-prompt path, if any. */
  pendingEditedRegenerateModule: string | null;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardContextProvider({
  value,
  children,
}: {
  value: DashboardContextValue;
  children: ReactNode;
}) {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext(): DashboardContextValue | null {
  return useContext(DashboardContext);
}

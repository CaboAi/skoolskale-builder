"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

// SSR-safe mount detection. Returns false on the server and during
// hydration (so client + server output match), then re-renders true
// once subscribed. Avoids the setState-in-effect cascade that the
// react-hooks lint rule rightly flags on the useEffect pattern.
const subscribe = () => () => {};
function useHasMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * Two-state sun/moon toggle. Defaults to system preference on first
 * paint; clicking flips between light and dark and persists via
 * next-themes' localStorage. We render a disabled placeholder until
 * mounted so the server-rendered HTML doesn't ship a guessed icon
 * that would mismatch the client's resolved theme.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled />
    );
  }

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-200 ease-out dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute inset-0 m-auto h-4 w-4 rotate-90 scale-0 transition-all duration-200 ease-out dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

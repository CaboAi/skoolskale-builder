import Link from "next/link";
import { PreSkoolWordmark } from "./PreSkoolWordmark";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Shared chrome rendered above every page from RootLayout.
 * Sticky so the theme toggle and wordmark stay reachable while
 * scrolling long surfaces (wizard, export view). Background is
 * a translucent overlay of --background so content scrolling
 * underneath shows through faintly.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link
          href="/"
          aria-label="preSkool home"
          className="rounded-md outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PreSkoolWordmark />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

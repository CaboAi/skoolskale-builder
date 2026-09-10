import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PreSkoolWordmark } from "./PreSkoolWordmark";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Shared chrome rendered above every page from RootLayout.
 * Sticky so the theme toggle and wordmark stay reachable while
 * scrolling long surfaces (wizard, export view). Background is
 * a translucent overlay of --background so content scrolling
 * underneath shows through faintly.
 *
 * The "Packages" link only renders for authenticated users — we
 * skip the redirecting requireUser() helper here because this
 * header also wraps the /auth/login page, which has no session.
 */
export async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthed = Boolean(user);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            aria-label="preSkool home"
            className="rounded-md outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PreSkoolWordmark />
          </Link>
          {isAuthed && (
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Packages
            </Link>
          )}
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

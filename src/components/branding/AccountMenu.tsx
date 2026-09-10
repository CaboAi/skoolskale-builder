"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Header control for the signed-in user: shows which account the session
 * belongs to, and offers the two things that were otherwise unreachable
 * from inside the app — changing a password, and signing out.
 *
 * /auth/update-password exists for the recovery-link flow, but it only
 * needs a session, so linking it here doubles as "change my password"
 * for anyone already signed in.
 */
export function AccountMenu({ email }: { email: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // The proxy would bounce an unauthenticated request to the login page
    // anyway; going there directly skips the extra round trip.
    router.replace("/auth/login");
    router.refresh();
  }

  return (
    <Popover>
      <PopoverTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            type="button"
            variant="ghost"
            size="sm"
            data-slot="account-menu-trigger"
            className="max-w-[10rem] justify-start text-sm font-normal text-muted-foreground md:max-w-[16rem]"
            aria-label={`Account menu for ${email}`}
          >
            <span className="truncate">{email}</span>
          </Button>
        )}
      />
      <PopoverContent align="end" className="w-56">
        <p className="truncate px-1 text-xs text-muted-foreground">
          Signed in as <span className="font-medium">{email}</span>
        </p>
        <Link
          href="/auth/update-password"
          className="rounded-md px-1 py-1.5 text-sm transition-colors hover:bg-muted"
        >
          Change password
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onSignOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Inline SVG illustration. Should use Tailwind fill-* utilities so it retokens. */
  illustration: ReactNode;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  className?: string;
};

/**
 * Reusable empty-state shell. Centered illustration + heading + body
 * + primary CTA. The illustration slot is intentionally generic so
 * different surfaces can supply their own artwork while sharing the
 * same layout, type scale, and CTA treatment.
 */
export function EmptyState({
  illustration,
  heading,
  body,
  ctaLabel,
  ctaHref,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 rounded-xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="w-56 max-w-full">{illustration}</div>
      <div className="max-w-md space-y-2">
        <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {heading}
        </h2>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <Link
        href={ctaHref}
        className={cn(buttonVariants({ size: "lg" }), "px-6 text-base font-semibold")}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

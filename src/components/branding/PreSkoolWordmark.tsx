import { cn } from "@/lib/utils";

type Props = {
  /** Compact "pS" variant for tight contexts (narrow nav, favicon stand-in). */
  compact?: boolean;
  className?: string;
};

/**
 * preSkool wordmark — text-only logo, no separate icon.
 * Letters cycle through four brand tokens (primary teal, accent
 * coral, warning amber, success green) so the wordmark IS the
 * identity. Capital S is scaled ~14% to anchor the "preSchool"
 * wordplay. Colors come from CSS tokens, so palette changes
 * propagate without touching this file. Renders correctly on
 * both light and dark backgrounds because the same tokens
 * adjust per mode.
 */
export function PreSkoolWordmark({ compact = false, className }: Props) {
  if (compact) {
    return (
      <svg
        viewBox="0 0 60 52"
        className={cn("h-7 w-auto", className)}
        role="img"
        aria-label="preSkool"
      >
        <text
          x="0"
          y="44"
          className="font-heading"
          fontWeight={800}
          fontSize={44}
          letterSpacing="-0.04em"
        >
          <tspan className="fill-primary">p</tspan>
          <tspan className="fill-primary" fontSize={50}>
            S
          </tspan>
        </text>
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 200 52"
      className={cn("h-7 w-auto", className)}
      role="img"
      aria-label="preSkool"
    >
      <text
        x="0"
        y="42"
        className="font-heading"
        fontWeight={800}
        fontSize={42}
        letterSpacing="-0.04em"
      >
        <tspan className="fill-primary">p</tspan>
        <tspan className="fill-accent">r</tspan>
        <tspan className="fill-warning">e</tspan>
        <tspan className="fill-primary" fontSize={48}>
          S
        </tspan>
        <tspan className="fill-success">k</tspan>
        <tspan className="fill-accent">o</tspan>
        <tspan className="fill-warning">o</tspan>
        <tspan className="fill-primary">l</tspan>
      </text>
    </svg>
  );
}

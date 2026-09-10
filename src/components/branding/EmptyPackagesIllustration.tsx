import { cn } from "@/lib/utils";

/**
 * Original artwork for the dashboard empty state. Three stacked launch-
 * package cards fanning out, the front one carrying a green approval
 * check and a few content lines, sparkles in two corners. Every fill
 * resolves through Tailwind utility classes that map to the Schoolyard
 * palette tokens (--primary teal, --accent coral, --warning amber,
 * --success green, --muted neutral), so the illustration retokens
 * automatically when palette or mode changes.
 */
export function EmptyPackagesIllustration({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 240 180"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="A stack of launch packages waiting to be built"
    >
      {/* Soft circular backdrop for warmth */}
      <circle cx="120" cy="90" r="78" className="fill-muted" />

      {/* Back card */}
      <g transform="translate(30 60) rotate(-10 70 40)">
        <rect
          x="0"
          y="0"
          width="140"
          height="80"
          rx="16"
          className="fill-success"
          opacity="0.45"
        />
      </g>

      {/* Middle card */}
      <g transform="translate(60 40) rotate(5 70 40)">
        <rect
          x="0"
          y="0"
          width="140"
          height="80"
          rx="16"
          className="fill-accent"
          opacity="0.7"
        />
      </g>

      {/* Front card with content lines + approval check */}
      <g transform="translate(50 50)">
        <rect
          x="0"
          y="0"
          width="140"
          height="80"
          rx="16"
          className="fill-primary"
        />
        <rect x="14" y="18" width="80" height="7" rx="3.5" fill="white" opacity="0.95" />
        <rect x="14" y="34" width="100" height="6" rx="3" fill="white" opacity="0.65" />
        <rect x="14" y="48" width="70" height="6" rx="3" fill="white" opacity="0.65" />
        <circle cx="118" cy="60" r="11" className="fill-success" />
        <path
          d="M112.5 60 L116.5 64 L124 56.5"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Large sparkle top-right */}
      <g transform="translate(200 28)">
        <path
          d="M0 -14 L3 -3 L14 0 L3 3 L0 14 L-3 3 L-14 0 L-3 -3 Z"
          className="fill-warning"
        />
      </g>

      {/* Small sparkle bottom-left */}
      <g transform="translate(30 150)">
        <path
          d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"
          className="fill-accent"
        />
      </g>
    </svg>
  );
}

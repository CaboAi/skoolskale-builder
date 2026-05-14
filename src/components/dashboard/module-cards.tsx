"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { GeneratedAsset } from "@/lib/db/schema";
import {
  MODULE_LABELS,
  type CardVariant,
} from "@/lib/modules/registry";
import { useDashboardContext } from "./dashboard-context";
import { PromptExpander } from "./PromptExpander";

/* -------------------------------------------------------------------------- */
/* Module → human label (re-exported from registry for back-compat)           */
/* -------------------------------------------------------------------------- */

export { MODULE_LABELS };

/**
 * Shared hover treatment for every interactive module card on the
 * dashboard. Border ring shifts toward primary, slight elevation lifts
 * via shadow-md, 200ms ease-out. Skeletons skip this — there's nothing
 * to hover-respond to while waiting.
 */
const MODULE_CARD_CLASS =
  "transition-all duration-200 ease-out hover:ring-primary/40 hover:shadow-md";

/* -------------------------------------------------------------------------- */
/* Action callbacks — placeholders for 5.3                                    */
/* -------------------------------------------------------------------------- */

export type ModuleAction = "edit" | "regenerate" | "approve";

export type ModuleActionHandler = (
  module: string,
  action: ModuleAction,
) => void;

/* -------------------------------------------------------------------------- */
/* Card chrome (header w/ approval check, footer w/ buttons)                  */
/* -------------------------------------------------------------------------- */

function ApprovalCheck({ approved }: { approved: boolean }) {
  // Keyed so the icon remounts when approval flips — that's what triggers
  // the spring zoom-in animation. The cubic-bezier overshoots past 1.0
  // before settling, which makes "Approved" feel rewarding rather than
  // a quiet state-flip.
  return (
    <CheckCircle2
      key={approved ? "approved" : "pending"}
      className={cn(
        "h-5 w-5 shrink-0 transition-colors",
        approved
          ? "fill-success text-success-foreground animate-in zoom-in-50 fade-in duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          : "text-muted-foreground/30",
      )}
      aria-label={approved ? "Approved" : "Not approved"}
    />
  );
}

function ModuleHeader({
  module,
  approved,
}: {
  module: string;
  approved: boolean;
}) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
      <CardTitle className="text-base">{MODULE_LABELS[module]}</CardTitle>
      <ApprovalCheck approved={approved} />
    </CardHeader>
  );
}

function ModuleFooter({
  module,
  onAction,
  showEdit = true,
  approved,
  pendingAction = null,
}: {
  module: string;
  onAction: ModuleActionHandler;
  showEdit?: boolean;
  approved: boolean;
  /** Which action (if any) is currently in flight for this module. */
  pendingAction?: ModuleAction | null;
}) {
  const approving = pendingAction === "approve";
  const anyPending = pendingAction !== null;
  // Optional dashboard-level wiring — null when card is rendered in
  // isolation (tests), in which case the prompt-editor affordance is
  // hidden. The footer otherwise renders byte-identical to pre-Phase-2.
  const dashboard = useDashboardContext();
  const editedPending =
    dashboard?.pendingEditedRegenerateModule === module || false;
  return (
    <CardFooter className="flex flex-col gap-3 border-t pt-4">
      <div className="flex w-full flex-wrap gap-2">
        {showEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction(module, "edit")}
            disabled={anyPending || editedPending}
          >
            Edit
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction(module, "regenerate")}
          disabled={anyPending || editedPending}
        >
          Regenerate
        </Button>
        <Button
          variant={approved ? "secondary" : "default"}
          size="sm"
          className="ml-auto"
          onClick={() => onAction(module, "approve")}
          disabled={approved || anyPending || editedPending}
        >
          {approving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {approving ? "Approving…" : approved ? "Approved" : "Approve"}
        </Button>
      </div>
      {dashboard && (
        <PromptExpander
          packageId={dashboard.packageId}
          module={module}
          onRegenerateEdited={(prompt) =>
            dashboard.onRegenerateEditedPrompt(module, prompt)
          }
          disabled={editedPending || anyPending}
        />
      )}
    </CardFooter>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeletons                                                                  */
/*                                                                            */
/* Title stays as real text (MODULE_LABELS) so the user knows which module    */
/* is in flight without reading a placeholder bar. Body matches the actual    */
/* card shape per variant. Footer mirrors the real Edit / Regenerate /        */
/* Approve trio so the layout doesn't shift when content lands. A friendly    */
/* one-line status sits below the body skeleton — uses --muted-foreground so  */
/* it retokens with the palette.                                              */
/* -------------------------------------------------------------------------- */

type SkeletonVariant = "copy" | "image-variants" | "image-single";

function statusFor(module: string, variant: SkeletonVariant): string {
  const label = MODULE_LABELS[module] ?? module;
  if (variant === "image-variants") return `Generating ${label} variants…`;
  if (variant === "image-single") return `Generating ${label}…`;
  return `Drafting your ${label}…`;
}

function SkeletonStatusText({
  module,
  variant,
}: {
  module: string;
  variant: SkeletonVariant;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      {statusFor(module, variant)}
    </p>
  );
}

function SkeletonFooter() {
  return (
    <CardFooter className="flex flex-row gap-2 border-t pt-4">
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="ml-auto h-7 w-20" />
    </CardFooter>
  );
}

export function CopyModuleSkeleton({
  module,
  fullWidth = false,
}: {
  module: string;
  fullWidth?: boolean;
}) {
  return (
    <Card className={cn(fullWidth && "md:col-span-2")}>
      <CardHeader>
        <CardTitle className="text-base">{MODULE_LABELS[module]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-9/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-8/12" />
        </div>
        <SkeletonStatusText module={module} variant="copy" />
      </CardContent>
      <SkeletonFooter />
    </Card>
  );
}

/**
 * Skeleton for image-variants modules (cover, icon). Three placeholder
 * tiles in a row. Cover-shaped 16:9; icon also fits visually in this grid.
 */
export function ImageVariantsSkeleton({
  module,
  fullWidth = false,
}: {
  module: string;
  fullWidth?: boolean;
}) {
  return (
    <Card className={cn(fullWidth && "md:col-span-2")}>
      <CardHeader>
        <CardTitle className="text-base">{MODULE_LABELS[module]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="aspect-[16/9] w-full" />
          <Skeleton className="aspect-[16/9] w-full" />
          <Skeleton className="aspect-[16/9] w-full" />
        </div>
        <SkeletonStatusText module={module} variant="image-variants" />
      </CardContent>
      <SkeletonFooter />
    </Card>
  );
}

/**
 * Skeleton for single-variant image modules (classroom_cover, calendar_cover).
 * One placeholder banner.
 */
export function ImageSingleSkeleton({
  module,
  fullWidth = false,
}: {
  module: string;
  fullWidth?: boolean;
}) {
  return (
    <Card className={cn(fullWidth && "md:col-span-2")}>
      <CardHeader>
        <CardTitle className="text-base">{MODULE_LABELS[module]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="aspect-[16/9] w-full" />
        <SkeletonStatusText module={module} variant="image-single" />
      </CardContent>
      <SkeletonFooter />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Simple-text card — renders welcome_dm (single body) and transformation     */
/* (numbered candidate list). Branches on asset.module since the two shapes   */
/* are stable and the registry maps both to cardVariant: "simple-text".       */
/* -------------------------------------------------------------------------- */

type WelcomeDmContent = { content: string };
type TransformationContent = { candidates: string[] };
type TitleDescriptionContent = { title: string; description: string };
type ClassroomContentDisplay = {
  items: { title: string; description: string }[];
};

export function TextModuleCard({
  asset,
  onAction,
  pendingAction = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
}) {
  const moduleName = asset.module;
  if (moduleName === "transformation") {
    const c = asset.content as TransformationContent;
    return (
      <Card className={MODULE_CARD_CLASS}>
        <ModuleHeader module={moduleName} approved={asset.approved} />
        <CardContent>
          <ol className="divide-y rounded-md border">
            {c.candidates.map((line, i) => (
              <li key={i} className="flex gap-3 px-3 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {i + 1}.
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </CardContent>
        <ModuleFooter
          module={moduleName}
          onAction={onAction}
          approved={asset.approved}
          pendingAction={pendingAction}
        />
      </Card>
    );
  }
  if (moduleName === "classroom") {
    const c = asset.content as ClassroomContentDisplay;
    return (
      <Card className={MODULE_CARD_CLASS}>
        <ModuleHeader module={moduleName} approved={asset.approved} />
        <CardContent className="space-y-3">
          {c.items.map((item, i) => (
            <div key={i} className="space-y-1 rounded-md border p-3">
              <p className="text-sm font-semibold leading-tight">
                {item.title}
              </p>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </CardContent>
        <ModuleFooter
          module={moduleName}
          onAction={onAction}
          approved={asset.approved}
          pendingAction={pendingAction}
        />
      </Card>
    );
  }
  if (moduleName === "calendar") {
    const c = asset.content as TitleDescriptionContent;
    return (
      <Card className={MODULE_CARD_CLASS}>
        <ModuleHeader module={moduleName} approved={asset.approved} />
        <CardContent className="space-y-3">
          <p className="text-base font-semibold leading-tight">{c.title}</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {c.description}
          </p>
        </CardContent>
        <ModuleFooter
          module={moduleName}
          onAction={onAction}
          approved={asset.approved}
          pendingAction={pendingAction}
        />
      </Card>
    );
  }
  // Default: welcome_dm-shaped { content: string } — preformatted body + word count.
  const c = asset.content as WelcomeDmContent;
  const wordCount = c.content.split(/\s+/).filter(Boolean).length;
  return (
    <Card className={MODULE_CARD_CLASS}>
      <ModuleHeader module={moduleName} approved={asset.approved} />
      <CardContent className="space-y-3">
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
          {c.content}
        </pre>
        <Badge variant="secondary">{wordCount} words</Badge>
      </CardContent>
      <ModuleFooter
        module={moduleName}
        onAction={onAction}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* About Us                                                                    */
/* -------------------------------------------------------------------------- */

type AboutUsContent = {
  hero: string;
  trial_callout: string;
  value_buckets: { emoji: string; header: string; items: string[] }[];
  pricing: string;
  refund_policy: string;
};

export function AboutUsCard({
  asset,
  onAction,
  pendingAction = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
}) {
  const c = asset.content as AboutUsContent;
  return (
    <Card className={MODULE_CARD_CLASS}>
      <ModuleHeader module="about_us" approved={asset.approved} />
      <CardContent className="space-y-4">
        <p className="text-base leading-snug">{c.hero}</p>
        <p className="text-sm italic text-muted-foreground">
          {c.trial_callout}
        </p>
        <div className="space-y-3">
          {c.value_buckets.map((bucket, i) => (
            <div key={i}>
              <p className="font-semibold">
                <span className="mr-2">{bucket.emoji}</span>
                {bucket.header}
              </p>
              <ul className="ml-6 mt-1 list-disc space-y-1 text-sm">
                {bucket.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="space-y-1 border-t pt-3 text-sm">
          <p>
            <span className="font-semibold">Pricing:</span> {c.pricing}
          </p>
          <p className="text-muted-foreground">{c.refund_policy}</p>
        </div>
      </CardContent>
      <ModuleFooter
        module="about_us"
        onAction={onAction}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Start Here                                                                  */
/* -------------------------------------------------------------------------- */

type StartHereContent = {
  step_1_how_to_use: {
    title: string;
    sections: { name: string; description: string }[];
  };
  step_2_community_rules: { title: string; rules: string[] };
  step_3_faqs: { question: string; answer_template: string }[];
  step_4_need_assistance: { title: string; template: string };
};

export function StartHereCard({
  asset,
  onAction,
  pendingAction = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
}) {
  const c = asset.content as StartHereContent;
  return (
    <Card className={MODULE_CARD_CLASS}>
      <ModuleHeader module="start_here" approved={asset.approved} />
      <CardContent>
        <Accordion multiple className="w-full">
          <AccordionItem value="step-1">
            <AccordionTrigger>
              Step 1: {c.step_1_how_to_use.title}
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 text-sm">
                {c.step_1_how_to_use.sections.map((s, i) => (
                  <li key={i}>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-muted-foreground">{s.description}</p>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-2">
            <AccordionTrigger>
              Step 2: {c.step_2_community_rules.title}
            </AccordionTrigger>
            <AccordionContent>
              <ul className="ml-4 list-disc space-y-1 text-sm">
                {c.step_2_community_rules.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-3">
            <AccordionTrigger>
              Step 3: {c.step_3_faqs.length} FAQs
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-3 text-sm">
                {c.step_3_faqs.map((faq, i) => (
                  <li key={i}>
                    <p className="font-semibold">Q: {faq.question}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                      A: {faq.answer_template}
                    </p>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-4">
            <AccordionTrigger>
              Step 4: {c.step_4_need_assistance.title}
            </AccordionTrigger>
            <AccordionContent>
              <p className="whitespace-pre-wrap text-sm">
                {c.step_4_need_assistance.template}
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
      <ModuleFooter
        module="start_here"
        onAction={onAction}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Image-variants card — multi-variant image modules (cover, icon).           */
/*                                                                            */
/* Renders N variants in a grid; clicking a variant calls onSelectVariant     */
/* with the asset's module key and the chosen index. Generalized from PR #6's */
/* CoverCard (renamed in PR #7) so cover and icon share the same UI.          */
/* -------------------------------------------------------------------------- */

type ImageVariant = { url: string; index: number };
type ImageVariantsContent = {
  variants: ImageVariant[];
  selected_variant_index?: number;
};

export function ImageVariantsCard({
  asset,
  onAction,
  onSelectVariant,
  pendingAction = null,
  selectingIndex = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  onSelectVariant?: (module: string, index: number) => void;
  pendingAction?: ModuleAction | null;
  /** Index of the variant whose select-variant request is in flight, if any. */
  selectingIndex?: number | null;
}) {
  const c = asset.content as ImageVariantsContent;
  const selected = c.selected_variant_index ?? 0;
  const variantSelectInFlight = selectingIndex !== null;
  const moduleName = asset.module;
  const moduleLabel = MODULE_LABELS[moduleName] ?? moduleName;
  return (
    <Card className={cn(MODULE_CARD_CLASS, "md:col-span-2")}>
      <ModuleHeader module={moduleName} approved={asset.approved} />
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {c.variants.map((v) => {
            const isSelected = v.index === selected;
            const isSelecting = selectingIndex === v.index;
            return (
              <button
                type="button"
                key={v.index}
                onClick={() => onSelectVariant?.(moduleName, v.index)}
                disabled={variantSelectInFlight || !onSelectVariant}
                className={cn(
                  "relative overflow-hidden rounded-md border-2 outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected
                    ? "border-primary"
                    : "border-muted hover:border-muted-foreground/40",
                  variantSelectInFlight && "cursor-wait",
                )}
              >
                <Image
                  src={v.url}
                  alt={`${moduleLabel} variant ${v.index + 1}`}
                  width={480}
                  height={270}
                  className="h-auto w-full"
                />
                {isSelected && (
                  <span className="absolute right-2 top-2 rounded-full bg-background">
                    <CheckCircle2 className="h-6 w-6 fill-primary text-primary-foreground" />
                  </span>
                )}
                {isSelecting && (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
      <ModuleFooter
        module={moduleName}
        onAction={onAction}
        showEdit={false}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Image-single card — single-variant image modules (classroom_cover,         */
/* calendar_cover). One image, one download/select target.                    */
/* -------------------------------------------------------------------------- */

export function ImageModuleCard({
  asset,
  onAction,
  pendingAction = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
}) {
  const c = asset.content as ImageVariantsContent;
  const moduleName = asset.module;
  const moduleLabel = MODULE_LABELS[moduleName] ?? moduleName;
  const variant = c.variants[0];
  return (
    <Card className={cn(MODULE_CARD_CLASS, "md:col-span-2")}>
      <ModuleHeader module={moduleName} approved={asset.approved} />
      <CardContent>
        {variant ? (
          <div className="overflow-hidden rounded-md border">
            <Image
              src={variant.url}
              alt={`${moduleLabel}`}
              width={1456}
              height={816}
              className="h-auto w-full"
            />
          </div>
        ) : (
          <Skeleton className="aspect-[16/9] w-full" />
        )}
      </CardContent>
      <ModuleFooter
        module={moduleName}
        onAction={onAction}
        showEdit={false}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Leaderboard — 9-level rank list                                            */
/* -------------------------------------------------------------------------- */

type LeaderboardContent = { levels: string[] };

export function LeaderboardCard({
  asset,
  onAction,
  pendingAction = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
}) {
  const c = asset.content as LeaderboardContent;
  return (
    <Card className={MODULE_CARD_CLASS}>
      <ModuleHeader module="leaderboard" approved={asset.approved} />
      <CardContent>
        <ol className="divide-y rounded-md border">
          {c.levels.map((name, i) => (
            <li key={i} className="flex gap-3 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                Lv {i + 1}
              </span>
              <span>{name}</span>
            </li>
          ))}
        </ol>
      </CardContent>
      <ModuleFooter
        module="leaderboard"
        onAction={onAction}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Categories — 3 named blocks                                                */
/* -------------------------------------------------------------------------- */

type CategoriesContent = {
  categories: { name: string; description: string }[];
};

export function CategoriesCard({
  asset,
  onAction,
  pendingAction = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
}) {
  const c = asset.content as CategoriesContent;
  return (
    <Card className={MODULE_CARD_CLASS}>
      <ModuleHeader module="categories" approved={asset.approved} />
      <CardContent className="space-y-3">
        {c.categories.map((cat, i) => (
          <div key={i} className="space-y-0.5 rounded-md border p-3">
            <p className="text-sm font-semibold">{cat.name}</p>
            <p className="text-xs text-muted-foreground">{cat.description}</p>
          </div>
        ))}
      </CardContent>
      <ModuleFooter
        module="categories"
        onAction={onAction}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Discovery SEO — keyword chips                                              */
/* -------------------------------------------------------------------------- */

type DiscoverySeoContent = { keywords: string[] };

export function DiscoverySeoCard({
  asset,
  onAction,
  pendingAction = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
}) {
  const c = asset.content as DiscoverySeoContent;
  return (
    <Card className={MODULE_CARD_CLASS}>
      <ModuleHeader module="discovery_seo" approved={asset.approved} />
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {c.keywords.map((kw, i) => (
            <Badge key={i} variant="secondary">
              {kw}
            </Badge>
          ))}
        </div>
      </CardContent>
      <ModuleFooter
        module="discovery_seo"
        onAction={onAction}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* CARD_COMPONENTS — registry-driven card dispatch                            */
/*                                                                            */
/* PR #7 tightens this from `Partial<Record<>>` to `Record<>` — every         */
/* CardVariant in the registry now has a wired component. Adding a new        */
/* variant without a component is a compile-time error.                       */
/*                                                                            */
/* Variant-aware modules (image-variants) read onSelectVariant +              */
/* selectingIndex from the props bag; non-variant modules ignore them.        */
/* -------------------------------------------------------------------------- */

export type GenericModuleCardProps = {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
  /**
   * Variant-aware modules (cover, icon) call this with their module key
   * + chosen variant index. The dashboard maps module key → API route.
   * Non-variant modules ignore this prop.
   */
  onSelectVariant?: (module: string, index: number) => void;
  /** Index of the variant whose select-variant request is in flight. */
  selectingIndex?: number | null;
};

export const CARD_COMPONENTS: Record<
  CardVariant,
  ComponentType<GenericModuleCardProps>
> = {
  "simple-text": TextModuleCard,
  "about-us": AboutUsCard,
  "start-here": StartHereCard,
  "image-variants": ImageVariantsCard,
  "image-single": ImageModuleCard,
  leaderboard: LeaderboardCard,
  repeater: CategoriesCard,
  chips: DiscoverySeoCard,
};

// Re-exports kept so the rest of the app's imports (PackageDashboard,
// action-dialogs) compile without code churn.
export type { ModuleKey } from "@/lib/modules/registry";

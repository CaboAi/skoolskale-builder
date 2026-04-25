"use client";

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

/* -------------------------------------------------------------------------- */
/* Module → human label                                                       */
/* -------------------------------------------------------------------------- */

export const COPY_MODULES = [
  "welcome_dm",
  "transformation",
  "about_us",
  "start_here",
] as const;

export const MODULE_LABELS: Record<string, string> = {
  cover: "Community Cover",
  welcome_dm: "Welcome DM",
  transformation: "Transformation Line",
  about_us: "About Us",
  start_here: "Start Here",
};

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
  return (
    <CheckCircle2
      className={cn(
        "h-5 w-5 shrink-0",
        approved ? "fill-emerald-500 text-white" : "text-muted-foreground/30",
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
  return (
    <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
      {showEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction(module, "edit")}
          disabled={anyPending}
        >
          Edit
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAction(module, "regenerate")}
        disabled={anyPending}
      >
        Regenerate
      </Button>
      <Button
        variant={approved ? "secondary" : "default"}
        size="sm"
        className="ml-auto"
        onClick={() => onAction(module, "approve")}
        disabled={approved || anyPending}
      >
        {approving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        {approving ? "Approving…" : approved ? "Approved" : "Approve"}
      </Button>
    </CardFooter>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeletons                                                                  */
/* -------------------------------------------------------------------------- */

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
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-9/12" />
        <Skeleton className="h-4 w-10/12" />
        <Skeleton className="h-4 w-8/12" />
      </CardContent>
    </Card>
  );
}

export function CoverSkeleton() {
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">{MODULE_LABELS.cover}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="aspect-[16/9] w-full" />
          <Skeleton className="aspect-[16/9] w-full" />
          <Skeleton className="aspect-[16/9] w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Welcome DM                                                                  */
/* -------------------------------------------------------------------------- */

type WelcomeDmContent = { content: string };

export function WelcomeDmCard({
  asset,
  onAction,
  pendingAction = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
}) {
  const c = asset.content as WelcomeDmContent;
  const wordCount = c.content.split(/\s+/).filter(Boolean).length;
  return (
    <Card>
      <ModuleHeader module="welcome_dm" approved={asset.approved} />
      <CardContent className="space-y-3">
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
          {c.content}
        </pre>
        <Badge variant="secondary">{wordCount} words</Badge>
      </CardContent>
      <ModuleFooter
        module="welcome_dm"
        onAction={onAction}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Transformation                                                              */
/* -------------------------------------------------------------------------- */

type TransformationContent = { candidates: string[] };

export function TransformationCard({
  asset,
  onAction,
  pendingAction = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  pendingAction?: ModuleAction | null;
}) {
  const c = asset.content as TransformationContent;
  return (
    <Card>
      <ModuleHeader module="transformation" approved={asset.approved} />
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
        module="transformation"
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
    <Card>
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
    <Card>
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
/* Cover                                                                       */
/* -------------------------------------------------------------------------- */

type CoverVariant = { url: string; index: number };
type CoverContent = {
  variants: CoverVariant[];
  selected_variant_index?: number;
};

export function CoverCard({
  asset,
  onAction,
  onSelectVariant,
  pendingAction = null,
  selectingIndex = null,
}: {
  asset: GeneratedAsset;
  onAction: ModuleActionHandler;
  onSelectVariant: (index: number) => void;
  pendingAction?: ModuleAction | null;
  /** Index of the variant whose select-variant request is in flight, if any. */
  selectingIndex?: number | null;
}) {
  const c = asset.content as CoverContent;
  const selected = c.selected_variant_index ?? 0;
  const variantSelectInFlight = selectingIndex !== null;
  return (
    <Card className="md:col-span-2">
      <ModuleHeader module="cover" approved={asset.approved} />
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {c.variants.map((v) => {
            const isSelected = v.index === selected;
            const isSelecting = selectingIndex === v.index;
            return (
              <button
                type="button"
                key={v.index}
                onClick={() => onSelectVariant(v.index)}
                disabled={variantSelectInFlight}
                className={cn(
                  "relative overflow-hidden rounded-md border-2 transition",
                  isSelected
                    ? "border-primary"
                    : "border-muted hover:border-muted-foreground/40",
                  variantSelectInFlight && "cursor-wait",
                )}
              >
                <Image
                  src={v.url}
                  alt={`Cover variant ${v.index + 1}`}
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
        module="cover"
        onAction={onAction}
        showEdit={false}
        approved={asset.approved}
        pendingAction={pendingAction}
      />
    </Card>
  );
}

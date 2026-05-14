"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Creator, GeneratedAsset, LaunchPackage } from "@/lib/db/schema";
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules/registry";

/* -------------------------------------------------------------------------- */
/* Content type aliases (mirror what the parsers produce)                     */
/* -------------------------------------------------------------------------- */

type WelcomeDmContent = { content: string };
type TransformationContent = { candidates: string[] };
type AboutUsContent = {
  hero: string;
  trial_callout: string;
  value_buckets: { emoji: string; header: string; items: string[] }[];
  pricing: string;
  refund_policy: string;
};
type StartHereContent = {
  step_1_how_to_use: {
    title: string;
    sections: { name: string; description: string }[];
  };
  step_2_community_rules: { title: string; rules: string[] };
  step_3_faqs: { question: string; answer_template: string }[];
  step_4_need_assistance: { title: string; template: string };
};
type CoverVariant = { url: string; index: number };
type CoverContent = {
  variants: CoverVariant[];
  selected_variant_index?: number;
};

/* -------------------------------------------------------------------------- */
/* CopyButton                                                                  */
/* -------------------------------------------------------------------------- */

function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy — clipboard blocked");
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      <Copy className="mr-1.5 h-4 w-4" />
      {label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Render helpers — JSON → formatted-text the VA pastes into Skool            */
/* -------------------------------------------------------------------------- */

function renderAboutUsText(c: AboutUsContent): string {
  const buckets = c.value_buckets
    .map((b) => {
      const items = b.items.map((i) => `- ${i}`).join("\n");
      return `${b.emoji} ${b.header}\n${items}`;
    })
    .join("\n\n");
  return [
    c.hero,
    "",
    c.trial_callout,
    "",
    buckets,
    "",
    c.pricing,
    "",
    c.refund_policy,
  ]
    .join("\n")
    .trim();
}

function renderStep1Text(s: StartHereContent["step_1_how_to_use"]): string {
  const sections = s.sections
    .map((sec) => `${sec.name}\n${sec.description}`)
    .join("\n\n");
  return `${s.title}\n\n${sections}`;
}

function renderStep2Text(
  s: StartHereContent["step_2_community_rules"],
): string {
  const rules = s.rules.map((r, i) => `${i + 1}. ${r}`).join("\n");
  return `${s.title}\n\n${rules}`;
}

function renderStep3Text(faqs: StartHereContent["step_3_faqs"]): string {
  return faqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer_template}`)
    .join("\n\n");
}

function renderStep4Text(
  s: StartHereContent["step_4_need_assistance"],
): string {
  return `${s.title}\n\n${s.template}`;
}

/* -------------------------------------------------------------------------- */
/* Section: Welcome DM                                                         */
/* -------------------------------------------------------------------------- */

function WelcomeDmSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as WelcomeDmContent;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <CardTitle>Welcome DM</CardTitle>
        <CopyButton text={c.content} />
      </CardHeader>
      <CardContent className="space-y-2">
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
          {c.content}
        </pre>
        <p className="text-xs text-muted-foreground">
          Paste this into your Skool community&apos;s automation &gt; welcome
          message.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Transformation                                                     */
/* -------------------------------------------------------------------------- */

function TransformationSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as TransformationContent;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transformation Line (selected)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-2">
          {c.candidates.map((line, i) => {
            const isPrimary = i === 0;
            return (
              <li
                key={i}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {i + 1}.
                </span>
                <span className="flex-1 text-sm">{line}</span>
                <div className="flex items-center gap-2">
                  {isPrimary && <Badge>Primary</Badge>}
                  <CopyButton text={line} />
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-muted-foreground">
          This goes at the top of your About Us page.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: About Us                                                           */
/* -------------------------------------------------------------------------- */

function AboutUsSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as AboutUsContent;
  const text = renderAboutUsText(c);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <CardTitle>About Us Page</CardTitle>
        <CopyButton text={text} />
      </CardHeader>
      <CardContent className="space-y-2">
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
          {text}
        </pre>
        <p className="text-xs text-muted-foreground">
          Paste this into Skool &gt; Settings &gt; About.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Start Here                                                         */
/* -------------------------------------------------------------------------- */

function StartHereSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as StartHereContent;
  const steps: { value: string; label: string; text: string }[] = [
    {
      value: "step-1",
      label: `Step 1: ${c.step_1_how_to_use.title}`,
      text: renderStep1Text(c.step_1_how_to_use),
    },
    {
      value: "step-2",
      label: `Step 2: ${c.step_2_community_rules.title}`,
      text: renderStep2Text(c.step_2_community_rules),
    },
    {
      value: "step-3",
      label: `Step 3: ${c.step_3_faqs.length} FAQs`,
      text: renderStep3Text(c.step_3_faqs),
    },
    {
      value: "step-4",
      label: `Step 4: ${c.step_4_need_assistance.title}`,
      text: renderStep4Text(c.step_4_need_assistance),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start Here Course</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Accordion
          multiple
          defaultValue={steps.map((s) => s.value)}
          className="w-full"
        >
          {steps.map((s) => (
            <AccordionItem key={s.value} value={s.value}>
              <AccordionTrigger>{s.label}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <CopyButton text={s.text} />
                  </div>
                  <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
                    {s.text}
                  </pre>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="text-xs text-muted-foreground">
          Create a course in Skool called &ldquo;Start Here&rdquo;. Add 4
          lessons matching the steps below.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Cover                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Renders a same-origin `<a>` styled as a button. The link points at the
 * download-redirect route, which authenticates the user, re-signs the
 * storage path with a 60s TTL, and 302s the browser to the signed URL
 * with `?download=<filename>` — Supabase honors that with
 * Content-Disposition: attachment, forcing a real file download instead
 * of opening the image in a new tab.
 *
 * No client-side fetch / Blob plumbing required. Same-origin `<a download>`
 * is also a no-op here (the eventual signed URL is cross-origin) but the
 * server-supplied filename takes over via the response header.
 */
function DownloadButton({
  packageId,
  module,
  index,
  label = "Download",
}: {
  packageId: string;
  module: string;
  index: number;
  label?: string;
}) {
  const href = `/api/packages/${packageId}/assets/${module}/${index}/download`;
  return (
    <a
      href={href}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      <Download className="mr-1.5 h-4 w-4" />
      {label}
    </a>
  );
}

function CoverSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as CoverContent;
  const selectedIdx = c.selected_variant_index ?? 0;
  const selected =
    c.variants.find((v) => v.index === selectedIdx) ?? c.variants[0];
  const others = c.variants.filter((v) => v.index !== selected.index);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Community Cover</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="overflow-hidden rounded-md border">
            <Image
              src={selected.url}
              alt="Selected community cover"
              width={1456}
              height={816}
              className="h-auto w-full"
              priority
            />
          </div>
          <DownloadButton
            packageId={asset.packageId}
            module={asset.module}
            index={selected.index}
            label="Download cover"
          />
        </div>
        {others.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Other variants</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {others.map((v) => (
                <div key={v.index} className="space-y-2">
                  <div className="overflow-hidden rounded-md border">
                    <Image
                      src={v.url}
                      alt={`Cover variant ${v.index + 1}`}
                      width={728}
                      height={408}
                      className="h-auto w-full"
                    />
                  </div>
                  <DownloadButton
                    packageId={asset.packageId}
                    module={asset.module}
                    index={v.index}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Upload to Skool &gt; Settings &gt; Branding &gt; Cover image.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Icon (3 variant grid, mirrors CoverSection)                       */
/* -------------------------------------------------------------------------- */

function IconSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as CoverContent;
  const selectedIdx = c.selected_variant_index ?? 0;
  const selected =
    c.variants.find((v) => v.index === selectedIdx) ?? c.variants[0];
  const others = c.variants.filter((v) => v.index !== selected.index);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Community Icon</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="overflow-hidden rounded-md border bg-muted/30 p-4">
            <Image
              src={selected.url}
              alt="Selected community icon"
              width={512}
              height={512}
              className="mx-auto h-auto max-w-[256px]"
            />
          </div>
          <DownloadButton
            packageId={asset.packageId}
            module={asset.module}
            index={selected.index}
            label="Download icon"
          />
        </div>
        {others.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Other variants</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {others.map((v) => (
                <div key={v.index} className="space-y-2">
                  <div className="overflow-hidden rounded-md border bg-muted/30 p-3">
                    <Image
                      src={v.url}
                      alt={`Icon variant ${v.index + 1}`}
                      width={512}
                      height={512}
                      className="mx-auto h-auto max-w-[160px]"
                    />
                  </div>
                  <DownloadButton
                    packageId={asset.packageId}
                    module={asset.module}
                    index={v.index}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Upload to Skool &gt; Settings &gt; Branding &gt; Community icon.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Classroom Cover (single banner image)                             */
/* -------------------------------------------------------------------------- */

function ClassroomCoverSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as CoverContent;
  const variant = c.variants[0];
  if (!variant) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classroom Cover</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="overflow-hidden rounded-md border">
          <Image
            src={variant.url}
            alt="Classroom cover banner"
            width={1456}
            height={816}
            className="h-auto w-full"
          />
        </div>
        <DownloadButton
          packageId={asset.packageId}
          module={asset.module}
          index={variant.index}
          label="Download classroom cover"
        />
        <p className="text-xs text-muted-foreground">
          Upload to Skool &gt; Classroom &gt; Settings (cover image).
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Calendar Cover (single banner image)                              */
/* -------------------------------------------------------------------------- */

function CalendarCoverSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as CoverContent;
  const variant = c.variants[0];
  if (!variant) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar Cover</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="overflow-hidden rounded-md border">
          <Image
            src={variant.url}
            alt="Calendar cover banner"
            width={1456}
            height={816}
            className="h-auto w-full"
          />
        </div>
        <DownloadButton
          packageId={asset.packageId}
          module={asset.module}
          index={variant.index}
          label="Download calendar cover"
        />
        <p className="text-xs text-muted-foreground">
          Upload to Skool &gt; Calendar &gt; Settings (cover image).
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Deployment checklist                                                        */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Section: Classroom (list of title + description items)                     */
/* -------------------------------------------------------------------------- */

type TitleDescriptionContent = { title: string; description: string };
type ClassroomExportContent = { items: TitleDescriptionContent[] };

export function ClassroomSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as ClassroomExportContent;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classroom</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {c.items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Classroom {i + 1}
              </p>
              <CopyButton text={item.title} label="Copy title" />
            </div>
            <p className="font-semibold">{item.title}</p>
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Description
              </p>
              <CopyButton text={item.description} label="Copy description" />
            </div>
            <p className="whitespace-pre-wrap text-sm">{item.description}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Paste each title + description into Skool &gt; Classroom &gt; the
          matching course.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Calendar (title + description)                                    */
/* -------------------------------------------------------------------------- */

export function CalendarSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as TitleDescriptionContent;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Title
            </p>
            <CopyButton text={c.title} label="Copy title" />
          </div>
          <p className="font-semibold">{c.title}</p>
        </div>
        <div className="space-y-1 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Description
            </p>
            <CopyButton text={c.description} label="Copy description" />
          </div>
          <p className="whitespace-pre-wrap text-sm">{c.description}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste these into Skool &gt; Calendar &gt; Settings (separate fields).
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Leaderboard (9 levels)                                            */
/* -------------------------------------------------------------------------- */

type LeaderboardContent = { levels: string[] };

function LeaderboardSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as LeaderboardContent;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard Levels</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-1.5">
          {c.levels.map((name, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-md border p-2"
            >
              <span className="font-mono text-xs text-muted-foreground">
                Lv {i + 1}
              </span>
              <span className="flex-1 text-sm">{name}</span>
              <CopyButton text={name} />
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Paste each name into Skool &gt; Settings &gt; Leaderboard.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Categories (3 named blocks)                                       */
/* -------------------------------------------------------------------------- */

type CategoriesContent = {
  categories: string[];
};

function CategoriesSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as CategoriesContent;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {c.categories.map((name, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-md border p-3"
          >
            <span className="mt-0.5 font-mono text-xs text-muted-foreground">
              {i + 1}.
            </span>
            <p className="flex-1 font-semibold">{name}</p>
            <CopyButton text={name} />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Paste each name into Skool &gt; Community &gt; Categories.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Section: Discovery SEO (keyword chips + CSV copy)                          */
/* -------------------------------------------------------------------------- */

type DiscoverySeoContent = { keywords: string[] };

function DiscoverySeoSection({ asset }: { asset: GeneratedAsset }) {
  const c = asset.content as DiscoverySeoContent;
  const csv = c.keywords.join(", ");
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <CardTitle>Discovery Search Keywords</CardTitle>
        <CopyButton text={csv} label="Copy as CSV" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {c.keywords.map((kw, i) => (
            <Badge key={i} variant="secondary">
              {kw}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Paste into Skool &gt; Settings &gt; Discovery (search keywords).
        </p>
      </CardContent>
    </Card>
  );
}

const CHECKLIST_ITEMS = [
  "Created Skool community",
  "Uploaded cover image",
  "Uploaded community icon",
  "Set community description (transformation line)",
  "Pasted About Us page",
  'Created "Start Here" course with 4 lessons',
  "Configured welcome message automation",
  "Set pricing per the proposal",
  "Named Classroom + Calendar areas",
  "Uploaded Classroom + Calendar cover images",
  "Renamed leaderboard levels",
  "Created the 3 community categories",
  "Pasted Discovery search keywords",
  "Tested join flow with a test account",
] as const;

function DeploymentChecklist({
  checked,
  onToggle,
}: {
  checked: boolean[];
  onToggle: (index: number, next: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {CHECKLIST_ITEMS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <Checkbox
                id={`checklist-${i}`}
                checked={checked[i]}
                onCheckedChange={(value) => onToggle(i, value === true)}
              />
              <label
                htmlFor={`checklist-${i}`}
                className="cursor-pointer text-sm"
              >
                {label}
              </label>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* ExportView                                                                  */
/* -------------------------------------------------------------------------- */

export type ExportViewProps = {
  package: LaunchPackage;
  creator: Creator;
  assets: GeneratedAsset[];
};

export function ExportView({ package: pkg, creator, assets }: ExportViewProps) {
  const router = useRouter();
  const byModule = useMemo(
    () => new Map<string, GeneratedAsset>(assets.map((a) => [a.module, a])),
    [assets],
  );
  const [checked, setChecked] = useState<boolean[]>(() =>
    CHECKLIST_ITEMS.map(() => false),
  );
  const allChecked = checked.every(Boolean);
  const isDeployed = pkg.status === "deployed";

  const deployMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/packages/${pkg.id}/deploy`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Deploy failed" }));
        throw new Error(err.error ?? "Deploy failed");
      }
      return (await res.json()) as LaunchPackage;
    },
    onSuccess: () => {
      toast.success("Package deployed 🎉");
      router.push(`/packages/${pkg.id}`);
    },
    onError: (err) => {
      toast.error(`Could not mark as deployed: ${err.message}`);
    },
  });

  // Look up every registered module in one pass; section blocks below pull
  // the per-module asset from this typed record. Adding a module to the
  // registry is enough for it to be fetched here — the section block is the
  // only thing that still needs hand-wiring.
  const m = Object.fromEntries(
    MODULE_KEYS.map((k) => [k, byModule.get(k)]),
  ) as Record<ModuleKey, GeneratedAsset | undefined>;
  const cover = m.cover;
  const icon = m.icon;
  const welcomeDm = m.welcome_dm;
  const transformation = m.transformation;
  const aboutUs = m.about_us;
  const startHere = m.start_here;
  const classroom = m.classroom;
  const calendar = m.calendar;
  const leaderboard = m.leaderboard;
  const categories = m.categories;
  const discoverySeo = m.discovery_seo;
  const classroomCover = m.classroom_cover;
  const calendarCover = m.calendar_cover;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link
            href={`/packages/${pkg.id}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:underline"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Export Launch Package
          </h1>
          <p className="truncate text-muted-foreground">
            {creator.name} — {creator.communityName}
          </p>
        </div>
        <Button
          onClick={() => deployMutation.mutate()}
          disabled={!allChecked || isDeployed || deployMutation.isPending}
        >
          {deployMutation.isPending && (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          )}
          {isDeployed
            ? "Deployed"
            : deployMutation.isPending
              ? "Deploying…"
              : allChecked
                ? "Deploy Package"
                : "In Review"}
        </Button>
      </header>

      {welcomeDm && <WelcomeDmSection asset={welcomeDm} />}
      {transformation && <TransformationSection asset={transformation} />}
      {aboutUs && <AboutUsSection asset={aboutUs} />}
      {startHere && <StartHereSection asset={startHere} />}
      {cover && <CoverSection asset={cover} />}
      {icon && <IconSection asset={icon} />}
      {classroom && <ClassroomSection asset={classroom} />}
      {classroomCover && <ClassroomCoverSection asset={classroomCover} />}
      {calendar && <CalendarSection asset={calendar} />}
      {calendarCover && <CalendarCoverSection asset={calendarCover} />}
      {leaderboard && <LeaderboardSection asset={leaderboard} />}
      {categories && <CategoriesSection asset={categories} />}
      {discoverySeo && <DiscoverySeoSection asset={discoverySeo} />}

      <DeploymentChecklist
        checked={checked}
        onToggle={(i, next) =>
          setChecked((prev) => {
            const copy = [...prev];
            copy[i] = next;
            return copy;
          })
        }
      />

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {isDeployed
            ? "This package has been marked as deployed."
            : allChecked
              ? "All checklist items complete — ready to deploy."
              : "Finish every checklist item above to enable deployment."}
        </p>
        <Button
          onClick={() => deployMutation.mutate()}
          disabled={!allChecked || isDeployed || deployMutation.isPending}
          size="lg"
        >
          {deployMutation.isPending && (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          )}
          {isDeployed
            ? "Deployed"
            : deployMutation.isPending
              ? "Deploying…"
              : allChecked
                ? "Deploy Package"
                : "In Review"}
        </Button>
      </div>
    </div>
  );
}

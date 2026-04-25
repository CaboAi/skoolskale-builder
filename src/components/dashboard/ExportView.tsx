"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, Loader2 } from "lucide-react";
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

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    toast.error(
      `Download failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

function DownloadButton({
  url,
  filename,
  label = "Download",
}: {
  url: string;
  filename: string;
  label?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void downloadImage(url, filename)}
    >
      <Download className="mr-1.5 h-4 w-4" />
      {label}
    </Button>
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
            url={selected.url}
            filename={`cover-variant-${selected.index + 1}.png`}
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
                    url={v.url}
                    filename={`cover-variant-${v.index + 1}.png`}
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
/* Deployment checklist                                                        */
/* -------------------------------------------------------------------------- */

const CHECKLIST_ITEMS = [
  "Created Skool community",
  "Uploaded cover image",
  "Set community description (transformation line)",
  "Pasted About Us page",
  'Created "Start Here" course with 4 lessons',
  "Configured welcome message automation",
  "Set pricing per the proposal",
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

  const cover = byModule.get("cover");
  const welcomeDm = byModule.get("welcome_dm");
  const transformation = byModule.get("transformation");
  const aboutUs = byModule.get("about_us");
  const startHere = byModule.get("start_here");

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
              : "Mark as deployed"}
        </Button>
      </header>

      {welcomeDm && <WelcomeDmSection asset={welcomeDm} />}
      {transformation && <TransformationSection asset={transformation} />}
      {aboutUs && <AboutUsSection asset={aboutUs} />}
      {startHere && <StartHereSection asset={startHere} />}
      {cover && <CoverSection asset={cover} />}

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
    </div>
  );
}

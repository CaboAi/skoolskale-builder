"use client";

import type { IntakeFormReturn } from "../wizard";
import type { CreatorIntake } from "@/types/schemas";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RepeaterField } from "@/components/wizard/RepeaterField";
import { KeywordChipField } from "@/components/wizard/KeywordChipField";

type Props = { form: IntakeFormReturn };

const LEADERBOARD_DEFAULTS: [
  string, string, string, string, string, string, string, string, string,
] = [
  "Newcomer",
  "Explorer",
  "Member",
  "Contributor",
  "Advocate",
  "Mentor",
  "Champion",
  "Leader",
  "Founder",
];

const CATEGORY_DEFAULTS: [
  { name: string; description: string },
  { name: string; description: string },
  { name: string; description: string },
] = [
  { name: "Introduce Yourself", description: "Say hi and tell us a bit about you." },
  { name: "Share your wins", description: "Celebrate progress, big or small." },
  { name: "Advice from the creator", description: "Tips and answers from the host." },
];

export function Step5AddOns({ form }: Props) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;

  const leaderboard =
    watch("leaderboard_levels") ?? LEADERBOARD_DEFAULTS;
  const categories = watch("categories") ?? CATEGORY_DEFAULTS;
  const keywords = watch("discovery_keywords") ?? [];

  function setLeaderboard(next: string[]) {
    setValue(
      "leaderboard_levels",
      next as CreatorIntake["leaderboard_levels"],
      { shouldValidate: true, shouldDirty: true },
    );
  }
  function setCategories(next: { name: string; description: string }[]) {
    setValue("categories", next as CreatorIntake["categories"], {
      shouldValidate: true,
      shouldDirty: true,
    });
  }
  function setKeywords(next: string[]) {
    setValue("discovery_keywords", next, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  const leaderboardErrors =
    Array.isArray((errors.leaderboard_levels as { message?: string }[]) ?? null)
      ? (errors.leaderboard_levels as unknown as {
          message?: string;
        }[]).map((e) => e?.message)
      : undefined;

  const categoryErrors =
    Array.isArray(errors.categories as unknown as unknown[])
      ? (errors.categories as unknown as {
          name?: { message?: string };
          description?: { message?: string };
        }[]).map((row) =>
          row
            ? {
                name: row.name?.message,
                description: row.description?.message,
              }
            : undefined,
        )
      : undefined;

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-medium">Launch package add-ons</h2>
      <p className="text-sm text-muted-foreground">
        Optional details for the new community modules. You can edit any of
        these from the dashboard later.
      </p>

      {/* Classroom */}
      <div className="space-y-3 rounded-md border p-4">
        <h3 className="text-sm font-semibold">Classroom</h3>
        <div className="space-y-1.5">
          <Label htmlFor="classroom_intake.title">
            Title{" "}
            <span className="text-xs text-muted-foreground">(max 50)</span>
          </Label>
          <Input
            id="classroom_intake.title"
            maxLength={50}
            {...register("classroom_intake.title")}
            placeholder="e.g. The Welcome Course"
          />
          {errors.classroom_intake?.title?.message ? (
            <p className="text-xs text-destructive">
              {errors.classroom_intake.title.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="classroom_intake.description">
            Description{" "}
            <span className="text-xs text-muted-foreground">(max 500)</span>
          </Label>
          <Textarea
            id="classroom_intake.description"
            rows={3}
            maxLength={500}
            {...register("classroom_intake.description")}
            placeholder="What members will get from the classroom…"
          />
          {errors.classroom_intake?.description?.message ? (
            <p className="text-xs text-destructive">
              {errors.classroom_intake.description.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* Calendar */}
      <div className="space-y-3 rounded-md border p-4">
        <h3 className="text-sm font-semibold">Calendar</h3>
        <div className="space-y-1.5">
          <Label htmlFor="calendar_intake.title">
            Title{" "}
            <span className="text-xs text-muted-foreground">(max 30)</span>
          </Label>
          <Input
            id="calendar_intake.title"
            maxLength={30}
            {...register("calendar_intake.title")}
            placeholder="e.g. Live Calls"
          />
          {errors.calendar_intake?.title?.message ? (
            <p className="text-xs text-destructive">
              {errors.calendar_intake.title.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calendar_intake.description">
            Description{" "}
            <span className="text-xs text-muted-foreground">(max 300)</span>
          </Label>
          <Textarea
            id="calendar_intake.description"
            rows={3}
            maxLength={300}
            {...register("calendar_intake.description")}
            placeholder="What events live on the calendar…"
          />
          {errors.calendar_intake?.description?.message ? (
            <p className="text-xs text-destructive">
              {errors.calendar_intake.description.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* Leaderboard levels */}
      <div className="rounded-md border p-4">
        <RepeaterField
          variant="single"
          legend="Leaderboard levels (9)"
          rowLabel={(i) => `Level ${i + 1}`}
          values={leaderboard}
          onChange={setLeaderboard}
          rowPlaceholder={(i) => LEADERBOARD_DEFAULTS[i]}
          errors={leaderboardErrors}
        />
      </div>

      {/* Categories */}
      <div className="rounded-md border p-4">
        <RepeaterField
          variant="grouped"
          legend="Categories (3)"
          rowLabel={(i) => `Category ${i + 1}`}
          values={categories}
          onChange={setCategories}
          namePlaceholder="Category name"
          descriptionPlaceholder="Short description"
          errors={categoryErrors}
        />
      </div>

      {/* Discovery SEO */}
      <div className="rounded-md border p-4">
        <KeywordChipField
          id="discovery_keywords"
          label="Discovery search keywords"
          values={keywords}
          onChange={setKeywords}
          max={11}
          placeholder="e.g. yoga, mindfulness, journaling"
          error={
            (errors.discovery_keywords as { message?: string } | undefined)
              ?.message
          }
        />
      </div>
    </section>
  );
}

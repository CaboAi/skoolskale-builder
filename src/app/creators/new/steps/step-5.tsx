"use client";

import type { IntakeFormReturn } from "../wizard";
import type { CalendarEventIntake, CreatorIntake } from "@/types/schemas";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RepeaterField } from "@/components/wizard/RepeaterField";
import { KeywordChipField } from "@/components/wizard/KeywordChipField";
import {
  EventsRepeater,
  makeDefaultEvent,
} from "@/components/wizard/EventsRepeater";

const CLASSROOM_TITLES_MAX = 10;
const CLASSROOM_TITLE_CHAR_MAX = 50;

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
    formState: { errors },
    watch,
    setValue,
  } = form;

  const leaderboard =
    watch("leaderboard_levels") ?? LEADERBOARD_DEFAULTS;
  const categories = watch("categories") ?? CATEGORY_DEFAULTS;
  const keywords = watch("discovery_keywords") ?? [];
  const classroomTitles = watch("classroom_titles") ?? [""];
  const events: CalendarEventIntake[] =
    watch("calendar_intake.events") ?? [makeDefaultEvent()];

  function setEvents(next: CalendarEventIntake[]) {
    setValue(
      "calendar_intake",
      { events: next },
      { shouldValidate: true, shouldDirty: true },
    );
  }

  function setClassroomTitles(next: string[]) {
    setValue("classroom_titles", next, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

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

      {/* Classroom titles */}
      <div className="space-y-3 rounded-md border p-4">
        <h3 className="text-sm font-semibold">Classroom titles</h3>
        <p className="text-xs text-muted-foreground">
          The titles of the classrooms / courses in this community. The
          generator will write a 2-3 sentence description for each.
        </p>
        <ClassroomTitlesRepeater
          values={classroomTitles}
          onChange={setClassroomTitles}
          errors={
            Array.isArray(errors.classroom_titles as unknown[])
              ? (errors.classroom_titles as unknown as {
                  message?: string;
                }[]).map((e) => e?.message)
              : undefined
          }
          rootError={
            !Array.isArray(errors.classroom_titles as unknown[])
              ? (errors.classroom_titles as { message?: string } | undefined)
                  ?.message
              : undefined
          }
        />
      </div>

      {/* Calendar — events with weekly or one-off schedule */}
      <div className="space-y-3 rounded-md border p-4">
        <h3 className="text-sm font-semibold">Calendar</h3>
        <p className="text-xs text-muted-foreground">
          One row per live event. Pick recurring weekly or a single dated
          occurrence. The generator writes a short description per event.
        </p>
        <EventsRepeater
          values={events}
          onChange={setEvents}
          errors={
            Array.isArray(
              (errors.calendar_intake?.events as unknown as unknown[]) ?? null,
            )
              ? (
                  errors.calendar_intake?.events as unknown as {
                    title?: { message?: string };
                    schedule?: { message?: string };
                  }[]
                ).map((row) =>
                  row
                    ? {
                        title: row.title?.message,
                        schedule: row.schedule?.message,
                      }
                    : undefined,
                )
              : undefined
          }
        />
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

function ClassroomTitlesRepeater({
  values,
  onChange,
  errors,
  rootError,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  errors?: (string | undefined)[];
  rootError?: string;
}) {
  const atMax = values.length >= CLASSROOM_TITLES_MAX;
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Classroom titles</legend>
      {values.map((value, i) => {
        const id = `classroom-title-${i}`;
        const err = errors?.[i];
        return (
          <div key={i} className="space-y-1.5">
            <Label htmlFor={id} className="text-xs text-muted-foreground">
              Classroom {i + 1}
            </Label>
            <div className="flex gap-2">
              <Input
                id={id}
                value={value}
                maxLength={CLASSROOM_TITLE_CHAR_MAX}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                placeholder="e.g. The Welcome Course"
                aria-invalid={err ? true : undefined}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                disabled={values.length <= 1}
              >
                Remove
              </Button>
            </div>
            {err ? <p className="text-xs text-destructive">{err}</p> : null}
          </div>
        );
      })}
      {rootError ? (
        <p className="text-xs text-destructive">{rootError}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...values, ""])}
        disabled={atMax}
      >
        Add classroom title ({values.length}/{CLASSROOM_TITLES_MAX})
      </Button>
    </fieldset>
  );
}

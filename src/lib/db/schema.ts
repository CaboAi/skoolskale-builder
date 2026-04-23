import {
  pgEnum,
  pgPolicy,
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------- Enums (PRD §6.3) ----------

export const toneEnum = pgEnum('tone', ['loving', 'direct', 'playful']);

export const nicheEnum = pgEnum('niche', [
  'spiritual',
  'business',
  'fitness',
  'relationships',
  'money',
  'yoga',
  'other',
]);

export const moduleEnum = pgEnum('module', [
  'welcome_dm',
  'transformation',
  'about_us',
  'start_here',
  'cover',
  'icon',
  'start_here_thumb',
  'join_now_banner',
]);

export const launchPackageStatusEnum = pgEnum('launch_package_status', [
  'draft',
  'generating',
  'review',
  'ready',
  'deployed',
  'archived',
]);

export const generationJobStatusEnum = pgEnum('generation_job_status', [
  'queued',
  'running',
  'done',
  'failed',
  'cancelled',
]);

// ---------- RLS shorthand ----------
//
// Owner-scoped tables all use the same predicate: "the row belongs to the
// current user, OR the current user has admin role on their JWT." Admin
// detection reads `auth.jwt() ->> 'role'`; see CLAUDE.md for the convention.

const ownerOrAdmin = (colName: string) =>
  sql.raw(`${colName} = auth.uid() OR (auth.jwt() ->> 'role') = 'admin'`);

const adminOnly = sql.raw(`(auth.jwt() ->> 'role') = 'admin'`);

// ---------- creators ----------

export const creators = pgTable(
  'creators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    communityName: text('community_name').notNull(),
    niche: nicheEnum('niche').notNull(),
    audience: text('audience').notNull(),
    transformation: text('transformation').notNull(),
    tone: toneEnum('tone').notNull(),
    // { coreOffer, bonuses[], ... }
    offerBreakdown: jsonb('offer_breakdown').notNull(),
    // { monthly, annual, currency, ... }
    pricing: jsonb('pricing').notNull(),
    // { days, price, upgradePath, ... }
    trialTerms: jsonb('trial_terms'),
    refundPolicy: text('refund_policy'),
    supportContact: text('support_contact'),
    brandPrefs: text('brand_prefs'),
    creatorPhotoUrl: text('creator_photo_url'),
    // FK to auth.users.id (Supabase Auth schema) — not a Drizzle-declared FK
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('creators_created_by_idx').on(t.createdBy),
    index('creators_niche_idx').on(t.niche),
    pgPolicy('creators_select_own_or_admin', {
      for: 'select',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
    }),
    pgPolicy('creators_insert_own_or_admin', {
      for: 'insert',
      to: 'authenticated',
      withCheck: ownerOrAdmin('created_by'),
    }),
    pgPolicy('creators_update_own_or_admin', {
      for: 'update',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
      withCheck: ownerOrAdmin('created_by'),
    }),
    pgPolicy('creators_delete_own_or_admin', {
      for: 'delete',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
    }),
  ],
).enableRLS();

// ---------- launch_packages ----------

export const launchPackages = pgTable(
  'launch_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creators.id, { onDelete: 'cascade' }),
    status: launchPackageStatusEnum('status').notNull().default('draft'),
    progressPct: integer('progress_pct').notNull().default(0),
    totalCostUsd: numeric('total_cost_usd', { precision: 10, scale: 4 })
      .notNull()
      .default('0'),
    generationDurationMs: integer('generation_duration_ms'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    exportedAt: timestamp('exported_at', { withTimezone: true }),
    deployedAt: timestamp('deployed_at', { withTimezone: true }),
  },
  (t) => [
    index('launch_packages_creator_id_idx').on(t.creatorId),
    index('launch_packages_created_by_idx').on(t.createdBy),
    index('launch_packages_status_idx').on(t.status),
    pgPolicy('launch_packages_select_own_or_admin', {
      for: 'select',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
    }),
    pgPolicy('launch_packages_insert_own_or_admin', {
      for: 'insert',
      to: 'authenticated',
      withCheck: ownerOrAdmin('created_by'),
    }),
    pgPolicy('launch_packages_update_own_or_admin', {
      for: 'update',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
      withCheck: ownerOrAdmin('created_by'),
    }),
    pgPolicy('launch_packages_delete_own_or_admin', {
      for: 'delete',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
    }),
  ],
).enableRLS();

// ---------- generated_assets ----------

export const generatedAssets = pgTable(
  'generated_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => launchPackages.id, { onDelete: 'cascade' }),
    module: moduleEnum('module').notNull(),
    version: integer('version').notNull().default(1),
    // Text modules: { text: "..." }
    // Image modules: { url, prompt, width, height, mime, storagePath }
    content: jsonb('content').notNull(),
    approved: boolean('approved').notNull().default(false),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    // Array of { version, content, authorId, editedAt, note }
    editHistory: jsonb('edit_history').notNull().default([]),
    vaNotes: text('va_notes'),
    qualityScore: numeric('quality_score', { precision: 5, scale: 2 }),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('generated_assets_package_id_idx').on(t.packageId),
    index('generated_assets_module_idx').on(t.module),
    index('generated_assets_created_by_idx').on(t.createdBy),
    pgPolicy('generated_assets_select_own_or_admin', {
      for: 'select',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
    }),
    pgPolicy('generated_assets_insert_own_or_admin', {
      for: 'insert',
      to: 'authenticated',
      withCheck: ownerOrAdmin('created_by'),
    }),
    pgPolicy('generated_assets_update_own_or_admin', {
      for: 'update',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
      withCheck: ownerOrAdmin('created_by'),
    }),
    pgPolicy('generated_assets_delete_own_or_admin', {
      for: 'delete',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
    }),
  ],
).enableRLS();

// ---------- generation_jobs ----------

export const generationJobs = pgTable(
  'generation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => launchPackages.id, { onDelete: 'cascade' }),
    module: moduleEnum('module').notNull(),
    status: generationJobStatusEnum('status').notNull().default('queued'),
    inngestRunId: text('inngest_run_id'),
    // { inputTokens, outputTokens, model, costUsd }
    claudeUsage: jsonb('claude_usage'),
    // { imagesCount, model, costUsd }
    geminiImageUsage: jsonb('gemini_image_usage'),
    error: text('error'),
    createdBy: uuid('created_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('generation_jobs_package_id_idx').on(t.packageId),
    index('generation_jobs_status_idx').on(t.status),
    index('generation_jobs_inngest_run_id_idx').on(t.inngestRunId),
    pgPolicy('generation_jobs_select_own_or_admin', {
      for: 'select',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
    }),
    pgPolicy('generation_jobs_insert_own_or_admin', {
      for: 'insert',
      to: 'authenticated',
      withCheck: ownerOrAdmin('created_by'),
    }),
    pgPolicy('generation_jobs_update_own_or_admin', {
      for: 'update',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
      withCheck: ownerOrAdmin('created_by'),
    }),
    pgPolicy('generation_jobs_delete_own_or_admin', {
      for: 'delete',
      to: 'authenticated',
      using: ownerOrAdmin('created_by'),
    }),
  ],
).enableRLS();

// ---------- pattern_library ----------
// SELECT open to all authed users, writes admin-only.

export const patternLibrary = pgTable(
  'pattern_library',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    module: moduleEnum('module').notNull(),
    // Nullable on both to express "universal" per PRD §6.3
    niche: nicheEnum('niche'),
    tone: toneEnum('tone'),
    // { text } for copy modules, { prompt, url } for image modules
    exampleContent: jsonb('example_content').notNull(),
    sourceCreator: text('source_creator'),
    // FK to launch_packages.id is nullable; promoted examples only
    sourcePackageId: uuid('source_package_id').references(
      () => launchPackages.id,
      { onDelete: 'set null' },
    ),
    qualityRank: integer('quality_rank').notNull().default(50),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    promotedAt: timestamp('promoted_at', { withTimezone: true }),
  },
  (t) => [
    index('pattern_library_module_idx').on(t.module),
    index('pattern_library_niche_idx').on(t.niche),
    index('pattern_library_tone_idx').on(t.tone),
    index('pattern_library_is_active_idx').on(t.isActive),
    pgPolicy('pattern_library_select_authed', {
      for: 'select',
      to: 'authenticated',
      using: sql.raw('true'),
    }),
    pgPolicy('pattern_library_insert_admin', {
      for: 'insert',
      to: 'authenticated',
      withCheck: adminOnly,
    }),
    pgPolicy('pattern_library_update_admin', {
      for: 'update',
      to: 'authenticated',
      using: adminOnly,
      withCheck: adminOnly,
    }),
    pgPolicy('pattern_library_delete_admin', {
      for: 'delete',
      to: 'authenticated',
      using: adminOnly,
    }),
  ],
).enableRLS();

// ---------- audit_log ----------
// Owner-scoped on user_id (not created_by) per PRD §6.3.

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('audit_log_user_id_idx').on(t.userId),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_created_at_idx').on(t.createdAt),
    pgPolicy('audit_log_select_own_or_admin', {
      for: 'select',
      to: 'authenticated',
      using: ownerOrAdmin('user_id'),
    }),
    pgPolicy('audit_log_insert_own_or_admin', {
      for: 'insert',
      to: 'authenticated',
      withCheck: ownerOrAdmin('user_id'),
    }),
    pgPolicy('audit_log_update_own_or_admin', {
      for: 'update',
      to: 'authenticated',
      using: ownerOrAdmin('user_id'),
      withCheck: ownerOrAdmin('user_id'),
    }),
    pgPolicy('audit_log_delete_own_or_admin', {
      for: 'delete',
      to: 'authenticated',
      using: ownerOrAdmin('user_id'),
    }),
  ],
).enableRLS();

// ---------- Type exports ----------

export type Creator = typeof creators.$inferSelect;
export type NewCreator = typeof creators.$inferInsert;
export type LaunchPackage = typeof launchPackages.$inferSelect;
export type NewLaunchPackage = typeof launchPackages.$inferInsert;
export type GeneratedAsset = typeof generatedAssets.$inferSelect;
export type NewGeneratedAsset = typeof generatedAssets.$inferInsert;
export type GenerationJob = typeof generationJobs.$inferSelect;
export type NewGenerationJob = typeof generationJobs.$inferInsert;
export type PatternLibraryEntry = typeof patternLibrary.$inferSelect;
export type NewPatternLibraryEntry = typeof patternLibrary.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;

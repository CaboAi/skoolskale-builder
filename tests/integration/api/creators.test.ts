/**
 * Integration tests for /api/creators.
 *
 * Scope: contract tests on the route handlers, with requireUser(), the
 * Drizzle db, and logAudit() mocked. Exercises the shape of the HTTP
 * request/response and the values passed to the persistence layer.
 *
 * A future upgrade (CLAUDE.md Testing Standards) will swap the db mock for a
 * Supabase test container so RLS gets exercised end-to-end. For now these
 * tests guarantee the handler logic + validation + audit calls are correct.
 */
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const fakeUser = { id: '00000000-0000-0000-0000-000000000001', email: 't@e.com' };

// ---- Mocks ----

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => fakeUser),
  requireAdmin: vi.fn(async () => fakeUser),
  isAllowedEmail: vi.fn(() => true),
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(async () => undefined),
}));

const dbState = {
  insertReturning: [] as unknown[],
  selectRows: [] as unknown[],
  updateReturning: [] as unknown[],
  lastInsertValues: undefined as unknown,
  lastUpdateSet: undefined as unknown,
};

vi.mock('@/lib/db', () => {
  const db = {
    insert: () => ({
      values: (v: unknown) => {
        dbState.lastInsertValues = v;
        return {
          returning: async () => dbState.insertReturning,
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => dbState.selectRows,
          orderBy: async () => dbState.selectRows,
        }),
        orderBy: async () => dbState.selectRows,
      }),
    }),
    update: () => ({
      set: (v: unknown) => {
        dbState.lastUpdateSet = v;
        return {
          where: () => ({
            returning: async () => dbState.updateReturning,
          }),
        };
      },
    }),
  };
  return { db };
});

// ---- Test helpers ----

const VALID_CREATOR = {
  name: 'Jane Doe',
  community_name: 'Alchemy',
  niche: 'spiritual',
  audience: 'Soul-led women 30-55',
  transformation: 'Reclaim your power',
  tone: 'loving',
  offer_breakdown: {
    courses: [{ name: 'Foundations' }],
    live_calls: 'weekly',
    perks: ['private podcast'],
    events: [],
    guest_sessions: false,
  },
  pricing: { monthly: 47, annual: 470, tiers: [] },
  trial_terms: { has_trial: true, duration_days: 7 },
  refund_policy: '14 days, no questions',
  support_contact: 'support@alchemy.co',
  brand_prefs: 'soft gold + deep teal',
  creator_photo_url: 'https://cdn.example.com/jane.jpg',
};

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : undefined,
  });
}

beforeEach(() => {
  dbState.insertReturning = [];
  dbState.selectRows = [];
  dbState.updateReturning = [];
  dbState.lastInsertValues = undefined;
  dbState.lastUpdateSet = undefined;
  vi.clearAllMocks();
});

// ---- Tests ----

describe('POST /api/creators', () => {
  test('creates a creator and writes an audit log on valid input', async () => {
    const inserted = { id: 'c-1', name: VALID_CREATOR.name, created_by: fakeUser.id };
    dbState.insertReturning = [inserted];

    const { POST } = await import('@/app/api/creators/route');
    const { logAudit } = await import('@/lib/audit');

    const res = await POST(
      jsonRequest('http://test/api/creators', 'POST', VALID_CREATOR),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(inserted);
    expect(dbState.lastInsertValues).toMatchObject({
      name: VALID_CREATOR.name,
      communityName: VALID_CREATOR.community_name,
      niche: 'spiritual',
      tone: 'loving',
      supportContact: VALID_CREATOR.support_contact,
      createdBy: fakeUser.id,
    });
    expect(logAudit).toHaveBeenCalledWith(
      fakeUser.id,
      'creator.create',
      'creator',
      'c-1',
      expect.objectContaining({ name: VALID_CREATOR.name }),
    );
  });

  test('returns 400 with validation_failed on missing required field', async () => {
    const { POST } = await import('@/app/api/creators/route');
    const bad = { ...VALID_CREATOR, name: '' };

    const res = await POST(
      jsonRequest('http://test/api/creators', 'POST', bad),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('validation_failed');
    expect(body.details).toBeDefined();
  });
});

describe('GET /api/creators', () => {
  test("returns the current user's creators newest first", async () => {
    dbState.selectRows = [
      { id: 'c-2', name: 'Newer', created_by: fakeUser.id },
      { id: 'c-1', name: 'Older', created_by: fakeUser.id },
    ];

    const { GET } = await import('@/app/api/creators/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.creators).toHaveLength(2);
    expect(body.creators[0].id).toBe('c-2');
  });
});

describe('GET /api/creators/[id]', () => {
  test('returns the creator when owned by the user', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    dbState.selectRows = [{ id: uuid, name: 'Jane', created_by: fakeUser.id }];

    const { GET } = await import('@/app/api/creators/[id]/route');
    const res = await GET(jsonRequest(`http://test/api/creators/${uuid}`, 'GET'), {
      params: Promise.resolve({ id: uuid }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(uuid);
  });

  test('returns 404 when no matching owned row', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    dbState.selectRows = [];

    const { GET } = await import('@/app/api/creators/[id]/route');
    const res = await GET(jsonRequest(`http://test/api/creators/${uuid}`, 'GET'), {
      params: Promise.resolve({ id: uuid }),
    });

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('not_found');
  });

  test('returns 400 on non-uuid id', async () => {
    const { GET } = await import('@/app/api/creators/[id]/route');
    const res = await GET(jsonRequest('http://test/api/creators/not-a-uuid', 'GET'), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('invalid_id');
  });
});

describe('PATCH /api/creators/[id]', () => {
  test('updates provided snake_case fields, maps to camelCase, logs audit', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    dbState.selectRows = [{ id: uuid, created_by: fakeUser.id }];
    dbState.updateReturning = [{ id: uuid, name: 'Renamed', community_name: 'NewCo' }];

    const patch = { name: 'Renamed', community_name: 'NewCo' };

    const { PATCH } = await import('@/app/api/creators/[id]/route');
    const { logAudit } = await import('@/lib/audit');

    const res = await PATCH(
      jsonRequest(`http://test/api/creators/${uuid}`, 'PATCH', patch),
      { params: Promise.resolve({ id: uuid }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(uuid);
    expect(dbState.lastUpdateSet).toMatchObject({
      name: 'Renamed',
      communityName: 'NewCo',
    });
    expect(logAudit).toHaveBeenCalledWith(
      fakeUser.id,
      'creator.update',
      'creator',
      uuid,
      patch,
    );
  });

  test('rejects empty patch body', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';

    const { PATCH } = await import('@/app/api/creators/[id]/route');
    const res = await PATCH(
      jsonRequest(`http://test/api/creators/${uuid}`, 'PATCH', {}),
      { params: Promise.resolve({ id: uuid }) },
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('validation_failed');
  });
});

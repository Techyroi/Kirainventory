import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';

async function handleSeed(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
      return NextResponse.json({ error: 'Seeding is disabled in production' }, { status: 403 });
    }

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const user = db.prepare(`SELECT is_platform_admin FROM users WHERE id = ?`).get(session.userId) as { is_platform_admin?: number } | undefined;
    if (!user?.is_platform_admin) {
      return NextResponse.json({ error: 'Platform administrator access required' }, { status: 403 });
    }

    await seedDatabase();
    return NextResponse.json({ success: true, message: 'Database successfully seeded with demo data' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleSeed(req);
}

export async function POST(req: NextRequest) {
  return handleSeed(req);
}

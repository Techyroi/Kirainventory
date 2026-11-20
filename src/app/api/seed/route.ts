import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isPlatformAdminEmail } from '@/lib/auth';
import { seedDatabase } from '@/lib/seed';

async function handleSeed(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
      return NextResponse.json({ error: 'Seeding is disabled in production' }, { status: 403 });
    }

    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPlatformAdminEmail(session.email)) {
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

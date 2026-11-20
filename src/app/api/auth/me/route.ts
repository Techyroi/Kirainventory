import { NextResponse, NextRequest } from 'next/server';
import { getSessionFromRequest, isPlatformAdminEmail } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const user = await db.prepare(`SELECT id, name, email, role, status, is_platform_admin FROM users WHERE id = ?`).get(session.userId) as any;
  const business = await db.prepare(`SELECT * FROM businesses WHERE id = ?`).get(session.businessId) as any;

  if (!user || user.status === 'disabled') {
    return NextResponse.json({ error: 'User account disabled or not found' }, { status: 403 });
  }

  if (!business || business.access_status === 'paused') {
    const res = NextResponse.json(
      { error: 'Your account access is currently paused. Please settle your balance or contact support.', paused: true },
      { status: 403 }
    );
    res.cookies.delete('auth_token');
    return res;
  }

  return NextResponse.json({
    user: {
      ...user,
      is_platform_admin: isPlatformAdminEmail(user.email)
    },
    business
  });
}

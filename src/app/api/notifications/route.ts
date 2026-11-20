import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const bizId = session.businessId;

    const notifications = await db.prepare(`
      SELECT * FROM notifications
      WHERE business_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(bizId);

    const unreadCountRow = await db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE business_id = ? AND is_read = 0
    `).get(bizId) as any;

    return NextResponse.json({
      notifications,
      unreadCount: unreadCountRow?.count || 0
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Mark all as read
    const db = await getDb();
    await db.prepare(`UPDATE notifications SET is_read = 1 WHERE business_id = ?`).run(session.businessId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

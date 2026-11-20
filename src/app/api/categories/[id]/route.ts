import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'Staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { name, description } = await req.json();
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = ?
      WHERE id = ? AND business_id = ?
    `).run(name, description, now, params.id, session.businessId);

    const updated = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(params.id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'Staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = getDb();
    db.prepare(`DELETE FROM categories WHERE id = ? AND business_id = ?`).run(params.id, session.businessId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

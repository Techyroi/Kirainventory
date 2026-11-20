import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hashPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'Admin') return NextResponse.json({ error: 'Only Administrators can update user roles and status' }, { status: 403 });

    const { name, role, status, password } = await req.json();

    const db = await getDb();
    const now = new Date().toISOString();

    let passwordHash = undefined;
    if (password) {
      passwordHash = await hashPassword(password);
    }

    await db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        role = COALESCE(?, role),
        status = COALESCE(?, status),
        password_hash = COALESCE(?, password_hash),
        updated_at = ?
      WHERE id = ? AND business_id = ?
    `).run(name, role, status, passwordHash, now, params.id, session.businessId);

    const updated = await db.prepare(`SELECT id, name, email, role, status, created_at FROM users WHERE id = ?`).get(params.id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

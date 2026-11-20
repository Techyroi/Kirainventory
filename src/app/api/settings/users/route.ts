import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hashPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'Admin') return NextResponse.json({ error: 'Only Administrators can access user settings' }, { status: 403 });

    const db = await getDb();
    const users = await db.prepare(`
      SELECT id, name, email, role, status, created_at, updated_at
      FROM users
      WHERE business_id = ?
      ORDER BY created_at DESC
    `).all(session.businessId);

    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'Admin') return NextResponse.json({ error: 'Only Administrators can add users' }, { status: 403 });

    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Name, email, password, and role are required' }, { status: 400 });
    }

    if (!['Admin', 'Manager', 'Staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const db = await getDb();

    // Check duplicate email
    const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    const id = 'usr_' + Math.random().toString(36).substring(2, 10);
    const password_hash = await hashPassword(password);
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO users (id, business_id, name, email, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, session.businessId, name, email, password_hash, role, now, now);

    const newUser = await db.prepare(`SELECT id, name, email, role, status, created_at FROM users WHERE id = ?`).get(id);
    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

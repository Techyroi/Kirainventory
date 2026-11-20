import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hashPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'Admin' && session.role !== 'Manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const users = await db.prepare(`
      SELECT id, business_id, name, email, role, status, created_at, updated_at
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'Admin') {
      return NextResponse.json({ error: 'Only Admin users can invite or create new users' }, { status: 403 });
    }

    const { name, email, password, role = 'Staff' } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const db = await getDb();
    const bizId = session.businessId;

    const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    const userId = 'usr_' + Math.random().toString(36).substring(2, 10);
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO users (id, business_id, name, email, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(userId, bizId, name, email, passwordHash, role, now, now);

    const newUser = await db.prepare(`SELECT id, business_id, name, email, role, status, created_at FROM users WHERE id = ?`).get(userId);
    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'Admin') {
      return NextResponse.json({ error: 'Only Admin users can edit user roles or status' }, { status: 403 });
    }

    const { userId, role, status } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const db = await getDb();
    const bizId = session.businessId;

    const targetUser = await db.prepare(`SELECT * FROM users WHERE id = ? AND business_id = ?`).get(userId, bizId) as any;
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE users
      SET role = ?, status = ?, updated_at = ?
      WHERE id = ? AND business_id = ?
    `).run(role || targetUser.role, status || targetUser.status, now, userId, bizId);

    const updatedUser = await db.prepare(`SELECT id, name, email, role, status, updated_at FROM users WHERE id = ?`).get(userId);
    return NextResponse.json(updatedUser);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

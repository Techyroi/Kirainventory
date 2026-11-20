import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { businessName, name, email, password } = await req.json();

    if (!businessName || !name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const db = await getDb();

    // Check if user already exists
    const existingUser = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    const bizId = 'biz_' + Math.random().toString(36).substring(2, 10);
    const userId = 'usr_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    const passwordHash = await hashPassword(password);

    await db.transaction(async (db) => {
      // 1. Create Business
      await db.prepare(`
        INSERT INTO businesses (id, name, email, currency, default_tax_rate, allow_negative_inventory, default_min_stock, created_at, updated_at)
        VALUES (?, ?, ?, '$', 8.5, 0, 10, ?, ?)
      `).run(bizId, businessName, email, now, now);

      // 2. Create Admin User
      await db.prepare(`
        INSERT INTO users (id, business_id, name, email, password_hash, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'Admin', 'active', ?, ?)
      `).run(userId, bizId, name, email, passwordHash, now, now);
    });

    const sessionPayload = {
      userId,
      businessId: bizId,
      name,
      email,
      role: 'Admin' as const
    };

    const token = signToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
      token
    }, { status: 201 });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hashPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { CrmClient, CrmClientUser } from '@/types';

async function requirePlatformAdmin(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const db = await getDb();
  const user = await db.prepare(`SELECT is_platform_admin FROM users WHERE id = ?`).get(session.userId) as { is_platform_admin?: number } | undefined;
  if (!user?.is_platform_admin) {
    return { error: NextResponse.json({ error: 'Platform administrator access required' }, { status: 403 }) };
  }
  return { session, db };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(req);
    if ('error' in auth) return auth.error;
    const { db } = auth;

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const filter = (searchParams.get('filter') || '').trim();

    let sql = `
      SELECT b.*,
        (SELECT COUNT(*) FROM users u WHERE u.business_id = b.id) AS user_count,
        (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id) AS product_count,
        (SELECT COUNT(*) FROM sales s WHERE s.business_id = b.id) AS sales_count
      FROM businesses b
      WHERE 1=1
    `;
    const params: string[] = [];

    if (search) {
      sql += ` AND (b.name LIKE ? OR b.email LIKE ? OR COALESCE(b.phone, '') LIKE ? OR COALESCE(b.crm_notes, '') LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (filter === 'active' || filter === 'paused') {
      sql += ` AND COALESCE(b.access_status, 'active') = ?`;
      params.push(filter);
    } else if (['Paid', 'Pending', 'Overdue', 'Trial'].includes(filter)) {
      sql += ` AND COALESCE(b.payment_status, 'Paid') = ?`;
      params.push(filter);
    }

    sql += ` ORDER BY b.created_at DESC`;

    const businesses = await db.prepare(sql).all(...params) as Omit<CrmClient, 'users'>[];

    const allUsers = await db.prepare(`
      SELECT id, business_id, name, email, role, status, is_platform_admin, created_at
      FROM users
      ORDER BY created_at ASC
    `).all() as (CrmClientUser & { business_id: string })[];

    const usersByBiz = new Map<string, CrmClientUser[]>();
    for (const u of allUsers) {
      const list = usersByBiz.get(u.business_id) || [];
      list.push({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        is_platform_admin: u.is_platform_admin,
        created_at: u.created_at
      });
      usersByBiz.set(u.business_id, list);
    }

    const clients: CrmClient[] = businesses.map((b) => ({
      ...b,
      access_status: b.access_status || 'active',
      payment_status: b.payment_status || 'Paid',
      plan_amount: Number(b.plan_amount) || 0,
      users: usersByBiz.get(b.id) || []
    }));

    return NextResponse.json(clients);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(req);
    if ('error' in auth) return auth.error;
    const { db } = auth;

    const {
      businessName,
      name,
      email,
      phone = '',
      password,
      plan_amount = 0,
      payment_status = 'Pending',
      next_due_date = '',
      crm_notes = ''
    } = await req.json();

    if (!businessName || !name || !email || !password) {
      return NextResponse.json({ error: 'Business name, owner name, email, and password are required' }, { status: 400 });
    }

    const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    const bizId = 'biz_' + Math.random().toString(36).substring(2, 10);
    const userId = 'usr_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const lastPaidAt = payment_status === 'Paid' ? now : null;

    await db.transaction(async (tx) => {
      await tx.prepare(`
        INSERT INTO businesses (
          id, name, email, phone, currency, default_tax_rate, allow_negative_inventory,
          default_min_stock, access_status, payment_status, plan_amount, last_paid_at,
          next_due_date, crm_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, '$', 8.5, 0, 10, 'active', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bizId,
        businessName,
        email,
        phone,
        payment_status,
        Number(plan_amount) || 0,
        lastPaidAt,
        next_due_date || null,
        crm_notes || null,
        now,
        now
      );

      await tx.prepare(`
        INSERT INTO users (id, business_id, name, email, password_hash, role, status, is_platform_admin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'Admin', 'active', 0, ?, ?)
      `).run(userId, bizId, name, email, passwordHash, now, now);
    });

    return NextResponse.json({ success: true, businessId: bizId, userId }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

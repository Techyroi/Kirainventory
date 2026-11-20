import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';

    const db = getDb();
    const bizId = session.businessId;

    let sql = `
      SELECT c.*,
             COALESCE((SELECT SUM(total_amount) FROM sales WHERE customer_id = c.id AND status = 'Completed'), 0) as total_purchases,
             COALESCE((SELECT COUNT(*) FROM sales WHERE customer_id = c.id AND status = 'Completed'), 0) as order_count,
             (SELECT MAX(created_at) FROM sales WHERE customer_id = c.id AND status = 'Completed') as last_purchase_date
      FROM customers c
      WHERE c.business_id = ?
    `;

    const params: any[] = [bizId];

    if (query) {
      sql += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`;
      const term = `%${query}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY c.name ASC`;

    const customers = db.prepare(sql).all(...params);
    return NextResponse.json(customers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, email, phone, address, notes } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const db = getDb();
    const id = 'cust_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO customers (id, business_id, name, email, phone, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, session.businessId, name, email || '', phone || '', address || '', notes || '', now, now);

    const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

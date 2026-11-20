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
      SELECT s.*,
             COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = s.id AND status != 'Cancelled'), 0) as total_purchases,
             COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = s.id AND payment_status != 'Paid' AND status != 'Cancelled'), 0) as outstanding_payments
      FROM suppliers s
      WHERE s.business_id = ?
    `;

    const params: any[] = [bizId];

    if (query) {
      sql += ` AND (s.company_name LIKE ? OR s.contact_person LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)`;
      const term = `%${query}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY s.company_name ASC`;

    const suppliers = db.prepare(sql).all(...params);
    return NextResponse.json(suppliers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'Staff') return NextResponse.json({ error: 'Staff members cannot add suppliers' }, { status: 403 });

    const { company_name, contact_person, email, phone, address, notes } = await req.json();
    if (!company_name) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const db = getDb();
    const id = 'sup_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO suppliers (id, business_id, company_name, contact_person, email, phone, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, session.businessId, company_name, contact_person || '', email || '', phone || '', address || '', notes || '', now, now);

    const supplier = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id);
    return NextResponse.json(supplier, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

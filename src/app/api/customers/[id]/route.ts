import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const customer = db.prepare(`
      SELECT c.*,
             COALESCE((SELECT SUM(total_amount) FROM sales WHERE customer_id = c.id AND status = 'Completed'), 0) as total_purchases,
             COALESCE((SELECT COUNT(*) FROM sales WHERE customer_id = c.id AND status = 'Completed'), 0) as order_count,
             (SELECT MAX(created_at) FROM sales WHERE customer_id = c.id AND status = 'Completed') as last_purchase_date
      FROM customers c
      WHERE c.id = ? AND c.business_id = ?
    `).get(params.id, session.businessId) as any;

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const purchaseHistory = db.prepare(`
      SELECT s.*, u.name as user_name,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE s.customer_id = ? AND s.business_id = ?
      ORDER BY s.created_at DESC
    `).all(params.id, session.businessId);

    customer.purchaseHistory = purchaseHistory;
    return NextResponse.json(customer);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, email, phone, address, notes } = await req.json();
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE customers SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        notes = COALESCE(?, notes),
        updated_at = ?
      WHERE id = ? AND business_id = ?
    `).run(name, email, phone, address, notes, now, params.id, session.businessId);

    const updated = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(params.id);
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
    if (session.role === 'Staff') return NextResponse.json({ error: 'Staff users cannot delete customers' }, { status: 403 });

    const db = getDb();
    db.prepare(`DELETE FROM customers WHERE id = ? AND business_id = ?`).run(params.id, session.businessId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

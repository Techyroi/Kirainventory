import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const supplier = await db.prepare(`
      SELECT s.*,
             COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = s.id AND status != 'Cancelled'), 0) as total_purchases,
             COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = s.id AND payment_status != 'Paid' AND status != 'Cancelled'), 0) as outstanding_payments
      FROM suppliers s
      WHERE s.id = ? AND s.business_id = ?
    `).get(params.id, session.businessId) as any;

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const products = await db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.supplier_id = ? AND p.business_id = ?
    `).all(params.id, session.businessId);

    const purchaseHistory = await db.prepare(`
      SELECT p.*, u.name as user_name,
             (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as item_count
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      WHERE p.supplier_id = ? AND p.business_id = ?
      ORDER BY p.created_at DESC
    `).all(params.id, session.businessId);

    supplier.products = products;
    supplier.purchaseHistory = purchaseHistory;

    return NextResponse.json(supplier);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'Staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { company_name, contact_person, email, phone, address, notes } = await req.json();
    const db = await getDb();
    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE suppliers SET
        company_name = COALESCE(?, company_name),
        contact_person = COALESCE(?, contact_person),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        notes = COALESCE(?, notes),
        updated_at = ?
      WHERE id = ? AND business_id = ?
    `).run(company_name, contact_person, email, phone, address, notes, now, params.id, session.businessId);

    const updated = await db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(params.id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'Staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = await getDb();
    await db.prepare(`DELETE FROM suppliers WHERE id = ? AND business_id = ?`).run(params.id, session.businessId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

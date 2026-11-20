import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const sale = db.prepare(`
      SELECT s.*, COALESCE(c.name, 'Walk-in Customer') as customer_name, c.email as customer_email, c.phone as customer_phone,
             u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.business_id = ?
    `).get(params.id, session.businessId) as any;

    if (!sale) {
      return NextResponse.json({ error: 'Sale invoice not found' }, { status: 404 });
    }

    const items = db.prepare(`
      SELECT si.*, p.name as product_name, p.sku
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(params.id);

    sale.items = items;
    return NextResponse.json(sale);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb, executeStockMovement } from '@/lib/db';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const purchase = db.prepare(`
      SELECT p.*, s.company_name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
             u.name as user_name
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND p.business_id = ?
    `).get(params.id, session.businessId) as any;

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const items = db.prepare(`
      SELECT pi.*, pr.name as product_name, pr.sku
      FROM purchase_items pi
      JOIN products pr ON pi.product_id = pr.id
      WHERE pi.purchase_id = ?
    `).all(params.id);

    purchase.items = items;
    return NextResponse.json(purchase);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'Staff') return NextResponse.json({ error: 'Staff members cannot update purchase orders' }, { status: 403 });

    const body = await req.json();
    const { status, payment_status, notes } = body;

    const db = getDb();
    const bizId = session.businessId;

    const existing = db.prepare(`SELECT * FROM purchases WHERE id = ? AND business_id = ?`).get(params.id, bizId) as any;
    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      // If status changed to Received (and was not previously Received), update product stock!
      if (status === 'Received' && existing.status !== 'Received') {
        const items = db.prepare(`SELECT * FROM purchase_items WHERE purchase_id = ?`).all(params.id) as any[];
        
        for (const item of items) {
          executeStockMovement(db, {
            businessId: bizId,
            productId: item.product_id,
            userId: session.userId,
            movementType: 'Purchase',
            quantityDelta: item.quantity,
            reason: `Purchase Received (${existing.purchase_number})`,
            referenceId: params.id
          });
        }

        // Notification
        const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
        db.prepare(`
          INSERT INTO notifications (id, business_id, title, message, type, is_read, reference_id, created_at)
          VALUES (?, ?, ?, ?, 'purchase_received', 0, ?, ?)
        `).run(notifId, bizId, `Purchase Order Received: ${existing.purchase_number}`, `Stock updated for purchase ${existing.purchase_number}.`, params.id, now);
      }

      db.prepare(`
        UPDATE purchases SET
          status = COALESCE(?, status),
          payment_status = COALESCE(?, payment_status),
          notes = COALESCE(?, notes),
          updated_at = ?
        WHERE id = ? AND business_id = ?
      `).run(status, payment_status, notes, now, params.id, bizId);
    });

    transaction();

    const updated = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(params.id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

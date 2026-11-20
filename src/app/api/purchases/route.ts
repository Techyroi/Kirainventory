import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb, executeStockMovement } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';
    const supplierId = searchParams.get('supplierId') || '';

    const db = getDb();
    const bizId = session.businessId;

    let sql = `
      SELECT p.*,
             s.company_name as supplier_name,
             u.name as user_name,
             (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as item_count
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      JOIN users u ON p.user_id = u.id
      WHERE p.business_id = ?
    `;

    const params: any[] = [bizId];

    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }

    if (supplierId) {
      sql += ` AND p.supplier_id = ?`;
      params.push(supplierId);
    }

    sql += ` ORDER BY p.created_at DESC`;

    const purchases = db.prepare(sql).all(...params);
    return NextResponse.json(purchases);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'Staff') return NextResponse.json({ error: 'Staff users cannot create purchase orders' }, { status: 403 });

    const body = await req.json();
    const { supplier_id, status = 'Draft', payment_status = 'Pending', notes, items } = body;

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Supplier and at least one purchase item are required' }, { status: 400 });
    }

    const db = getDb();
    const bizId = session.businessId;

    // Generate unique PO Number (e.g. PO-2026-0005)
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM purchases WHERE business_id = ?`).get(bizId) as any;
    const poNumber = `PO-${new Date().getFullYear()}-${String((countRow?.count || 0) + 1).padStart(4, '0')}`;

    const poId = 'po_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    let totalAmount = 0;

    const transaction = db.transaction(() => {
      // 1. Insert Purchase Header
      db.prepare(`
        INSERT INTO purchases (id, business_id, purchase_number, supplier_id, user_id, status, payment_status, total_amount, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `).run(poId, bizId, poNumber, supplier_id, session.userId, status, payment_status, notes || '', now, now);

      // 2. Insert Items & Calc Total
      for (const item of items) {
        const itemId = 'poi_' + Math.random().toString(36).substring(2, 10);
        const qty = Number(item.quantity) || 1;
        const cost = Number(item.cost_price) || 0;
        const totalPrice = qty * cost;
        totalAmount += totalPrice;

        db.prepare(`
          INSERT INTO purchase_items (id, purchase_id, product_id, quantity, cost_price, total_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(itemId, poId, item.product_id, qty, cost, totalPrice);

        // If created directly in Received status, update stock!
        if (status === 'Received') {
          executeStockMovement(db, {
            businessId: bizId,
            productId: item.product_id,
            userId: session.userId,
            movementType: 'Purchase',
            quantityDelta: qty,
            reason: `Purchase Received (${poNumber})`,
            referenceId: poId
          });
        }
      }

      // 3. Update total amount
      db.prepare(`UPDATE purchases SET total_amount = ? WHERE id = ?`).run(totalAmount, poId);

      // 4. Send notification if received
      if (status === 'Received') {
        const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
        db.prepare(`
          INSERT INTO notifications (id, business_id, title, message, type, is_read, reference_id, created_at)
          VALUES (?, ?, ?, ?, 'purchase_received', 0, ?, ?)
        `).run(notifId, bizId, `Purchase Order Received: ${poNumber}`, `Received stock worth $${totalAmount.toFixed(2)}`, poId, now);
      }
    });

    transaction();

    const createdPO = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(poId);
    return NextResponse.json(createdPO, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

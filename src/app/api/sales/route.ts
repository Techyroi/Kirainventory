import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb, executeStockMovement } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId') || '';
    const status = searchParams.get('status') || '';
    const paymentMethod = searchParams.get('paymentMethod') || '';

    const db = getDb();
    const bizId = session.businessId;

    let sql = `
      SELECT s.*,
             COALESCE(c.name, 'Walk-in Customer') as customer_name,
             u.name as user_name,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      JOIN users u ON s.user_id = u.id
      WHERE s.business_id = ?
    `;

    const params: any[] = [bizId];

    if (customerId) {
      sql += ` AND s.customer_id = ?`;
      params.push(customerId);
    }

    if (status) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }

    if (paymentMethod) {
      sql += ` AND s.payment_method = ?`;
      params.push(paymentMethod);
    }

    sql += ` ORDER BY s.created_at DESC`;

    const sales = db.prepare(sql).all(...params);
    return NextResponse.json(sales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      customer_id, items, discount_amount = 0, tax_amount = 0,
      payment_method = 'Cash', notes
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one product item is required for a sale' }, { status: 400 });
    }

    const db = getDb();
    const bizId = session.businessId;

    // 1. Generate Invoice Number (e.g. INV-2026-0006)
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM sales WHERE business_id = ?`).get(bizId) as any;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String((countRow?.count || 0) + 1).padStart(4, '0')}`;

    const saleId = 'sale_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    let subtotal = 0;

    const transaction = db.transaction(() => {
      // Validate item availability & calculate totals
      for (const item of items) {
        const product = db.prepare(`SELECT * FROM products WHERE id = ? AND business_id = ?`).get(item.product_id, bizId) as any;
        if (!product) {
          throw new Error(`Product not found: ${item.product_id}`);
        }
        const qty = Number(item.quantity) || 1;
        const sellingPrice = Number(item.selling_price) ?? product.selling_price;
        subtotal += qty * sellingPrice;
      }

      const discount = Number(discount_amount) || 0;
      const tax = Number(tax_amount) || 0;
      const totalAmount = Math.max(0, subtotal - discount + tax);

      // Insert Sale Header
      db.prepare(`
        INSERT INTO sales (
          id, business_id, invoice_number, customer_id, user_id, subtotal, 
          discount_amount, tax_amount, total_amount, payment_method, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?, ?, ?)
      `).run(
        saleId, bizId, invoiceNumber, customer_id || null, session.userId,
        subtotal, discount, tax, totalAmount, payment_method, notes || 'POS Sale', now, now
      );

      // Process Line Items & Deduct Inventory
      for (const item of items) {
        const product = db.prepare(`SELECT * FROM products WHERE id = ? AND business_id = ?`).get(item.product_id, bizId) as any;
        const qty = Number(item.quantity) || 1;
        const sellingPrice = Number(item.selling_price) ?? product.selling_price;
        const costPrice = product.cost_price;
        const totalPrice = qty * sellingPrice;

        const itemId = 'sli_' + Math.random().toString(36).substring(2, 10);
        db.prepare(`
          INSERT INTO sale_items (id, sale_id, product_id, quantity, selling_price, cost_price, total_price)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, saleId, item.product_id, qty, sellingPrice, costPrice, totalPrice);

        // Execute Inventory Deduction (Negative Delta)
        executeStockMovement(db, {
          businessId: bizId,
          productId: item.product_id,
          userId: session.userId,
          movementType: 'Sale',
          quantityDelta: -qty,
          reason: `Completed Sale ${invoiceNumber}`,
          referenceId: saleId
        });
      }

      // Notification
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
      db.prepare(`
        INSERT INTO notifications (id, business_id, title, message, type, is_read, reference_id, created_at)
        VALUES (?, ?, ?, ?, 'sale_completed', 0, ?, ?)
      `).run(
        notifId, bizId, `Sale Completed: ${invoiceNumber}`,
        `Processed invoice ${invoiceNumber} for $${totalAmount.toFixed(2)}.`,
        saleId, now
      );
    });

    transaction();

    const createdSale = db.prepare(`
      SELECT s.*, COALESCE(c.name, 'Walk-in Customer') as customer_name
      FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).get(saleId);

    return NextResponse.json(createdSale, { status: 201 });
  } catch (error: any) {
    console.error('POS Sale Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process sale' }, { status: 400 });
  }
}

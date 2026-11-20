import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb, executeStockMovement } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId') || '';
    const movementType = searchParams.get('type') || '';
    const userId = searchParams.get('userId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const limit = Number(searchParams.get('limit')) || 100;

    const db = await getDb();
    const bizId = session.businessId;

    let sql = `
      SELECT m.*,
             p.name as product_name, p.sku,
             u.name as user_name
      FROM inventory_movements m
      JOIN products p ON m.product_id = p.id
      JOIN users u ON m.user_id = u.id
      WHERE m.business_id = ?
    `;

    const params: any[] = [bizId];

    if (productId) {
      sql += ` AND m.product_id = ?`;
      params.push(productId);
    }

    if (movementType) {
      sql += ` AND m.movement_type = ?`;
      params.push(movementType);
    }

    if (userId) {
      sql += ` AND m.user_id = ?`;
      params.push(userId);
    }

    if (startDate) {
      sql += ` AND date(m.created_at) >= date(?)`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND date(m.created_at) <= date(?)`;
      params.push(endDate);
    }

    sql += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(limit);

    const movements = await db.prepare(sql).all(...params);
    return NextResponse.json(movements);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { productId, movementType, quantity, reason, referenceId } = body;

    if (!productId || !movementType || quantity === undefined || !reason) {
      return NextResponse.json({ error: 'Product ID, movement type, quantity, and reason are required' }, { status: 400 });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty === 0) {
      return NextResponse.json({ error: 'Quantity must be a non-zero number' }, { status: 400 });
    }

    const db = await getDb();
    const bizId = session.businessId;

    // Movement types that decrease stock
    const decreaseTypes = ['Sale', 'Damaged', 'Lost', 'Remove'];
    const quantityDelta = decreaseTypes.includes(movementType) ? -Math.abs(qty) : Math.abs(qty);

    const result = await executeStockMovement(db, {
      businessId: bizId,
      productId,
      userId: session.userId,
      movementType: (movementType === 'Remove' ? 'Adjustment' : movementType) as any,
      quantityDelta,
      reason,
      referenceId: referenceId || 'MANUAL-ADJ'
    });

    return NextResponse.json({
      success: true,
      newQuantity: result.newQuantity,
      previousQuantity: result.previousQuantity
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 400 });
  }
}

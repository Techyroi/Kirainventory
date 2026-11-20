import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb, executeStockMovement } from '@/lib/db';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, s.company_name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ? AND p.business_id = ?
    `).get(params.id, session.businessId);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role === 'Staff') {
      return NextResponse.json({ error: 'Staff members cannot update product specs' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name, sku, barcode, category_id, supplier_id, description,
      cost_price, selling_price, current_stock, min_stock_level, max_stock_level,
      product_image, status
    } = body;

    const db = getDb();
    const bizId = session.businessId;

    const existing = db.prepare(`SELECT * FROM products WHERE id = ? AND business_id = ?`).get(params.id, bizId) as any;
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // SKU duplicate check if SKU changed
    if (sku && sku !== existing.sku) {
      const duplicate = db.prepare(`SELECT id FROM products WHERE business_id = ? AND sku = ? AND id != ?`).get(bizId, sku, params.id);
      if (duplicate) {
        return NextResponse.json({ error: `SKU '${sku}' is already assigned to another product` }, { status: 400 });
      }
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        sku = COALESCE(?, sku),
        barcode = ?,
        category_id = ?,
        supplier_id = ?,
        description = ?,
        cost_price = COALESCE(?, cost_price),
        selling_price = COALESCE(?, selling_price),
        min_stock_level = COALESCE(?, min_stock_level),
        max_stock_level = COALESCE(?, max_stock_level),
        product_image = ?,
        status = COALESCE(?, status),
        updated_at = ?
      WHERE id = ? AND business_id = ?
    `).run(
      name, sku, barcode !== undefined ? barcode : existing.barcode,
      category_id !== undefined ? category_id : existing.category_id,
      supplier_id !== undefined ? supplier_id : existing.supplier_id,
      description !== undefined ? description : existing.description,
      cost_price, selling_price, min_stock_level, max_stock_level,
      product_image !== undefined ? product_image : existing.product_image,
      status, now, params.id, bizId
    );

    // If current_stock was explicitly changed in edit modal, trigger Stock Movement Adjustment
    if (current_stock !== undefined && Number(current_stock) !== existing.current_stock) {
      const delta = Number(current_stock) - existing.current_stock;
      executeStockMovement(db, {
        businessId: bizId,
        productId: params.id,
        userId: session.userId,
        movementType: 'Adjustment',
        quantityDelta: delta,
        reason: 'Manual edit adjustment via product editor',
        referenceId: 'PROD-EDIT'
      });
    }

    const updated = db.prepare(`SELECT * FROM products WHERE id = ?`).get(params.id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role === 'Staff') {
      return NextResponse.json({ error: 'Staff users cannot delete products' }, { status: 403 });
    }

    const db = getDb();
    const result = db.prepare(`DELETE FROM products WHERE id = ? AND business_id = ?`).run(params.id, session.businessId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

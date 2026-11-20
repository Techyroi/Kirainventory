import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb, executeStockMovement } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const supplierId = searchParams.get('supplierId') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'DESC';

    const db = await getDb();
    const bizId = session.businessId;

    let sql = `
      SELECT p.*,
             c.name as category_name,
             s.company_name as supplier_name,
             (p.selling_price - p.cost_price) as profit_per_unit
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.business_id = ?
    `;

    const params: any[] = [bizId];

    if (query) {
      sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.description LIKE ?)`;
      const term = `%${query}%`;
      params.push(term, term, term, term);
    }

    if (categoryId) {
      sql += ` AND p.category_id = ?`;
      params.push(categoryId);
    }

    if (supplierId) {
      sql += ` AND p.supplier_id = ?`;
      params.push(supplierId);
    }

    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }

    // Allowed sort fields
    const validSortFields = ['name', 'sku', 'selling_price', 'cost_price', 'current_stock', 'created_at'];
    const safeSortBy = validSortFields.includes(sortBy) ? `p.${sortBy}` : 'p.created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

    const products = await db.prepare(sql).all(...params);

    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role === 'Staff') {
      return NextResponse.json({ error: 'Staff users are not authorized to add products' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name, sku, barcode, category_id, supplier_id, description,
      cost_price, selling_price, current_stock = 0, min_stock_level = 5, max_stock_level = 100, product_image
    } = body;

    if (!name || !sku || cost_price === undefined || selling_price === undefined) {
      return NextResponse.json({ error: 'Name, SKU, cost price, and selling price are required' }, { status: 400 });
    }

    const db = await getDb();
    const bizId = session.businessId;

    // Prevent Duplicate SKU
    const existingSku = await db.prepare(`SELECT id FROM products WHERE business_id = ? AND sku = ?`).get(bizId, sku);
    if (existingSku) {
      return NextResponse.json({ error: `SKU '${sku}' already exists in your inventory` }, { status: 400 });
    }

    const productId = 'prod_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    const stock = Number(current_stock) || 0;
    const minStock = Number(min_stock_level) || 5;

    let computedStatus = 'In Stock';
    if (stock <= 0) {
      computedStatus = 'Out of Stock';
    } else if (stock <= minStock) {
      computedStatus = 'Low Stock';
    }

    await db.prepare(`
      INSERT INTO products (
        id, business_id, name, sku, barcode, category_id, supplier_id, description,
        cost_price, selling_price, current_stock, min_stock_level, max_stock_level,
        product_image, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      productId, bizId, name, sku, barcode || null, category_id || null, supplier_id || null, description || '',
      Number(cost_price), Number(selling_price), stock, minStock, Number(max_stock_level) || 100,
      product_image || null, computedStatus, now, now
    );

    // Record initial stock movement if initial stock > 0
    if (stock > 0) {
      await executeStockMovement(db, {
        businessId: bizId,
        productId,
        userId: session.userId,
        movementType: 'Adjustment',
        quantityDelta: stock,
        reason: 'Initial Product Stock Setup',
        referenceId: 'INIT-ADD'
      });
    }

    const newProduct = await db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

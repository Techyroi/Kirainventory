import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const supplierId = searchParams.get('supplierId') || '';

    const db = getDb();
    const bizId = session.businessId;

    // Date filters for sales
    let salesWhere = `WHERE s.business_id = ? AND s.status = 'Completed'`;
    const salesParams: any[] = [bizId];

    if (startDate) {
      salesWhere += ` AND date(s.created_at) >= date(?)`;
      salesParams.push(startDate);
    }
    if (endDate) {
      salesWhere += ` AND date(s.created_at) <= date(?)`;
      salesParams.push(endDate);
    }

    // 1. Sales Summary Metrics
    const salesSummary = db.prepare(`
      SELECT COUNT(*) as order_count,
             COALESCE(SUM(s.total_amount), 0) as total_revenue,
             COALESCE(AVG(s.total_amount), 0) as avg_order_value,
             COALESCE(SUM(s.tax_amount), 0) as total_tax,
             COALESCE(SUM(s.discount_amount), 0) as total_discount
      FROM sales s
      ${salesWhere}
    `).get(...salesParams) as any;

    // Sales over time trend
    const salesTrend = db.prepare(`
      SELECT date(s.created_at) as date,
             SUM(s.total_amount) as revenue,
             COUNT(*) as orders
      FROM sales s
      ${salesWhere}
      GROUP BY date(s.created_at)
      ORDER BY date(s.created_at) ASC
    `).all(...salesParams);

    // 2. Inventory Valuation Report
    let productWhere = `WHERE p.business_id = ? AND p.status != 'Inactive'`;
    const prodParams: any[] = [bizId];
    if (categoryId) {
      productWhere += ` AND p.category_id = ?`;
      prodParams.push(categoryId);
    }
    if (supplierId) {
      productWhere += ` AND p.supplier_id = ?`;
      prodParams.push(supplierId);
    }

    const inventoryValuation = db.prepare(`
      SELECT COUNT(*) as total_items,
             COALESCE(SUM(p.current_stock), 0) as total_quantity,
             COALESCE(SUM(p.current_stock * p.cost_price), 0) as total_cost_value,
             COALESCE(SUM(p.current_stock * p.selling_price), 0) as total_retail_value,
             SUM(CASE WHEN p.current_stock <= p.min_stock_level AND p.current_stock > 0 THEN 1 ELSE 0 END) as low_stock_count,
             SUM(CASE WHEN p.current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM products p
      ${productWhere}
    `).get(...prodParams) as any;

    // 3. Product Performance Report (Top Sellers & Profitability)
    const productPerformance = db.prepare(`
      SELECT p.id, p.name, p.sku, c.name as category_name,
             p.cost_price, p.selling_price, (p.selling_price - p.cost_price) as unit_profit,
             p.current_stock,
             COALESCE(SUM(si.quantity), 0) as total_sold,
             COALESCE(SUM(si.total_price), 0) as total_revenue,
             COALESCE(SUM(si.quantity * (si.selling_price - si.cost_price)), 0) as total_profit
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'Completed'
      ${productWhere}
      GROUP BY p.id
      ORDER BY total_sold DESC
    `).all(...prodParams);

    // 4. Purchase Report by Supplier
    let purchaseWhere = `WHERE pur.business_id = ? AND pur.status != 'Cancelled'`;
    const purParams: any[] = [bizId];
    if (startDate) {
      purchaseWhere += ` AND date(pur.created_at) >= date(?)`;
      purParams.push(startDate);
    }
    if (endDate) {
      purchaseWhere += ` AND date(pur.created_at) <= date(?)`;
      purParams.push(endDate);
    }

    const purchaseSummary = db.prepare(`
      SELECT COUNT(*) as total_pos,
             COALESCE(SUM(pur.total_amount), 0) as total_purchase_spend,
             SUM(CASE WHEN pur.payment_status != 'Paid' THEN pur.total_amount ELSE 0 END) as outstanding_payments
      FROM purchases pur
      ${purchaseWhere}
    `).get(...purParams) as any;

    const purchasesBySupplier = db.prepare(`
      SELECT sup.company_name as supplier_name,
             COUNT(pur.id) as order_count,
             SUM(pur.total_amount) as total_spend
      FROM purchases pur
      JOIN suppliers sup ON pur.supplier_id = sup.id
      ${purchaseWhere}
      GROUP BY sup.id
      ORDER BY total_spend DESC
    `).all(...purParams);

    return NextResponse.json({
      salesSummary,
      salesTrend,
      inventoryValuation,
      productPerformance,
      purchaseSummary,
      purchasesBySupplier
    });
  } catch (error: any) {
    console.error('Reports API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

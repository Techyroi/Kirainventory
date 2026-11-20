import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const bizId = session.businessId;

    // 1. Total Products
    const totalProductsRow = db.prepare(`SELECT COUNT(*) as count FROM products WHERE business_id = ? AND status != 'Inactive'`).get(bizId) as any;
    const totalProducts = totalProductsRow?.count || 0;

    // 2. Total Inventory Value (Cost price * stock)
    const invValueRow = db.prepare(`SELECT SUM(current_stock * cost_price) as val FROM products WHERE business_id = ? AND status != 'Inactive'`).get(bizId) as any;
    const totalInventoryValue = invValueRow?.val || 0;

    // 3. Low Stock Products Count
    const lowStockRow = db.prepare(`SELECT COUNT(*) as count FROM products WHERE business_id = ? AND current_stock <= min_stock_level AND current_stock > 0 AND status != 'Inactive'`).get(bizId) as any;
    const lowStockCount = lowStockRow?.count || 0;

    // 4. Out of Stock Count
    const outOfStockRow = db.prepare(`SELECT COUNT(*) as count FROM products WHERE business_id = ? AND current_stock <= 0 AND status != 'Inactive'`).get(bizId) as any;
    const outOfStockCount = outOfStockRow?.count || 0;

    // 5. Today Sales
    const todaySalesRow = db.prepare(`
      SELECT SUM(total_amount) as total FROM sales 
      WHERE business_id = ? AND status = 'Completed' AND date(created_at) = date('now')
    `).get(bizId) as any;
    const todaySales = todaySalesRow?.total || 0;

    // 6. This Month Sales
    const monthSalesRow = db.prepare(`
      SELECT SUM(total_amount) as total FROM sales 
      WHERE business_id = ? AND status = 'Completed' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get(bizId) as any;
    const monthSales = monthSalesRow?.total || 0;

    // 7. Recent Sales (Latest 5)
    const recentSales = db.prepare(`
      SELECT s.id, s.invoice_number, s.total_amount, s.created_at, s.status, s.payment_method,
             COALESCE(c.name, 'Walk-in Customer') as customer_name,
             u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.business_id = ?
      ORDER BY s.created_at DESC
      LIMIT 5
    `).all(bizId);

    // 8. Low Stock Products list
    const lowStockProducts = db.prepare(`
      SELECT p.id, p.name, p.sku, p.current_stock, p.min_stock_level, p.status, p.cost_price, p.selling_price,
             c.name as category_name, s.company_name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.business_id = ? AND p.current_stock <= p.min_stock_level AND p.status != 'Inactive'
      ORDER BY p.current_stock ASC
      LIMIT 6
    `).all(bizId);

    // 9. Recent Stock Movements
    const recentMovements = db.prepare(`
      SELECT m.id, m.movement_type, m.quantity, m.previous_quantity, m.new_quantity, m.created_at, m.reason,
             p.name as product_name, p.sku, u.name as user_name
      FROM inventory_movements m
      JOIN products p ON m.product_id = p.id
      JOIN users u ON m.user_id = u.id
      WHERE m.business_id = ?
      ORDER BY m.created_at DESC
      LIMIT 6
    `).all(bizId);

    // 10. Sales over time (Last 7 days)
    const salesOverTime = db.prepare(`
      SELECT date(created_at) as date, SUM(total_amount) as sales, COUNT(*) as count
      FROM sales
      WHERE business_id = ? AND status = 'Completed'
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
      LIMIT 14
    `).all(bizId);

    // 11. Inventory value by Category
    const inventoryValueByCategory = db.prepare(`
      SELECT COALESCE(c.name, 'Uncategorized') as name, SUM(p.current_stock * p.cost_price) as value
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.business_id = ? AND p.status != 'Inactive'
      GROUP BY c.name
      ORDER BY value DESC
    `).all(bizId);

    // 12. Top Selling Products
    const topSellingProducts = db.prepare(`
      SELECT p.name, SUM(si.quantity) as sold, SUM(si.total_price) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.business_id = ? AND s.status = 'Completed'
      GROUP BY p.id
      ORDER BY sold DESC
      LIMIT 5
    `).all(bizId);

    // 13. Stock Movement Type Summary
    const movementTypeSummary = db.prepare(`
      SELECT movement_type as type, COUNT(*) as count
      FROM inventory_movements
      WHERE business_id = ?
      GROUP BY movement_type
    `).all(bizId);

    return NextResponse.json({
      totalProducts,
      totalInventoryValue,
      lowStockCount,
      outOfStockCount,
      todaySales,
      monthSales,
      recentSales,
      lowStockProducts,
      recentMovements,
      salesOverTime,
      inventoryValueByCategory,
      topSellingProducts,
      movementTypeSummary
    });
  } catch (error: any) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

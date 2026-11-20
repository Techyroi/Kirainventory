import Database from 'better-sqlite3';
import path from 'path';

// Singleton instance for Next.js hot-reloading
const dbPath = path.join(process.cwd(), 'inventory.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      currency TEXT DEFAULT '$',
      default_tax_rate REAL DEFAULT 10.0,
      allow_negative_inventory INTEGER DEFAULT 0,
      default_min_stock INTEGER DEFAULT 10,
      access_status TEXT DEFAULT 'active' CHECK(access_status IN ('active', 'paused')),
      payment_status TEXT DEFAULT 'Paid' CHECK(payment_status IN ('Paid', 'Pending', 'Overdue', 'Trial')),
      plan_amount REAL DEFAULT 0,
      last_paid_at TEXT,
      next_due_date TEXT,
      crm_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Admin', 'Manager', 'Staff')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      is_platform_admin INTEGER DEFAULT 0,
      reset_token TEXT,
      reset_token_expires TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      UNIQUE(business_id, name)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      barcode TEXT,
      category_id TEXT,
      supplier_id TEXT,
      description TEXT,
      cost_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      current_stock INTEGER NOT NULL DEFAULT 0,
      min_stock_level INTEGER NOT NULL DEFAULT 5,
      max_stock_level INTEGER NOT NULL DEFAULT 100,
      product_image TEXT,
      status TEXT DEFAULT 'In Stock' CHECK(status IN ('In Stock', 'Low Stock', 'Out of Stock', 'Inactive')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      UNIQUE(business_id, sku)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      purchase_number TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft', 'Ordered', 'Received', 'Cancelled')),
      payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Pending', 'Partial', 'Paid')),
      total_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      cost_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      customer_id TEXT,
      user_id TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash' CHECK(payment_method IN ('Cash', 'Card', 'Transfer')),
      status TEXT DEFAULT 'Completed' CHECK(status IN ('Completed', 'Refunded', 'Cancelled')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      selling_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK(movement_type IN ('Purchase', 'Sale', 'Return', 'Damaged', 'Lost', 'Adjustment', 'Transfer')),
      quantity INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      reason TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('low_stock', 'out_of_stock', 'purchase_received', 'sale_completed', 'adjustment')),
      is_read INTEGER DEFAULT 0,
      reference_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );
  `);

  // Safe migrations for existing databases
  const bizCols = (db.prepare(`PRAGMA table_info(businesses)`).all() as Array<{ name: string }>).map(c => c.name);
  const bizMigrations: Array<[string, string]> = [
    ['access_status', `ALTER TABLE businesses ADD COLUMN access_status TEXT DEFAULT 'active'`],
    ['payment_status', `ALTER TABLE businesses ADD COLUMN payment_status TEXT DEFAULT 'Paid'`],
    ['plan_amount', `ALTER TABLE businesses ADD COLUMN plan_amount REAL DEFAULT 0`],
    ['last_paid_at', `ALTER TABLE businesses ADD COLUMN last_paid_at TEXT`],
    ['next_due_date', `ALTER TABLE businesses ADD COLUMN next_due_date TEXT`],
    ['crm_notes', `ALTER TABLE businesses ADD COLUMN crm_notes TEXT`]
  ];
  for (const [col, sql] of bizMigrations) {
    if (!bizCols.includes(col)) {
      db.exec(sql);
    }
  }

  const userCols = (db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map(c => c.name);
  if (!userCols.includes('is_platform_admin')) {
    db.exec(`ALTER TABLE users ADD COLUMN is_platform_admin INTEGER DEFAULT 0`);
  }

  // Ensure a platform admin exists (defaults to PLATFORM_ADMIN_EMAIL or admin@demo.com)
  const hasPlatformAdmin = db.prepare(`SELECT id FROM users WHERE is_platform_admin = 1 LIMIT 1`).get();
  if (!hasPlatformAdmin) {
    const targetEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@demo.com';
    db.prepare(`UPDATE users SET is_platform_admin = 1 WHERE email = ?`).run(targetEmail);
  }
}

export interface StockMovementParams {
  businessId: string;
  productId: string;
  userId: string;
  movementType: 'Purchase' | 'Sale' | 'Return' | 'Damaged' | 'Lost' | 'Adjustment' | 'Transfer';
  quantityDelta: number; // positive to add stock, negative to decrease stock
  reason?: string;
  referenceId?: string;
}

export function executeStockMovement(db: Database.Database, params: StockMovementParams): { newQuantity: number; previousQuantity: number } {
  const transaction = db.transaction(() => {
    // 1. Fetch current product & business settings
    const product = db.prepare(`SELECT * FROM products WHERE id = ? AND business_id = ?`).get(params.productId, params.businessId) as any;
    if (!product) {
      throw new Error('Product not found');
    }

    const business = db.prepare(`SELECT * FROM businesses WHERE id = ?`).get(params.businessId) as any;
    const allowNegative = business?.allow_negative_inventory === 1;

    const previousQuantity = product.current_stock;
    const newQuantity = previousQuantity + params.quantityDelta;

    if (newQuantity < 0 && !allowNegative) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${previousQuantity}, Required: ${Math.abs(params.quantityDelta)}`);
    }

    // 2. Compute status
    let status = product.status;
    if (status !== 'Inactive') {
      if (newQuantity <= 0) {
        status = 'Out of Stock';
      } else if (newQuantity <= product.min_stock_level) {
        status = 'Low Stock';
      } else {
        status = 'In Stock';
      }
    }

    const now = new Date().toISOString();

    // 3. Update product stock & status
    db.prepare(`
      UPDATE products 
      SET current_stock = ?, status = ?, updated_at = ?
      WHERE id = ? AND business_id = ?
    `).run(newQuantity, status, now, params.productId, params.businessId);

    // 4. Log movement record
    const movementId = 'mov_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    db.prepare(`
      INSERT INTO inventory_movements (
        id, business_id, product_id, user_id, movement_type, 
        quantity, previous_quantity, new_quantity, reason, reference_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      movementId,
      params.businessId,
      params.productId,
      params.userId,
      params.movementType,
      params.quantityDelta,
      previousQuantity,
      newQuantity,
      params.reason || `${params.movementType} adjustment`,
      params.referenceId || null,
      now
    );

    // 5. Trigger automated notification if status changed to Low Stock or Out of Stock
    if (newQuantity <= 0) {
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 11);
      db.prepare(`
        INSERT INTO notifications (id, business_id, title, message, type, is_read, reference_id, created_at)
        VALUES (?, ?, ?, ?, 'out_of_stock', 0, ?, ?)
      `).run(
        notifId,
        params.businessId,
        `Out of Stock: ${product.name}`,
        `${product.name} (SKU: ${product.sku}) is now out of stock!`,
        params.productId,
        now
      );
    } else if (newQuantity <= product.min_stock_level) {
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 11);
      db.prepare(`
        INSERT INTO notifications (id, business_id, title, message, type, is_read, reference_id, created_at)
        VALUES (?, ?, ?, ?, 'low_stock', 0, ?, ?)
      `).run(
        notifId,
        params.businessId,
        `Low Stock Warning: ${product.name}`,
        `${product.name} stock level is ${newQuantity} (Minimum threshold: ${product.min_stock_level}).`,
        params.productId,
        now
      );
    }

    return { newQuantity, previousQuantity };
  });

  return transaction();
}

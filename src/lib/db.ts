import { createClient, Client, InValue, Transaction } from '@libsql/client';
import path from 'path';

export interface StatementResult {
  changes: number;
  lastInsertRowid: number | bigint | undefined;
}

export interface PreparedStatement {
  get: (...args: unknown[]) => Promise<Record<string, unknown> | any | undefined>;
  all: (...args: unknown[]) => Promise<any[]>;
  run: (...args: unknown[]) => Promise<StatementResult>;
}

export interface DbClient {
  prepare: (sql: string) => PreparedStatement;
  exec: (sql: string) => Promise<void>;
  transaction: <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>;
}

function sanitizeArgs(args: unknown[]): InValue[] {
  return args.map((v) => (v === undefined ? null : (v as InValue)));
}

function wrapExecutor(executor: Client | Transaction, rootClient?: Client): DbClient {
  const clientForTx = rootClient || (executor as Client);
  return {
    prepare(sql: string): PreparedStatement {
      return {
        async get(...args: unknown[]) {
          const res = await executor.execute({ sql, args: sanitizeArgs(args) });
          return res.rows[0] as any;
        },
        async all(...args: unknown[]) {
          const res = await executor.execute({ sql, args: sanitizeArgs(args) });
          return res.rows as any[];
        },
        async run(...args: unknown[]) {
          const res = await executor.execute({ sql, args: sanitizeArgs(args) });
          return {
            changes: res.rowsAffected,
            lastInsertRowid: res.lastInsertRowid
          };
        }
      };
    },
    async exec(sql: string) {
      const statements = sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await executor.execute(stmt);
      }
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      // If already inside a transaction, reuse the current transaction executor
      if (!('transaction' in executor) || typeof (executor as Client).transaction !== 'function') {
        return await fn(this);
      }
      const tx = await clientForTx.transaction('write');
      try {
        const wrappedTx = wrapExecutor(tx, clientForTx);
        const result = await fn(wrappedTx);
        await tx.commit();
        return result;
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    }
  };
}

let rawClient: Client | null = null;
let initPromise: Promise<DbClient> | null = null;

function getClientUrl(): { url: string; authToken?: string } {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (tursoUrl) {
    return {
      url: tursoUrl,
      authToken: tursoToken
    };
  }
  const localPath = process.env.VERCEL
    ? '/tmp/inventory.db'
    : path.join(process.cwd(), 'inventory.db');
  return { url: `file:${localPath}` };
}

export async function getDb(): Promise<DbClient> {
  if (!rawClient) {
    rawClient = createClient(getClientUrl());
  }
  const db = wrapExecutor(rawClient, rawClient);
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await db.exec('PRAGMA foreign_keys = ON;');
      } catch {
        // Remote libSQL/Turso servers may manage foreign keys at server level
      }
      await initSchema(db);
      return db;
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return await initPromise;
}

async function initSchema(db: DbClient) {
  await db.exec(`
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
  const bizCols = ((await db.prepare(`PRAGMA table_info(businesses)`).all()) as Array<{ name: string }>).map((c) => c.name);
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
      await db.exec(sql);
    }
  }

  const userCols = ((await db.prepare(`PRAGMA table_info(users)`).all()) as Array<{ name: string }>).map((c) => c.name);
  if (!userCols.includes('is_platform_admin')) {
    await db.exec(`ALTER TABLE users ADD COLUMN is_platform_admin INTEGER DEFAULT 0`);
  }

  // Ensure a platform admin exists (defaults to PLATFORM_ADMIN_EMAIL or admin@demo.com)
  const hasPlatformAdmin = await db.prepare(`SELECT id FROM users WHERE is_platform_admin = 1 LIMIT 1`).get();
  if (!hasPlatformAdmin) {
    const targetEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@demo.com';
    await db.prepare(`UPDATE users SET is_platform_admin = 1 WHERE email = ?`).run(targetEmail);
  }

  // Auto-seed demo data if the database is completely empty (e.g. fresh Turso DB)
  const userCount = (await db.prepare(`SELECT COUNT(*) AS count FROM users`).get()) as { count: number } | undefined;
  if (!userCount || Number(userCount.count) === 0) {
    const { seedDatabase } = await import('./seed');
    await seedDatabase(db);
  }
}

export interface StockMovementParams {
  businessId: string;
  productId: string;
  userId: string;
  movementType: 'Purchase' | 'Sale' | 'Return' | 'Damaged' | 'Lost' | 'Adjustment' | 'Transfer';
  quantityDelta: number;
  reason?: string;
  referenceId?: string;
}

export async function executeStockMovement(
  db: DbClient,
  params: StockMovementParams
): Promise<{ newQuantity: number; previousQuantity: number }> {
  return await db.transaction(async (tx) => {
    const product = (await tx
      .prepare(`SELECT * FROM products WHERE id = ? AND business_id = ?`)
      .get(params.productId, params.businessId)) as any;
    if (!product) {
      throw new Error('Product not found');
    }

    const business = (await tx
      .prepare(`SELECT * FROM businesses WHERE id = ?`)
      .get(params.businessId)) as any;
    const allowNegative = business?.allow_negative_inventory === 1;

    const previousQuantity = product.current_stock;
    const newQuantity = previousQuantity + params.quantityDelta;

    if (newQuantity < 0 && !allowNegative) {
      throw new Error(
        `Insufficient stock for ${product.name}. Available: ${previousQuantity}, Required: ${Math.abs(params.quantityDelta)}`
      );
    }

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

    await tx
      .prepare(
        `UPDATE products SET current_stock = ?, status = ?, updated_at = ? WHERE id = ? AND business_id = ?`
      )
      .run(newQuantity, status, now, params.productId, params.businessId);

    const movementId = 'mov_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    await tx
      .prepare(
        `INSERT INTO inventory_movements (
          id, business_id, product_id, user_id, movement_type,
          quantity, previous_quantity, new_quantity, reason, reference_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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

    if (newQuantity <= 0) {
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 11);
      await tx
        .prepare(
          `INSERT INTO notifications (id, business_id, title, message, type, is_read, reference_id, created_at)
           VALUES (?, ?, ?, ?, 'out_of_stock', 0, ?, ?)`
        )
        .run(
          notifId,
          params.businessId,
          `Out of Stock: ${product.name}`,
          `${product.name} (SKU: ${product.sku}) is now out of stock!`,
          params.productId,
          now
        );
    } else if (newQuantity <= product.min_stock_level) {
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 11);
      await tx
        .prepare(
          `INSERT INTO notifications (id, business_id, title, message, type, is_read, reference_id, created_at)
           VALUES (?, ?, ?, ?, 'low_stock', 0, ?, ?)`
        )
        .run(
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
}

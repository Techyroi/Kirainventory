import { getDb, DbClient } from './db';
import bcrypt from 'bcryptjs';

export async function seedDatabase(existingDb?: DbClient) {
  const db = existingDb || (await getDb());

  console.log('🌱 Clearing existing database tables...');
  await db.exec('PRAGMA foreign_keys = OFF;');
  await db.exec('DELETE FROM notifications;');
  await db.exec('DELETE FROM inventory_movements;');
  await db.exec('DELETE FROM sale_items;');
  await db.exec('DELETE FROM sales;');
  await db.exec('DELETE FROM purchase_items;');
  await db.exec('DELETE FROM purchases;');
  await db.exec('DELETE FROM products;');
  await db.exec('DELETE FROM customers;');
  await db.exec('DELETE FROM suppliers;');
  await db.exec('DELETE FROM categories;');
  await db.exec('DELETE FROM users;');
  await db.exec('DELETE FROM businesses;');
  await db.exec('PRAGMA foreign_keys = ON;');

  const now = new Date().toISOString();
  const pastDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };

  // 1. Create Business
  const bizId = 'biz_demo_101';
  await db.prepare(`
    INSERT INTO businesses (id, name, logo, email, phone, address, currency, default_tax_rate, allow_negative_inventory, default_min_stock, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bizId,
    'Apex Retail & Wholesale Ltd',
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=150&auto=format&fit=crop&q=80',
    'support@apexretail.com',
    '+1 (555) 019-2831',
    '100 Enterprise Way, Suite 400, San Francisco, CA',
    '$',
    8.5,
    0, // negative stock disallowed by default
    10,
    pastDate(60),
    now
  );

  // 2. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);
  const users = [
    { id: 'usr_admin', name: 'Sarah Jenkins (Admin)', email: 'admin@demo.com', role: 'Admin' },
    { id: 'usr_manager', name: 'Michael Scott (Manager)', email: 'manager@demo.com', role: 'Manager' },
    { id: 'usr_staff', name: 'Jim Halpert (Staff)', email: 'staff@demo.com', role: 'Staff' }
  ];

  for (const u of users) {
    await db.prepare(`
      INSERT INTO users (id, business_id, name, email, password_hash, role, status, is_platform_admin, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `).run(u.id, bizId, u.name, u.email, passwordHash, u.role, u.id === 'usr_admin' ? 1 : 0, pastDate(60), now);
  }

  // 3. Create Categories
  const categories = [
    { id: 'cat_elec', name: 'Electronics', description: 'Gadgets, accessories, and audio hardware' },
    { id: 'cat_food', name: 'Food & Beverage', description: 'Packaged snacks, gourmet beverages, and dry goods' },
    { id: 'cat_apparel', name: 'Clothing & Apparel', description: 'T-shirts, hoodies, and footwear' },
    { id: 'cat_beauty', name: 'Beauty & Personal Care', description: 'Skincare, haircare, and cosmetics' },
    { id: 'cat_home', name: 'Household Items', description: 'Home decor, kitchenware, and organization' }
  ];

  for (const c of categories) {
    await db.prepare(`
      INSERT INTO categories (id, business_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(c.id, bizId, c.name, c.description, pastDate(60), now);
  }

  // 4. Create Suppliers
  const suppliers = [
    { id: 'sup_tech', company_name: 'TechWorld Supplies', contact_person: 'David Zhao', email: 'sales@techworld.com', phone: '+1 (555) 234-5678', address: 'San Jose, CA' },
    { id: 'sup_food', company_name: 'Global Harvest Distributors', contact_person: 'Elena Rostova', email: 'orders@globalharvest.com', phone: '+1 (555) 876-5432', address: 'Chicago, IL' },
    { id: 'sup_apparel', company_name: 'Urban Style Co.', contact_person: 'Marcus Vance', email: 'contact@urbanstyle.com', phone: '+1 (555) 345-6789', address: 'New York, NY' },
    { id: 'sup_beauty', company_name: 'Natura Beauty Ltd', contact_person: 'Sophia Thorne', email: 'wholesale@naturabeauty.com', phone: '+1 (555) 654-3210', address: 'Los Angeles, CA' },
    { id: 'sup_home', company_name: 'HomeEssential Wholesalers', contact_person: 'Robert Chen', email: 'info@homeessential.com', phone: '+1 (555) 987-6543', address: 'Dallas, TX' }
  ];

  for (const s of suppliers) {
    await db.prepare(`
      INSERT INTO suppliers (id, business_id, company_name, contact_person, email, phone, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Tier-1 Trusted Supplier', ?, ?)
    `).run(s.id, bizId, s.company_name, s.contact_person, s.email, s.phone, s.address, pastDate(60), now);
  }

  // 5. Create Customers
  const customers = [
    { id: 'cust_101', name: 'Acme Corporation', email: 'procurement@acme.com', phone: '+1 555-111-2222', address: '123 Market St, SF' },
    { id: 'cust_102', name: 'Stellar Retailers', email: 'contact@stellar.com', phone: '+1 555-333-4444', address: '456 Grand Ave, NYC' },
    { id: 'cust_103', name: 'Apex Mart', email: 'orders@apexmart.com', phone: '+1 555-555-6666', address: '789 Main Rd, Austin' },
    { id: 'cust_104', name: 'Summit Trading', email: 'summit@trading.org', phone: '+1 555-777-8888', address: '101 Alpine Way, Denver' },
    { id: 'cust_105', name: 'Crestview Cafe', email: 'hello@crestview.com', phone: '+1 555-999-0000', address: '202 Ocean Blvd, Seattle' },
    { id: 'cust_106', name: 'Metro Supermarket', email: 'info@metrosuper.com', phone: '+1 555-222-3333', address: '303 Commerce St, Chicago' },
    { id: 'cust_107', name: 'Horizon Boutiques', email: 'buyer@horizon.com', phone: '+1 555-444-5555', address: '404 Fashion Mall, Miami' },
    { id: 'cust_108', name: 'Prime Logistics', email: 'supply@primelogistics.com', phone: '+1 555-666-7777', address: '505 Hub Ct, Atlanta' },
    { id: 'cust_109', name: 'Nova Enterprises', email: 'admin@novaent.com', phone: '+1 555-888-9999', address: '606 Tech Park, San Jose' },
    { id: 'cust_110', name: 'Vanguard Store', email: 'orders@vanguard.io', phone: '+1 555-000-1111', address: '707 Center St, Boston' }
  ];

  for (const c of customers) {
    await db.prepare(`
      INSERT INTO customers (id, business_id, name, email, phone, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Key Corporate Client', ?, ?)
    `).run(c.id, bizId, c.name, c.email, c.phone, c.address, pastDate(45), now);
  }

  // 6. Create 20+ Products
  const products = [
    // Electronics
    { id: 'prod_elec_1', name: 'Wireless Noise-Canceling Headphones', sku: 'ELEC-WNC-001', barcode: '88392019201', category_id: 'cat_elec', supplier_id: 'sup_tech', cost: 85, price: 149.99, stock: 45, min: 10, max: 100, status: 'In Stock' },
    { id: 'prod_elec_2', name: 'Ergonomic Mechanical Keyboard', sku: 'ELEC-EMK-002', barcode: '88392019202', category_id: 'cat_elec', supplier_id: 'sup_tech', cost: 45, price: 89.99, stock: 28, min: 10, max: 80, status: 'In Stock' },
    { id: 'prod_elec_3', name: '4K Ultra-HD Webcam', sku: 'ELEC-UHD-003', barcode: '88392019203', category_id: 'cat_elec', supplier_id: 'sup_tech', cost: 38, price: 74.50, stock: 6, min: 10, max: 50, status: 'Low Stock' },
    { id: 'prod_elec_4', name: 'USB-C Multi-Port Hub (8-in-1)', sku: 'ELEC-HUB-004', barcode: '88392019204', category_id: 'cat_elec', supplier_id: 'sup_tech', cost: 18, price: 39.99, stock: 0, min: 15, max: 120, status: 'Out of Stock' },
    { id: 'prod_elec_5', name: 'Smartwatch Fitness Tracker', sku: 'ELEC-SWF-005', barcode: '88392019205', category_id: 'cat_elec', supplier_id: 'sup_tech', cost: 65, price: 129.00, stock: 32, min: 8, max: 60, status: 'In Stock' },

    // Food & Beverage
    { id: 'prod_food_1', name: 'Organic Cold Brew Coffee (12 Pack)', sku: 'FOOD-CBC-101', barcode: '77281920101', category_id: 'cat_food', supplier_id: 'sup_food', cost: 14, price: 29.99, stock: 85, min: 20, max: 200, status: 'In Stock' },
    { id: 'prod_food_2', name: 'Artisanal Dark Chocolate Bars (6 Pack)', sku: 'FOOD-ADC-102', barcode: '77281920102', category_id: 'cat_food', supplier_id: 'sup_food', cost: 8, price: 18.50, stock: 4, min: 15, max: 100, status: 'Low Stock' },
    { id: 'prod_food_3', name: 'Gluten-Free Granola Clusters 500g', sku: 'FOOD-GFG-103', barcode: '77281920103', category_id: 'cat_food', supplier_id: 'sup_food', cost: 4.5, price: 9.99, stock: 110, min: 25, max: 250, status: 'In Stock' },
    { id: 'prod_food_4', name: 'Sparkling Mineral Water (24 Case)', sku: 'FOOD-SMW-104', barcode: '77281920104', category_id: 'cat_food', supplier_id: 'sup_food', cost: 12, price: 24.99, stock: 52, min: 10, max: 150, status: 'In Stock' },

    // Apparel
    { id: 'prod_app_1', name: 'Premium Heavyweight Cotton T-Shirt', sku: 'APP-HCT-201', barcode: '66192019301', category_id: 'cat_apparel', supplier_id: 'sup_apparel', cost: 9, price: 24.99, stock: 65, min: 15, max: 150, status: 'In Stock' },
    { id: 'prod_app_2', name: 'Fleece Pullover Hoodie (Navy)', sku: 'APP-FPH-202', barcode: '66192019302', category_id: 'cat_apparel', supplier_id: 'sup_apparel', cost: 22, price: 49.99, stock: 3, min: 10, max: 60, status: 'Low Stock' },
    { id: 'prod_app_3', name: 'Slim-Fit Denim Jeans (Dark Wash)', sku: 'APP-SFD-203', barcode: '66192019303', category_id: 'cat_apparel', supplier_id: 'sup_apparel', cost: 26, price: 59.95, stock: 40, min: 12, max: 90, status: 'In Stock' },
    { id: 'prod_app_4', name: 'Athletic Running Sneakers', sku: 'APP-ARS-204', barcode: '66192019304', category_id: 'cat_apparel', supplier_id: 'sup_apparel', cost: 38, price: 84.99, stock: 18, min: 8, max: 50, status: 'In Stock' },

    // Beauty
    { id: 'prod_bty_1', name: 'Hydrating Botanical Facial Serum', sku: 'BTY-HFS-301', barcode: '55192019401', category_id: 'cat_beauty', supplier_id: 'sup_beauty', cost: 15, price: 34.00, stock: 50, min: 10, max: 100, status: 'In Stock' },
    { id: 'prod_bty_2', name: 'Organic Argan Oil Shampoo 500ml', sku: 'BTY-AOS-302', barcode: '55192019402', category_id: 'cat_beauty', supplier_id: 'sup_beauty', cost: 7.5, price: 16.99, stock: 0, min: 12, max: 80, status: 'Out of Stock' },
    { id: 'prod_bty_3', name: 'Vitamin C Brightening Moisturizer', sku: 'BTY-VCM-303', barcode: '55192019403', category_id: 'cat_beauty', supplier_id: 'sup_beauty', cost: 13, price: 28.50, stock: 7, min: 10, max: 70, status: 'Low Stock' },
    { id: 'prod_bty_4', name: 'Mineral Sunscreen SPF 50', sku: 'BTY-MSS-304', barcode: '55192019404', category_id: 'cat_beauty', supplier_id: 'sup_beauty', cost: 8, price: 19.99, stock: 80, min: 20, max: 150, status: 'In Stock' },

    // Household
    { id: 'prod_home_1', name: 'Aromatherapy Essential Oil Diffuser', sku: 'HOME-EOD-401', barcode: '44192019501', category_id: 'cat_home', supplier_id: 'sup_home', cost: 16, price: 32.99, stock: 22, min: 5, max: 40, status: 'In Stock' },
    { id: 'prod_home_2', name: 'Stainless Steel Insulated Water Bottle', sku: 'HOME-IWB-402', barcode: '44192019502', category_id: 'cat_home', supplier_id: 'sup_home', cost: 8.5, price: 21.99, stock: 75, min: 15, max: 150, status: 'In Stock' },
    { id: 'prod_home_3', name: 'Bamboo Storage Basket Organizer Set', sku: 'HOME-BSB-403', barcode: '44192019503', category_id: 'cat_home', supplier_id: 'sup_home', cost: 19, price: 38.50, stock: 14, min: 8, max: 60, status: 'In Stock' },
    { id: 'prod_home_4', name: 'Smart LED Desk Lamp with Wireless Charger', sku: 'HOME-LDL-404', barcode: '44192019504', category_id: 'cat_home', supplier_id: 'sup_home', cost: 24, price: 49.99, stock: 5, min: 8, max: 45, status: 'Low Stock' }
  ];

  for (const p of products) {
    await db.prepare(`
      INSERT INTO products (
        id, business_id, name, sku, barcode, category_id, supplier_id, description, 
        cost_price, selling_price, current_stock, min_stock_level, max_stock_level, 
        product_image, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      p.id, bizId, p.name, p.sku, p.barcode, p.category_id, p.supplier_id,
      `High quality ${p.name.toLowerCase()} suitable for commercial distribution.`,
      p.cost, p.price, p.stock, p.min, p.max,
      `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=80`,
      p.status, pastDate(50), now
    );
  }

  // 7. Generate Stock Movements for initial stock
  for (const p of products) {
    await db.prepare(`
      INSERT INTO inventory_movements (
        id, business_id, product_id, user_id, movement_type, quantity, 
        previous_quantity, new_quantity, reason, reference_id, created_at
      ) VALUES (?, ?, ?, ?, 'Purchase', ?, 0, ?, 'Initial inventory baseline load', 'PO-INIT', ?)
    `).run(
      'mov_init_' + p.id, bizId, p.id, 'usr_admin', p.stock, p.stock, pastDate(40)
    );
  }

  // 8. Create Historical Purchases (POs)
  const purchases = [
    {
      id: 'po_101', number: 'PO-2026-0001', supplier_id: 'sup_tech', status: 'Received', payment: 'Paid', total: 4250.00, user_id: 'usr_admin', daysAgo: 30,
      items: [
        { product_id: 'prod_elec_1', qty: 30, cost: 85.00 },
        { product_id: 'prod_elec_2', qty: 20, cost: 45.00 },

      ]
    },
    {
      id: 'po_102', number: 'PO-2026-0002', supplier_id: 'sup_food', status: 'Received', payment: 'Paid', total: 1680.00, user_id: 'usr_manager', daysAgo: 20,
      items: [
        { product_id: 'prod_food_1', qty: 50, cost: 14.00 },
        { product_id: 'prod_food_3', qty: 100, cost: 4.50 },
      ]
    },
    {
      id: 'po_103', number: 'PO-2026-0003', supplier_id: 'sup_beauty', status: 'Ordered', payment: 'Pending', total: 1250.00, user_id: 'usr_manager', daysAgo: 5,
      items: [
        { product_id: 'prod_bty_1', qty: 50, cost: 15.00 },
        { product_id: 'prod_bty_2', qty: 40, cost: 7.50 },
      ]
    },
    {
      id: 'po_104', number: 'PO-2026-0004', supplier_id: 'sup_apparel', status: 'Draft', payment: 'Pending', total: 850.00, user_id: 'usr_staff', daysAgo: 2,
      items: [
        { product_id: 'prod_app_1', qty: 50, cost: 9.00 },
        { product_id: 'prod_app_2', qty: 15, cost: 22.00 },
      ]
    }
  ];

  for (const po of purchases) {
    const poDate = pastDate(po.daysAgo);
    await db.prepare(`
      INSERT INTO purchases (id, business_id, purchase_number, supplier_id, user_id, status, payment_status, total_amount, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Standard wholesale reorder', ?, ?)
    `).run(po.id, bizId, po.number, po.supplier_id, po.user_id, po.status, po.payment, po.total, poDate, poDate);

    for (const item of po.items) {
      const itemId = 'poi_' + Math.random().toString(36).substring(2, 10);
      const total = item.qty * item.cost;
      await db.prepare(`
        INSERT INTO purchase_items (id, purchase_id, product_id, quantity, cost_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(itemId, po.id, item.product_id, item.qty, item.cost, total);
    }
  }

  // 9. Create Historical Sales (Invoices)
  const sales = [
    {
      id: 'sale_201', inv: 'INV-2026-0001', cust_id: 'cust_101', user_id: 'usr_staff', daysAgo: 15, method: 'Card',
      items: [
        { product_id: 'prod_elec_1', qty: 2, selling: 149.99, cost: 85.00 },
        { product_id: 'prod_elec_2', qty: 1, selling: 89.99, cost: 45.00 }
      ]
    },
    {
      id: 'sale_202', inv: 'INV-2026-0002', cust_id: 'cust_102', user_id: 'usr_staff', daysAgo: 10, method: 'Transfer',
      items: [
        { product_id: 'prod_food_1', qty: 5, selling: 29.99, cost: 14.00 },
        { product_id: 'prod_food_3', qty: 10, selling: 9.99, cost: 4.50 },
        { product_id: 'prod_home_2', qty: 2, selling: 21.99, cost: 8.50 }
      ]
    },
    {
      id: 'sale_203', inv: 'INV-2026-0003', cust_id: 'cust_104', user_id: 'usr_manager', daysAgo: 5, method: 'Card',
      items: [
        { product_id: 'prod_app_1', qty: 4, selling: 24.99, cost: 9.00 },
        { product_id: 'prod_app_3', qty: 2, selling: 59.95, cost: 26.00 }
      ]
    },
    {
      id: 'sale_204', inv: 'INV-2026-0004', cust_id: null, user_id: 'usr_staff', daysAgo: 1, method: 'Cash', // Walk-in sale
      items: [
        { product_id: 'prod_bty_1', qty: 1, selling: 34.00, cost: 15.00 },
        { product_id: 'prod_bty_4', qty: 2, selling: 19.99, cost: 8.00 }
      ]
    },
    {
      id: 'sale_205', inv: 'INV-2026-0005', cust_id: 'cust_106', user_id: 'usr_staff', daysAgo: 0, method: 'Card', // Today sale
      items: [
        { product_id: 'prod_elec_5', qty: 1, selling: 129.00, cost: 65.00 },
        { product_id: 'prod_home_1', qty: 1, selling: 32.99, cost: 16.00 }
      ]
    }
  ];

  for (const s of sales) {
    const saleDate = pastDate(s.daysAgo);
    let subtotal = 0;
    for (const item of s.items) {
      subtotal += item.qty * item.selling;
    }
    const tax = Math.round((subtotal * 0.085) * 100) / 100;
    const total = subtotal + tax;

    await db.prepare(`
      INSERT INTO sales (id, business_id, invoice_number, customer_id, user_id, subtotal, discount_amount, tax_amount, total_amount, payment_method, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'Completed', 'POS Checkout', ?, ?)
    `).run(s.id, bizId, s.inv, s.cust_id, s.user_id, subtotal, tax, total, s.method, saleDate, saleDate);

    for (const item of s.items) {
      const itemId = 'sli_' + Math.random().toString(36).substring(2, 10);
      const totalItemPrice = item.qty * item.selling;
      await db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, quantity, selling_price, cost_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, s.id, item.product_id, item.qty, item.selling, item.cost, totalItemPrice);

      // Record Sale movement
      await db.prepare(`
        INSERT INTO inventory_movements (id, business_id, product_id, user_id, movement_type, quantity, previous_quantity, new_quantity, reason, reference_id, created_at)
        VALUES (?, ?, ?, ?, 'Sale', ?, ?, ?, ?, ?, ?)
      `).run(
        'mov_sale_' + itemId, bizId, item.product_id, s.user_id, -item.qty, 10 + item.qty, 10, `Completed sale ${s.inv}`, s.id, saleDate
      );
    }
  }

  // 10. Create Sample Notifications
  const notifications = [
    { title: 'Low Stock Warning: 4K Ultra-HD Webcam', msg: '4K Ultra-HD Webcam stock level is 6 (Minimum threshold: 10).', type: 'low_stock', isRead: 0, daysAgo: 1 },
    { title: 'Out of Stock: USB-C Multi-Port Hub (8-in-1)', msg: 'USB-C Multi-Port Hub (8-in-1) is completely out of stock!', type: 'out_of_stock', isRead: 0, daysAgo: 2 },
    { title: 'Purchase Received: PO-2026-0002', msg: 'Purchase Order PO-2026-0002 from Global Harvest Distributors marked as Received.', type: 'purchase_received', isRead: 1, daysAgo: 5 },
    { title: 'Sale Completed: INV-2026-0005', msg: 'New sale INV-2026-0005 processed for $161.99.', type: 'sale_completed', isRead: 0, daysAgo: 0 }
  ];

  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i];
    await db.prepare(`
      INSERT INTO notifications (id, business_id, title, message, type, is_read, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('notif_seed_' + i, bizId, n.title, n.msg, n.type, n.isRead, 'ref_' + i, pastDate(n.daysAgo));
  }

  console.log('✅ Seed data successfully injected into SQLite database!');
}

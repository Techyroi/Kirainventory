export type UserRole = 'Admin' | 'Manager' | 'Staff';

export type BusinessAccessStatus = 'active' | 'paused';
export type BillingPaymentStatus = 'Paid' | 'Pending' | 'Overdue' | 'Trial';

export type ProductStatus = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Inactive';

export type MovementType = 
  | 'Purchase' 
  | 'Sale' 
  | 'Return' 
  | 'Damaged' 
  | 'Lost' 
  | 'Adjustment' 
  | 'Transfer';

export type PurchaseStatus = 'Draft' | 'Ordered' | 'Received' | 'Cancelled';
export type PurchasePaymentStatus = 'Pending' | 'Partial' | 'Paid';

export type SaleStatus = 'Completed' | 'Refunded' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Card' | 'Transfer';

export type NotificationType = 
  | 'low_stock' 
  | 'out_of_stock' 
  | 'purchase_received' 
  | 'sale_completed' 
  | 'adjustment';

export interface Business {
  id: string;
  name: string;
  logo?: string;
  email: string;
  phone?: string;
  address?: string;
  currency: string;
  default_tax_rate: number;
  allow_negative_inventory: number; // 0 or 1
  default_min_stock: number;
  access_status?: BusinessAccessStatus;
  payment_status?: BillingPaymentStatus;
  plan_amount?: number;
  last_paid_at?: string | null;
  next_due_date?: string | null;
  crm_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  business_id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'disabled';
  is_platform_admin?: number | boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmClientUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'disabled';
  is_platform_admin: number;
  created_at: string;
}

export interface CrmClient extends Business {
  access_status: BusinessAccessStatus;
  payment_status: BillingPaymentStatus;
  plan_amount: number;
  user_count: number;
  product_count: number;
  sales_count: number;
  users: CrmClientUser[];
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  business_id: string;
  company_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  total_purchases?: number;
  outstanding_payments?: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  total_purchases?: number;
  order_count?: number;
  last_purchase_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  sku: string;
  barcode?: string;
  category_id?: string;
  supplier_id?: string;
  category_name?: string;
  supplier_name?: string;
  description?: string;
  cost_price: number;
  selling_price: number;
  profit_per_unit?: number;
  current_stock: number;
  min_stock_level: number;
  max_stock_level: number;
  product_image?: string;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id?: string;
  purchase_id?: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity: number;
  cost_price: number;
  total_price: number;
}

export interface Purchase {
  id: string;
  business_id: string;
  purchase_number: string;
  supplier_id: string;
  supplier_name?: string;
  user_id: string;
  user_name?: string;
  status: PurchaseStatus;
  payment_status: PurchasePaymentStatus;
  total_amount: number;
  notes?: string;
  items?: PurchaseItem[];
  item_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id?: string;
  sale_id?: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity: number;
  selling_price: number;
  cost_price: number;
  total_price: number;
}

export interface Sale {
  id: string;
  business_id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  user_id: string;
  user_name?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  notes?: string;
  items?: SaleItem[];
  item_count?: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  business_id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  user_id: string;
  user_name?: string;
  movement_type: MovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  reference_id?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  business_id: string;
  user_id?: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: number;
  reference_id?: string;
  created_at: string;
}

export interface DashboardMetrics {
  totalProducts: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  todaySales: number;
  monthSales: number;
  recentSales: Sale[];
  lowStockProducts: Product[];
  recentMovements: InventoryMovement[];
  salesOverTime: { date: string; sales: number; count: number }[];
  inventoryValueByCategory: { name: string; value: number }[];
  topSellingProducts: { name: string; sold: number; revenue: number }[];
  movementTypeSummary: { type: string; count: number }[];
}

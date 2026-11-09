export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  pin: string;
  avatarUrl?: string;
  active: boolean;
}

export type CostingMethod = 'FIFO' | 'AVERAGE';

export interface BusinessSettings {
  storeName: string;
  storeTagline: string;
  storeAddress: string;
  storePhone: string;
  storeFooterNote: string;
  currency: string;
  costingMethod: CostingMethod;
  taxEnabled: boolean;
  taxRatePercent: number; // e.g. 11 for PPN
  defaultReceiptWidth: '58mm' | '80mm';
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  lastSyncTime?: string;
  autoSyncIntervalMinutes?: number;
  loyaltyEnabled?: boolean;
  loyaltyPointsPerAmount?: number; // e.g. 10000 = 1 point per Rp 10.000 spent
  loyaltyPointRedemptionValue?: number; // e.g. 1 point = Rp 100 discount
  loyaltyMinRedeemPoints?: number; // e.g. 10 points minimum to redeem
}


export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  unit: string; // e.g. 'Pcs', 'Kg', 'Pack', 'Box', 'Botol'
  costPrice: number; // Reference cost price
  sellingPrice: number;
  minStock: number;
  currentStock: number;
  avgCostPrice: number; // For Moving Average
  active: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FifoBatch {
  id: string;
  productId: string;
  purchaseRefId: string;
  dateReceived: string;
  initialQty: number;
  remainingQty: number;
  costPerUnit: number;
  status: 'ACTIVE' | 'DEPLETED';
}

export interface CartItem {
  productId: string;
  product: Product;
  qty: number;
  sellingPrice: number;
  discountItem: number; // nominal discount per line
  notes?: string;
}

export type PaymentMethod = 'TUNAI' | 'QRIS' | 'TRANSFER' | 'DEBIT' | 'KREDIT' | 'SPLIT' | 'PIUTANG';

export interface PaymentRecord {
  id: string;
  method: PaymentMethod;
  amount: number;
  referenceNo?: string;
  paidAt: string;
}

export type ReceivableStatus = 'BELUM_LUNAS' | 'SEBAGIAN' | 'LUNAS';

export interface ReceivablePayment {
  id: string;
  receivableId: string;
  amount: number;
  paymentMethod: 'TUNAI' | 'TRANSFER' | 'QRIS' | 'DEBIT';
  paymentDate: string;
  referenceNo?: string;
  receivedBy: string;
  notes?: string;
}

export interface Receivable {
  id: string; // REC-YYYYMMDD-XXXX
  receivableNo: string;
  saleId?: string; // Optional linked sale
  receiptNo?: string; // Optional linked receipt
  customerId: string;
  customerName: string;
  customerPhone?: string;
  transactionDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: ReceivableStatus;
  notes?: string;
  payments: ReceivablePayment[];
  createdAt: string;
  updatedAt: string;
}

export type SaleStatus = 'POSTED' | 'VOID' | 'REFUNDED';

export interface SaleDetail {
  id: string;
  saleId: string;
  productId: string;
  skuSnapshot: string;
  nameSnapshot: string;
  unitSnapshot: string;
  qty: number;
  sellingPrice: number;
  discountItem: number;
  hppTotal: number; // Cost of goods sold for this line based on FIFO or Average
  subtotal: number; // (qty * sellingPrice) - discountItem
  batchesUsed?: { batchId: string; qty: number; costPerUnit: number }[];
}

export interface Sale {
  id: string; // Local / Sync ID
  receiptNo: string; // POS-YYYYMMDD-XXXX
  timestamp: string;
  cashierId: string;
  cashierName: string;
  shiftId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  subtotal: number;
  orderDiscount: number;
  taxAmount: number;
  taxRatePercent: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  payments: PaymentRecord[];
  notes?: string;
  status: SaleStatus;
  items: SaleDetail[];
  pointsEarned?: number;
  pointsRedeemed?: number;
  pointsDiscountAmount?: number;
  customerPointsBalanceAfter?: number;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  syncError?: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface HoldOrder {
  id: string;
  orderName: string;
  items: CartItem[];
  customerId?: string;
  customerName?: string;
  notes?: string;
  savedAt: string;
  subtotal: number;
}

export type StockMovementType =
  | 'PENJUALAN'
  | 'RETUR_PENJUALAN'
  | 'PEMBELIAN'
  | 'RETUR_PEMBELIAN'
  | 'PENYESUAIAN_MASUK'
  | 'PENYESUAIAN_KELUAR'
  | 'OPNAME'
  | 'RUSAK_HILANG';

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  timestamp: string;
  type: StockMovementType;
  qtyIn: number;
  qtyOut: number;
  balanceAfter: number;
  costValue: number;
  referenceId: string; // Sale ID, Purchase ID, or Adjustment ID
  userId: string;
  userName: string;
  note: string;
}

export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseItem {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  qtyOrdered: number;
  qtyReceived: number;
  costPerUnit: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  purchaseNo: string; // PO-YYYYMMDD-XXXX
  supplierId: string;
  supplierName: string;
  date: string;
  receivedDate?: string;
  status: PurchaseStatus;
  items: PurchaseItem[];
  totalAmount: number;
  additionalCost: number; // shipping, packing, etc.
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'LISTRIK_AIR'
  | 'SEWA_TEMPAT'
  | 'GAJI_KARYAWAN'
  | 'OPERASIONAL_KASIR'
  | 'KONSUMSI_KEBERSIHAN'
  | 'MARKETING'
  | 'LAINNYA';

export interface Expense {
  id: string;
  timestamp: string;
  category: ExpenseCategory;
  categoryLabel: string;
  amount: number;
  description: string;
  recipient?: string;
  userId: string;
  userName: string;
  shiftId?: string;
}

export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface CashierShift {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  startingCash: number;
  expectedEndingCash: number;
  actualEndingCash?: number;
  cashDifference?: number; // actual - expected
  totalSalesCash: number;
  totalSalesNonCash: number;
  totalTransactions: number;
  cashInExpenses: number;
  notes?: string;
  status: ShiftStatus;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  category: string;
  details: string;
}

export interface SyncQueueItem {
  id: string;
  entityType: 'SALE' | 'INVENTORY' | 'PURCHASE' | 'EXPENSE' | 'SHIFT' | 'PRODUCT' | 'CUSTOMER' | 'LOYALTY';
  entityId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastAttempt?: string;
  errorMessage?: string;
  idempotencyKey: string;
}

export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tier: CustomerTier;
  pointsBalance: number;
  totalSpend: number;
  totalVisits: number;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

export type LoyaltyLogType = 'EARN' | 'REDEEM' | 'ADJUSTMENT' | 'REFUND';

export interface LoyaltyLog {
  id: string;
  customerId: string;
  customerName: string;
  saleId?: string;
  type: LoyaltyLogType;
  points: number; // positive for earned/adjustment+, negative for redeemed/adjustment-
  amountSpent?: number;
  balanceAfter: number;
  timestamp: string;
  notes?: string;
  createdBy?: string;
}


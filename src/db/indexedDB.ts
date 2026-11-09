import Dexie, { Table } from 'dexie';
import {
  AuditLog,
  BusinessSettings,
  CashierShift,
  Category,
  Customer,
  Expense,
  FifoBatch,
  HoldOrder,
  InventoryLog,
  LoyaltyLog,
  Product,
  Purchase,
  Sale,
  Supplier,
  SyncQueueItem,
  UserAccount,
  Receivable,
  ReceivablePayment,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_FIFO_BATCHES,
  INITIAL_LOYALTY_LOGS,
  INITIAL_PRODUCTS,
  INITIAL_SETTINGS,
  INITIAL_SUPPLIERS,
  INITIAL_USERS,
  INITIAL_RECEIVABLES,
} from './seedData';

export class POSDatabase extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  suppliers!: Table<Supplier, string>;
  fifoBatches!: Table<FifoBatch, string>;
  sales!: Table<Sale, string>;
  inventoryLogs!: Table<InventoryLog, string>;
  purchases!: Table<Purchase, string>;
  expenses!: Table<Expense, string>;
  shifts!: Table<CashierShift, string>;
  holdOrders!: Table<HoldOrder, string>;
  auditLogs!: Table<AuditLog, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  settings!: Table<BusinessSettings & { id: string }, string>;
  users!: Table<UserAccount, string>;
  customers!: Table<Customer, string>;
  loyaltyLogs!: Table<LoyaltyLog, string>;
  receivables!: Table<Receivable, string>;
  receivablePayments!: Table<ReceivablePayment, string>;

  constructor() {
    super('IntegratedPOS_DB');
    this.version(1).stores({
      products: 'id, sku, barcode, categoryId, active, updatedAt',
      categories: 'id, name',
      suppliers: 'id, name',
      fifoBatches: 'id, productId, status, dateReceived',
      sales: 'id, receiptNo, timestamp, status, syncStatus, cashierId',
      inventoryLogs: 'id, productId, timestamp, type, referenceId',
      purchases: 'id, purchaseNo, supplierId, status, date',
      expenses: 'id, timestamp, category, shiftId',
      shifts: 'id, cashierId, status, openedAt',
      holdOrders: 'id, savedAt',
      auditLogs: 'id, timestamp, userId, action',
      syncQueue: 'id, entityType, status, idempotencyKey',
      settings: 'id',
      users: 'id, email, role, active',
    });
    this.version(2).stores({
      customers: 'id, name, phone, tier, pointsBalance, createdAt',
      loyaltyLogs: 'id, customerId, saleId, type, timestamp',
    });
    this.version(3).stores({
      receivables: 'id, receivableNo, saleId, receiptNo, customerId, status, dueDate, transactionDate',
      receivablePayments: 'id, receivableId, paymentDate',
    });
  }
}

export const db = new POSDatabase();

export async function initializeDatabase() {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    // Seed initial records
    await db.settings.put({ ...INITIAL_SETTINGS, id: 'current_config' });
    await db.users.bulkPut(INITIAL_USERS);
    await db.categories.bulkPut(INITIAL_CATEGORIES);
    await db.suppliers.bulkPut(INITIAL_SUPPLIERS);
    await db.products.bulkPut(INITIAL_PRODUCTS);
    await db.fifoBatches.bulkPut(INITIAL_FIFO_BATCHES);
    await db.customers.bulkPut(INITIAL_CUSTOMERS);
    await db.loyaltyLogs.bulkPut(INITIAL_LOYALTY_LOGS);
    await db.receivables.bulkPut(INITIAL_RECEIVABLES);

    // Initial audit log
    await db.auditLogs.add({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: 'SYSTEM',
      userName: 'Sistem',
      action: 'INIT_DB',
      category: 'SYSTEM',
      details: 'Database lokal IndexedDB berhasil diinisialisasi dengan master data ritel, pelanggan & pencatatan piutang.',
    });
  } else {
    // Ensure customers and receivables table are populated if migrating
    const custCount = await db.customers.count();
    if (custCount === 0) {
      await db.customers.bulkPut(INITIAL_CUSTOMERS);
      await db.loyaltyLogs.bulkPut(INITIAL_LOYALTY_LOGS);
    }
    const recCount = await db.receivables.count();
    if (recCount === 0) {
      await db.receivables.bulkPut(INITIAL_RECEIVABLES);
    }
  }
}

// Reset database helper (useful for UAT testing)
export async function resetDatabaseWithSeed() {
  await db.transaction(
    'rw',
    [
      db.products,
      db.categories,
      db.suppliers,
      db.fifoBatches,
      db.sales,
      db.inventoryLogs,
      db.purchases,
      db.expenses,
      db.shifts,
      db.holdOrders,
      db.auditLogs,
      db.syncQueue,
      db.settings,
      db.users,
      db.customers,
      db.loyaltyLogs,
      db.receivables,
      db.receivablePayments,
    ],
    async () => {
      await db.products.clear();
      await db.categories.clear();
      await db.suppliers.clear();
      await db.fifoBatches.clear();
      await db.sales.clear();
      await db.inventoryLogs.clear();
      await db.purchases.clear();
      await db.expenses.clear();
      await db.shifts.clear();
      await db.holdOrders.clear();
      await db.auditLogs.clear();
      await db.syncQueue.clear();
      await db.settings.clear();
      await db.users.clear();
      await db.customers.clear();
      await db.loyaltyLogs.clear();
      await db.receivables.clear();
      await db.receivablePayments.clear();

      await db.settings.put({ ...INITIAL_SETTINGS, id: 'current_config' });
      await db.users.bulkPut(INITIAL_USERS);
      await db.categories.bulkPut(INITIAL_CATEGORIES);
      await db.suppliers.bulkPut(INITIAL_SUPPLIERS);
      await db.products.bulkPut(INITIAL_PRODUCTS);
      await db.fifoBatches.bulkPut(INITIAL_FIFO_BATCHES);
      await db.customers.bulkPut(INITIAL_CUSTOMERS);
      await db.loyaltyLogs.bulkPut(INITIAL_LOYALTY_LOGS);
      await db.receivables.bulkPut(INITIAL_RECEIVABLES);

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: 'USR-001',
        userName: 'Budi Santoso',
        action: 'RESET_SEED',
        category: 'SYSTEM',
        details: 'Database di-reset ke data awal ritel untuk testing/demo.',
      });
    }
  );
}


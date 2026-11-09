import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { db } from '../db/indexedDB';
import { auth, getStoredGoogleUser } from './auth';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore targeting the specific provisioned database
export const firestore: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const SYNC_METADATA_KEY = 'pos_cloud_last_sync';

export interface CloudSyncResult {
  success: boolean;
  message: string;
  syncedCounts: {
    products: number;
    sales: number;
    expenses: number;
    customers: number;
    receivables: number;
    suppliers: number;
    shifts: number;
  };
  syncedAt: string;
}

export interface CloudRestoreResult {
  success: boolean;
  message: string;
  restoredCounts: {
    products: number;
    sales: number;
    customers: number;
    expenses: number;
    receivables: number;
  };
}

/**
 * Ping / Test Live Connection to Cloud Firestore
 */
export const testFirestoreConnection = async (): Promise<{
  success: boolean;
  message: string;
  projectId: string;
  databaseId: string;
  latencyMs?: number;
}> => {
  const startTime = Date.now();
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const projectId = firebaseConfig.projectId;

  try {
    const pingRef = doc(firestore, '_healthcheck', 'ping');
    const user = getStoredGoogleUser();
    await setDoc(
      pingRef,
      {
        lastPing: new Date().toISOString(),
        testedBy: user.email || 'anonymous_pos',
        clientTime: Date.now(),
      },
      { merge: true }
    );

    // Verify read
    await getDocFromServer(pingRef);
    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      message: `Berhasil terhubung ke Cloud Firestore (${latencyMs}ms)! Database ID: ${databaseId}`,
      projectId,
      databaseId,
      latencyMs,
    };
  } catch (error: any) {
    console.warn('Firestore connection test failed:', error);
    const msg = error?.message || 'Gagal tersambung ke Cloud Firestore';
    return {
      success: false,
      message: msg.includes('the client is offline')
        ? 'Perangkat sedang offline. Pastikan koneksi internet aktif.'
        : `Gagal mengakses Cloud Firestore: ${msg}`,
      projectId,
      databaseId,
    };
  }
};

/**
 * Sync all local Dexie IndexedDB records to Cloud Firestore
 */
export const syncAllToFirestore = async (): Promise<CloudSyncResult> => {
  const syncedCounts = {
    products: 0,
    sales: 0,
    expenses: 0,
    customers: 0,
    receivables: 0,
    suppliers: 0,
    shifts: 0,
  };

  try {
    // 1. Fetch local data from Dexie
    const [products, sales, expenses, customers, receivables, suppliers, shifts, settings] =
      await Promise.all([
        db.products.toArray(),
        db.sales.toArray(),
        db.expenses.toArray(),
        db.customers.toArray(),
        db.receivables.toArray(),
        db.suppliers.toArray(),
        db.shifts.toArray(),
        db.settings.get('current_config'),
      ]);

    // 2. Batch write helper to respect Firestore's 500 ops per batch limit
    const commitBatchOps = async (items: any[], collectionName: string, idField: string = 'id') => {
      let count = 0;
      const CHUNK_SIZE = 400;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(firestore);

        for (const item of chunk) {
          const docId = String(item[idField] || `${collectionName}_${Date.now()}_${Math.random()}`);
          const ref = doc(firestore, collectionName, docId);
          // Clone item without undefined fields
          const cleanItem = JSON.parse(JSON.stringify(item));
          batch.set(ref, { ...cleanItem, _lastSyncedAt: new Date().toISOString() }, { merge: true });
          count++;
        }
        await batch.commit();
      }
      return count;
    };

    // 3. Sync collections to Firestore
    if (products.length > 0) {
      syncedCounts.products = await commitBatchOps(products, 'products', 'id');
    }
    if (sales.length > 0) {
      syncedCounts.sales = await commitBatchOps(sales, 'sales', 'id');
    }
    if (expenses.length > 0) {
      syncedCounts.expenses = await commitBatchOps(expenses, 'expenses', 'id');
    }
    if (customers.length > 0) {
      syncedCounts.customers = await commitBatchOps(customers, 'customers', 'id');
    }
    if (receivables.length > 0) {
      syncedCounts.receivables = await commitBatchOps(receivables, 'receivables', 'id');
    }
    if (suppliers.length > 0) {
      syncedCounts.suppliers = await commitBatchOps(suppliers, 'suppliers', 'id');
    }
    if (shifts.length > 0) {
      syncedCounts.shifts = await commitBatchOps(shifts, 'shifts', 'id');
    }

    // 4. Sync Settings
    if (settings) {
      const cleanSettings = JSON.parse(JSON.stringify(settings));
      await setDoc(doc(firestore, 'settings', 'current_config'), {
        ...cleanSettings,
        _lastSyncedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // 5. Update local syncStatus of sales to SYNCED
    await db.sales.where('syncStatus').equals('PENDING').modify({ syncStatus: 'SYNCED' });
    await db.syncQueue.where('status').equals('PENDING').modify({ status: 'SYNCED' });

    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(SYNC_METADATA_KEY, nowIso);
    } catch {}

    const totalSynced =
      syncedCounts.products +
      syncedCounts.sales +
      syncedCounts.expenses +
      syncedCounts.customers +
      syncedCounts.receivables;

    const message = `Sinkronisasi Cloud Firestore berhasil! Total ${totalSynced} data terkirim (${syncedCounts.sales} transaksi, ${syncedCounts.products} produk, ${syncedCounts.customers} pelanggan, ${syncedCounts.receivables} piutang).`;

    return {
      success: true,
      message,
      syncedCounts,
      syncedAt: nowIso,
    };
  } catch (error: any) {
    console.error('Firestore sync error:', error);
    throw new Error(error?.message || 'Gagal melakukan sinkronisasi ke Cloud Firestore');
  }
};

/**
 * Pull and Restore Data from Cloud Firestore to Local IndexedDB
 */
export const restoreFromFirestore = async (): Promise<CloudRestoreResult> => {
  const restoredCounts = {
    products: 0,
    sales: 0,
    customers: 0,
    expenses: 0,
    receivables: 0,
  };

  try {
    // 1. Fetch Products
    const productsSnap = await getDocs(collection(firestore, 'products'));
    if (!productsSnap.empty) {
      const cloudProducts: any[] = [];
      productsSnap.forEach((docSnap) => {
        cloudProducts.push(docSnap.data());
      });
      if (cloudProducts.length > 0) {
        await db.products.bulkPut(cloudProducts);
        restoredCounts.products = cloudProducts.length;
      }
    }

    // 2. Fetch Customers
    const customersSnap = await getDocs(collection(firestore, 'customers'));
    if (!customersSnap.empty) {
      const cloudCustomers: any[] = [];
      customersSnap.forEach((docSnap) => {
        cloudCustomers.push(docSnap.data());
      });
      if (cloudCustomers.length > 0) {
        await db.customers.bulkPut(cloudCustomers);
        restoredCounts.customers = cloudCustomers.length;
      }
    }

    // 3. Fetch Receivables
    const receivablesSnap = await getDocs(collection(firestore, 'receivables'));
    if (!receivablesSnap.empty) {
      const cloudReceivables: any[] = [];
      receivablesSnap.forEach((docSnap) => {
        cloudReceivables.push(docSnap.data());
      });
      if (cloudReceivables.length > 0) {
        await db.receivables.bulkPut(cloudReceivables);
        restoredCounts.receivables = cloudReceivables.length;
      }
    }

    // 4. Fetch Expenses
    const expensesSnap = await getDocs(collection(firestore, 'expenses'));
    if (!expensesSnap.empty) {
      const cloudExpenses: any[] = [];
      expensesSnap.forEach((docSnap) => {
        cloudExpenses.push(docSnap.data());
      });
      if (cloudExpenses.length > 0) {
        await db.expenses.bulkPut(cloudExpenses);
        restoredCounts.expenses = cloudExpenses.length;
      }
    }

    // 5. Fetch Sales
    const salesSnap = await getDocs(collection(firestore, 'sales'));
    if (!salesSnap.empty) {
      const cloudSales: any[] = [];
      salesSnap.forEach((docSnap) => {
        cloudSales.push(docSnap.data());
      });
      if (cloudSales.length > 0) {
        await db.sales.bulkPut(cloudSales);
        restoredCounts.sales = cloudSales.length;
      }
    }

    // 6. Fetch Settings
    const settingsDoc = await getDoc(doc(firestore, 'settings', 'current_config'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      await db.settings.put({ ...data, id: 'current_config' } as any);
    }

    const totalRestored =
      restoredCounts.products +
      restoredCounts.customers +
      restoredCounts.sales +
      restoredCounts.expenses +
      restoredCounts.receivables;

    return {
      success: true,
      message: `Pemulihan data dari Cloud Firestore selesai. Berhasil menarik ${totalRestored} rekaman ke IndexedDB lokal.`,
      restoredCounts,
    };
  } catch (error: any) {
    console.error('Firestore restore error:', error);
    throw new Error(error?.message || 'Gagal memulihkan data dari Cloud Firestore');
  }
};

export const getLastCloudSyncTime = (): string | null => {
  try {
    return localStorage.getItem(SYNC_METADATA_KEY);
  } catch {
    return null;
  }
};

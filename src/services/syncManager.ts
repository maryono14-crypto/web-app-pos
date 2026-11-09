import { db } from '../db/indexedDB';
import { SyncQueueItem } from '../types';
import { syncAllToFirestore } from './firestoreSyncService';

type SyncListener = (isOnline: boolean, pendingCount: number, isSyncing: boolean, lastSyncMessage?: string) => void;

class SyncManager {
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;
  private isSimulatedOffline = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private autoSyncInterval: any = null;
  private lastSyncMessage = '';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (!this.isSimulatedOffline) {
          this.isOnline = true;
          this.notify();
          this.triggerAutoSync();
        }
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });

      // Listen for Cloud/Google auth events
      window.addEventListener('google-auth-changed', () => {
        this.lastSyncMessage = 'Status autentikasi Cloud diperbarui.';
        this.notify();
        if (this.isOnline && !this.isSimulatedOffline) {
          this.triggerAutoSync();
        }
      });

      // Periodic retry every 30 seconds if online and there are pending items
      this.autoSyncInterval = setInterval(() => {
        if (this.isOnline && !this.isSimulatedOffline) {
          this.getPendingCount().then((count) => {
            if (count > 0 && !this.isSyncing) {
              this.triggerAutoSync();
            }
          });
        }
      }, 30000);
    }
  }

  public getIsOnline(): boolean {
    if (this.isSimulatedOffline) return false;
    return this.isOnline;
  }

  public setSimulateOffline(simulate: boolean) {
    this.isSimulatedOffline = simulate;
    this.isOnline = simulate ? false : navigator.onLine;
    this.notify();
    if (!simulate) {
      this.triggerAutoSync();
    }
  }

  public getIsSimulatedOffline(): boolean {
    return this.isSimulatedOffline;
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    // Initial call
    this.getPendingCount().then((count) => {
      listener(this.getIsOnline(), count, this.isSyncing, this.lastSyncMessage);
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async getPendingCount(): Promise<number> {
    try {
      const pendingSales = await db.sales.where('syncStatus').equals('PENDING').count();
      const queueItems = await db.syncQueue.where('status').equals('PENDING').count();
      return pendingSales + queueItems;
    } catch {
      return 0;
    }
  }

  private async notify() {
    const count = await this.getPendingCount();
    const online = this.getIsOnline();
    for (const listener of this.listeners) {
      listener(online, count, this.isSyncing, this.lastSyncMessage);
    }
  }

  public async enqueue(
    entityType: SyncQueueItem['entityType'],
    entityId: string,
    operation: SyncQueueItem['operation'],
    payload: any,
    idempotencyKey: string
  ) {
    // Check if idempotency key already exists
    const existing = await db.syncQueue.where('idempotencyKey').equals(idempotencyKey).first();
    if (existing) {
      return existing.id;
    }

    const item: SyncQueueItem = {
      id: `SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      entityType,
      entityId,
      operation,
      payload,
      status: 'PENDING',
      retryCount: 0,
      idempotencyKey,
    };

    await db.syncQueue.add(item);
    await this.notify();

    // Trigger auto-sync if currently online
    if (this.getIsOnline()) {
      this.triggerAutoSync();
    }
    return item.id;
  }

  public async triggerAutoSync(): Promise<{ success: boolean; message?: string }> {
    if (this.isSyncing || !this.getIsOnline()) {
      return {
        success: false,
        message: !this.getIsOnline()
          ? 'Perangkat sedang offline. Transaksi tersimpan aman di IndexedDB lokal.'
          : 'Sinkronisasi Cloud sedang berlangsung...',
      };
    }

    try {
      this.isSyncing = true;
      await this.notify();

      // Check pending count
      const pendingCount = await this.getPendingCount();
      if (pendingCount === 0) {
        this.lastSyncMessage = 'Seluruh data lokal telah tersinkronisasi ke Cloud Firestore.';
        return { success: true, message: this.lastSyncMessage };
      }

      // Sync to Cloud Firestore
      const syncResult = await syncAllToFirestore();

      this.lastSyncMessage = `Berhasil sinkronisasi otomatis! ${syncResult.syncedCounts.sales} penjualan & ${syncResult.syncedCounts.products} produk tersimpan di Cloud Firestore.`;

      // Record in audit log
      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: 'SYNC_DAEMON',
        userName: 'Sistem Sinkronisasi Cloud',
        action: 'AUTO_SYNC_SUCCESS',
        category: 'SYNC',
        details: this.lastSyncMessage,
      });

      return {
        success: true,
        message: this.lastSyncMessage,
      };
    } catch (err: any) {
      console.warn('Auto sync warning:', err);
      this.lastSyncMessage = err?.message || 'Gagal sinkronisasi ke Cloud Firestore';
      return { success: false, message: this.lastSyncMessage };
    } finally {
      this.isSyncing = false;
      await this.notify();
    }
  }
}

export const syncManager = new SyncManager();

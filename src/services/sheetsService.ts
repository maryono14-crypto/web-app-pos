import { getAccessToken, clearAuthSession, googleSignIn } from './auth';
import { db } from '../db/indexedDB';

export interface SheetDefinition {
  title: string;
  headers: string[];
}

export const REQUIRED_SHEETS: SheetDefinition[] = [
  {
    title: 'pengaturan_sistem',
    headers: [
      'key',
      'store_name',
      'address',
      'phone',
      'costing_method',
      'tax_enabled',
      'tax_rate_percent',
      'default_receipt_width',
      'updated_at',
    ],
  },
  {
    title: 'pengguna',
    headers: ['user_id', 'nama', 'email', 'role', 'status_aktif'],
  },
  {
    title: 'master_kategori',
    headers: ['kategori_id', 'nama_kategori', 'icon'],
  },
  {
    title: 'master_supplier',
    headers: ['supplier_id', 'nama_supplier', 'kontak', 'telepon', 'email', 'alamat'],
  },
  {
    title: 'master_produk',
    headers: [
      'produk_id',
      'sku',
      'barcode',
      'nama_produk',
      'kategori_id',
      'satuan',
      'harga_beli_referensi',
      'harga_jual',
      'stok_minimum',
      'stok_saat_ini',
      'hpp_average',
      'status_aktif',
      'updated_at',
    ],
  },
  {
    title: 'pelanggan_member',
    headers: [
      'pelanggan_id',
      'nama_lengkap',
      'telepon',
      'email',
      'tier',
      'saldo_poin',
      'total_belanja',
      'total_kunjungan',
      'terdaftar_pada',
    ],
  },
  {
    title: 'transaksi_penjualan',
    headers: [
      'transaksi_id',
      'nomor_struk',
      'waktu_transaksi',
      'kasir_id',
      'kasir_nama',
      'pelanggan',
      'subtotal',
      'diskon',
      'pajak',
      'grand_total',
      'jumlah_bayar',
      'kembalian',
      'status',
      'metode_pembayaran_utama',
      'sync_id',
      'created_at',
    ],
  },
  {
    title: 'detail_penjualan',
    headers: [
      'detail_id',
      'transaksi_id',
      'produk_id',
      'sku_snapshot',
      'nama_snapshot',
      'qty',
      'harga_jual',
      'diskon_item',
      'hpp_total',
      'subtotal',
    ],
  },
  {
    title: 'pembelian',
    headers: [
      'pembelian_id',
      'nomor_po',
      'supplier_id',
      'supplier_nama',
      'tanggal',
      'tanggal_terima',
      'status',
      'total_biaya',
      'biaya_tambahan',
      'catatan',
      'dibuat_oleh',
      'created_at',
    ],
  },
  {
    title: 'detail_pembelian',
    headers: [
      'detail_id',
      'pembelian_id',
      'produk_id',
      'sku',
      'nama_produk',
      'unit',
      'qty_pesan',
      'qty_terima',
      'harga_per_unit',
      'subtotal',
    ],
  },
  {
    title: 'log_inventaris',
    headers: [
      'log_id',
      'produk_id',
      'sku',
      'nama_produk',
      'waktu_posting',
      'tipe_transaksi',
      'qty_masuk',
      'qty_keluar',
      'saldo_akhir',
      'nilai_biaya',
      'referensi_id',
      'pengguna_id',
      'pengguna_nama',
      'catatan',
    ],
  },
  {
    title: 'fifo_batches',
    headers: [
      'batch_id',
      'produk_id',
      'referensi_penerimaan',
      'tanggal_masuk',
      'qty_awal',
      'qty_sisa',
      'biaya_per_unit',
      'status',
    ],
  },
  {
    title: 'stok_aktual_average',
    headers: ['produk_id', 'sku', 'nama_produk', 'qty_on_hand', 'nilai_persediaan', 'biaya_rata_rata', 'updated_at'],
  },
  {
    title: 'pengeluaran',
    headers: [
      'pengeluaran_id',
      'timestamp',
      'kategori',
      'kategori_label',
      'jumlah',
      'keterangan',
      'penerima',
      'user_nama',
    ],
  },
  {
    title: 'shift_kasir',
    headers: [
      'shift_id',
      'kasir_id',
      'kasir_nama',
      'buka',
      'tutup',
      'modal_awal',
      'kas_diharapkan',
      'kas_aktual',
      'selisih',
      'total_penjualan_tunai',
      'total_non_tunai',
      'total_transaksi',
      'status',
    ],
  },
  {
    title: 'audit_log',
    headers: ['log_id', 'timestamp', 'user_id', 'user_nama', 'aksi', 'kategori', 'rincian'],
  },
];

/**
 * Robust API fetch wrapper that detects 401/403 connection drop and notifies listeners
 */
export async function sheetsApiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    clearAuthSession();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('google-sheets-connection-lost', {
          detail: { reason: 'NO_TOKEN', message: 'Sesi Google telah terputus.' },
        })
      );
    }
    throw new Error('Sambungan Google Sheets terputus. Silakan klik tombol "Hubungkan Ulang" untuk memperbarui sesi login.');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
      clearAuthSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('google-sheets-connection-lost', {
            detail: { reason: 'EXPIRED', message: 'Token akses Google OAuth telah kadaluarsa.' },
          })
        );
      }
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson?.error?.message || 'Token Google kadaluarsa';
      throw new Error(`Sambungan Google Sheets terputus (${msg}). Silakan klik "Hubungkan Ulang" untuk login kembali.`);
    }

    return response;
  } catch (err: any) {
    if (err.message && err.message.includes('Sambungan Google Sheets terputus')) {
      throw err;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Jaringan internet sedang terputus (Offline). Transaksi tersimpan aman di database lokal IndexedDB.');
    }
    throw err;
  }
}

/**
 * Test live Google Sheets connection
 */
export async function testGoogleSheetsConnection(spreadsheetIdToTest?: string): Promise<{
  success: boolean;
  message: string;
  spreadsheetTitle?: string;
  sheetCount?: number;
  latencyMs?: number;
  isAuthExpired?: boolean;
}> {
  const startTime = Date.now();
  const token = await getAccessToken();

  if (!token) {
    return {
      success: false,
      isAuthExpired: true,
      message: 'Belum ada akun Google terautentikasi atau token telah kadaluarsa. Silakan hubungkan ulang.',
    };
  }

  const settings = await db.settings.get('current_config');
  const targetId = spreadsheetIdToTest || settings?.spreadsheetId;

  if (!targetId) {
    return {
      success: false,
      message: 'Belum ada ID Spreadsheet Google Sheets yang dipilih.',
    };
  }

  try {
    const res = await sheetsApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetId}?fields=properties.title,sheets.properties.title`
    );

    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          message: 'Spreadsheet tidak ditemukan di Google Drive akun Anda (Pastikan ID benar dan izin dibuka).',
        };
      }
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        message: errData?.error?.message || `Gagal menghubungi Google Sheets (HTTP ${res.status})`,
      };
    }

    const data = await res.json();
    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      spreadsheetTitle: data.properties?.title || 'Google Spreadsheet',
      sheetCount: data.sheets?.length || 0,
      latencyMs,
      message: `Koneksi Google Sheets prima! Terhubung ke "${data.properties?.title}" (${latencyMs}ms)`,
    };
  } catch (err: any) {
    const isAuth = err.message?.includes('terputus') || err.message?.includes('kadaluarsa');
    return {
      success: false,
      isAuthExpired: isAuth,
      message: err?.message || 'Gagal menghubungi Google Sheets.',
    };
  }
}

/**
 * Reconnect to Google Sheets by logging in and verifying connection
 */
export async function reconnectGoogleSheets(): Promise<{ success: boolean; message: string }> {
  try {
    const loginResult = await googleSignIn();
    if (!loginResult) {
      return { success: false, message: 'Login Google dibatalkan.' };
    }

    const settings = await db.settings.get('current_config');
    if (settings?.spreadsheetId) {
      // Test link to existing spreadsheet
      const test = await testGoogleSheetsConnection(settings.spreadsheetId);
      if (test.success) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('google-sheets-reconnected', { detail: { spreadsheetId: settings.spreadsheetId } }));
        }
        return { success: true, message: `Berhasil tersambung kembali ke Google Sheets: ${test.spreadsheetTitle}!` };
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('google-sheets-reconnected', { detail: {} }));
    }
    return { success: true, message: `Akun Google ${loginResult.user.email} berhasil terhubung!` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menyambungkan kembali ke Google Sheets.' };
  }
}

/**
 * Disconnect current spreadsheet from system settings
 */
export async function disconnectSpreadsheet(): Promise<void> {
  const settings = await db.settings.get('current_config');
  if (settings) {
    await db.settings.put({
      ...settings,
      spreadsheetId: undefined,
      spreadsheetUrl: undefined,
    });
  }
}

/**
 * Link an existing Google Spreadsheet by full URL or ID
 */
export async function linkExistingSpreadsheet(urlOrId: string): Promise<{ success: boolean; title: string; id: string; url: string }> {
  const trimmed = urlOrId.trim();
  let spreadsheetId = trimmed;

  // Extract ID from full Google Sheets URL
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    spreadsheetId = match[1];
  }

  if (!spreadsheetId || spreadsheetId.length < 15) {
    throw new Error('ID Spreadsheet tidak valid. Pastikan format URL atau ID Google Sheets sesuai.');
  }

  // Test access to this spreadsheet
  const test = await testGoogleSheetsConnection(spreadsheetId);
  if (!test.success) {
    throw new Error(test.message || 'Gagal mengakses spreadsheet tersebut. Pastikan Anda telah login dengan akun Google pemilik file.');
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Save to settings
  const settings = await db.settings.get('current_config');
  if (settings) {
    await db.settings.put({
      ...settings,
      spreadsheetId,
      spreadsheetUrl,
      lastSyncTime: new Date().toISOString(),
    });
  }

  return {
    success: true,
    title: test.spreadsheetTitle || 'Google Spreadsheet',
    id: spreadsheetId,
    url: spreadsheetUrl,
  };
}

/**
 * Create a new Google Spreadsheet with all required PRD sheets
 */
export async function createGoogleSpreadsheet(
  title: string = 'Integrated POS & Business Intelligence'
): Promise<{ id: string; url: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Anda belum login dengan Akun Google. Silakan klik tombol "Hubungkan Akun Google" terlebih dahulu.');
  }

  const body = {
    properties: {
      title,
    },
    sheets: REQUIRED_SHEETS.map((s) => ({
      properties: {
        title: s.title,
        gridProperties: {
          rowCount: 500,
          columnCount: s.headers.length + 3,
          frozenRowCount: 1,
        },
      },
    })),
  };

  const response = await sheetsApiFetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gagal membuat Google Spreadsheet (HTTP ${response.status})`);
  }

  const result = await response.json();
  const spreadsheetId = result.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Populate headers in all sheets
  const headerData = REQUIRED_SHEETS.map((s) => ({
    range: `${s.title}!A1:${String.fromCharCode(64 + s.headers.length)}1`,
    values: [s.headers],
  }));

  await sheetsApiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: headerData,
    }),
  });

  // Save spreadsheet ID to settings
  const settings = await db.settings.get('current_config');
  if (settings) {
    await db.settings.put({
      ...settings,
      spreadsheetId,
      spreadsheetUrl,
      lastSyncTime: new Date().toISOString(),
    });
  }

  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Synchronize all local IndexedDB data to Google Sheets
 */
export async function syncAllToGoogleSheets(): Promise<{ success: boolean; syncedCounts: Record<string, number> }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autentikasi Google diperlukan. Silakan klik "Hubungkan Ulang" untuk login Google.');
  }

  const settings = await db.settings.get('current_config');
  let spreadsheetId = settings?.spreadsheetId;

  if (!spreadsheetId) {
    const created = await createGoogleSpreadsheet(`${settings?.storeName || 'Toko Berkah'} - POS Database`);
    spreadsheetId = created.id;
  }

  // Gather current tables
  const [
    products,
    categories,
    suppliers,
    users,
    customers,
    sales,
    fifoBatches,
    logs,
    purchases,
    expenses,
    shifts,
    audits,
  ] = await Promise.all([
    db.products.toArray(),
    db.categories.toArray(),
    db.suppliers.toArray(),
    db.users.toArray(),
    db.customers.toArray(),
    db.sales.toArray(),
    db.fifoBatches.toArray(),
    db.inventoryLogs.toArray(),
    db.purchases.toArray(),
    db.expenses.toArray(),
    db.shifts.toArray(),
    db.auditLogs.toArray(),
  ]);

  // Transform to rows matching sheet headers
  const productRows = products.map((p) => [
    p.id,
    p.sku,
    p.barcode,
    p.name,
    p.categoryId,
    p.unit,
    p.costPrice,
    p.sellingPrice,
    p.minStock,
    p.currentStock,
    p.avgCostPrice,
    p.active ? 'AKTIF' : 'NONAKTIF',
    p.updatedAt,
  ]);

  const categoryRows = categories.map((c) => [c.id, c.name, c.icon || '']);
  const supplierRows = suppliers.map((s) => [s.id, s.name, s.contactPerson, s.phone, s.email, s.address]);
  const userRows = users.map((u) => [u.id, u.name, u.email, u.role, u.active ? 'AKTIF' : 'NONAKTIF']);

  const customerRows = customers.map((c) => [
    c.id,
    c.name,
    c.phone,
    c.email || '-',
    c.tier,
    c.pointsBalance || 0,
    c.totalSpend || 0,
    c.totalVisits || 0,
    c.createdAt,
  ]);

  const salesRows = sales.map((s) => [
    s.id,
    s.receiptNo,
    s.timestamp,
    s.cashierId,
    s.cashierName,
    s.customerName || '-',
    s.subtotal,
    s.orderDiscount,
    s.taxAmount,
    s.grandTotal,
    s.paidAmount,
    s.changeAmount,
    s.status,
    s.paymentMethod,
    s.idempotencyKey,
    s.createdAt,
  ]);

  const saleDetailRows: (string | number)[][] = [];
  sales.forEach((s) => {
    s.items.forEach((item) => {
      saleDetailRows.push([
        item.id,
        s.id,
        item.productId,
        item.skuSnapshot,
        item.nameSnapshot,
        item.qty,
        item.sellingPrice,
        item.discountItem,
        item.hppTotal,
        item.subtotal,
      ]);
    });
  });

  const purchaseRows = purchases.map((p) => [
    p.id,
    p.purchaseNo,
    p.supplierId,
    p.supplierName,
    p.date,
    p.receivedDate || '-',
    p.status,
    p.totalAmount,
    p.additionalCost,
    p.notes || '-',
    p.createdBy,
    p.createdAt,
  ]);

  const purchaseDetailRows: (string | number)[][] = [];
  purchases.forEach((p) => {
    p.items.forEach((item, idx) => {
      purchaseDetailRows.push([
        `${p.id}-${idx}`,
        p.id,
        item.productId,
        item.sku,
        item.name,
        item.unit,
        item.qtyOrdered,
        item.qtyReceived,
        item.costPerUnit,
        item.subtotal,
      ]);
    });
  });

  const logRows = logs.map((l) => [
    l.id,
    l.productId,
    l.sku,
    l.productName,
    l.timestamp,
    l.type,
    l.qtyIn,
    l.qtyOut,
    l.balanceAfter,
    l.costValue,
    l.referenceId,
    l.userId,
    l.userName,
    l.note || '-',
  ]);

  const batchRows = fifoBatches.map((b) => [
    b.id,
    b.productId,
    b.purchaseRefId,
    b.dateReceived,
    b.initialQty,
    b.remainingQty,
    b.costPerUnit,
    b.status,
  ]);

  const avgStockRows = products.map((p) => [
    p.id,
    p.sku,
    p.name,
    p.currentStock,
    p.currentStock * (p.avgCostPrice || p.costPrice),
    p.avgCostPrice || p.costPrice,
    p.updatedAt,
  ]);

  const expenseRows = expenses.map((e) => [
    e.id,
    e.timestamp,
    e.category,
    e.categoryLabel,
    e.amount,
    e.description,
    e.recipient || '-',
    e.userName,
  ]);

  const shiftRows = shifts.map((sh) => [
    sh.id,
    sh.cashierId,
    sh.cashierName,
    sh.openedAt,
    sh.closedAt || '-',
    sh.startingCash,
    sh.expectedEndingCash,
    sh.actualEndingCash ?? '-',
    sh.cashDifference ?? '-',
    sh.totalSalesCash,
    sh.totalSalesNonCash,
    sh.totalTransactions,
    sh.status,
  ]);

  const auditRows = audits.map((a) => [a.id, a.timestamp, a.userId, a.userName, a.action, a.category, a.details]);

  const settingRows = [
    [
      'app_config',
      settings?.storeName || '',
      settings?.storeAddress || '',
      settings?.storePhone || '',
      settings?.costingMethod || 'FIFO',
      settings?.taxEnabled ? 'TRUE' : 'FALSE',
      settings?.taxRatePercent || 11,
      settings?.defaultReceiptWidth || '58mm',
      new Date().toISOString(),
    ],
  ];

  // Batch update payloads
  const payloadData = [
    { range: 'pengaturan_sistem!A2:I' + (settingRows.length + 1), values: settingRows },
    { range: 'pengguna!A2:E' + (userRows.length + 1), values: userRows },
    { range: 'master_kategori!A2:C' + (categoryRows.length + 1), values: categoryRows },
    { range: 'master_supplier!A2:F' + (supplierRows.length + 1), values: supplierRows },
    { range: 'master_produk!A2:M' + (productRows.length + 1), values: productRows },
    { range: 'pelanggan_member!A2:I' + (customerRows.length + 1), values: customerRows },
    { range: 'transaksi_penjualan!A2:P' + (salesRows.length + 1), values: salesRows },
    { range: 'detail_penjualan!A2:J' + (saleDetailRows.length + 1), values: saleDetailRows },
    { range: 'pembelian!A2:L' + (purchaseRows.length + 1), values: purchaseRows },
    { range: 'detail_pembelian!A2:J' + (purchaseDetailRows.length + 1), values: purchaseDetailRows },
    { range: 'log_inventaris!A2:N' + (logRows.length + 1), values: logRows },
    { range: 'fifo_batches!A2:H' + (batchRows.length + 1), values: batchRows },
    { range: 'stok_aktual_average!A2:G' + (avgStockRows.length + 1), values: avgStockRows },
    { range: 'pengeluaran!A2:H' + (expenseRows.length + 1), values: expenseRows },
    { range: 'shift_kasir!A2:M' + (shiftRows.length + 1), values: shiftRows },
    { range: 'audit_log!A2:G' + (auditRows.length + 1), values: auditRows },
  ].filter((p) => p.values.length > 0);

  const res = await sheetsApiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: payloadData,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal menulis data ke Google Sheets (HTTP ${res.status})`);
  }

  // Update sales syncStatus to SYNCED
  await db.sales.where('syncStatus').equals('PENDING').modify({ syncStatus: 'SYNCED' });

  // Update last sync time
  if (settings) {
    await db.settings.put({
      ...settings,
      lastSyncTime: new Date().toISOString(),
    });
  }

  return {
    success: true,
    syncedCounts: {
      produk: productRows.length,
      penjualan: salesRows.length,
      log_inventaris: logRows.length,
      batches: batchRows.length,
      pengeluaran: expenseRows.length,
    },
  };
}

import pptxgen from 'pptxgenjs';
import { Customer, Product, Sale, Category } from '../types';

/**
 * Utility to download CSV with UTF-8 BOM so Excel opens it with proper Indonesian formatting
 */
export const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const escapeCsv = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent =
    '\uFEFF' +
    [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * 1. Export Sales Transactions to CSV
 */
export const exportSalesToCsv = (sales: Sale[], dateRangeLabel = 'Semua') => {
  const headers = [
    'No. Struk',
    'Tanggal & Waktu',
    'Status',
    'Metode Pembayaran',
    'Kasir',
    'Pelanggan / Member',
    'ID Member',
    'Jumlah Item',
    'Rincian Produk',
    'Subtotal (Rp)',
    'Diskon Transaksi (Rp)',
    'Diskon Poin Member (Rp)',
    'Poin Didapat',
    'Poin Ditukar',
    'Pajak (Rp)',
    'Total Akhir (Rp)',
    'Uang Dibayar (Rp)',
    'Kembalian (Rp)',
    'Catatan',
  ];

  const rows = sales.map((s) => {
    const itemsSummary = s.items
      .map((i) => `${i.nameSnapshot} (x${i.qty} @Rp${i.sellingPrice.toLocaleString('id-ID')})`)
      .join(' | ');

    return [
      s.receiptNo,
      new Date(s.timestamp).toLocaleString('id-ID'),
      s.status,
      s.paymentMethod,
      s.cashierName || '-',
      s.customerName || (s.customerId ? 'Member' : 'Umum'),
      s.customerId || '-',
      s.items.reduce((sum, i) => sum + i.qty, 0),
      itemsSummary,
      s.subtotal,
      s.orderDiscount || 0,
      s.pointsDiscountAmount || 0,
      s.pointsEarned || 0,
      s.pointsRedeemed || 0,
      s.taxAmount || 0,
      s.grandTotal,
      s.paidAmount || s.grandTotal,
      s.changeAmount || 0,
      s.notes || '-',
    ];
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`Laporan_Penjualan_${dateRangeLabel}_${dateStr}.csv`, headers, rows);
};

/**
 * 2. Export Inventory Master & Stock Valuation to CSV
 */
export const exportInventoryToCsv = (products: Product[], categories: Category[]) => {
  const categoryMap = new Map<string, string>();
  categories.forEach((c) => categoryMap.set(c.id, c.name));

  const headers = [
    'SKU',
    'Barcode',
    'Nama Produk',
    'Kategori',
    'Stok Saat Ini',
    'Stok Minimum',
    'Status Stok',
    'Satuan',
    'Harga Beli Pokok / HPP (Rp)',
    'Harga Jual (Rp)',
    'Estimasi Margin (%)',
    'Total Nilai Aset Stok (Rp)',
    'Status Produk',
  ];

  const rows = products.map((p) => {
    const hpp = p.avgCostPrice || p.costPrice || 0;
    const margin = p.sellingPrice > 0 ? (((p.sellingPrice - hpp) / p.sellingPrice) * 100).toFixed(1) : '0.0';
    const totalAsset = p.currentStock * hpp;
    const minAlert = p.minStock || 5;
    const stockStatus =
      p.currentStock <= 0
        ? 'HABIS'
        : p.currentStock <= minAlert
        ? 'MENIPIS'
        : 'AMAN';

    return [
      p.sku,
      p.barcode || '-',
      p.name,
      categoryMap.get(p.categoryId) || 'Lainnya',
      p.currentStock,
      minAlert,
      stockStatus,
      p.unit || 'pcs',
      hpp,
      p.sellingPrice,
      `${margin}%`,
      totalAsset,
      p.active ? 'Aktif' : 'Non-Aktif',
    ];
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`Laporan_Inventaris_Valuasi_Stok_${dateStr}.csv`, headers, rows);
};

/**
 * 3. Export Customer & Loyalty Points to CSV
 */
export const exportLoyaltyToCsv = (customers: Customer[]) => {
  const headers = [
    'ID Pelanggan',
    'Nama Lengkap',
    'No. Handphone / WhatsApp',
    'Email',
    'Tier Keanggotaan',
    'Saldo Poin Saat Ini',
    'Total Belanja Akumulasi (Rp)',
    'Total Kunjungan',
    'Tanggal Terdaftar',
  ];

  const rows = customers.map((c) => [
    c.id,
    c.name,
    c.phone || '-',
    c.email || '-',
    c.tier,
    c.pointsBalance || 0,
    c.totalSpend || 0,
    c.totalVisits || 0,
    c.createdAt ? new Date(c.createdAt).toLocaleDateString('id-ID') : '-',
  ]);

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`Laporan_Loyalitas_Member_${dateStr}.csv`, headers, rows);
};

/**
 * 4. Generate Executive PowerPoint Presentation (.pptx)
 */
export interface PPTReportData {
  storeName: string;
  storeAddress?: string;
  periodLabel: string;
  metrics: {
    netRevenue: number;
    totalHpp: number;
    grossProfit: number;
    grossMargin: number;
    transactionCount: number;
    averageBasket: number;
    totalExpenses: number;
    netOperatingProfit: number;
    totalValuation: number;
    inventoryTurnover: string;
  };
  topProducts: { name: string; qty: number; revenue: number; profit: number }[];
  categoryBreakdown: { name: string; revenue: number; profit: number }[];
  customerStats: {
    totalMembers: number;
    bronzeCount: number;
    silverCount: number;
    goldCount: number;
    platinumCount: number;
    totalPointsIssued: number;
    totalPointsRedeemed: number;
  };
  paymentBreakdown: { method: string; count: number; total: number }[];
  lowStockItems: { name: string; stock: number; minStock: number }[];
}

export const generateExecutivePPT = async (data: PPTReportData) => {
  const pptx = new pptxgen();

  // Configure presentation properties
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = `${data.storeName} - Executive BI Performance Deck`;
  pptx.company = data.storeName;
  pptx.subject = 'Executive Sales, Inventory & Loyalty Review';

  const BRAND_DARK = '0F172A'; // Slate-900
  const BRAND_EMERALD = '059669'; // Emerald-600
  const BRAND_LIGHT_BG = 'F8FAFC'; // Slate-50
  const BRAND_GRAY = '64748B'; // Slate-500
  const BRAND_WHITE = 'FFFFFF';
  const BRAND_GOLD = 'D97706'; // Amber-600

  // -------------------------------------------------------------
  // SLIDE 1: Title & Executive Cover
  // -------------------------------------------------------------
  const slide1 = pptx.addSlide();
  slide1.background = { color: BRAND_DARK };

  // Decorative accent line
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0.8,
    y: 1.2,
    w: 0.15,
    h: 4.8,
    fill: { color: BRAND_EMERALD },
  });

  slide1.addText('LAPORAN EKSEKUTIF BISNIS & RETAIL', {
    x: 1.2,
    y: 1.3,
    w: 11,
    h: 0.4,
    fontSize: 14,
    fontFace: 'Arial',
    color: BRAND_EMERALD,
    bold: true,
    charSpacing: 2,
  });

  slide1.addText(data.storeName, {
    x: 1.2,
    y: 1.8,
    w: 11.5,
    h: 1.2,
    fontSize: 34,
    fontFace: 'Arial',
    color: BRAND_WHITE,
    bold: true,
  });

  slide1.addText(`Analisis Tren Penjualan, Valuasi Stok, dan Performa Loyalitas Member`, {
    x: 1.2,
    y: 3.1,
    w: 11,
    h: 0.6,
    fontSize: 16,
    fontFace: 'Arial',
    color: '94A3B8',
  });

  // Period & Meta Card
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 1.2,
    y: 4.2,
    w: 8.5,
    h: 1.8,
    rectRadius: 0.1,
    fill: { color: '1E293B' },
    line: { color: '334155', width: 1 },
  });

  slide1.addText(
    [
      { text: `Periode Analisis: `, options: { bold: true, color: 'CBD5E1' } },
      { text: `${data.periodLabel}\n`, options: { bold: false, color: BRAND_WHITE } },
      { text: `Lokasi Toko: `, options: { bold: true, color: 'CBD5E1' } },
      { text: `${data.storeAddress || 'Pusat Operasional'}\n`, options: { bold: false, color: BRAND_WHITE } },
      { text: `Dibuat Pada: `, options: { bold: true, color: 'CBD5E1' } },
      { text: `${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`, options: { bold: false, color: BRAND_WHITE } },
    ],
    {
      x: 1.5,
      y: 4.4,
      w: 8.0,
      h: 1.4,
      fontSize: 13,
      fontFace: 'Arial',
      lineSpacing: 22,
    }
  );

  // -------------------------------------------------------------
  // SLIDE 2: Executive Financial Summary (KPIs)
  // -------------------------------------------------------------
  const slide2 = pptx.addSlide();
  slide2.background = { color: BRAND_LIGHT_BG };

  slide2.addText('RINGKASAN EKSEKUTIF KEUANGAN', {
    x: 0.8,
    y: 0.5,
    w: 8,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: BRAND_EMERALD,
    bold: true,
  });
  slide2.addText('Performa Finansial & Profitabilitas', {
    x: 0.8,
    y: 0.8,
    w: 10,
    h: 0.5,
    fontSize: 22,
    fontFace: 'Arial',
    color: BRAND_DARK,
    bold: true,
  });

  // KPI Card 1: Omzet Bersih
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 1.5,
    w: 2.7,
    h: 1.8,
    rectRadius: 0.1,
    fill: { color: BRAND_WHITE },
    line: { color: 'E2E8F0', width: 1 },
  });
  slide2.addText('OMZET BERSIH', { x: 1.0, y: 1.7, w: 2.3, h: 0.3, fontSize: 10, color: BRAND_GRAY, bold: true });
  slide2.addText(`Rp ${data.metrics.netRevenue.toLocaleString('id-ID')}`, {
    x: 1.0,
    y: 2.0,
    w: 2.3,
    h: 0.6,
    fontSize: 18,
    bold: true,
    color: BRAND_EMERALD,
  });
  slide2.addText(`${data.metrics.transactionCount} Transaksi Selesai`, {
    x: 1.0,
    y: 2.7,
    w: 2.3,
    h: 0.3,
    fontSize: 10,
    color: BRAND_GRAY,
  });

  // KPI Card 2: HPP (Harga Pokok Penjualan)
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 3.75,
    y: 1.5,
    w: 2.7,
    h: 1.8,
    rectRadius: 0.1,
    fill: { color: BRAND_WHITE },
    line: { color: 'E2E8F0', width: 1 },
  });
  slide2.addText('TOTAL BEBAN POKOK (HPP)', { x: 3.95, y: 1.7, w: 2.3, h: 0.3, fontSize: 10, color: BRAND_GRAY, bold: true });
  slide2.addText(`Rp ${data.metrics.totalHpp.toLocaleString('id-ID')}`, {
    x: 3.95,
    y: 2.0,
    w: 2.3,
    h: 0.6,
    fontSize: 18,
    bold: true,
    color: '7C3AED',
  });
  slide2.addText('Biaya perolehan stok terjual', {
    x: 3.95,
    y: 2.7,
    w: 2.3,
    h: 0.3,
    fontSize: 10,
    color: BRAND_GRAY,
  });

  // KPI Card 3: Laba Kotor
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 6.7,
    y: 1.5,
    w: 2.7,
    h: 1.8,
    rectRadius: 0.1,
    fill: { color: 'ECFDF5' },
    line: { color: 'A7F3D0', width: 1 },
  });
  slide2.addText('LABA KOTOR BISNIS', { x: 6.9, y: 1.7, w: 2.3, h: 0.3, fontSize: 10, color: BRAND_EMERALD, bold: true });
  slide2.addText(`Rp ${data.metrics.grossProfit.toLocaleString('id-ID')}`, {
    x: 6.9,
    y: 2.0,
    w: 2.3,
    h: 0.6,
    fontSize: 18,
    bold: true,
    color: '065F46',
  });
  slide2.addText(`Gross Margin: ${data.metrics.grossMargin.toFixed(1)}%`, {
    x: 6.9,
    y: 2.7,
    w: 2.3,
    h: 0.3,
    fontSize: 10,
    bold: true,
    color: BRAND_EMERALD,
  });

  // KPI Card 4: Laba Bersih Operasional
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 9.65,
    y: 1.5,
    w: 2.8,
    h: 1.8,
    rectRadius: 0.1,
    fill: { color: BRAND_WHITE },
    line: { color: 'E2E8F0', width: 1 },
  });
  slide2.addText('LABA BERSIH OPERASIONAL', { x: 9.85, y: 1.7, w: 2.4, h: 0.3, fontSize: 10, color: BRAND_GRAY, bold: true });
  slide2.addText(`Rp ${data.metrics.netOperatingProfit.toLocaleString('id-ID')}`, {
    x: 9.85,
    y: 2.0,
    w: 2.4,
    h: 0.6,
    fontSize: 18,
    bold: true,
    color: data.metrics.netOperatingProfit >= 0 ? BRAND_DARK : 'DC2626',
  });
  slide2.addText(`Beban Operasional: Rp ${data.metrics.totalExpenses.toLocaleString('id-ID')}`, {
    x: 9.85,
    y: 2.7,
    w: 2.4,
    h: 0.3,
    fontSize: 10,
    color: BRAND_GRAY,
  });

  // Secondary Table: Detailed Breakdown
  const summaryTableRows: any[] = [
    [
      { text: 'Indikator Kinerja Utama', options: { bold: true, fill: { color: 'F1F5F9' } } },
      { text: 'Nilai Terhitung', options: { bold: true, fill: { color: 'F1F5F9' } } },
      { text: 'Keterangan Analisis', options: { bold: true, fill: { color: 'F1F5F9' } } },
    ],
    ['Rata-Rata Belanja (Basket Size)', `Rp ${data.metrics.averageBasket.toLocaleString('id-ID')}`, 'Rata-rata belanja bersih per struk'],
    ['Total Valuasi Nilai Stok Toko', `Rp ${data.metrics.totalValuation.toLocaleString('id-ID')}`, 'Total modal stok yang tersimpan di gudang'],
    ['Rasio Perputaran Stok (Turnover)', `${data.metrics.inventoryTurnover}x`, 'Kecepatan perputaran stok barang retail'],
    ['Beban Operasional Toko', `Rp ${data.metrics.totalExpenses.toLocaleString('id-ID')}`, 'Gaji, listrik, sewa, & logistik'],
  ];

  slide2.addTable(summaryTableRows, {
    x: 0.8,
    y: 3.6,
    w: 11.65,
    h: 2.8,
    fontSize: 11,
    color: BRAND_DARK,
    border: { pt: 0.5, color: 'CBD5E1' },
    align: 'left',
  });

  // -------------------------------------------------------------
  // SLIDE 3: Top Selling Products & Category Contribution
  // -------------------------------------------------------------
  const slide3 = pptx.addSlide();
  slide3.background = { color: BRAND_LIGHT_BG };

  slide3.addText('ANALISIS PRODUK & KATEGORI', {
    x: 0.8,
    y: 0.5,
    w: 8,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: BRAND_EMERALD,
    bold: true,
  });
  slide3.addText('Produk Terlaris & Kontribusi Omzet Kategori', {
    x: 0.8,
    y: 0.8,
    w: 10,
    h: 0.5,
    fontSize: 22,
    fontFace: 'Arial',
    color: BRAND_DARK,
    bold: true,
  });

  // Left Column: Top 5 Products Table
  slide3.addText('Top 5 Produk Berdasarkan Volume & Omzet', {
    x: 0.8,
    y: 1.5,
    w: 6.0,
    h: 0.35,
    fontSize: 13,
    bold: true,
    color: BRAND_DARK,
  });

  const topProductRows: any[] = [
    [
      { text: 'Nama Produk', options: { bold: true, fill: { color: 'E2E8F0' } } },
      { text: 'Terjual', options: { bold: true, fill: { color: 'E2E8F0' }, align: 'center' } },
      { text: 'Total Omzet (Rp)', options: { bold: true, fill: { color: 'E2E8F0' }, align: 'right' } },
      { text: 'Laba Kotor (Rp)', options: { bold: true, fill: { color: 'E2E8F0' }, align: 'right' } },
    ],
    ...data.topProducts.slice(0, 5).map((p) => [
      p.name,
      { text: `${p.qty} pcs`, options: { align: 'center' } },
      { text: `Rp ${p.revenue.toLocaleString('id-ID')}`, options: { align: 'right' } },
      { text: `Rp ${p.profit.toLocaleString('id-ID')}`, options: { align: 'right', bold: true, color: BRAND_EMERALD } },
    ]),
  ];

  slide3.addTable(topProductRows, {
    x: 0.8,
    y: 1.9,
    w: 6.0,
    h: 3.5,
    fontSize: 10.5,
    border: { pt: 0.5, color: 'CBD5E1' },
  });

  // Right Column: Category Breakdown
  slide3.addText('Kontribusi Omzet per Kategori Produk', {
    x: 7.2,
    y: 1.5,
    w: 5.2,
    h: 0.35,
    fontSize: 13,
    bold: true,
    color: BRAND_DARK,
  });

  const categoryRows: any[] = [
    [
      { text: 'Kategori', options: { bold: true, fill: { color: 'E2E8F0' } } },
      { text: 'Omzet (Rp)', options: { bold: true, fill: { color: 'E2E8F0' }, align: 'right' } },
      { text: 'Pangsa', options: { bold: true, fill: { color: 'E2E8F0' }, align: 'center' } },
    ],
    ...data.categoryBreakdown.slice(0, 6).map((c) => {
      const share = data.metrics.netRevenue > 0 ? ((c.revenue / data.metrics.netRevenue) * 100).toFixed(1) : '0';
      return [
        c.name,
        { text: `Rp ${c.revenue.toLocaleString('id-ID')}`, options: { align: 'right' } },
        { text: `${share}%`, options: { align: 'center', bold: true } },
      ];
    }),
  ];

  slide3.addTable(categoryRows, {
    x: 7.2,
    y: 1.9,
    w: 5.25,
    h: 3.5,
    fontSize: 10.5,
    border: { pt: 0.5, color: 'CBD5E1' },
  });

  // -------------------------------------------------------------
  // SLIDE 4: Customer Loyalty & Membership Performance
  // -------------------------------------------------------------
  const slide4 = pptx.addSlide();
  slide4.background = { color: BRAND_LIGHT_BG };

  slide4.addText('PROGRAM LOYALITAS & PELANGGAN', {
    x: 0.8,
    y: 0.5,
    w: 8,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: BRAND_EMERALD,
    bold: true,
  });
  slide4.addText('Pertumbuhan Member & Penebusan Poin', {
    x: 0.8,
    y: 0.8,
    w: 10,
    h: 0.5,
    fontSize: 22,
    fontFace: 'Arial',
    color: BRAND_DARK,
    bold: true,
  });

  // Member Tier Cards
  const tierCards = [
    { name: 'Bronze', count: data.customerStats.bronzeCount, color: 'B45309', bg: 'FEF3C7', border: 'FDE68A' },
    { name: 'Silver', count: data.customerStats.silverCount, color: '475569', bg: 'F1F5F9', border: 'CBD5E1' },
    { name: 'Gold', count: data.customerStats.goldCount, color: 'D97706', bg: 'FEF3C7', border: 'FCD34D' },
    { name: 'Platinum', count: data.customerStats.platinumCount, color: '4338CA', bg: 'EEF2FF', border: 'C7D2FE' },
  ];

  tierCards.forEach((tier, idx) => {
    const cardX = 0.8 + idx * 2.95;
    slide4.addShape(pptx.ShapeType.roundRect, {
      x: cardX,
      y: 1.5,
      w: 2.75,
      h: 1.5,
      rectRadius: 0.1,
      fill: { color: tier.bg },
      line: { color: tier.border, width: 1 },
    });
    slide4.addText(`TIER ${tier.name.toUpperCase()}`, {
      x: cardX + 0.2,
      y: 1.65,
      w: 2.3,
      h: 0.3,
      fontSize: 10,
      color: tier.color,
      bold: true,
    });
    slide4.addText(`${tier.count} Member`, {
      x: cardX + 0.2,
      y: 1.95,
      w: 2.3,
      h: 0.5,
      fontSize: 20,
      bold: true,
      color: BRAND_DARK,
    });
  });

  // Points Circulation Box
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 3.3,
    w: 5.7,
    h: 2.8,
    rectRadius: 0.1,
    fill: { color: BRAND_WHITE },
    line: { color: 'E2E8F0', width: 1 },
  });

  slide4.addText('Sirkulasi & Penebusan Poin Loyalitas', {
    x: 1.1,
    y: 3.5,
    w: 5.1,
    h: 0.35,
    fontSize: 13,
    bold: true,
    color: BRAND_DARK,
  });

  slide4.addText(
    [
      { text: `Total Member Terdaftar: `, options: { bold: true } },
      { text: `${data.customerStats.totalMembers} Member Aktif\n\n` },
      { text: `Total Poin Diterbitkan: `, options: { bold: true } },
      { text: `+${data.customerStats.totalPointsIssued.toLocaleString('id-ID')} Poin\n\n` },
      { text: `Total Poin Ditukarkan: `, options: { bold: true } },
      { text: `-${data.customerStats.totalPointsRedeemed.toLocaleString('id-ID')} Poin\n\n` },
      { text: `Rasio Retensi & Penebusan: `, options: { bold: true } },
      {
        text: `${
          data.customerStats.totalPointsIssued > 0
            ? ((data.customerStats.totalPointsRedeemed / data.customerStats.totalPointsIssued) * 100).toFixed(1)
            : '0'
        }% dari poin terbit telah ditukarkan menjadi diskon belanja.`,
      },
    ],
    {
      x: 1.1,
      y: 3.9,
      w: 5.1,
      h: 2.0,
      fontSize: 11,
      color: BRAND_DARK,
      lineSpacing: 18,
    }
  );

  // Payment Channel Distribution Box
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 6.75,
    y: 3.3,
    w: 5.7,
    h: 2.8,
    rectRadius: 0.1,
    fill: { color: BRAND_WHITE },
    line: { color: 'E2E8F0', width: 1 },
  });

  slide4.addText('Distribusi Metode Pembayaran', {
    x: 7.0,
    y: 3.5,
    w: 5.2,
    h: 0.35,
    fontSize: 13,
    bold: true,
    color: BRAND_DARK,
  });

  const paymentRows: any[] = [
    [
      { text: 'Metode', options: { bold: true, fill: { color: 'F1F5F9' } } },
      { text: 'Transaksi', options: { bold: true, fill: { color: 'F1F5F9' }, align: 'center' } },
      { text: 'Total Nilai (Rp)', options: { bold: true, fill: { color: 'F1F5F9' }, align: 'right' } },
    ],
    ...data.paymentBreakdown.map((p) => [
      p.method,
      { text: `${p.count}`, options: { align: 'center' } },
      { text: `Rp ${p.total.toLocaleString('id-ID')}`, options: { align: 'right', bold: true } },
    ]),
  ];

  slide4.addTable(paymentRows, {
    x: 7.0,
    y: 4.0,
    w: 5.2,
    h: 1.9,
    fontSize: 10,
    border: { pt: 0.5, color: 'CBD5E1' },
  });

  // -------------------------------------------------------------
  // SLIDE 5: Inventory Valuation & Stock Alerts
  // -------------------------------------------------------------
  const slide5 = pptx.addSlide();
  slide5.background = { color: BRAND_LIGHT_BG };

  slide5.addText('MANAJEMEN PERSEDIAAN & GUDANG', {
    x: 0.8,
    y: 0.5,
    w: 8,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: BRAND_EMERALD,
    bold: true,
  });
  slide5.addText('Valuasi Modal & Peringatan Stok Kritis', {
    x: 0.8,
    y: 0.8,
    w: 10,
    h: 0.5,
    fontSize: 22,
    fontFace: 'Arial',
    color: BRAND_DARK,
    bold: true,
  });

  // Left Alert Box
  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 1.5,
    w: 6.2,
    h: 4.8,
    rectRadius: 0.1,
    fill: { color: BRAND_WHITE },
    line: { color: 'E2E8F0', width: 1 },
  });

  slide5.addText('Item Butuh Restock Segera (Stok Kritis)', {
    x: 1.1,
    y: 1.7,
    w: 5.6,
    h: 0.35,
    fontSize: 13,
    bold: true,
    color: 'DC2626',
  });

  const lowStockRows: any[] = [
    [
      { text: 'Nama Barang', options: { bold: true, fill: { color: 'FEE2E2' } } },
      { text: 'Sisa Stok', options: { bold: true, fill: { color: 'FEE2E2' }, align: 'center' } },
      { text: 'Ambang Min', options: { bold: true, fill: { color: 'FEE2E2' }, align: 'center' } },
      { text: 'Status', options: { bold: true, fill: { color: 'FEE2E2' }, align: 'center' } },
    ],
    ...(data.lowStockItems.length > 0
      ? data.lowStockItems.slice(0, 6).map((item) => [
          item.name,
          { text: `${item.stock}`, options: { align: 'center', bold: true, color: 'DC2626' } },
          { text: `${item.minStock}`, options: { align: 'center' } },
          { text: item.stock <= 0 ? 'HABIS' : 'KRITIS', options: { align: 'center', bold: true, color: 'DC2626' } },
        ])
      : [['Semua stok dalam batas aman', '-', '-', 'AMAN']]),
  ];

  slide5.addTable(lowStockRows, {
    x: 1.1,
    y: 2.2,
    w: 5.6,
    h: 3.8,
    fontSize: 10,
    border: { pt: 0.5, color: 'CBD5E1' },
  });

  // Right Side: Recommendations & Next Steps
  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 7.3,
    y: 1.5,
    w: 5.15,
    h: 4.8,
    rectRadius: 0.1,
    fill: { color: '1E293B' },
  });

  slide5.addText('Rekomendasi Strategis Bisnis', {
    x: 7.6,
    y: 1.8,
    w: 4.5,
    h: 0.35,
    fontSize: 14,
    bold: true,
    color: BRAND_WHITE,
  });

  slide5.addText(
    [
      { text: '1. Prioritas Restock Produk Laris:\n', options: { bold: true, color: BRAND_EMERALD } },
      { text: 'Segera lakukan Purchase Order (PO) pada item dengan turnover tinggi agar tidak kehilangan potensi omzet.\n\n', options: { color: 'CBD5E1' } },
      { text: '2. Kampanye Poin Loyalitas:\n', options: { bold: true, color: BRAND_GOLD } },
      { text: 'Tingkatkan promosi penukaran poin di kasir untuk mendorong kunjungan berulang member Bronze & Silver ke tingkat Gold.\n\n', options: { color: 'CBD5E1' } },
      { text: '3. Evaluasi Produk Lambat (Slow-moving):\n', options: { bold: true, color: '38BDF8' } },
      { text: 'Lakukan bundling promo atau flash sale untuk membebaskan modal kerja yang tertahan pada stok menumpuk.\n\n', options: { color: 'CBD5E1' } },
      { text: '4. Optimasi Jam Sibuk:\n', options: { bold: true, color: 'A78BFA' } },
      { text: 'Pastikan kesiapan kasir dan persediaan uang kembalian pada puncak jam transaksi toko.', options: { color: 'CBD5E1' } },
    ],
    {
      x: 7.6,
      y: 2.3,
      w: 4.5,
      h: 3.8,
      fontSize: 11,
      lineSpacing: 18,
    }
  );

  // Write and download presentation
  const fileName = `Presentasi_BI_${data.storeName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pptx`;
  await pptx.writeFile({ fileName });
};

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Expense, Product, Sale, Customer } from '../types';

export interface MonthlyReportData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  selectedMonth: string; // YYYY-MM or formatted e.g. "November 2026"
  generatedBy: string;
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  customers?: Customer[];
}

export const generateMonthlyPdfReport = async (data: MonthlyReportData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Color Palette
  const EMERALD_DARK = [4, 120, 87]; // #047857
  const SLATE_DARK = [15, 23, 42]; // #0f172a
  const SLATE_MUTED = [100, 116, 139]; // #64748b
  const BG_LIGHT = [248, 250, 252]; // #f8fafc

  const formatRupiah = (num: number) => {
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
  };

  // 1. Calculations for the monthly period
  const totalSalesCount = data.sales.length;
  const grossSales = data.sales.reduce((sum, s) => sum + s.subtotal, 0);
  const totalDiscounts = data.sales.reduce(
    (sum, s) => sum + (s.orderDiscount || 0) + (s.pointsDiscountAmount || 0),
    0
  );
  const netRevenue = data.sales.reduce(
    (sum, s) => sum + s.grandTotal - (s.taxAmount || 0),
    0
  );
  const totalTax = data.sales.reduce((sum, s) => sum + (s.taxAmount || 0), 0);

  const totalHpp = data.sales.reduce(
    (sum, s) =>
      sum + s.items.reduce((acc, item) => acc + (item.hppTotal || (item.qty * (item.sellingPrice * 0.7))), 0),
    0
  );

  const grossProfit = netRevenue - totalHpp;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const avgBasket = totalSalesCount > 0 ? netRevenue / totalSalesCount : 0;

  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netOperatingProfit = grossProfit - totalExpenses;
  const netMargin = netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;

  // Header Banner
  doc.setFillColor(EMERALD_DARK[0], EMERALD_DARK[1], EMERALD_DARK[2]);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(data.storeName.toUpperCase(), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const subAddress = [data.storeAddress, data.storePhone].filter(Boolean).join(' | ') || 'Sistem Kasir & Analisis Bisnis';
  doc.text(subAddress, 14, 17);
  doc.text('LAPORAN KEUANGAN & PENJUALAN BULANAN', pageWidth - 14, 11, { align: 'right' });
  doc.text(`Periode: ${data.selectedMonth}`, pageWidth - 14, 17, { align: 'right' });

  // Metadata block
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
  doc.setFontSize(7.5);
  const printedAt = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Dicetak pada: ${printedAt} • Oleh: ${data.generatedBy}`, 14, 32);

  // Executive Summary Card Section
  let currentY = 36;

  // Title: Ringkasan Kinerja Eksekutif
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.text('I. RINGKASAN EKSEKUTIF KINERJA KEUANGAN', 14, currentY);

  currentY += 4;

  const kpiWidth = (pageWidth - 28 - 9) / 4; // 4 cards across
  const kpiHeight = 16;

  const kpis = [
    { label: 'Total Omzet Bersih', value: formatRupiah(netRevenue), color: [16, 185, 129] },
    { label: 'Beban Pokok (HPP)', value: formatRupiah(totalHpp), color: [245, 158, 11] },
    { label: 'Beban Operasional', value: formatRupiah(totalExpenses), color: [239, 68, 68] },
    {
      label: 'Laba Bersih Usaha',
      value: formatRupiah(netOperatingProfit),
      color: netOperatingProfit >= 0 ? [5, 150, 105] : [220, 38, 38],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (kpiWidth + 3);
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, kpiWidth, kpiHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
    doc.text(kpi.label.toUpperCase(), x + 3, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 3, currentY + 12);
  });

  currentY += kpiHeight + 6;

  // Table 1: Ikhtisar Laba Rugi (P&L Summary)
  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [['Komponen Keuangan', 'Nilai Nominal (Rp)', 'Rasio terhadap Omzet (%)']],
    body: [
      ['Penjualan Bruto (Gross Sales)', formatRupiah(grossSales), '-'],
      ['Potongan & Diskon Penjualan', '-' + formatRupiah(totalDiscounts), '-'],
      ['Pajak Resto / PPN (jika ada)', formatRupiah(totalTax), '-'],
      ['Pendapatan Bersih (Net Revenue / Omzet)', formatRupiah(netRevenue), '100.0%'],
      ['Harga Pokok Penjualan (HPP / COGS)', '-' + formatRupiah(totalHpp), `${((totalHpp / (netRevenue || 1)) * 100).toFixed(1)}%`],
      ['LABA KOTOR (Gross Profit)', formatRupiah(grossProfit), `${grossMargin.toFixed(1)}%`],
      ['Total Biaya & Beban Operasional', '-' + formatRupiah(totalExpenses), `${((totalExpenses / (netRevenue || 1)) * 100).toFixed(1)}%`],
      [
        'LABA BERSIH OPERASIONAL (Net Operating Profit)',
        formatRupiah(netOperatingProfit),
        `${netMargin.toFixed(1)}%`,
      ],
      ['Total Volume Transaksi', `${totalSalesCount.toLocaleString('id-ID')} Struk`, '-'],
      ['Rata-rata Belanja Per Pelanggan (Average Basket)', formatRupiah(avgBasket), '-'],
    ],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 37, halign: 'center' },
    },
    didParseCell: (hookData) => {
      // Highlight Grand Total lines
      if (
        hookData.row.index === 3 ||
        hookData.row.index === 5 ||
        hookData.row.index === 7
      ) {
        hookData.cell.styles.fillColor = [241, 245, 249];
        hookData.cell.styles.fontStyle = 'bold';
      }
      if (hookData.row.index === 7) {
        hookData.cell.styles.fillColor = netOperatingProfit >= 0 ? [236, 253, 245] : [254, 242, 242];
        hookData.cell.styles.textColor = netOperatingProfit >= 0 ? [4, 120, 87] : [220, 38, 38];
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 7;

  // Table 2: Rincian Beban Operasional (Expenses Breakdown)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.text('II. RINCIAN BIAYA & PENGELUARAN OPERASIONAL', 14, currentY);

  currentY += 3;

  const categoryLabels: Record<string, string> = {
    OPERASIONAL_KASIR: 'Operasional Kasir / Kas Kecil',
    LISTRIK_AIR: 'Listrik, Air & Internet',
    SEWA_TEMPAT: 'Sewa Tempat / Kios / Kebersihan',
    GAJI_KARYAWAN: 'Gaji & Uang Makan Karyawan',
    KONSUMSI_KEBERSIHAN: 'Konsumsi & Perlengkapan Toko',
    MARKETING: 'Promosi, Spanduk & Marketing',
    LAINNYA: 'Biaya Lain-lain',
  };

  const expenseGroupMap: Record<string, { label: string; count: number; total: number }> = {};
  data.expenses.forEach((e) => {
    const cat = e.category || 'LAINNYA';
    if (!expenseGroupMap[cat]) {
      expenseGroupMap[cat] = {
        label: e.categoryLabel || categoryLabels[cat] || cat,
        count: 0,
        total: 0,
      };
    }
    expenseGroupMap[cat].count += 1;
    expenseGroupMap[cat].total += e.amount;
  });

  const expenseRows = Object.values(expenseGroupMap)
    .sort((a, b) => b.total - a.total)
    .map((item) => [
      item.label,
      `${item.count} Transaksi`,
      formatRupiah(item.total),
      `${totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(1) : 0}%`,
    ]);

  if (expenseRows.length === 0) {
    expenseRows.push(['Tidak ada catatan biaya operasional di periode ini', '-', 'Rp 0', '0%']);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    head: [['Pos Biaya / Kategori Beban', 'Frekuensi', 'Total Pengeluaran (Rp)', 'Proporsi Beban (%)']],
    body: [
      ...expenseRows,
      [
        'TOTAL BEBAN OPERASIONAL',
        `${data.expenses.length} Catatan`,
        formatRupiah(totalExpenses),
        '100.0%',
      ],
    ],
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 25, halign: 'center' },
    },
    didParseCell: (hookData) => {
      if (hookData.row.index === expenseRows.length) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [241, 245, 249];
        hookData.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  // PAGE 2: SALES DETAILS, PRODUCTS, PAYMENTS & SIGNATURES
  doc.addPage();

  // Page 2 Header Banner
  doc.setFillColor(EMERALD_DARK[0], EMERALD_DARK[1], EMERALD_DARK[2]);
  doc.rect(0, 0, pageWidth, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`${data.storeName.toUpperCase()} — ANALISIS PENJUALAN & METODE BAYAR`, 14, 8);
  doc.text(`Periode: ${data.selectedMonth}`, pageWidth - 14, 8, { align: 'right' });

  currentY = 18;

  // Table 3: Top Selling Products
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.text('III. 5 PRODUK TERLARIS BULAN INI (TOP SALES)', 14, currentY);

  currentY += 3;

  const productMap: Record<string, { name: string; sku: string; qty: number; revenue: number }> = {};
  data.sales.forEach((s) => {
    s.items.forEach((item) => {
      if (!productMap[item.productId]) {
        productMap[item.productId] = {
          name: item.nameSnapshot || 'Produk',
          sku: item.skuSnapshot || '-',
          qty: 0,
          revenue: 0,
        };
      }
      productMap[item.productId].qty += item.qty;
      productMap[item.productId].revenue += item.subtotal;
    });
  });

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p, idx) => [
      `${idx + 1}`,
      p.name,
      p.sku,
      `${p.qty.toLocaleString('id-ID')} unit`,
      formatRupiah(p.revenue),
      `${netRevenue > 0 ? ((p.revenue / netRevenue) * 100).toFixed(1) : 0}%`,
    ]);

  if (topProducts.length === 0) {
    topProducts.push(['-', 'Belum ada transaksi produk tercatat', '-', '0', 'Rp 0', '0%']);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [['No', 'Nama Produk', 'SKU', 'Volume Terjual', 'Total Omzet (Rp)', 'Kontribusi (%)']],
    body: topProducts,
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 27, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 15, halign: 'center' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Table 4: Payment Methods Distribution & Receivables
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.text('IV. DISTRIBUSI METODE PEMBAYARAN KASIR', 14, currentY);

  currentY += 3;

  const paymentMethodSummary: Record<string, { count: number; total: number }> = {};
  data.sales.forEach((s) => {
    const met = s.paymentMethod || 'TUNAI';
    if (!paymentMethodSummary[met]) {
      paymentMethodSummary[met] = { count: 0, total: 0 };
    }
    paymentMethodSummary[met].count += 1;
    paymentMethodSummary[met].total += s.grandTotal;
  });

  const totalPaymentAmount = Object.values(paymentMethodSummary).reduce((s, p) => s + p.total, 0);

  const paymentRows = Object.entries(paymentMethodSummary).map(([method, val]) => [
    method,
    `${val.count} Transaksi`,
    formatRupiah(val.total),
    `${totalPaymentAmount > 0 ? ((val.total / totalPaymentAmount) * 100).toFixed(1) : 0}%`,
  ]);

  if (paymentRows.length === 0) {
    paymentRows.push(['TUNAI', '0 Transaksi', 'Rp 0', '0%']);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    head: [['Metode Pembayaran', 'Frekuensi Transaksi', 'Total Nilai (Rp)', 'Pangsa Pembayaran (%)']],
    body: [
      ...paymentRows,
      [
        'TOTAL PEMBAYARAN DITERIMA',
        `${totalSalesCount} Transaksi`,
        formatRupiah(totalPaymentAmount),
        '100.0%',
      ],
    ],
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 27, halign: 'center' },
    },
    didParseCell: (hookData) => {
      if (hookData.row.index === paymentRows.length) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [241, 245, 249];
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Signature Block
  const signBoxWidth = 75;
  const signBoxHeight = 32;

  // Left Signature: Penanggung Jawab / Kasir
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
  doc.roundedRect(14, currentY, signBoxWidth, signBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
  doc.text('Dibuat Oleh (Admin / Kasir):', 18, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.text(data.generatedBy, 18, currentY + 26);
  doc.setDrawColor(148, 163, 184);
  doc.line(18, currentY + 22, 18 + signBoxWidth - 10, currentY + 22);

  // Right Signature: Pemilik / Manajer Toko
  const rightSignX = pageWidth - 14 - signBoxWidth;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
  doc.roundedRect(rightSignX, currentY, signBoxWidth, signBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
  doc.text('Disetujui & Diverifikasi Oleh:', rightSignX + 4, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.text('Pemilik / Manajer Toko', rightSignX + 4, currentY + 26);
  doc.setDrawColor(148, 163, 184);
  doc.line(rightSignX + 4, currentY + 22, rightSignX + signBoxWidth - 6, currentY + 22);

  // Page Numbers Footer on All Pages
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Dokumen Resmi Laporan Bisnis • ${data.storeName} • Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Trigger download
  const cleanStoreName = data.storeName.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanPeriod = data.selectedMonth.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Laporan_Bulanan_${cleanStoreName}_${cleanPeriod}.pdf`;
  doc.save(filename);
};

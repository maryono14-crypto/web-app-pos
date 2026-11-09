import React, { useState, useMemo } from 'react';
import { db } from '../../db/indexedDB';
import { Expense, Product, Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import { generateMonthlyPdfReport } from '../../utils/pdfReportGenerator';
import {
  FileText,
  Calendar,
  DollarSign,
  Download,
  X,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Building2,
  User,
  AlertTriangle,
  ArrowDownRight,
  Printer,
} from 'lucide-react';

interface MonthlyPdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSales?: Sale[];
  initialExpenses?: Expense[];
}

export const MonthlyPdfReportModal: React.FC<MonthlyPdfReportModalProps> = ({
  isOpen,
  onClose,
  initialSales,
  initialExpenses,
}) => {
  const { settings, activeUser, showToast } = useApp();

  const [sales, setSales] = useState<Sale[]>(initialSales || []);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses || []);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Month selector: Default to current year-month "YYYY-MM"
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedYearMonth, setSelectedYearMonth] = useState(defaultYearMonth);

  // Metadata overrides
  const [customStoreName, setCustomStoreName] = useState(settings?.storeName || 'BerkahPOS Store');
  const [customGeneratedBy, setCustomGeneratedBy] = useState(activeUser?.name || 'Admin Toko');

  // Load fresh data when opened
  React.useEffect(() => {
    if (isOpen) {
      setIsLoadingData(true);
      Promise.all([
        db.sales.toArray(),
        db.expenses.toArray(),
        db.products.toArray(),
      ])
        .then(([sList, eList, pList]) => {
          setSales(sList);
          setExpenses(eList);
          setProducts(pList);
        })
        .finally(() => setIsLoadingData(false));
    }
  }, [isOpen]);

  // Generate options for last 12 months
  const monthOptions = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const date = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      list.push({ key, label });
    }
    return list;
  }, []);

  // Filter sales and expenses by selected year-month
  const { filteredSales, filteredExpenses } = useMemo(() => {
    const [yearStr, monthStr] = selectedYearMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-indexed

    const startOfMonth = new Date(year, month, 1).getTime();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

    const fSales = sales.filter((s) => {
      if (s.status === 'VOID') return false;
      const t = new Date(s.timestamp).getTime();
      return t >= startOfMonth && t <= endOfMonth;
    });

    const fExpenses = expenses.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= startOfMonth && t <= endOfMonth;
    });

    return { filteredSales: fSales, filteredExpenses: fExpenses };
  }, [sales, expenses, selectedYearMonth]);

  // Financial aggregates for preview
  const summary = useMemo(() => {
    const netRevenue = filteredSales.reduce((sum, s) => sum + s.grandTotal - (s.taxAmount || 0), 0);
    const totalHpp = filteredSales.reduce(
      (sum, s) =>
        sum +
        s.items.reduce(
          (acc, item) => acc + (item.hppTotal || item.qty * (item.sellingPrice * 0.7)),
          0
        ),
      0
    );
    const grossProfit = netRevenue - totalHpp;
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    return {
      txCount: filteredSales.length,
      netRevenue,
      totalHpp,
      grossProfit,
      totalExpenses,
      netProfit,
      grossMargin,
      netMargin,
    };
  }, [filteredSales, filteredExpenses]);

  // Label of selected month
  const selectedMonthLabel = useMemo(() => {
    const found = monthOptions.find((m) => m.key === selectedYearMonth);
    return found ? found.label : selectedYearMonth;
  }, [monthOptions, selectedYearMonth]);

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      await generateMonthlyPdfReport({
        storeName: customStoreName.trim() || settings?.storeName || 'BerkahPOS Store',
        storeAddress: settings?.storeAddress,
        storePhone: settings?.storePhone,
        selectedMonth: selectedMonthLabel,
        generatedBy: customGeneratedBy.trim() || activeUser?.name || 'Admin',
        sales: filteredSales,
        expenses: filteredExpenses,
        products,
      });
      showToast(`Laporan PDF periode ${selectedMonthLabel} berhasil diunduh!`, 'success');
      onClose();
    } catch (err: any) {
      showToast('Gagal membuat dokumen PDF: ' + (err.message || 'Error tidak diketahui'), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Ekspor Laporan Keuangan &amp; Penjualan Bulanan (PDF)
              </h3>
              <p className="text-xs text-emerald-100">
                Dokumen resmi ringkasan laba rugi, omzet, HPP, beban operasional, dan produk terlaris
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs flex-1 overflow-y-auto">
          {/* Month Selector */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <label className="block font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Pilih Periode Bulan Pelaporan:</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedYearMonth}
                onChange={(e) => setSelectedYearMonth(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {monthOptions.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold text-[11px]">
                <span>
                  {filteredSales.length} Struk Penjualan &bull; {filteredExpenses.length} Pos Biaya
                </span>
              </div>
            </div>
          </div>

          {/* Live Preview Metric Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Pratinjau Angka Laporan ({selectedMonthLabel}):
              </span>
              {isLoadingData && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Memuat data...
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Omzet Net */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold block">Total Omzet Bersih</span>
                <span className="text-sm font-black font-mono text-emerald-700 mt-0.5 block tabular-nums">
                  Rp {summary.netRevenue.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Total HPP */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold block">Beban Pokok (HPP)</span>
                <span className="text-sm font-black font-mono text-amber-700 mt-0.5 block tabular-nums">
                  Rp {summary.totalHpp.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Gross Profit */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold block">
                  Laba Kotor ({summary.grossMargin.toFixed(1)}%)
                </span>
                <span className="text-sm font-black font-mono text-slate-800 mt-0.5 block tabular-nums">
                  Rp {summary.grossProfit.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Operating Expenses */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold block">Beban Operasional</span>
                <span className="text-sm font-black font-mono text-rose-600 mt-0.5 block tabular-nums">
                  -Rp {summary.totalExpenses.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Net Profit */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Laba Bersih Operasional ({summary.netMargin.toFixed(1)}% margin)
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      summary.netProfit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {summary.netProfit >= 0 ? 'Surplus' : 'Defisit'}
                  </span>
                </div>
                <span
                  className={`text-base font-black font-mono mt-0.5 block tabular-nums ${
                    summary.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  Rp {summary.netProfit.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Customization Details */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <span className="font-bold text-slate-800 text-[11px]">Kop Dokumen &amp; Penandatangan:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nama Toko / Bisnis:</label>
                <input
                  type="text"
                  value={customStoreName}
                  onChange={(e) => setCustomStoreName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="Nama Toko"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Penanggung Jawab Laporan:</label>
                <input
                  type="text"
                  value={customGeneratedBy}
                  onChange={(e) => setCustomGeneratedBy(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="Nama Kasir / Admin"
                />
              </div>
            </div>
          </div>

          {/* Document Content Overview Notice */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dokumen PDF yang dihasilkan meliputi:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-500 pl-1">
              <li>Laporan Laba Rugi Eksekutif (Omzet, Diskon, HPP, Margin Kotor &amp; Bersih)</li>
              <li>Rincian Pengeluaran berdasarkan pos beban operasional (Listrik, Sewa, Gaji, dll.)</li>
              <li>Tabel 5 Produk Terlaris dan kontribusinya terhadap omzet</li>
              <li>Statistik Distribusi Pembayaran Kasir (Tunai, QRIS, Transfer, Debit)</li>
              <li>Kolom pengesahan dan tanda tangan verifikasi pemilik toko</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            Format: Standar A4 Portrait (Print-Ready)
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>

            <button
              onClick={handleGeneratePdf}
              disabled={isGenerating || isLoadingData}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh Dokumen PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

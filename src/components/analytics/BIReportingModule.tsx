import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../db/indexedDB';
import { Category, Expense, Product, Sale, Customer } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  exportSalesToCsv,
  exportInventoryToCsv,
  exportLoyaltyToCsv,
  generateExecutivePPT,
} from '../../utils/exportHelpers';
import { MonthlyPdfReportModal } from './MonthlyPdfReportModal';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Award,
  Clock,
  Download,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Printer,
  ChevronDown,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Presentation,
  Loader2,
  FileDown,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';

type TrendViewMode = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'HOURLY';

export const BIReportingModule: React.FC = () => {
  const { settings, showToast } = useApp();

  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Export states
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isGeneratingPpt, setIsGeneratingPpt] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState<'7D' | '14D' | '30D' | '90D' | 'ALL'>('14D');
  const [trendMode, setTrendMode] = useState<TrendViewMode>('DAILY');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPayment, setSelectedPayment] = useState<string>('ALL');

  useEffect(() => {
    Promise.all([
      db.sales.toArray(),
      db.expenses.toArray(),
      db.products.toArray(),
      db.categories.toArray(),
      db.customers.toArray(),
    ]).then(([sList, eList, pList, cList, custList]) => {
      setSales(sList);
      setExpenses(eList);
      setProducts(pList);
      setCategories(cList);
      setCustomers(custList);
    });
  }, []);

  // Filtered Sales based on date, category, and payment method
  const filteredSales = useMemo(() => {
    const now = new Date();
    let daysToSubtract = 14;
    if (dateRange === '7D') daysToSubtract = 7;
    else if (dateRange === '14D') daysToSubtract = 14;
    else if (dateRange === '30D') daysToSubtract = 30;
    else if (dateRange === '90D') daysToSubtract = 90;

    const cutoffDate = dateRange === 'ALL' ? new Date(0) : new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);

    return sales.filter((s) => {
      if (s.status === 'VOID') return false;
      const sDate = new Date(s.timestamp);
      if (sDate < cutoffDate) return false;

      if (selectedPayment !== 'ALL' && s.paymentMethod !== selectedPayment) return false;

      if (selectedCategory !== 'ALL') {
        const hasCategoryItem = s.items.some((item) => {
          const prod = products.find((p) => p.id === item.productId);
          return prod?.categoryId === selectedCategory;
        });
        if (!hasCategoryItem) return false;
      }

      return true;
    });
  }, [sales, dateRange, selectedCategory, selectedPayment, products]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    let daysToSubtract = 14;
    if (dateRange === '7D') daysToSubtract = 7;
    else if (dateRange === '14D') daysToSubtract = 14;
    else if (dateRange === '30D') daysToSubtract = 30;
    else if (dateRange === '90D') daysToSubtract = 90;

    const cutoffDate = dateRange === 'ALL' ? new Date(0) : new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);

    return expenses.filter((e) => new Date(e.timestamp) >= cutoffDate);
  }, [expenses, dateRange]);

  // Core Financial Aggregates
  const metrics = useMemo(() => {
    const grossSales = filteredSales.reduce((sum, s) => sum + s.subtotal, 0);
    const totalDiscounts = filteredSales.reduce((sum, s) => sum + s.orderDiscount, 0);
    const netRevenue = filteredSales.reduce((sum, s) => sum + s.grandTotal - (s.taxAmount || 0), 0);

    // COGS / HPP
    const totalHpp = filteredSales.reduce(
      (sum, s) => sum + s.items.reduce((iSum, item) => iSum + (item.hppTotal || 0), 0),
      0
    );

    const grossProfit = netRevenue - totalHpp;
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const transactionCount = filteredSales.length;
    const averageBasket = transactionCount > 0 ? Math.round(netRevenue / transactionCount) : 0;

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netOperatingProfit = grossProfit - totalExpenses;

    // Inventory Valuation
    const totalValuation = products.reduce(
      (sum, p) => sum + p.currentStock * (p.avgCostPrice || p.costPrice),
      0
    );

    // Inventory Turnover Ratio = Total HPP / Average Inventory
    const inventoryTurnover = totalValuation > 0 ? (totalHpp / totalValuation).toFixed(2) : '0.00';

    return {
      grossSales,
      totalDiscounts,
      netRevenue,
      totalHpp,
      grossProfit,
      grossMargin,
      transactionCount,
      averageBasket,
      totalExpenses,
      netOperatingProfit,
      totalValuation,
      inventoryTurnover,
    };
  }, [filteredSales, filteredExpenses, products]);

  // 1. Daily Sales Trend Data
  const dailyTrendData = useMemo(() => {
    const daysMap: Record<string, { label: string; dateObj: Date; omzet: number; hpp: number; laba: number; count: number }> = {};
    const now = new Date();
    let numDays = dateRange === '7D' ? 7 : dateRange === '14D' ? 14 : dateRange === '30D' ? 30 : 60;
    if (dateRange === 'ALL') numDays = 30;

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      daysMap[key] = { label, dateObj: d, omzet: 0, hpp: 0, laba: 0, count: 0 };
    }

    filteredSales.forEach((s) => {
      const key = s.timestamp.slice(0, 10);
      if (daysMap[key]) {
        const saleHpp = s.items.reduce((acc, item) => acc + (item.hppTotal || 0), 0);
        const saleNet = s.grandTotal - (s.taxAmount || 0);
        daysMap[key].omzet += saleNet;
        daysMap[key].hpp += saleHpp;
        daysMap[key].laba += saleNet - saleHpp;
        daysMap[key].count += 1;
      }
    });

    return Object.values(daysMap);
  }, [filteredSales, dateRange]);

  // 2. Weekly Sales Trend Data (Grouped by Week)
  const weeklyTrendData = useMemo(() => {
    const weeksMap: Record<string, { weekLabel: string; omzet: number; hpp: number; laba: number; count: number }> = {};

    // Group sales by week number of year
    filteredSales.forEach((s) => {
      const d = new Date(s.timestamp);
      // Start of week (Monday)
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const weekKey = `Minggu ${monday.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`;

      if (!weeksMap[weekKey]) {
        weeksMap[weekKey] = { weekLabel: weekKey, omzet: 0, hpp: 0, laba: 0, count: 0 };
      }

      const saleHpp = s.items.reduce((acc, item) => acc + (item.hppTotal || 0), 0);
      const saleNet = s.grandTotal - (s.taxAmount || 0);
      weeksMap[weekKey].omzet += saleNet;
      weeksMap[weekKey].hpp += saleHpp;
      weeksMap[weekKey].laba += saleNet - saleHpp;
      weeksMap[weekKey].count += 1;
    });

    const list = Object.values(weeksMap);
    return list.length > 0 ? list : [{ weekLabel: 'Minggu Ini', omzet: 0, hpp: 0, laba: 0, count: 0 }];
  }, [filteredSales]);

  // 3. Monthly Sales Trend Data
  const monthlyTrendData = useMemo(() => {
    const monthsMap: Record<string, { monthLabel: string; omzet: number; hpp: number; laba: number; count: number }> = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    filteredSales.forEach((s) => {
      const d = new Date(s.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

      if (!monthsMap[key]) {
        monthsMap[key] = { monthLabel: label, omzet: 0, hpp: 0, laba: 0, count: 0 };
      }

      const saleHpp = s.items.reduce((acc, item) => acc + (item.hppTotal || 0), 0);
      const saleNet = s.grandTotal - (s.taxAmount || 0);
      monthsMap[key].omzet += saleNet;
      monthsMap[key].hpp += saleHpp;
      monthsMap[key].laba += saleNet - saleHpp;
      monthsMap[key].count += 1;
    });

    const sortedKeys = Object.keys(monthsMap).sort();
    const list = sortedKeys.map((k) => monthsMap[k]);
    return list.length > 0 ? list : [{ monthLabel: 'Bulan Ini', omzet: 0, hpp: 0, laba: 0, count: 0 }];
  }, [filteredSales]);

  // 4. Hourly / Peak Time Distribution
  const hourlyData = useMemo(() => {
    const hours: { hour: string; count: number; omzet: number }[] = [];
    for (let h = 7; h <= 22; h++) {
      const label = `${h.toString().padStart(2, '0')}:00`;
      hours.push({ hour: label, count: 0, omzet: 0 });
    }

    filteredSales.forEach((s) => {
      const d = new Date(s.timestamp);
      const h = d.getHours();
      if (h >= 7 && h <= 22) {
        const idx = h - 7;
        hours[idx].count += 1;
        hours[idx].omzet += s.grandTotal;
      }
    });

    return hours;
  }, [filteredSales]);

  // 4. Category Contribution Data
  const categoryData = useMemo(() => {
    const catMap: Record<string, { name: string; revenue: number; profit: number }> = {};

    filteredSales.forEach((s) => {
      s.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const cat = categories.find((c) => c.id === prod?.categoryId);
        const catName = cat ? cat.name : 'Lainnya';

        if (!catMap[catName]) {
          catMap[catName] = { name: catName, revenue: 0, profit: 0 };
        }
        const itemProfit = item.subtotal - (item.hppTotal || 0);
        catMap[catName].revenue += item.subtotal;
        catMap[catName].profit += itemProfit;
      });
    });

    return Object.values(catMap).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, products, categories]);

  // 5. Payment Methods Data
  const paymentData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSales.forEach((s) => {
      map[s.paymentMethod] = (map[s.paymentMethod] || 0) + s.grandTotal;
    });

    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  // 6. Top Selling & Slow Moving Products
  const { topProducts, slowProducts } = useMemo(() => {
    const productMap: Record<string, { id: string; name: string; sku: string; qtySold: number; revenue: number; stock: number }> = {};

    products.forEach((p) => {
      productMap[p.id] = {
        id: p.id,
        name: p.name,
        sku: p.sku,
        qtySold: 0,
        revenue: 0,
        stock: p.currentStock,
      };
    });

    filteredSales.forEach((s) => {
      s.items.forEach((item) => {
        if (productMap[item.productId]) {
          productMap[item.productId].qtySold += item.qty;
          productMap[item.productId].revenue += item.subtotal;
        }
      });
    });

    const allList = Object.values(productMap);
    const top = [...allList].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const slow = [...allList]
      .filter((p) => p.stock > 0)
      .sort((a, b) => a.qtySold - b.qtySold)
      .slice(0, 5);

    return { topProducts: top, slowProducts: slow };
  }, [filteredSales, products]);

  const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Export Handlers
  const handleExportSalesCSV = () => {
    exportSalesToCsv(filteredSales, dateRange);
    setIsExportDropdownOpen(false);
    showToast?.(`Data penjualan (${filteredSales.length} transaksi) berhasil diekspor ke CSV!`, 'success');
  };

  const handleExportInventoryCSV = () => {
    exportInventoryToCsv(products, categories);
    setIsExportDropdownOpen(false);
    showToast?.(`Data master & valuasi stok (${products.length} SKU) berhasil diekspor ke CSV!`, 'success');
  };

  const handleExportLoyaltyCSV = () => {
    exportLoyaltyToCsv(customers);
    setIsExportDropdownOpen(false);
    showToast?.(`Data pelanggan & poin loyalitas (${customers.length} member) berhasil diekspor ke CSV!`, 'success');
  };

  const handleExportAllCSV = () => {
    exportSalesToCsv(filteredSales, dateRange);
    setTimeout(() => exportInventoryToCsv(products, categories), 300);
    setTimeout(() => exportLoyaltyToCsv(customers), 600);
    setIsExportDropdownOpen(false);
    showToast?.('3 File CSV (Penjualan, Inventaris, Loyalitas) berhasil diunduh.', 'success');
  };

  const handleExportPPT = async () => {
    setIsGeneratingPpt(true);
    try {
      const periodMap: Record<string, string> = {
        '7D': '7 Hari Terakhir',
        '14D': '14 Hari Terakhir',
        '30D': '30 Hari Terakhir',
        '90D': 'Kuartal Terakhir (90 Hari)',
        'ALL': 'Semua Waktu',
      };

      const bronzeCount = customers.filter((c) => c.tier === 'BRONZE').length;
      const silverCount = customers.filter((c) => c.tier === 'SILVER').length;
      const goldCount = customers.filter((c) => c.tier === 'GOLD').length;
      const platinumCount = customers.filter((c) => c.tier === 'PLATINUM').length;

      const totalPointsIssued = filteredSales.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);
      const totalPointsRedeemed = filteredSales.reduce((sum, s) => sum + (s.pointsRedeemed || 0), 0);

      const paymentMap: Record<string, { count: number; total: number }> = {};
      filteredSales.forEach((s) => {
        if (!paymentMap[s.paymentMethod]) {
          paymentMap[s.paymentMethod] = { count: 0, total: 0 };
        }
        paymentMap[s.paymentMethod].count += 1;
        paymentMap[s.paymentMethod].total += s.grandTotal;
      });

      const paymentBreakdown = Object.entries(paymentMap).map(([method, val]) => ({
        method,
        count: val.count,
        total: val.total,
      }));

      const lowStockItems = products
        .filter((p) => p.currentStock <= (p.minStock || 5))
        .map((p) => ({
          name: p.name,
          stock: p.currentStock,
          minStock: p.minStock || 5,
        }));

      const topSellingWithProfit = topProducts.map((p) => {
        const prod = products.find((pr) => pr.id === p.id);
        const hpp = prod?.avgCostPrice || prod?.costPrice || 0;
        const profit = p.revenue - p.qtySold * hpp;
        return {
          name: p.name,
          qty: p.qtySold,
          revenue: p.revenue,
          profit: Math.max(0, profit),
        };
      });

      await generateExecutivePPT({
        storeName: settings?.storeName || 'POS Retail Modern',
        storeAddress: settings?.storeAddress,
        periodLabel: periodMap[dateRange] || 'Periode Berjalan',
        metrics,
        topProducts: topSellingWithProfit,
        categoryBreakdown: categoryData,
        customerStats: {
          totalMembers: customers.length,
          bronzeCount,
          silverCount,
          goldCount,
          platinumCount,
          totalPointsIssued,
          totalPointsRedeemed,
        },
        paymentBreakdown,
        lowStockItems,
      });

      showToast?.('Presentasi Eksekutif PPT (.pptx) berhasil diunduh!', 'success');
    } catch (err) {
      console.error('Error generating PPT:', err);
      showToast?.('Gagal membuat file PPT. Silakan coba lagi.', 'error');
    } finally {
      setIsGeneratingPpt(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header with Period Selectors & Export */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Business Intelligence & Sales Trends
              </h1>
              <p className="text-xs text-slate-500">
                Visualisasi tren penjualan harian & mingguan, analisis laba kotor, dan performa
                bisnis
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
            {[
              { id: '7D', label: '7 Hari' },
              { id: '14D', label: '14 Hari' },
              { id: '30D', label: '30 Hari' },
              { id: '90D', label: 'Kuartal' },
              { id: 'ALL', label: 'Semua' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setDateRange(r.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  dateRange === r.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Export Actions Group */}
          <div className="flex items-center gap-2">
            {/* Export Monthly PDF Report Button */}
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Ekspor Ringkasan Laporan Penjualan & Keuangan Bulanan ke PDF"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>Ekspor PDF Bulanan</span>
            </button>

            {/* Download PPT Button */}
            <button
              onClick={handleExportPPT}
              disabled={isGeneratingPpt}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60"
              title="Download Presentasi Eksekutif PowerPoint (.pptx)"
            >
              {isGeneratingPpt ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Presentation className="w-4 h-4 text-white" />
              )}
              <span>{isGeneratingPpt ? 'Menyiapkan PPT...' : 'Download PPT'}</span>
            </button>

            {/* Export CSV Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-xs cursor-pointer transition-colors"
                title="Ekspor Data ke Format CSV Excel atau Dokumen PDF"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Ekspor File</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isExportDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsExportDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Pilihan Format Ekspor
                    </div>

                    <button
                      onClick={() => {
                        setIsExportDropdownOpen(false);
                        setIsPdfModalOpen(true);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-emerald-50/60 flex items-center gap-2.5 transition-colors cursor-pointer border-b border-slate-100"
                    >
                      <Printer className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="font-semibold text-slate-900">Laporan Bulanan PDF</div>
                        <div className="text-[10px] text-slate-400">Laba rugi, omzet, HPP &amp; beban</div>
                      </div>
                    </button>

                    <button
                      onClick={handleExportSalesCSV}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <ShoppingCart className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="font-semibold text-slate-900">Transaksi Penjualan</div>
                        <div className="text-[10px] text-slate-400">
                          {filteredSales.length} struk periode {dateRange}
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={handleExportInventoryCSV}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Package className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-semibold text-slate-900">Inventaris & Valuasi Stok</div>
                        <div className="text-[10px] text-slate-400">{products.length} SKU master barang</div>
                      </div>
                    </button>

                    <button
                      onClick={handleExportLoyaltyCSV}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-amber-600" />
                      <div>
                        <div className="font-semibold text-slate-900">Data Loyalitas Member</div>
                        <div className="text-[10px] text-slate-400">{customers.length} member & saldo poin</div>
                      </div>
                    </button>

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      onClick={handleExportAllCSV}
                      className="w-full text-left px-3.5 py-2 text-xs text-emerald-700 font-bold hover:bg-emerald-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FileDown className="w-4 h-4 text-emerald-600" />
                      <span>Unduh Semua File Sekaligus</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Omzet Bersih */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Omzet Bersih</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            Rp {metrics.netRevenue.toLocaleString('id-ID')}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <span>{metrics.transactionCount} transaksi</span>
            <span>&bull;</span>
            <span>Rata-rata: Rp {metrics.averageBasket.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* HPP (COGS) */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Harga Pokok (HPP)</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700 tracking-tight">
            Rp {metrics.totalHpp.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500">
            Metode Aktif: <strong>{settings?.costingMethod || 'FIFO'}</strong>
          </p>
        </div>

        {/* Laba Kotor & Margin */}
        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-emerald-800">
            <span className="text-xs font-bold">Laba Kotor Bisnis</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-black text-emerald-900 tracking-tight">
            Rp {metrics.grossProfit.toLocaleString('id-ID')}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
            <span className="bg-emerald-200/80 px-1.5 py-0.2 rounded">
              Margin: {metrics.grossMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Laba Bersih Operasional */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Laba Bersih Operasional</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div
            className={`text-2xl font-black tracking-tight ${
              metrics.netOperatingProfit >= 0 ? 'text-blue-800' : 'text-rose-600'
            }`}
          >
            Rp {metrics.netOperatingProfit.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500">
            Beban Operasional: -Rp {metrics.totalExpenses.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* 3. Primary Chart: Daily vs Weekly Sales Trends (Recharts) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>
                {trendMode === 'DAILY'
                  ? 'Tren Penjualan & Laba Harian (Daily Sales Trend)'
                  : trendMode === 'WEEKLY'
                  ? 'Tren Penjualan Mingguan (Weekly Sales Trend)'
                  : trendMode === 'MONTHLY'
                  ? 'Tren Penjualan Bulanan (Monthly Sales Trend)'
                  : 'Distribusi Penjualan per Jam (Peak Hours)'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Perbandingan pendapatan kotor, HPP modal barang, dan margin laba kotor
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 self-start sm:self-auto text-xs font-bold">
            <button
              onClick={() => setTrendMode('DAILY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                trendMode === 'DAILY'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Harian (Daily)
            </button>
            <button
              onClick={() => setTrendMode('WEEKLY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                trendMode === 'WEEKLY'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mingguan (Weekly)
            </button>
            <button
              onClick={() => setTrendMode('MONTHLY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                trendMode === 'MONTHLY'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulanan (Monthly)
            </button>
            <button
              onClick={() => setTrendMode('HOURLY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                trendMode === 'HOURLY'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jam Sibuk (Peak Hours)
            </button>
          </div>
        </div>

        {/* Chart View */}
        <div className="h-72 w-full pt-2">
          {trendMode === 'DAILY' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="omzetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="labaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toLocaleString('id-ID')}k`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`}
                  contentStyle={{
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    borderColor: '#cbd5e1',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="omzet"
                  name="Omzet Penjualan"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#omzetGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="laba"
                  name="Laba Kotor"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#labaGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {trendMode === 'WEEKLY' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toLocaleString('id-ID')}k`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`}
                  contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar
                  dataKey="omzet"
                  name="Omzet Mingguan"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
                <Bar
                  dataKey="hpp"
                  name="HPP (Modal)"
                  fill="#c084fc"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
                <Bar
                  dataKey="laba"
                  name="Laba Kotor"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          )}

          {trendMode === 'MONTHLY' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000000).toLocaleString('id-ID')}M`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`}
                  contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar
                  dataKey="omzet"
                  name="Omzet Bulanan"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
                <Bar
                  dataKey="hpp"
                  name="HPP (Modal)"
                  fill="#94a3b8"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
                <Bar
                  dataKey="laba"
                  name="Laba Kotor"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          )}

          {trendMode === 'HOURLY' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v: any, name: any) =>
                    name === 'Omzet (Rp)'
                      ? `Rp ${Number(v).toLocaleString('id-ID')}`
                      : `${v} transaksi`
                  }
                  contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar
                  dataKey="count"
                  name="Jumlah Struk Kasir"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. Secondary Row: Category Breakdown & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Contribution */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-600" />
              <span>Kontribusi Penjualan per Kategori Produk</span>
            </h3>
            <span className="text-xs text-slate-400">Berdasarkan total omzet</span>
          </div>

          <div className="h-60 w-full">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada transaksi pada periode ini
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${(v / 1000).toLocaleString('id-ID')}k`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#334155' }}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`}
                    contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Omzet Kategori"
                    fill="#10b981"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Methods Composition */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Metode Pembayaran Kasir</h3>
          <div className="h-60 w-full flex items-center justify-center">
            {paymentData.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada transaksi</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`}
                    contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 5. Tertiary Row: Top Sellers vs Slow Moving Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Best Sellers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>5 Produk Terlaris (Top Performers)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Berdasarkan omzet</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {topProducts.length === 0 ? (
              <p className="py-8 text-center text-slate-400">Belum ada data transaksi.</p>
            ) : (
              topProducts.map((p, idx) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-[11px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-emerald-700">
                      Rp {p.revenue.toLocaleString('id-ID')}
                    </span>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {p.qtySold} unit terjual
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slow Moving Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span>Produk Lambat Terjual (Slow Moving)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Perlu evaluasi stok</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {slowProducts.length === 0 ? (
              <p className="py-8 text-center text-slate-400">Semua produk bergerak lancar.</p>
            ) : (
              slowProducts.map((p, idx) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-700 font-bold flex items-center justify-center text-[11px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-700">
                      Sisa Stok: {p.stock}
                    </span>
                    <div className="text-[10px] text-rose-600 font-medium">
                      {p.qtySold} unit terjual
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 6. Executive P&L Income Statement Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Laporan Laba Rugi Eksekutif (Income Statement)
            </h3>
            <p className="text-xs text-slate-400">
              Perhitungan laba kotor & operasional sesuai prinsip akuntansi PRD
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono">
            Metode: {settings?.costingMethod || 'FIFO'}
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
          <div className="p-3 bg-slate-50 flex justify-between font-bold text-slate-700">
            <span>Komponen Keuangan</span>
            <span>Nilai (Rp)</span>
          </div>
          <div className="p-3 flex justify-between text-slate-700">
            <span>1. Penjualan Kotor (Gross Sales)</span>
            <span className="font-medium">Rp {metrics.grossSales.toLocaleString('id-ID')}</span>
          </div>
          <div className="p-3 flex justify-between text-rose-600">
            <span>2. Potongan / Diskon Penjualan (-)</span>
            <span>-Rp {metrics.totalDiscounts.toLocaleString('id-ID')}</span>
          </div>
          <div className="p-3 bg-slate-50/70 flex justify-between font-bold text-slate-900">
            <span>3. Penjualan Bersih (Net Revenue)</span>
            <span className="font-black">Rp {metrics.netRevenue.toLocaleString('id-ID')}</span>
          </div>
          <div className="p-3 flex justify-between text-purple-700 font-semibold">
            <span>4. Beban Pokok Penjualan / HPP ({settings?.costingMethod || 'FIFO'}) (-)</span>
            <span>-Rp {metrics.totalHpp.toLocaleString('id-ID')}</span>
          </div>
          <div className="p-3.5 bg-emerald-50 flex justify-between font-black text-emerald-900 text-sm">
            <span>5. LABA KOTOR (GROSS PROFIT)</span>
            <span>Rp {metrics.grossProfit.toLocaleString('id-ID')} (Margin: {metrics.grossMargin.toFixed(1)}%)</span>
          </div>
          <div className="p-3 flex justify-between text-rose-600">
            <span>6. Beban Operasional Kas & Toko (-)</span>
            <span>-Rp {metrics.totalExpenses.toLocaleString('id-ID')}</span>
          </div>
          <div className="p-4 bg-slate-900 text-white flex justify-between items-center text-base font-black">
            <span>7. LABA BERSIH OPERASIONAL (NET PROFIT)</span>
            <span className={metrics.netOperatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              Rp {metrics.netOperatingProfit.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly PDF Report Modal */}
      <MonthlyPdfReportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        initialSales={sales}
        initialExpenses={expenses}
      />
    </div>
  );
};

export default BIReportingModule;

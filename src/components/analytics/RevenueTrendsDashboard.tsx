import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../db/indexedDB';
import { Sale, Product, Category, Expense } from '../../types';
import { useApp } from '../../context/AppContext';
import { seedHistoricalSalesData } from '../../utils/salesSeedHelper';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  BarChart3,
  CalendarRange,
  Target,
  RefreshCw,
  Sparkles,
  Eye,
  ChevronRight,
  Database,
  PieChart as PieIcon,
  ShoppingBag,
  Printer,
} from 'lucide-react';
import { MonthlyPdfReportModal } from './MonthlyPdfReportModal';

type GranularityMode = 'OVERVIEW' | 'DAILY' | 'MONTHLY';
type MetricFocus = 'REVENUE' | 'PROFIT' | 'TRANSACTIONS' | 'AOV';
type DateRangeOption = '7D' | '14D' | '30D' | '60D' | '90D' | '12M' | 'ALL';

interface DailyTrendItem {
  dateKey: string;
  label: string;
  fullDate: string;
  dayName: string;
  revenue: number;
  hpp: number;
  grossProfit: number;
  marginPercent: number;
  txCount: number;
  aov: number;
  movingAverage7d?: number;
}

interface MonthlyTrendItem {
  monthKey: string;
  label: string;
  revenue: number;
  hpp: number;
  grossProfit: number;
  marginPercent: number;
  txCount: number;
  aov: number;
  expenses: number;
  netProfit: number;
  targetRevenue: number;
  achievementPercent: number;
  momGrowthPercent: number | null;
}

interface DayOfWeekItem {
  dayIndex: number;
  dayName: string;
  revenue: number;
  txCount: number;
  avgRevenuePerTx: number;
}

interface HourlyItem {
  hour: string;
  revenue: number;
  txCount: number;
}

const MONTH_NAMES_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const RevenueTrendsDashboard: React.FC = () => {
  const { settings, showToast } = useApp();

  // Raw database entities
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Dashboard Controls
  const [granularity, setGranularity] = useState<GranularityMode>('OVERVIEW');
  const [dateRange, setDateRange] = useState<DateRangeOption>('30D');
  const [metricFocus, setMetricFocus] = useState<MetricFocus>('REVENUE');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPayment, setSelectedPayment] = useState<string>('ALL');
  const [showMovingAverage, setShowMovingAverage] = useState<boolean>(true);
  const [showTargetLine, setShowTargetLine] = useState<boolean>(true);
  const [dailyTarget, setDailyTarget] = useState<number>(2500000); // Rp 2.500.000 default daily target
  const [monthlyTarget, setMonthlyTarget] = useState<number>(75000000); // Rp 75.000.000 default monthly target
  const [isTableExpanded, setIsTableExpanded] = useState<boolean>(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sList, eList, pList, cList] = await Promise.all([
        db.sales.toArray(),
        db.expenses.toArray(),
        db.products.toArray(),
        db.categories.toArray(),
      ]);
      setSales(sList);
      setExpenses(eList);
      setProducts(pList);
      setCategories(cList);
    } catch (err) {
      console.error('Error loading sales trend data:', err);
      showToast?.('Gagal memuat data transaksi dari IndexedDB', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick Seed Handler for instant rich demo visualization
  const handleSeedHistoricalData = async () => {
    setIsSeeding(true);
    try {
      const insertedCount = await seedHistoricalSalesData(6);
      await loadData();
      showToast?.(
        `Berhasil memuat ${insertedCount} transaksi historis (6 bulan terakhir) untuk analisis tren BI!`,
        'success'
      );
    } catch (err: any) {
      console.error(err);
      showToast?.(err.message || 'Gagal memuat data sampel historis.', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  // Base Valid Sales (non-void) filtered by Category and Payment Method
  const validFilteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.status === 'VOID') return false;
      if (selectedPayment !== 'ALL' && s.paymentMethod !== selectedPayment) return false;
      if (selectedCategory !== 'ALL') {
        const hasMatch = s.items.some((item) => {
          const prod = products.find((p) => p.id === item.productId);
          return prod?.categoryId === selectedCategory;
        });
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [sales, selectedCategory, selectedPayment, products]);

  // Window-filtered Sales for Daily Analytics
  const windowSales = useMemo(() => {
    if (dateRange === 'ALL') return validFilteredSales;

    // Use current reference date (latest sale date or local time)
    const latestTimestamp = validFilteredSales.length > 0
      ? Math.max(...validFilteredSales.map((s) => new Date(s.timestamp).getTime()))
      : new Date().getTime();

    const endDate = new Date(latestTimestamp);
    let daysToSubtract = 30;
    if (dateRange === '7D') daysToSubtract = 7;
    else if (dateRange === '14D') daysToSubtract = 14;
    else if (dateRange === '30D') daysToSubtract = 30;
    else if (dateRange === '60D') daysToSubtract = 60;
    else if (dateRange === '90D') daysToSubtract = 90;
    else if (dateRange === '12M') daysToSubtract = 365;

    const startDate = new Date(endDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    return validFilteredSales.filter((s) => {
      const t = new Date(s.timestamp).getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });
  }, [validFilteredSales, dateRange]);

  // ==========================================
  // 1. DAILY TREND AGGREGATION
  // ==========================================
  const dailyTrendData = useMemo<DailyTrendItem[]>(() => {
    if (validFilteredSales.length === 0) return [];

    const latestTimestamp = Math.max(...validFilteredSales.map((s) => new Date(s.timestamp).getTime()));
    const refEnd = new Date(latestTimestamp);
    refEnd.setHours(23, 59, 59, 999);

    let daysCount = 30;
    if (dateRange === '7D') daysCount = 7;
    else if (dateRange === '14D') daysCount = 14;
    else if (dateRange === '30D') daysCount = 30;
    else if (dateRange === '60D') daysCount = 60;
    else if (dateRange === '90D') daysCount = 90;
    else if (dateRange === '12M') daysCount = 120; // 120 days view for detailed daily chart in year mode
    else if (dateRange === 'ALL') daysCount = 60;

    const daysMap: Record<string, DailyTrendItem> = {};

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(refEnd.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().slice(0, 10);
      const dayName = DAY_NAMES_ID[d.getDay()];
      const label = `${d.getDate()} ${MONTH_NAMES_ID[d.getMonth()]}`;
      const fullDate = d.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      daysMap[dateKey] = {
        dateKey,
        label,
        fullDate,
        dayName,
        revenue: 0,
        hpp: 0,
        grossProfit: 0,
        marginPercent: 0,
        txCount: 0,
        aov: 0,
      };
    }

    validFilteredSales.forEach((s) => {
      const dateKey = s.timestamp.slice(0, 10);
      if (daysMap[dateKey]) {
        const netRev = s.grandTotal - (s.taxAmount || 0);
        const saleHpp = s.items.reduce((sum, item) => sum + (item.hppTotal || 0), 0);
        daysMap[dateKey].revenue += netRev;
        daysMap[dateKey].hpp += saleHpp;
        daysMap[dateKey].grossProfit += netRev - saleHpp;
        daysMap[dateKey].txCount += 1;
      }
    });

    const list = Object.values(daysMap);

    // Compute Margin, AOV & 7-Day Moving Average
    list.forEach((item, idx) => {
      item.marginPercent = item.revenue > 0 ? (item.grossProfit / item.revenue) * 100 : 0;
      item.aov = item.txCount > 0 ? Math.round(item.revenue / item.txCount) : 0;

      // Calculate 7-day trailing moving average
      const windowStart = Math.max(0, idx - 6);
      const windowSlice = list.slice(windowStart, idx + 1);
      const sumRev = windowSlice.reduce((acc, curr) => acc + curr.revenue, 0);
      item.movingAverage7d = Math.round(sumRev / windowSlice.length);
    });

    return list;
  }, [validFilteredSales, dateRange]);

  // ==========================================
  // 2. MONTHLY TREND AGGREGATION
  // ==========================================
  const monthlyTrendData = useMemo<MonthlyTrendItem[]>(() => {
    if (validFilteredSales.length === 0) return [];

    const monthsMap: Record<string, {
      monthKey: string;
      label: string;
      revenue: number;
      hpp: number;
      txCount: number;
      expenses: number;
    }> = {};

    // Determine span: last 12 months from latest sale
    const latestTimestamp = Math.max(...validFilteredSales.map((s) => new Date(s.timestamp).getTime()));
    const refDate = new Date(latestTimestamp);

    for (let m = 11; m >= 0; m--) {
      const targetDate = new Date(refDate.getFullYear(), refDate.getMonth() - m, 1);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;
      const label = `${MONTH_NAMES_ID[targetDate.getMonth()]} ${yyyy}`;

      monthsMap[monthKey] = {
        monthKey,
        label,
        revenue: 0,
        hpp: 0,
        txCount: 0,
        expenses: 0,
      };
    }

    // Populate Sales
    validFilteredSales.forEach((s) => {
      const monthKey = s.timestamp.slice(0, 7);
      if (monthsMap[monthKey]) {
        const netRev = s.grandTotal - (s.taxAmount || 0);
        const saleHpp = s.items.reduce((sum, item) => sum + (item.hppTotal || 0), 0);
        monthsMap[monthKey].revenue += netRev;
        monthsMap[monthKey].hpp += saleHpp;
        monthsMap[monthKey].txCount += 1;
      }
    });

    // Populate Expenses
    expenses.forEach((e) => {
      const monthKey = e.timestamp.slice(0, 7);
      if (monthsMap[monthKey]) {
        monthsMap[monthKey].expenses += e.amount;
      }
    });

    const rawList = Object.values(monthsMap);
    const resultList: MonthlyTrendItem[] = [];

    rawList.forEach((mItem, index) => {
      const grossProfit = mItem.revenue - mItem.hpp;
      const marginPercent = mItem.revenue > 0 ? (grossProfit / mItem.revenue) * 100 : 0;
      const aov = mItem.txCount > 0 ? Math.round(mItem.revenue / mItem.txCount) : 0;
      const netProfit = grossProfit - mItem.expenses;
      const achievementPercent = monthlyTarget > 0 ? (mItem.revenue / monthlyTarget) * 100 : 0;

      // Month-over-Month calculation
      let momGrowthPercent: number | null = null;
      if (index > 0) {
        const prevMonth = rawList[index - 1];
        if (prevMonth.revenue > 0) {
          momGrowthPercent = ((mItem.revenue - prevMonth.revenue) / prevMonth.revenue) * 100;
        } else if (mItem.revenue > 0) {
          momGrowthPercent = 100;
        }
      }

      resultList.push({
        monthKey: mItem.monthKey,
        label: mItem.label,
        revenue: mItem.revenue,
        hpp: mItem.hpp,
        grossProfit,
        marginPercent,
        txCount: mItem.txCount,
        aov,
        expenses: mItem.expenses,
        netProfit,
        targetRevenue: monthlyTarget,
        achievementPercent,
        momGrowthPercent,
      });
    });

    return resultList;
  }, [validFilteredSales, expenses, monthlyTarget]);

  // ==========================================
  // 3. DAY OF WEEK & HOURLY PATTERNS
  // ==========================================
  const dayOfWeekData = useMemo<DayOfWeekItem[]>(() => {
    const days: DayOfWeekItem[] = [
      { dayIndex: 1, dayName: 'Senin', revenue: 0, txCount: 0, avgRevenuePerTx: 0 },
      { dayIndex: 2, dayName: 'Selasa', revenue: 0, txCount: 0, avgRevenuePerTx: 0 },
      { dayIndex: 3, dayName: 'Rabu', revenue: 0, txCount: 0, avgRevenuePerTx: 0 },
      { dayIndex: 4, dayName: 'Kamis', revenue: 0, txCount: 0, avgRevenuePerTx: 0 },
      { dayIndex: 5, dayName: 'Jumat', revenue: 0, txCount: 0, avgRevenuePerTx: 0 },
      { dayIndex: 6, dayName: 'Sabtu', revenue: 0, txCount: 0, avgRevenuePerTx: 0 },
      { dayIndex: 0, dayName: 'Minggu', revenue: 0, txCount: 0, avgRevenuePerTx: 0 },
    ];

    windowSales.forEach((s) => {
      const d = new Date(s.timestamp).getDay();
      const target = days.find((x) => x.dayIndex === d);
      if (target) {
        const net = s.grandTotal - (s.taxAmount || 0);
        target.revenue += net;
        target.txCount += 1;
      }
    });

    days.forEach((item) => {
      item.avgRevenuePerTx = item.txCount > 0 ? Math.round(item.revenue / item.txCount) : 0;
    });

    return days;
  }, [windowSales]);

  const hourlyData = useMemo<HourlyItem[]>(() => {
    const hours: HourlyItem[] = [];
    for (let h = 8; h <= 21; h++) {
      hours.push({
        hour: `${String(h).padStart(2, '0')}:00`,
        revenue: 0,
        txCount: 0,
      });
    }

    windowSales.forEach((s) => {
      const h = new Date(s.timestamp).getHours();
      if (h >= 8 && h <= 21) {
        const idx = h - 8;
        hours[idx].revenue += s.grandTotal - (s.taxAmount || 0);
        hours[idx].txCount += 1;
      }
    });

    return hours;
  }, [windowSales]);

  // Category Contribution
  const categoryContribution = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; profit: number }> = {};
    windowSales.forEach((s) => {
      s.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const cat = categories.find((c) => c.id === prod?.categoryId);
        const catName = cat ? cat.name : 'Lainnya';
        if (!map[catName]) {
          map[catName] = { name: catName, revenue: 0, profit: 0 };
        }
        map[catName].revenue += item.subtotal;
        map[catName].profit += item.subtotal - (item.hppTotal || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [windowSales, products, categories]);

  // Payment Method Breakdown
  const paymentMethodBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    windowSales.forEach((s) => {
      map[s.paymentMethod] = (map[s.paymentMethod] || 0) + s.grandTotal;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [windowSales]);

  // ==========================================
  // 4. EXECUTIVE SUMMARY METRICS
  // ==========================================
  const summaryMetrics = useMemo(() => {
    const totalRevenue = windowSales.reduce((acc, s) => acc + s.grandTotal - (s.taxAmount || 0), 0);
    const totalHpp = windowSales.reduce(
      (acc, s) => acc + s.items.reduce((iSum, item) => iSum + (item.hppTotal || 0), 0),
      0
    );
    const totalGrossProfit = totalRevenue - totalHpp;
    const grossMarginPercent = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const totalTransactions = windowSales.length;
    const aov = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    // Daily Average & Peak Day in active daily list
    const activeDaysWithSales = dailyTrendData.filter((d) => d.revenue > 0);
    const dailyAverageRevenue =
      activeDaysWithSales.length > 0
        ? Math.round(
            activeDaysWithSales.reduce((acc, d) => acc + d.revenue, 0) / activeDaysWithSales.length
          )
        : 0;

    const peakDay =
      dailyTrendData.length > 0
        ? [...dailyTrendData].sort((a, b) => b.revenue - a.revenue)[0]
        : null;

    // Current Month Run-Rate Projection
    const latestMonth = monthlyTrendData[monthlyTrendData.length - 1];
    const currentMonthRevenue = latestMonth ? latestMonth.revenue : 0;
    const currentMonthTx = latestMonth ? latestMonth.txCount : 0;

    // Estimate month run rate based on day of month (e.g., day 24 / 30)
    const today = new Date();
    const dayOfMonth = Math.max(1, Math.min(30, today.getDate()));
    const daysInMonth = 30;
    const projectedMonthEndRevenue =
      currentMonthRevenue > 0
        ? Math.round((currentMonthRevenue / dayOfMonth) * daysInMonth)
        : 0;

    // Latest MoM Growth from previous month
    const previousMonth =
      monthlyTrendData.length >= 2 ? monthlyTrendData[monthlyTrendData.length - 2] : null;
    const momGrowth = latestMonth?.momGrowthPercent ?? null;

    return {
      totalRevenue,
      totalHpp,
      totalGrossProfit,
      grossMarginPercent,
      totalTransactions,
      aov,
      dailyAverageRevenue,
      peakDay,
      currentMonthRevenue,
      currentMonthTx,
      projectedMonthEndRevenue,
      previousMonthRevenue: previousMonth ? previousMonth.revenue : 0,
      momGrowth,
    };
  }, [windowSales, dailyTrendData, monthlyTrendData]);

  // Export CSV handler for Daily or Monthly view
  const handleExportCSV = () => {
    if (granularity === 'MONTHLY') {
      const headers = [
        'Bulan',
        'Omzet Pendapatan (IDR)',
        'HPP Modal (IDR)',
        'Laba Kotor (IDR)',
        'Margin (%)',
        'Jumlah Transaksi',
        'Rata-rata Keranjang AOV (IDR)',
        'Beban Operasional (IDR)',
        'Laba Bersih (IDR)',
        'Target Omzet (IDR)',
        'Pencapaian Target (%)',
        'Pertumbuhan MoM (%)',
      ];
      const rows = monthlyTrendData.map((m) => [
        `"${m.label}"`,
        m.revenue,
        m.hpp,
        m.grossProfit,
        m.marginPercent.toFixed(2),
        m.txCount,
        m.aov,
        m.expenses,
        m.netProfit,
        m.targetRevenue,
        m.achievementPercent.toFixed(1),
        m.momGrowthPercent !== null ? m.momGrowthPercent.toFixed(2) : '-',
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Tren_Pendapatan_Bulanan_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast?.('Data tren pendapatan bulanan berhasil diekspor ke CSV!', 'success');
    } else {
      const headers = [
        'Tanggal',
        'Hari',
        'Omzet Penjualan (IDR)',
        'HPP Modal (IDR)',
        'Laba Kotor (IDR)',
        'Margin (%)',
        'Jumlah Transaksi',
        'AOV (IDR)',
        '7-Day Moving Avg (IDR)',
      ];
      const rows = dailyTrendData.map((d) => [
        `"${d.dateKey}"`,
        `"${d.dayName}"`,
        d.revenue,
        d.hpp,
        d.grossProfit,
        d.marginPercent.toFixed(2),
        d.txCount,
        d.aov,
        d.movingAverage7d ?? 0,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Tren_Pendapatan_Harian_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast?.('Data tren pendapatan harian berhasil diekspor ke CSV!', 'success');
    }
  };

  const PIE_COLORS = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2'];

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* 1. Header & Navigation Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200 pb-4 sm:pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-700 text-white rounded-xl shadow-xs shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Business Intelligence</span>
                <span aria-hidden="true">&middot;</span>
                <span>Analisis Pendapatan Toko</span>
                <span aria-hidden="true">&middot;</span>
                <span className="font-mono tabular-nums">{sales.length} Total Transaksi</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Tren Pendapatan Harian & Bulanan
              </h1>
            </div>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Refresh */}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Segarkan data terbaru"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          {/* Seed Sample Historical Data button if sales count is small or user wants simulation */}
          <button
            onClick={handleSeedHistoricalData}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            title="Muat data transaksi 6 bulan untuk visualisasi mendalam"
          >
            <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Membuat Data...' : 'Muat Data Tren Historis (6 Bulan)'}</span>
          </button>

          {/* Export Monthly PDF Report Button */}
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Ekspor Ringkasan Laporan Penjualan & Keuangan Bulanan ke Dokumen PDF Resmi"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Laporan PDF Bulanan</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Unduh laporan tren ke format CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Granularity & Period Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        {/* Granularity Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setGranularity('OVERVIEW')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              granularity === 'OVERVIEW'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ikhtisar (Overview)
          </button>
          <button
            onClick={() => setGranularity('DAILY')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              granularity === 'DAILY'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tren Harian (Daily)
          </button>
          <button
            onClick={() => setGranularity('MONTHLY')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              granularity === 'MONTHLY'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tren Bulanan (Monthly)
          </button>
        </div>

        {/* Date Window Filters & Display Options */}
        <div className="flex flex-wrap items-center gap-2">
          {granularity !== 'MONTHLY' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              {(['7D', '14D', '30D', '60D', '90D', 'ALL'] as DateRangeOption[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    dateRange === r
                      ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r === '7D'
                    ? '7 Hari'
                    : r === '14D'
                    ? '14 Hari'
                    : r === '30D'
                    ? '30 Hari'
                    : r === '60D'
                    ? '60 Hari'
                    : r === '90D'
                    ? '90 Hari'
                    : 'Semua'}
                </button>
              ))}
            </div>
          )}

          {/* Metric Focus Selector */}
          <select
            value={metricFocus}
            onChange={(e) => setMetricFocus(e.target.value as MetricFocus)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
          >
            <option value="REVENUE">Fokus: Omzet Pendapatan</option>
            <option value="PROFIT">Fokus: Laba Kotor & Margin</option>
            <option value="TRANSACTIONS">Fokus: Volume Transaksi</option>
            <option value="AOV">Fokus: Nilai Rata-rata Keranjang (AOV)</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            value={selectedPayment}
            onChange={(e) => setSelectedPayment(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
          >
            <option value="ALL">Semua Pembayaran</option>
            <option value="TUNAI">Tunai</option>
            <option value="QRIS">QRIS</option>
            <option value="TRANSFER">Transfer Bank</option>
            <option value="DEBIT">Debit</option>
          </select>
        </div>
      </div>

      {/* 3. Executive KPI Metric Strip (Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Omzet */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Omzet Pendapatan Bersih</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight font-mono tabular-nums">
            Rp {summaryMetrics.totalRevenue.toLocaleString('id-ID')}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{summaryMetrics.totalTransactions} transaksi</span>
            <span aria-hidden="true">&middot;</span>
            <span className="font-mono tabular-nums">AOV: Rp {summaryMetrics.aov.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Laba Kotor & Margin */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Laba Kotor & Margin</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-800 tracking-tight font-mono tabular-nums">
            Rp {summaryMetrics.totalGrossProfit.toLocaleString('id-ID')}
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-700 font-semibold">
            <span>Margin Kotor:</span>
            <span className="font-mono tabular-nums">{summaryMetrics.grossMarginPercent.toFixed(1)}%</span>
            <span className="text-slate-400 font-normal ml-1">
              (HPP: Rp {(summaryMetrics.totalHpp / 1000).toLocaleString('id-ID')}k)
            </span>
          </div>
        </div>

        {/* Rata-rata Harian & Peak Day */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Rata-rata Omzet Harian</span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight font-mono tabular-nums">
            Rp {summaryMetrics.dailyAverageRevenue.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {summaryMetrics.peakDay ? (
              <span>
                Puncak: {summaryMetrics.peakDay.label} (Rp{' '}
                {(summaryMetrics.peakDay.revenue / 1000).toLocaleString('id-ID')}k)
              </span>
            ) : (
              <span>Belum ada data harian</span>
            )}
          </div>
        </div>

        {/* Proyeksi Run-Rate Bulanan */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Proyeksi Akhir Bulan (Run-Rate)</span>
            <Target className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900 tracking-tight font-mono tabular-nums">
            Rp {summaryMetrics.projectedMonthEndRevenue.toLocaleString('id-ID')}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            {summaryMetrics.momGrowth !== null ? (
              <span
                className={`flex items-center font-semibold font-mono tabular-nums ${
                  summaryMetrics.momGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {summaryMetrics.momGrowth >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {Math.abs(summaryMetrics.momGrowth).toFixed(1)}% MoM
              </span>
            ) : (
              <span>Target: Rp {(monthlyTarget / 1000000).toFixed(0)} Juta</span>
            )}
            <span aria-hidden="true">&middot;</span>
            <span className="font-mono tabular-nums">
              Bulan Berjalan: Rp {(summaryMetrics.currentMonthRevenue / 1000000).toFixed(1)}M
            </span>
          </div>
        </div>
      </div>

      {/* Notice if no sales exist */}
      {sales.length === 0 && (
        <div className="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Belum ada data transaksi tersimpan di database lokal
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mulai catat transaksi penjualan di menu POS Kasir, atau buat data simulasi historis
                (6 bulan) untuk mengeksplorasi visualisasi tren pendapatan sekarang.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeedHistoricalData}
            disabled={isSeeding}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {isSeeding ? 'Membuat Data...' : 'Isi Data Simulasi Historis'}
          </button>
        </div>
      )}

      {/* 4. MAIN VISUALIZATION: Daily or Monthly Trend Chart */}
      {(granularity === 'OVERVIEW' || granularity === 'DAILY') && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Visualisasi Harian
                </span>
                <span className="text-xs text-slate-400">&middot;</span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Rentang: {dailyTrendData.length} Hari Terakhir
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                Tren Pendapatan & Profitabilitas Harian (Daily Sales & Profit)
              </h2>
            </div>

            {/* Chart Options Toggle */}
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={showMovingAverage}
                  onChange={(e) => setShowMovingAverage(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-600"
                />
                <span>7-Day Moving Avg</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={showTargetLine}
                  onChange={(e) => setShowTargetLine(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-600"
                />
                <span>Target Harian</span>
              </label>

              <div className="flex items-center gap-1 text-slate-400">
                <span>Target:</span>
                <input
                  type="number"
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(Number(e.target.value) || 0)}
                  className="w-24 px-1.5 py-0.5 border border-slate-200 rounded text-slate-800 font-mono tabular-nums text-xs"
                />
              </div>
            </div>
          </div>

          {/* Daily Recharts Area/Composed Chart */}
          <div className="h-64 sm:h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dailyTrendData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dailyRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="dailyProfitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  tickFormatter={(v) => `Rp ${(v / 1000).toLocaleString('id-ID')}k`}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(val: any, name: any) => {
                    if (name === 'Margin Kotor (%)') return [`${Number(val).toFixed(1)}%`, name];
                    if (name === 'Jumlah Transaksi') return [`${val} struk`, name];
                    return [`Rp ${Number(val).toLocaleString('id-ID')}`, name];
                  }}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload as DailyTrendItem | undefined;
                    return item ? item.fullDate : _label;
                  }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                  iconType="circle"
                />

                {showTargetLine && (
                  <ReferenceLine
                    y={dailyTarget}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Target Harian (Rp ${(dailyTarget / 1000).toLocaleString('id-ID')}k)`,
                      fill: '#dc2626',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                )}

                {/* Primary Metric based on focus */}
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Omzet Penjualan"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fill="url(#dailyRevenueGradient)"
                />

                <Area
                  type="monotone"
                  dataKey="grossProfit"
                  name="Laba Kotor"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#dailyProfitGradient)"
                />

                {showMovingAverage && (
                  <Line
                    type="monotone"
                    dataKey="movingAverage7d"
                    name="Tren Rata-rata 7 Hari (Moving Avg)"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="3 3"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 5. MONTHLY REVENUE & TARGET TRAJECTORY CHART */}
      {(granularity === 'OVERVIEW' || granularity === 'MONTHLY') && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
                  Visualisasi Bulanan (12 Bulan Terakhir)
                </span>
                <span className="text-xs text-slate-400">&middot;</span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {monthlyTrendData.length} Bulan Terdata
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                Tren Pendapatan Bulanan, Beban & Laba Bersih (Monthly Trajectory)
              </h2>
            </div>

            {/* Target input */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Target Bulanan:</span>
              <input
                type="number"
                value={monthlyTarget}
                onChange={(e) => setMonthlyTarget(Number(e.target.value) || 0)}
                className="w-28 px-2 py-1 border border-slate-200 rounded-lg text-slate-800 font-mono tabular-nums text-xs"
              />
            </div>
          </div>

          {/* Monthly Bar + Line Composed Chart */}
          <div className="h-64 sm:h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyTrendData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => `Rp ${(v / 1000000).toLocaleString('id-ID')}Jt`}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: '#d97706' }}
                  tickLine={false}
                  axisLine={false}
                  domain={[-50, 100]}
                />
                <Tooltip
                  formatter={(val: any, name: any) => {
                    if (name === 'Pertumbuhan MoM') {
                      return [val !== null ? `${Number(val).toFixed(1)}%` : '-', name];
                    }
                    if (name === 'Pencapaian Target (%)') return [`${Number(val).toFixed(1)}%`, name];
                    return [`Rp ${Number(val).toLocaleString('id-ID')}`, name];
                  }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                  iconType="circle"
                />

                <ReferenceLine
                  yAxisId="left"
                  y={monthlyTarget}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Target Bulanan (Rp ${(monthlyTarget / 1000000).toFixed(0)} Jt)`,
                    fill: '#dc2626',
                    fontSize: 10,
                    position: 'top',
                  }}
                />

                {/* Monthly Revenue Bar */}
                <Bar
                  yAxisId="left"
                  dataKey="revenue"
                  name="Omzet Bulanan"
                  fill="#059669"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />

                {/* Modal HPP Bar */}
                <Bar
                  yAxisId="left"
                  dataKey="hpp"
                  name="HPP Modal Barang"
                  fill="#94a3b8"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />

                {/* Laba Bersih Line */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="netProfit"
                  name="Laba Bersih Setelah Biaya"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563eb' }}
                />

                {/* MoM Growth Line */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="momGrowthPercent"
                  name="Pertumbuhan MoM"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#d97706' }}
                  strokeDasharray="2 2"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 6. SECONDARY BI INSIGHTS: Day of Week & Hourly Distributions & Category Contribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pola Pendapatan Hari dalam Seminggu */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pola Hari dalam Seminggu</h2>
              <p className="text-xs text-slate-500">Omzet rata-rata berdasarkan hari belanja</p>
            </div>
            <CalendarRange className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dayName" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(v: any) => [`Rp ${Number(v).toLocaleString('id-ID')}`, 'Omzet']}
                  contentStyle={{
                    borderRadius: '0.5rem',
                    fontSize: '11px',
                    borderColor: '#cbd5e1',
                  }}
                />
                <Bar
                  dataKey="revenue"
                  name="Total Omzet"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-2 font-mono tabular-nums">
            <span>Puncak Belanja: Akhir Pekan (Sabtu & Minggu)</span>
            <span>{dayOfWeekData.reduce((s, d) => s + d.txCount, 0)} Total Sesi</span>
          </div>
        </div>

        {/* Distribusi Jam Sibuk Kasir */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Distribusi Jam Sibuk (Peak Hours)</h2>
              <p className="text-xs text-slate-500">Volume transaksi per jam operasional</p>
            </div>
            <ShoppingBag className="w-4 h-4 text-blue-600" />
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(v: any, name: any) => [
                    name === 'txCount' ? `${v} transaksi` : `Rp ${Number(v).toLocaleString('id-ID')}`,
                    name === 'txCount' ? 'Jumlah Transaksi' : 'Omzet Jam',
                  ]}
                  contentStyle={{
                    borderRadius: '0.5rem',
                    fontSize: '11px',
                    borderColor: '#cbd5e1',
                  }}
                />
                <Bar
                  dataKey="revenue"
                  name="Omzet Jam"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-2">
            <span>Pagi (08:00-11:00) &amp; Sore (16:00-19:00)</span>
            <span className="font-mono tabular-nums">Buka 08:00 - 21:00</span>
          </div>
        </div>

        {/* Kontribusi Kategori & Metode Pembayaran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Kontribusi Kategori Produk</h2>
              <p className="text-xs text-slate-500">Porsi omzet per segmen barang</p>
            </div>
            <PieIcon className="w-4 h-4 text-amber-600" />
          </div>

          <div className="h-60 w-full pt-1 flex items-center justify-center">
            {categoryContribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryContribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="revenue"
                  >
                    {categoryContribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => `Rp ${Number(v).toLocaleString('id-ID')}`}
                    contentStyle={{
                      borderRadius: '0.5rem',
                      fontSize: '11px',
                      borderColor: '#cbd5e1',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400 text-center">Belum ada data kategori</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1 text-[11px] border-t border-slate-100 pt-2">
            {categoryContribution.slice(0, 4).map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="truncate text-slate-700">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. DETAILED BREAKDOWN DATA TABLE (Collapsible) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div
          onClick={() => setIsTableExpanded(!isTableExpanded)}
          className="p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Tabel Angka Rinci &amp; Performa {granularity === 'MONTHLY' ? 'Bulanan' : 'Harian'}
            </h2>
            <span className="text-xs text-slate-400">
              ({granularity === 'MONTHLY' ? monthlyTrendData.length : dailyTrendData.length} baris data)
            </span>
          </div>
          <button className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
            <span>{isTableExpanded ? 'Sembunyikan' : 'Buka Tabel Rinci'}</span>
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${
                isTableExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>
        </div>

        {isTableExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">
                    {granularity === 'MONTHLY' ? 'Bulan' : 'Tanggal & Hari'}
                  </th>
                  <th className="py-2.5 px-4 text-right">Omzet Pendapatan</th>
                  <th className="py-2.5 px-4 text-right">HPP Modal</th>
                  <th className="py-2.5 px-4 text-right">Laba Kotor</th>
                  <th className="py-2.5 px-4 text-right">Margin (%)</th>
                  <th className="py-2.5 px-4 text-right">Jumlah Tx</th>
                  <th className="py-2.5 px-4 text-right">Rata-rata Keranjang (AOV)</th>
                  {granularity === 'MONTHLY' ? (
                    <>
                      <th className="py-2.5 px-4 text-right">Laba Bersih</th>
                      <th className="py-2.5 px-4 text-right">Target Omzet</th>
                      <th className="py-2.5 px-4 text-right">MoM Growth</th>
                    </>
                  ) : (
                    <th className="py-2.5 px-4 text-right">7-Day Moving Avg</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {granularity === 'MONTHLY'
                  ? monthlyTrendData.map((row) => (
                      <tr key={row.monthKey} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-4 font-sans font-medium text-slate-900">{row.label}</td>
                        <td className="py-2 px-4 text-right text-slate-900 font-semibold">
                          Rp {row.revenue.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-500">
                          Rp {row.hpp.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-4 text-right text-blue-700 font-semibold">
                          Rp {row.grossProfit.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-700">
                          {row.marginPercent.toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 text-right text-slate-700">{row.txCount}</td>
                        <td className="py-2 px-4 text-right text-slate-700">
                          Rp {row.aov.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-4 text-right text-emerald-700 font-semibold">
                          Rp {row.netProfit.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-500">
                          Rp {row.targetRevenue.toLocaleString('id-ID')} ({row.achievementPercent.toFixed(0)}%)
                        </td>
                        <td className="py-2 px-4 text-right font-semibold">
                          {row.momGrowthPercent !== null ? (
                            <span
                              className={
                                row.momGrowthPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }
                            >
                              {row.momGrowthPercent >= 0 ? '+' : ''}
                              {row.momGrowthPercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  : dailyTrendData.map((row) => (
                      <tr key={row.dateKey} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-4 font-sans">
                          <span className="font-semibold text-slate-900">{row.label}</span>
                          <span className="text-slate-400 ml-1.5 text-[11px]">({row.dayName})</span>
                        </td>
                        <td className="py-2 px-4 text-right text-slate-900 font-semibold">
                          Rp {row.revenue.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-500">
                          Rp {row.hpp.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-4 text-right text-blue-700 font-semibold">
                          Rp {row.grossProfit.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-700">
                          {row.marginPercent.toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 text-right text-slate-700">{row.txCount}</td>
                        <td className="py-2 px-4 text-right text-slate-700">
                          Rp {row.aov.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-4 text-right text-amber-700 font-semibold">
                          {row.movingAverage7d ? `Rp ${row.movingAverage7d.toLocaleString('id-ID')}` : '-'}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
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

export default RevenueTrendsDashboard;

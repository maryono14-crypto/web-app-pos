import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../db/indexedDB';
import { Product, Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  Layers,
  Store,
  RefreshCw,
  BarChart3,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { settings, activeShift, setShiftModalOpen, isOnline, pendingSyncCount, syncNow, isSyncing } =
    useApp();
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const todayStr = new Date().toDateString();
    Promise.all([db.sales.toArray(), db.products.toArray()]).then(([salesList, allProducts]) => {
      setAllSales(salesList);
      setTodaySales(
        salesList.filter(
          (s) => s.status !== 'VOID' && new Date(s.timestamp).toDateString() === todayStr
        )
      );
      setProducts(allProducts);
    });
  }, []);

  // 7-day revenue trend for quick dashboard widget
  const recentTrendData = useMemo(() => {
    const now = new Date();
    const days: { label: string; revenue: number; profit: number }[] = [];
    const dateMap: Record<string, { label: string; revenue: number; profit: number }> = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      dateMap[key] = { label, revenue: 0, profit: 0 };
      days.push(dateMap[key]);
    }

    allSales.forEach((s) => {
      if (s.status === 'VOID') return;
      const key = s.timestamp.slice(0, 10);
      if (dateMap[key]) {
        const net = s.grandTotal - (s.taxAmount || 0);
        const hpp = s.items.reduce((sum, item) => sum + (item.hppTotal || 0), 0);
        dateMap[key].revenue += net;
        dateMap[key].profit += net - hpp;
      }
    });

    return days;
  }, [allSales]);

  const todayRevenue = todaySales.reduce((s, sale) => s + sale.grandTotal, 0);
  const todayHpp = todaySales.reduce(
    (s, sale) => s + sale.items.reduce((sum, item) => sum + (item.hppTotal || 0), 0),
    0
  );
  const todayProfit = todayRevenue - todayHpp;
  const todayMargin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

  const lowStockItems = products.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStock);
  const outOfStockItems = products.filter((p) => p.currentStock <= 0);
  const totalStockValuation = products.reduce(
    (s, p) => s + p.currentStock * (p.avgCostPrice || p.costPrice),
    0
  );

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Welcome & Status Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              <Store className="w-4 h-4" />
              <span>{settings?.storeName || 'Toko Berkah Sejahtera'}</span>
              <span>&bull;</span>
              <span>HPP {settings?.costingMethod || 'FIFO'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">Dashboard Bisnis & Operasional Kasir</h1>
            <p className="text-xs text-emerald-100/80 mt-1 max-w-xl">
              Sistem kasir POS, mutasi persediaan batch, rekonsiliasi shift laci, dan analisis laba
              rugi terintegrasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              onClick={() => onNavigate('pos')}
              className="px-5 py-2.5 rounded-xl bg-white text-emerald-900 font-bold text-xs hover:bg-emerald-50 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-700" />
              <span>Buka Kasir POS</span>
            </button>
            <button
              onClick={() => setShiftModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-white font-semibold text-xs border border-emerald-600/50 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>{activeShift ? 'Monitor Shift Kasir' : 'Buka Shift Baru'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sync Warning if pending */}
      {pendingSyncCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Terdapat <strong>{pendingSyncCount} transaksi / data</strong> di antrean lokal
              IndexedDB yang belum disinkronkan ke Cloud Firestore.
            </span>
          </div>
          <button
            onClick={syncNow}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sinkron...' : 'Sinkron Sekarang'}</span>
          </button>
        </div>
      )}

      {/* Today's Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Omzet Hari Ini */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Omzet Penjualan Hari Ini</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            Rp {todayRevenue.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500">{todaySales.length} transaksi selesai</p>
        </div>

        {/* Laba Kotor Hari Ini */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Laba Kotor Hari Ini</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            Rp {todayProfit.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-emerald-600 font-bold">
            Margin: {todayMargin.toFixed(1)}% (HPP: Rp {todayHpp.toLocaleString('id-ID')})
          </p>
        </div>

        {/* Nilai Persediaan Total */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Total Valuasi Persediaan</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            Rp {totalStockValuation.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500">{products.length} item SKU terdaftar</p>
        </div>

        {/* Status Shift Kasir */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Laci Kasir Shift</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {activeShift ? `Rp ${activeShift.expectedEndingCash.toLocaleString('id-ID')}` : 'Tutup'}
          </div>
          <p className="text-[11px] text-blue-600 font-semibold">
            {activeShift ? `Kasir: ${activeShift.cashierName}` : 'Belum buka shift'}
          </p>
        </div>
      </div>

      {/* 7-Day Revenue Trend Card (Recharts) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tren Pendapatan 7 Hari Terakhir</h2>
              <p className="text-xs text-slate-400">Pergerakan omzet dan laba harian toko</p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('analytics')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Dashboard BI Lengkap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-44 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={recentTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="dashProfitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `${(v / 1000).toLocaleString('id-ID')}k`}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(val: any, name: any) => [
                  `Rp ${Number(val).toLocaleString('id-ID')}`,
                  name === 'revenue' ? 'Omzet' : 'Laba',
                ]}
                contentStyle={{
                  borderRadius: '0.5rem',
                  fontSize: '11px',
                  borderColor: '#cbd5e1',
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Omzet"
                stroke="#059669"
                strokeWidth={2}
                fill="url(#dashRevGrad)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Laba"
                stroke="#2563eb"
                strokeWidth={1.5}
                fill="url(#dashProfitGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stock Alerts & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-sm">
                Peringatan Stok Menipis & Habis ({lowStockItems.length + outOfStockItems.length} SKU)
              </h3>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Buka Inventaris</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {lowStockItems.length === 0 && outOfStockItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
                <p className="font-medium text-slate-700">Seluruh stok barang dalam kondisi aman!</p>
              </div>
            ) : (
              [...outOfStockItems, ...lowStockItems].slice(0, 5).map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">{p.name}</span>
                    <span className="block text-[11px] text-slate-400 font-mono">
                      SKU: {p.sku} &bull; Min. Stok: {p.minStock} {p.unit}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-black text-sm ${
                        p.currentStock <= 0 ? 'text-rose-600' : 'text-amber-700'
                      }`}
                    >
                      {p.currentStock <= 0 ? 'Habis (0)' : `Sisa ${p.currentStock} ${p.unit}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Nav Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Aksi Cepat & Navigasi</h3>
          <div className="space-y-2">
            {[
              { id: 'pos', label: 'Kasir Penjualan Baru', desc: 'Transaksi cepat barcode & struk' },
              { id: 'purchases', label: 'Buat PO Pembelian', desc: 'Pesan stok barang ke supplier' },
              { id: 'inventory', label: 'Stok Opname Fisik', desc: 'Penyesuaian saldo persediaan' },
              { id: 'finance', label: 'Catat Biaya Toko', desc: 'Pengeluaran kas kecil operasional' },
              { id: 'analytics', label: 'Lihat Laporan Laba Rugi', desc: 'Analisis laba kotor & omzet' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => onNavigate(btn.id)}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition-all group flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-xs text-slate-800 group-hover:text-emerald-800">
                    {btn.label}
                  </div>
                  <div className="text-[10px] text-slate-400">{btn.desc}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

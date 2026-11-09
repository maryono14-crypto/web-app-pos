import React, { useMemo, useState } from 'react';
import { Customer, CustomerTier, LoyaltyLog, Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Award,
  TrendingUp,
  Users,
  Sparkles,
  ShoppingBag,
  Repeat,
  Crown,
  Search,
  Filter,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Calendar,
  AlertTriangle,
  Flame,
  Star,
  CheckCircle2,
  DollarSign,
  PieChart as PieIcon,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
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
  AreaChart,
  Area,
} from 'recharts';

interface LoyaltyAnalyticsDashboardProps {
  customers: Customer[];
  loyaltyLogs: LoyaltyLog[];
  sales: Sale[];
  onSelectCustomer: (customer: Customer) => void;
  onOpenAdjustPoints: (customer: Customer) => void;
}

type SortMetric = 'POINTS' | 'SPEND' | 'FREQUENCY' | 'AOV';
type FrequencySegment = 'ALL' | 'VIP_10_PLUS' | 'REGULAR_5_9' | 'OCCASIONAL_2_4' | 'NEW_1';

export const LoyaltyAnalyticsDashboard: React.FC<LoyaltyAnalyticsDashboardProps> = ({
  customers,
  loyaltyLogs,
  sales,
  onSelectCustomer,
  onOpenAdjustPoints,
}) => {
  const { settings } = useApp();

  const [sortMetric, setSortMetric] = useState<SortMetric>('SPEND');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('ALL');
  const [selectedFrequencyFilter, setSelectedFrequencyFilter] = useState<FrequencySegment>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const redemptionValue = settings?.loyaltyPointRedemptionValue || 100;

  // Enrich customer records with sales data calculations
  const enrichedCustomers = useMemo(() => {
    return customers.map((c) => {
      // Find all sales for this customer
      const custSales = sales.filter((s) => s.customerId === c.id && s.status !== 'VOID');
      const salesCount = custSales.length;
      const visits = Math.max(c.totalVisits || 0, salesCount);
      const spend = c.totalSpend || custSales.reduce((sum, s) => sum + s.grandTotal, 0);
      const aov = visits > 0 ? Math.round(spend / visits) : 0;

      // Calculate days since last visit
      let lastVisitDate: Date | null = null;
      if (custSales.length > 0) {
        const sortedSales = [...custSales].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        lastVisitDate = new Date(sortedSales[0].timestamp);
      } else if (c.updatedAt) {
        lastVisitDate = new Date(c.updatedAt);
      } else if (c.createdAt) {
        lastVisitDate = new Date(c.createdAt);
      }

      const daysSinceLastVisit = lastVisitDate
        ? Math.max(0, Math.floor((Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 999;

      // Frequency classification
      let frequencyCategory: 'VIP_10_PLUS' | 'REGULAR_5_9' | 'OCCASIONAL_2_4' | 'NEW_1' = 'NEW_1';
      let frequencyLabel = 'Pelanggan Baru (1x)';
      let frequencyBadgeColor = 'bg-slate-100 text-slate-700 border-slate-200';

      if (visits >= 10) {
        frequencyCategory = 'VIP_10_PLUS';
        frequencyLabel = 'Super VIP (10+ Kunjungan)';
        frequencyBadgeColor = 'bg-purple-100 text-purple-800 border-purple-200 font-bold';
      } else if (visits >= 5) {
        frequencyCategory = 'REGULAR_5_9';
        frequencyLabel = 'Pelanggan Rutin (5-9x)';
        frequencyBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold';
      } else if (visits >= 2) {
        frequencyCategory = 'OCCASIONAL_2_4';
        frequencyLabel = 'Pelanggan Berkala (2-4x)';
        frequencyBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
      }

      // Customer retention status
      let retentionStatus: 'ACTIVE' | 'WARM' | 'AT_RISK' = 'ACTIVE';
      if (daysSinceLastVisit > 45 && visits >= 3) {
        retentionStatus = 'AT_RISK'; // Was frequent, but hasn't visited in 45+ days
      } else if (daysSinceLastVisit > 21) {
        retentionStatus = 'WARM';
      }

      return {
        ...c,
        computedVisits: visits,
        computedSpend: spend,
        aov,
        lastVisitDate,
        daysSinceLastVisit,
        frequencyCategory,
        frequencyLabel,
        frequencyBadgeColor,
        retentionStatus,
      };
    });
  }, [customers, sales]);

  // Frequency Segments Distribution
  const frequencySegmentsData = useMemo(() => {
    const segments = {
      VIP_10_PLUS: { label: 'Super VIP (≥10x)', count: 0, totalSpend: 0, totalPoints: 0 },
      REGULAR_5_9: { label: 'Rutin (5-9x)', count: 0, totalSpend: 0, totalPoints: 0 },
      OCCASIONAL_2_4: { label: 'Berkala (2-4x)', count: 0, totalSpend: 0, totalPoints: 0 },
      NEW_1: { label: 'Baru (1x)', count: 0, totalSpend: 0, totalPoints: 0 },
    };

    enrichedCustomers.forEach((c) => {
      const seg = segments[c.frequencyCategory];
      if (seg) {
        seg.count += 1;
        seg.totalSpend += c.computedSpend;
        seg.totalPoints += c.pointsBalance || 0;
      }
    });

    return [
      {
        key: 'VIP_10_PLUS',
        name: 'Super VIP (≥10x)',
        count: segments.VIP_10_PLUS.count,
        omzet: segments.VIP_10_PLUS.totalSpend,
        points: segments.VIP_10_PLUS.totalPoints,
      },
      {
        key: 'REGULAR_5_9',
        name: 'Rutin (5-9x)',
        count: segments.REGULAR_5_9.count,
        omzet: segments.REGULAR_5_9.totalSpend,
        points: segments.REGULAR_5_9.totalPoints,
      },
      {
        key: 'OCCASIONAL_2_4',
        name: 'Berkala (2-4x)',
        count: segments.OCCASIONAL_2_4.count,
        omzet: segments.OCCASIONAL_2_4.totalSpend,
        points: segments.OCCASIONAL_2_4.totalPoints,
      },
      {
        key: 'NEW_1',
        name: 'Baru (1x)',
        count: segments.NEW_1.count,
        omzet: segments.NEW_1.totalSpend,
        points: segments.NEW_1.totalPoints,
      },
    ];
  }, [enrichedCustomers]);

  // Overall Frequency & Loyalty Metrics
  const summaryMetrics = useMemo(() => {
    const totalCount = enrichedCustomers.length;
    if (totalCount === 0) {
      return {
        avgVisits: 0,
        avgSpend: 0,
        avgAov: 0,
        repeatRate: 0,
        totalPoints: 0,
        atRiskCount: 0,
        championCust: null,
      };
    }

    const totalVisits = enrichedCustomers.reduce((s, c) => s + c.computedVisits, 0);
    const totalSpend = enrichedCustomers.reduce((s, c) => s + c.computedSpend, 0);
    const repeatShoppers = enrichedCustomers.filter((c) => c.computedVisits >= 2).length;
    const totalPoints = enrichedCustomers.reduce((s, c) => s + (c.pointsBalance || 0), 0);
    const atRiskCount = enrichedCustomers.filter((c) => c.retentionStatus === 'AT_RISK').length;

    const avgVisits = (totalVisits / totalCount).toFixed(1);
    const avgSpend = Math.round(totalSpend / totalCount);
    const avgAov = totalVisits > 0 ? Math.round(totalSpend / totalVisits) : 0;
    const repeatRate = Math.round((repeatShoppers / totalCount) * 100);

    const championCust = [...enrichedCustomers].sort((a, b) => b.computedSpend - a.computedSpend)[0] || null;

    return {
      avgVisits,
      avgSpend,
      avgAov,
      repeatRate,
      totalPoints,
      atRiskCount,
      championCust,
    };
  }, [enrichedCustomers]);

  // Filtered & Sorted Leaderboard
  const sortedLeaderboard = useMemo(() => {
    return enrichedCustomers
      .filter((c) => {
        const matchesTier = selectedTierFilter === 'ALL' || c.tier === selectedTierFilter;
        const matchesFreq =
          selectedFrequencyFilter === 'ALL' || c.frequencyCategory === selectedFrequencyFilter;
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q));
        return matchesTier && matchesFreq && matchesSearch;
      })
      .sort((a, b) => {
        if (sortMetric === 'SPEND') return b.computedSpend - a.computedSpend;
        if (sortMetric === 'FREQUENCY') return b.computedVisits - a.computedVisits;
        if (sortMetric === 'POINTS') return (b.pointsBalance || 0) - (a.pointsBalance || 0);
        if (sortMetric === 'AOV') return b.aov - a.aov;
        return b.computedSpend - a.computedSpend;
      });
  }, [enrichedCustomers, selectedTierFilter, selectedFrequencyFilter, searchQuery, sortMetric]);

  // Top 3 Podium
  const topPodium = sortedLeaderboard.slice(0, 3);

  // Top 10 for Composed Chart
  const top10ChartData = useMemo(() => {
    return sortedLeaderboard.slice(0, 8).map((c) => ({
      name: c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name,
      fullName: c.name,
      spend: c.computedSpend,
      visits: c.computedVisits,
      points: c.pointsBalance || 0,
      tier: c.tier,
    }));
  }, [sortedLeaderboard]);

  // Tier Composition Data for Pie Chart
  const tierPieData = useMemo(() => {
    const tierMap: Record<CustomerTier, { count: number; spend: number; points: number }> = {
      PLATINUM: { count: 0, spend: 0, points: 0 },
      GOLD: { count: 0, spend: 0, points: 0 },
      SILVER: { count: 0, spend: 0, points: 0 },
      BRONZE: { count: 0, spend: 0, points: 0 },
    };

    enrichedCustomers.forEach((c) => {
      if (tierMap[c.tier]) {
        tierMap[c.tier].count += 1;
        tierMap[c.tier].spend += c.computedSpend;
        tierMap[c.tier].points += c.pointsBalance || 0;
      }
    });

    const colors = {
      PLATINUM: '#8b5cf6', // purple
      GOLD: '#f59e0b', // amber
      SILVER: '#94a3b8', // slate
      BRONZE: '#d97706', // bronze amber
    };

    return Object.entries(tierMap).map(([tier, val]) => ({
      name: tier,
      value: val.count,
      spend: val.spend,
      points: val.points,
      color: colors[tier as CustomerTier],
    }));
  }, [enrichedCustomers]);

  // Monthly Points Flow (Earned vs Redeemed)
  const monthlyPointsFlowData = useMemo(() => {
    const monthMap: Record<string, { label: string; earned: number; redeemed: number }> = {};
    const now = new Date();

    // Initialize past 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      const label = d.toLocaleDateString('id-ID', { month: 'short' });
      monthMap[key] = { label, earned: 0, redeemed: 0 };
    }

    loyaltyLogs.forEach((l) => {
      const key = l.timestamp.slice(0, 7);
      if (monthMap[key]) {
        if (l.type === 'EARN' || (l.type === 'ADJUSTMENT' && l.points > 0)) {
          monthMap[key].earned += Math.abs(l.points);
        } else if (l.type === 'REDEEM' || (l.type === 'ADJUSTMENT' && l.points < 0)) {
          monthMap[key].redeemed += Math.abs(l.points);
        }
      }
    });

    return Object.values(monthMap);
  }, [loyaltyLogs]);

  const getTierBadge = (tier: CustomerTier) => {
    switch (tier) {
      case 'PLATINUM':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'GOLD':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SILVER':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-orange-50 text-orange-800 border-orange-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Executive Frequency & Loyalty Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {/* Rata-Rata Frekuensi */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Rata-Rata Frekuensi
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summaryMetrics.avgVisits} <span className="text-sm font-semibold text-slate-500">Kunjungan</span>
            </div>
            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
              Tingkat Retensi: {summaryMetrics.repeatRate}% Member Rutin
            </p>
          </div>
        </div>

        {/* Rata-Rata Belanja (AOV) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Rata-Rata per Struk (AOV)
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-700 tracking-tight">
              Rp {summaryMetrics.avgAov.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Lifetime Value: Rp {summaryMetrics.avgSpend.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* Saldo Poin & Nilai Rupiah */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Poin Aktif
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-600 tracking-tight flex items-center gap-1">
              <span>{summaryMetrics.totalPoints.toLocaleString('id-ID')}</span>
              <span className="text-xs font-semibold text-amber-700">Poin</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Setara Rp {(summaryMetrics.totalPoints * redemptionValue).toLocaleString('id-ID')} diskon
            </p>
          </div>
        </div>

        {/* Member Super VIP */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Super VIP (≥10x)
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-purple-800 tracking-tight">
              {frequencySegmentsData[0].count}{' '}
              <span className="text-sm font-semibold text-slate-500">Member</span>
            </div>
            <p className="text-[10px] text-purple-600 font-semibold mt-0.5">
              Omzet Rp {frequencySegmentsData[0].omzet.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* Perlu Diingatkan (At-Risk) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between col-span-2 md:col-span-4 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Potensi Churn (&gt;45hr)
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-700 tracking-tight">
              {summaryMetrics.atRiskCount}{' '}
              <span className="text-sm font-semibold text-slate-500">Member</span>
            </div>
            <p className="text-[10px] text-rose-500 font-medium mt-0.5">
              Perlu broadcast promo / poin bonus
            </p>
          </div>
        </div>
      </div>

      {/* 2. Visual Top-Performing Customers Podium */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden">
        {/* Background glow decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <Crown className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black tracking-tight text-white">
                Podium Juara Loyalitas & Frekuensi Belanja
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Peringkat pelanggan terbaik dengan intensitas kunjungan tertinggi dan kontribusi omzet terbesar
            </p>
          </div>

          {/* Metric Selector Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-700 text-xs">
            {[
              { id: 'SPEND', label: 'Total Belanja (LTV)', icon: DollarSign },
              { id: 'FREQUENCY', label: 'Frekuensi Kunjungan', icon: Repeat },
              { id: 'POINTS', label: 'Saldo Poin', icon: Sparkles },
              { id: 'AOV', label: 'Rata-Rata Struk', icon: ShoppingBag },
            ].map((m) => {
              const Icon = m.icon;
              const isSelected = sortMetric === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSortMetric(m.id as SortMetric)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Podium Layout: #2 Silver, #1 Gold, #3 Bronze */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 items-end">
          {/* #2 Silver (Left) */}
          {topPodium[1] && (
            <div
              onClick={() => onSelectCustomer(topPodium[1])}
              className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-lg group relative flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 flex items-center gap-1">
                  🥈 Juara 2
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTierBadge(topPodium[1].tier)}`}>
                  {topPodium[1].tier}
                </span>
              </div>

              <div className="my-3 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-900 font-black text-xl flex items-center justify-center shadow-md">
                  {topPodium[1].name.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="font-bold text-base text-white mt-2 group-hover:text-amber-300 transition-colors">
                  {topPodium[1].name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{topPodium[1].phone}</p>
              </div>

              <div className="bg-slate-900/80 rounded-xl p-3 space-y-1.5 text-xs border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Frekuensi Belanja:</span>
                  <span className="font-bold text-blue-400 flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5" /> {topPodium[1].computedVisits}x Kunjungan
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Belanja:</span>
                  <span className="font-bold text-emerald-400">
                    Rp {topPodium[1].computedSpend.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Saldo Poin:</span>
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> {topPodium[1].pointsBalance} Poin
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* #1 Gold Champion (Center - Higher Elevation) */}
          {topPodium[0] && (
            <div
              onClick={() => onSelectCustomer(topPodium[0])}
              className="bg-gradient-to-b from-amber-950/60 via-slate-800 to-slate-800 border-2 border-amber-400/80 rounded-3xl p-5 transition-all duration-200 cursor-pointer shadow-2xl group relative flex flex-col justify-between -mt-2 md:-mt-4"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-xs font-black px-3.5 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 fill-slate-950" />
                <span>#1 JUARA UTAMA</span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                  🥇 Peringkat Tertinggi
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTierBadge(topPodium[0].tier)}`}>
                  {topPodium[0].tier}
                </span>
              </div>

              <div className="my-4 text-center">
                <div className="w-18 h-18 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-200 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg ring-4 ring-amber-400/30">
                  {topPodium[0].name.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="font-black text-lg text-white mt-2 group-hover:text-amber-300 transition-colors">
                  {topPodium[0].name}
                </h3>
                <p className="text-xs text-amber-200/80 font-mono">{topPodium[0].phone}</p>
                <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold border border-amber-400/30">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{topPodium[0].frequencyLabel}</span>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl p-3.5 space-y-2 text-xs border border-amber-400/20">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Frekuensi Belanja:</span>
                  <span className="font-bold text-amber-300 text-sm flex items-center gap-1">
                    <Repeat className="w-4 h-4" /> {topPodium[0].computedVisits}x Kunjungan
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Belanja (LTV):</span>
                  <span className="font-black text-emerald-400 text-sm">
                    Rp {topPodium[0].computedSpend.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Saldo Poin Member:</span>
                  <span className="font-black text-amber-400 text-sm flex items-center gap-1">
                    <Sparkles className="w-4 h-4 fill-amber-400" /> {topPodium[0].pointsBalance} Poin
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400">Rata-Rata per Struk:</span>
                  <span className="font-semibold text-white">Rp {topPodium[0].aov.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          )}

          {/* #3 Bronze (Right) */}
          {topPodium[2] && (
            <div
              onClick={() => onSelectCustomer(topPodium[2])}
              className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-lg group relative flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-800 text-amber-100 flex items-center gap-1">
                  🥉 Juara 3
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTierBadge(topPodium[2].tier)}`}>
                  {topPodium[2].tier}
                </span>
              </div>

              <div className="my-3 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-800 to-amber-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                  {topPodium[2].name.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="font-bold text-base text-white mt-2 group-hover:text-amber-300 transition-colors">
                  {topPodium[2].name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{topPodium[2].phone}</p>
              </div>

              <div className="bg-slate-900/80 rounded-xl p-3 space-y-1.5 text-xs border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Frekuensi Belanja:</span>
                  <span className="font-bold text-blue-400 flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5" /> {topPodium[2].computedVisits}x Kunjungan
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Belanja:</span>
                  <span className="font-bold text-emerald-400">
                    Rp {topPodium[2].computedSpend.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Saldo Poin:</span>
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> {topPodium[2].pointsBalance} Poin
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Visual Charts Grid: Frequency Distribution & Composed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Segmentasi Frekuensi Kunjungan vs Omzet (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">
                  Distribusi Frekuensi Belanja & Kontribusi Omzet
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Perbandingan jumlah member dan total belanja berdasarkan frekuensi kunjungan
              </p>
            </div>

            {/* Quick Segment Indicator */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
                <span>Jumlah Member</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                <span>Omzet Belanja</span>
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={frequencySegmentsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(1)}M`}
                  tick={{ fontSize: 10, fill: '#10b981' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: any, name: any) => {
                    if (name === 'omzet') return [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Total Belanja'];
                    if (name === 'count') return [`${val} Member`, 'Jumlah Member'];
                    return [val, name];
                  }}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none' }}
                />
                <Bar yAxisId="left" dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28} />
                <Bar yAxisId="right" dataKey="omzet" fill="#10b981" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Segment Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            {frequencySegmentsData.map((seg) => (
              <div
                key={seg.key}
                onClick={() => setSelectedFrequencyFilter(seg.key as FrequencySegment)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedFrequencyFilter === seg.key
                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="text-[11px] font-bold text-slate-700 truncate">{seg.name}</div>
                <div className="text-base font-black text-slate-900 mt-0.5">{seg.count} Member</div>
                <div className="text-[10px] text-emerald-600 font-semibold truncate">
                  Rp {(seg.omzet / 1000).toFixed(0)}k
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Komposisi Tier Loyalitas (1 col) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                <PieIcon className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Komposisi Tier Keanggotaan</h3>
            </div>
            <p className="text-xs text-slate-500">Porsi member Bronze, Silver, Gold, dan Platinum</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tierPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {tierPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any, item: any) => [
                    `${val} Member (Rp ${item.payload.spend.toLocaleString('id-ID')})`,
                    `Tier ${name}`,
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Tier Legend with Spend Contribution */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {tierPieData.map((t) => (
              <div
                key={t.name}
                onClick={() => setSelectedTierFilter(t.name === selectedTierFilter ? 'ALL' : t.name)}
                className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedTierFilter === t.name
                    ? 'border-amber-500 bg-amber-50/60 font-bold'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-[11px] font-semibold text-slate-700">{t.name}</span>
                </div>
                <span className="font-bold text-slate-900 text-xs">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Chart 3: Top 8 Pelanggan: Belanja vs Frekuensi Kunjungan */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">
                Top Pelanggan: Korelasi Frekuensi Belanja vs Akumulasi Omzet (LTV)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Melihat hubungan antara seberapa sering pelanggan datang dengan total nominal belanja mereka
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
              <span>Total Belanja (Rp)</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-3 h-1.5 rounded bg-purple-600 inline-block" />
              <span>Frekuensi (Kali)</span>
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={top10ChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(1)}jt`}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#8b5cf6' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(val: any, name: any) => {
                  if (name === 'spend') return [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Total Belanja'];
                  if (name === 'visits') return [`${val}x Belanja`, 'Frekuensi Kunjungan'];
                  return [val, name];
                }}
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px', border: 'none' }}
              />
              <Bar yAxisId="left" dataKey="spend" fill="#10b981" radius={[6, 6, 0, 0]} barSize={26} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="visits"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Complete Top Customers Leaderboard & Frequency Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <span>Leaderboard Pelanggan & Analisis Frekuensi</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                {sortedLeaderboard.length} Member
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik nama member untuk melihat riwayat struk, mutasi poin, dan cetak kartu statement
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari member / no HP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Tier Filter */}
            <select
              value={selectedTierFilter}
              onChange={(e) => setSelectedTierFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Semua Tier</option>
              <option value="PLATINUM">Platinum</option>
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
              <option value="BRONZE">Bronze</option>
            </select>

            {/* Frequency Filter */}
            <select
              value={selectedFrequencyFilter}
              onChange={(e) => setSelectedFrequencyFilter(e.target.value as FrequencySegment)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Semua Frekuensi</option>
              <option value="VIP_10_PLUS">Super VIP (≥10x)</option>
              <option value="REGULAR_5_9">Rutin (5-9x)</option>
              <option value="OCCASIONAL_2_4">Berkala (2-4x)</option>
              <option value="NEW_1">Baru (1x)</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 text-center w-12">Rank</th>
                <th className="py-3 px-4">Nama Pelanggan</th>
                <th className="py-3 px-4 text-center">Tier</th>
                <th className="py-3 px-4 text-center">Frekuensi Belanja</th>
                <th className="py-3 px-4 text-right">Total Belanja (LTV)</th>
                <th className="py-3 px-4 text-right">Rata-Rata / Struk</th>
                <th className="py-3 px-4 text-right">Saldo Poin</th>
                <th className="py-3 px-4 text-center">Aktivitas Terakhir</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedLeaderboard.map((cust, idx) => {
                const rankNumber = idx + 1;
                const isTop3 = rankNumber <= 3;

                return (
                  <tr
                    key={cust.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onSelectCustomer(cust)}
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                          rankNumber === 1
                            ? 'bg-amber-400 text-slate-950 shadow-xs ring-2 ring-amber-300'
                            : rankNumber === 2
                            ? 'bg-slate-300 text-slate-800'
                            : rankNumber === 3
                            ? 'bg-amber-800 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rankNumber}
                      </span>
                    </td>

                    {/* Member Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                            isTop3
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {cust.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                            <span>{cust.name}</span>
                            {rankNumber === 1 && <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                            <span>{cust.phone}</span>
                            <span>&bull;</span>
                            <span>{cust.id}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Tier Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTierBadge(cust.tier)}`}>
                        {cust.tier}
                      </span>
                    </td>

                    {/* Frekuensi Belanja */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-black text-slate-900 text-xs flex items-center gap-1">
                          <Repeat className="w-3.5 h-3.5 text-blue-600" />
                          <span>{cust.computedVisits}x Belanja</span>
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full border mt-0.5 ${cust.frequencyBadgeColor}`}>
                          {cust.frequencyLabel}
                        </span>
                      </div>
                    </td>

                    {/* Total Belanja */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-emerald-700 text-xs">
                        Rp {cust.computedSpend.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-slate-400">Akumulasi Belanja</div>
                    </td>

                    {/* Rata-Rata per Struk (AOV) */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-semibold text-slate-800 text-xs">
                        Rp {cust.aov.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-slate-400">per transaksi</div>
                    </td>

                    {/* Saldo Poin */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-black text-amber-600 text-xs flex items-center justify-end gap-1">
                        <Sparkles className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{cust.pointsBalance} Poin</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Diskon: Rp {(cust.pointsBalance * redemptionValue).toLocaleString('id-ID')}
                      </div>
                    </td>

                    {/* Aktivitas Terakhir / Recency */}
                    <td className="py-3.5 px-4 text-center">
                      {cust.daysSinceLastVisit === 999 ? (
                        <span className="text-slate-400 text-[11px]">-</span>
                      ) : cust.daysSinceLastVisit === 0 ? (
                        <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Hari ini
                        </span>
                      ) : cust.retentionStatus === 'AT_RISK' ? (
                        <span className="text-rose-700 font-bold text-[10px] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1 justify-center">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{cust.daysSinceLastVisit} hari lalu</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[11px]">
                          {cust.daysSinceLastVisit} hari lalu
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div
                        className="flex items-center justify-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onSelectCustomer(cust)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                          title="Lihat Detail Kartu & Riwayat Poin"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => onOpenAdjustPoints(cust)}
                          className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200 transition-colors cursor-pointer"
                          title="Koreksi / Tambah Poin Bonus"
                        >
                          +/- Poin
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {sortedLeaderboard.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">Tidak ada member yang cocok dengan filter</p>
            <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau filter frekuensi kunjungan.</p>
          </div>
        )}
      </div>
    </div>
  );
};

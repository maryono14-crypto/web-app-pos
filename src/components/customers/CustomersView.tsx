import React, { useEffect, useState } from 'react';
import { db } from '../../db/indexedDB';
import { Customer, CustomerTier, LoyaltyLog, Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Award,
  Sparkles,
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Sliders,
  History,
  Phone,
  Mail,
  MapPin,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Gift,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Calendar,
  Save,
  BarChart3,
} from 'lucide-react';
import { LoyaltyAnalyticsDashboard } from './LoyaltyAnalyticsDashboard';

export const CustomersView: React.FC = () => {
  const { settings, refreshSettings, activeUser, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'CUSTOMERS' | 'LOGS' | 'SETTINGS'>('ANALYTICS');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loyaltyLogs, setLoyaltyLogs] = useState<LoyaltyLog[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'POINTS_DESC' | 'SPEND_DESC' | 'VISITS_DESC' | 'NEWEST'>('POINTS_DESC');

  // Modals
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    tier: 'BRONZE' as CustomerTier,
    notes: '',
  });

  // Adjust Points Modal
  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustCustomer, setAdjustCustomer] = useState<Customer | null>(null);
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState('Bonus loyalitas / promo');

  // Detail Statement Modal
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Customer | null>(null);

  // Settings form
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(settings?.loyaltyEnabled ?? true);
  const [pointsPerAmount, setPointsPerAmount] = useState(settings?.loyaltyPointsPerAmount ?? 10000);
  const [redemptionValue, setRedemptionValue] = useState(settings?.loyaltyPointRedemptionValue ?? 100);
  const [minRedeemPoints, setMinRedeemPoints] = useState(settings?.loyaltyMinRedeemPoints ?? 10);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const loadData = async () => {
    try {
      const [cList, lList, sList] = await Promise.all([
        db.customers.toArray(),
        db.loyaltyLogs.reverse().sortBy('timestamp'),
        db.sales.toArray(),
      ]);
      setCustomers(cList);
      setLoyaltyLogs(lList);
      setSales(sList);
    } catch (e) {
      console.error('Failed to load customers & loyalty data:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (settings) {
      setLoyaltyEnabled(settings.loyaltyEnabled ?? true);
      setPointsPerAmount(settings.loyaltyPointsPerAmount ?? 10000);
      setRedemptionValue(settings.loyaltyPointRedemptionValue ?? 100);
      setMinRedeemPoints(settings.loyaltyMinRedeemPoints ?? 10);
    }
  }, [settings]);

  // Statistics
  const totalCustomers = customers.length;
  const totalPointsBalance = customers.reduce((sum, c) => sum + (c.pointsBalance || 0), 0);
  const totalMemberSpend = customers.reduce((sum, c) => sum + (c.totalSpend || 0), 0);
  const totalPointsEarnedEver = loyaltyLogs
    .filter((l) => l.type === 'EARN' || (l.type === 'ADJUSTMENT' && l.points > 0))
    .reduce((sum, l) => sum + Math.abs(l.points), 0);
  const totalPointsRedeemedEver = loyaltyLogs
    .filter((l) => l.type === 'REDEEM' || (l.type === 'ADJUSTMENT' && l.points < 0))
    .reduce((sum, l) => sum + Math.abs(l.points), 0);

  // Tier color styling
  const getTierBadge = (tier: CustomerTier) => {
    switch (tier) {
      case 'PLATINUM':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'GOLD':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SILVER':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      default:
        return 'bg-orange-50 text-orange-800 border-orange-200';
    }
  };

  // Filter & Sort Customers
  const filteredCustomers = customers
    .filter((c) => {
      const matchesTier = selectedTierFilter === 'ALL' || c.tier === selectedTierFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));
      return matchesTier && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'POINTS_DESC') return (b.pointsBalance || 0) - (a.pointsBalance || 0);
      if (sortBy === 'SPEND_DESC') return (b.totalSpend || 0) - (a.totalSpend || 0);
      if (sortBy === 'VISITS_DESC') return (b.totalVisits || 0) - (a.totalVisits || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Handle Save / Edit Customer
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      tier: 'BRONZE',
      notes: '',
    });
    setCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerFormData({
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      address: c.address || '',
      tier: c.tier,
      notes: c.notes || '',
    });
    setCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerFormData.name.trim() || !customerFormData.phone.trim()) {
      showToast('Nama dan nomor telepon wajib diisi', 'error');
      return;
    }

    try {
      if (editingCustomer) {
        // Update
        await db.customers.update(editingCustomer.id, {
          name: customerFormData.name.trim(),
          phone: customerFormData.phone.trim(),
          email: customerFormData.email.trim() || undefined,
          address: customerFormData.address.trim() || undefined,
          tier: customerFormData.tier,
          notes: customerFormData.notes.trim() || undefined,
          updatedAt: new Date().toISOString(),
        });

        await db.auditLogs.add({
          id: `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: activeUser.id,
          userName: activeUser.name,
          action: 'UPDATE_CUSTOMER',
          category: 'CUSTOMER',
          details: `Data member ${customerFormData.name} diperbarui oleh ${activeUser.name}`,
        });

        showToast(`Data pelanggan ${customerFormData.name} berhasil diperbarui!`, 'success');
      } else {
        // Create
        const newCust: Customer = {
          id: `CUST-${Date.now()}`,
          name: customerFormData.name.trim(),
          phone: customerFormData.phone.trim(),
          email: customerFormData.email.trim() || undefined,
          address: customerFormData.address.trim() || undefined,
          tier: customerFormData.tier,
          pointsBalance: 0,
          totalSpend: 0,
          totalVisits: 0,
          notes: customerFormData.notes.trim() || undefined,
          createdAt: new Date().toISOString(),
        };

        await db.customers.add(newCust);

        await db.auditLogs.add({
          id: `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: activeUser.id,
          userName: activeUser.name,
          action: 'CREATE_CUSTOMER',
          category: 'CUSTOMER',
          details: `Member baru ${newCust.name} (${newCust.phone}) ditambahkan oleh ${activeUser.name}`,
        });

        showToast(`Pelanggan ${newCust.name} berhasil didaftarkan!`, 'success');
      }

      setCustomerModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error saving customer:', err);
      showToast('Gagal menyimpan data pelanggan', 'error');
    }
  };

  const handleDeleteCustomer = async (cust: Customer) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pelanggan "${cust.name}"? Poin saldo ${cust.pointsBalance} akan dihapus.`)) {
      try {
        await db.customers.delete(cust.id);
        await db.auditLogs.add({
          id: `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: activeUser.id,
          userName: activeUser.name,
          action: 'DELETE_CUSTOMER',
          category: 'CUSTOMER',
          details: `Member ${cust.name} (${cust.phone}) dihapus oleh ${activeUser.name}`,
        });
        showToast(`Pelanggan ${cust.name} telah dihapus.`, 'info');
        await loadData();
      } catch (err) {
        showToast('Gagal menghapus pelanggan', 'error');
      }
    }
  };

  // Handle Manual Point Adjustment
  const handleOpenAdjustPoints = (c: Customer) => {
    setAdjustCustomer(c);
    setAdjustType('ADD');
    setAdjustAmount(50);
    setAdjustReason('Bonus loyalitas / apresiasi pelanggan');
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustCustomer) return;
    if (adjustAmount <= 0) {
      showToast('Jumlah poin harus lebih dari 0', 'error');
      return;
    }

    try {
      const netPoints = adjustType === 'ADD' ? adjustAmount : -adjustAmount;
      const currentBalance = adjustCustomer.pointsBalance || 0;
      const newBalance = Math.max(0, currentBalance + netPoints);

      await db.customers.update(adjustCustomer.id, {
        pointsBalance: newBalance,
        updatedAt: new Date().toISOString(),
      });

      // Record loyalty log
      await db.loyaltyLogs.add({
        id: `LOG-LOYAL-${Date.now()}-ADJ`,
        customerId: adjustCustomer.id,
        customerName: adjustCustomer.name,
        type: 'ADJUSTMENT',
        points: netPoints,
        balanceAfter: newBalance,
        timestamp: new Date().toISOString(),
        notes: `Penyesuaian manual (${adjustType === 'ADD' ? 'Tambah' : 'Kurangi'}): ${adjustReason}`,
        createdBy: activeUser.name,
      });

      // Audit log
      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'ADJUST_LOYALTY_POINTS',
        category: 'LOYALTY',
        details: `Penyesuaian ${netPoints > 0 ? '+' : ''}${netPoints} poin untuk ${adjustCustomer.name}. Saldo baru: ${newBalance}. Alasan: ${adjustReason}`,
      });

      showToast(`Poin ${adjustCustomer.name} berhasil disesuaikan! Saldo sekarang: ${newBalance} poin`, 'success');
      setAdjustModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error adjusting points:', err);
      showToast('Gagal menyesuaikan poin pelanggan', 'error');
    }
  };

  // Save Loyalty Settings
  const handleSaveLoyaltySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      await db.settings.update('current_config', {
        loyaltyEnabled,
        loyaltyPointsPerAmount: Number(pointsPerAmount),
        loyaltyPointRedemptionValue: Number(redemptionValue),
        loyaltyMinRedeemPoints: Number(minRedeemPoints),
      });

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'UPDATE_SETTINGS',
        category: 'LOYALTY',
        details: `Pengaturan program loyalitas diperbarui: 1 poin / Rp ${pointsPerAmount.toLocaleString('id-ID')}, Nilai tukar: Rp ${redemptionValue}/poin`,
      });

      await refreshSettings();
      showToast('Pengaturan program loyalitas berhasil disimpan!', 'success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast('Gagal menyimpan pengaturan loyalitas', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-sm">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Pelanggan & Loyalitas Poin
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola data member, akumulasi poin belanja ritel, dan riwayat penukaran diskon
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ANALYTICS' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
            <span>Visual Analytics & Frekuensi</span>
          </button>
          <button
            onClick={() => setActiveTab('CUSTOMERS')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'CUSTOMERS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daftar Member ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab('LOGS')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'LOGS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Riwayat Poin ({loyaltyLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'SETTINGS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aturan & Konfigurasi
          </button>
        </div>
      </div>

      {/* KPI Cards Banner (For Customers & Logs view) */}
      {activeTab !== 'ANALYTICS' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Member */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Member Terdaftar
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {totalCustomers.toLocaleString('id-ID')}
              </div>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                Aktif berbelanja di kasir POS
              </p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Total Poin Beredar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Saldo Poin Beredar
              </span>
              <div className="text-2xl font-black text-amber-600 mt-1 flex items-center gap-1">
                <Sparkles className="w-5 h-5 fill-amber-500 text-amber-500" />
                <span>{totalPointsBalance.toLocaleString('id-ID')}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Setara diskon Rp {(totalPointsBalance * (settings?.loyaltyPointRedemptionValue || 100)).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
          </div>

          {/* Total Belanja Member */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Belanja Member
              </span>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                Rp {totalMemberSpend.toLocaleString('id-ID')}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Akumulasi seumur hidup (lifetime)
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Poin Diberikan vs Ditukar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Poin Ditukar / Reward
              </span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {totalPointsRedeemedEver.toLocaleString('id-ID')}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Dari {totalPointsEarnedEver.toLocaleString('id-ID')} poin diterbitkan
              </p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl">
              <Gift className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 0: VISUAL LOYALTY & PURCHASE FREQUENCY ANALYTICS */}
      {activeTab === 'ANALYTICS' && (
        <LoyaltyAnalyticsDashboard
          customers={customers}
          loyaltyLogs={loyaltyLogs}
          sales={sales}
          onSelectCustomer={(c) => setSelectedCustomerDetail(c)}
          onOpenAdjustPoints={(c) => handleOpenAdjustPoints(c)}
        />
      )}

      {/* TAB 1: CUSTOMERS LIST */}
      {activeTab === 'CUSTOMERS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Action & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search and Tier filter */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama, nomor HP, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Tier Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                {['ALL', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTierFilter(t)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      selectedTierFilter === t
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'ALL' ? 'Semua Tier' : t}
                  </button>
                ))}
              </div>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="POINTS_DESC">Urut: Poin Tertinggi</option>
                <option value="SPEND_DESC">Urut: Belanja Tertinggi</option>
                <option value="VISITS_DESC">Urut: Kunjungan Terbanyak</option>
                <option value="NEWEST">Urut: Terdaftar Terbaru</option>
              </select>
            </div>

            {/* Add Button */}
            <button
              onClick={handleOpenAddCustomer}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Daftar Member Baru</span>
            </button>
          </div>

          {/* Customers Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="p-3.5">Pelanggan / Member</th>
                  <th className="p-3.5">Tier Status</th>
                  <th className="p-3.5 text-right">Saldo Poin</th>
                  <th className="p-3.5 text-right">Total Belanja</th>
                  <th className="p-3.5 text-center">Kunjungan</th>
                  <th className="p-3.5">Terdaftar</th>
                  <th className="p-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-slate-600">Tidak ada pelanggan ditemukan</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Klik tombol "Daftar Member Baru" untuk menambahkan member pertama.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Contact */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                            {cust.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 hover:text-emerald-700 transition-colors cursor-pointer"
                              onClick={() => setSelectedCustomerDetail(cust)}
                            >
                              {cust.name}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-0.5">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {cust.phone}
                              </span>
                              {cust.email && (
                                <span className="flex items-center gap-1 hidden sm:flex">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  {cust.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tier Badge */}
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${getTierBadge(
                            cust.tier
                          )}`}
                        >
                          <Award className="w-3 h-3" />
                          {cust.tier}
                        </span>
                      </td>

                      {/* Points Balance */}
                      <td className="p-3.5 text-right font-mono">
                        <div className="font-black text-amber-600 flex items-center justify-end gap-1 text-sm">
                          <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{cust.pointsBalance.toLocaleString('id-ID')}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          &asymp; Rp {(cust.pointsBalance * (settings?.loyaltyPointRedemptionValue || 100)).toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Total Spend */}
                      <td className="p-3.5 text-right font-mono">
                        <div className="font-bold text-slate-900">
                          Rp {(cust.totalSpend || 0).toLocaleString('id-ID')}
                        </div>
                      </td>

                      {/* Visits */}
                      <td className="p-3.5 text-center font-mono">
                        <span className="px-2 py-1 bg-slate-100 rounded-md font-bold text-slate-700">
                          {cust.totalVisits || 0}x
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {new Date(cust.createdAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedCustomerDetail(cust)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Riwayat & Statement Poin"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenAdjustPoints(cust)}
                            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Sesuaikan Poin Manual (+/-)"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditCustomer(cust)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data Pelanggan"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(cust)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Pelanggan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LOYALTY POINTS LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Riwayat Mutasi Poin Pelanggan</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit log lengkap setiap transaksi penambahan (EARN), penukaran (REDEEM), atau penyesuaian (ADJUSTMENT)
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Total {loyaltyLogs.length} catatan mutasi
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="p-3.5">Waktu Transaksi</th>
                  <th className="p-3.5">Pelanggan</th>
                  <th className="p-3.5">Jenis Mutasi</th>
                  <th className="p-3.5 text-right">Perubahan Poin</th>
                  <th className="p-3.5 text-right">Saldo Akhir</th>
                  <th className="p-3.5">Keterangan / Alasan</th>
                  <th className="p-3.5">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loyaltyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-slate-600">Belum ada riwayat mutasi poin</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Poin akan tercatat otomatis saat kasir memproses transaksi POS.
                      </p>
                    </td>
                  </tr>
                ) : (
                  loyaltyLogs.map((log) => {
                    const isPositive = log.points > 0;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="p-3.5 font-bold text-slate-900">
                          {log.customerName}
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                              log.type === 'EARN'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : log.type === 'REDEEM'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            {log.type === 'EARN' && <ArrowDownLeft className="w-3 h-3 text-emerald-600" />}
                            {log.type === 'REDEEM' && <ArrowUpRight className="w-3 h-3 text-amber-600" />}
                            {log.type === 'ADJUSTMENT' && <Sliders className="w-3 h-3 text-blue-600" />}
                            {log.type === 'EARN'
                              ? 'DAPAT POIN'
                              : log.type === 'REDEEM'
                              ? 'TUKAR DISKON'
                              : 'PENYESUAIAN'}
                          </span>
                        </td>

                        <td className="p-3.5 text-right font-mono">
                          <span
                            className={`font-black text-sm ${
                              isPositive ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isPositive ? `+${log.points}` : log.points} Poin
                          </span>
                        </td>

                        <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                          {log.balanceAfter} Poin
                        </td>

                        <td className="p-3.5 text-slate-600 text-xs max-w-xs truncate">
                          {log.notes || '-'}
                        </td>

                        <td className="p-3.5 text-slate-500 text-[11px]">
                          {log.createdBy || 'Kasir'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS & CONFIGURATION */}
      {activeTab === 'SETTINGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 max-w-3xl space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Aturan Program Loyalitas & Poin Toko</h3>
            <p className="text-xs text-slate-500 mt-1">
              Tentukan rasio pemberian poin belanja dan nilai tukar diskon yang otomatis digunakan di kasir POS
            </p>
          </div>

          <form onSubmit={handleSaveLoyaltySettings} className="space-y-5">
            {/* Toggle Enable */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-sm text-slate-800 block">
                  Aktifkan Program Loyalitas Poin
                </span>
                <span className="text-xs text-slate-500">
                  Pelanggan akan otomatis mendapatkan poin setiap transaksi kasir
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={loyaltyEnabled}
                  onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Ratio: Spend to Point */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Rasio Perolehan Poin (Nominal Belanja per 1 Poin)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Setiap belanja: Rp</span>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={pointsPerAmount}
                  onChange={(e) => setPointsPerAmount(parseInt(e.target.value, 10) || 10000)}
                  className="w-36 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-600">= <strong className="text-emerald-700">1 Poin Loyalitas</strong></span>
              </div>
              <p className="text-[11px] text-slate-400">
                Contoh: Jika disetel Rp 10.000, transaksi belanja Rp 75.000 akan memperoleh 7 poin.
              </p>
            </div>

            {/* Ratio: Point to Discount Nominal */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Nilai Tukar Poin Menjadi Diskon (Rupiah per Poin)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">1 Poin = Potongan Rp</span>
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={redemptionValue}
                  onChange={(e) => setRedemptionValue(parseInt(e.target.value, 10) || 100)}
                  className="w-36 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Contoh: Jika 1 Poin = Rp 100, menukarkan 50 poin akan memotong belanja sebesar Rp 5.000.
              </p>
            </div>

            {/* Minimum Points to Redeem */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Minimal Poin untuk Penukaran
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={minRedeemPoints}
                  onChange={(e) => setMinRedeemPoints(parseInt(e.target.value, 10) || 10)}
                  className="w-28 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-600">Poin</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Member harus memiliki saldo minimal ini sebelum opsi tukar poin muncul di keranjang kasir.
              </p>
            </div>

            {/* Tier Thresholds Guide */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Tingkatan Member Otomatis (Berdasarkan Total Belanja)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-extrabold text-orange-800 block text-[11px]">BRONZE</span>
                  <span className="text-slate-500 text-[10px]">Rp 0 - Rp 999.999</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-extrabold text-slate-700 block text-[11px]">SILVER</span>
                  <span className="text-slate-500 text-[10px]">&ge; Rp 1.000.000</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-extrabold text-amber-700 block text-[11px]">GOLD</span>
                  <span className="text-slate-500 text-[10px]">&ge; Rp 5.000.000</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-extrabold text-purple-700 block text-[11px]">PLATINUM</span>
                  <span className="text-slate-500 text-[10px]">&ge; Rp 15.000.000</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT CUSTOMER */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingCustomer ? 'Edit Data Member' : 'Pendaftaran Member Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingCustomer ? `Perbarui profil ${editingCustomer.name}` : 'Mulai kumpulkan loyalitas poin belanja pelanggan'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCustomerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  placeholder="Contoh: Hj. Siti Fatimah"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor HP / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  placeholder="Contoh: 0812-3456-7890"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email (Opsional)
                  </label>
                  <input
                    type="email"
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    placeholder="nama@email.com"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tingkatan (Tier)
                  </label>
                  <select
                    value={customerFormData.tier}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, tier: e.target.value as CustomerTier })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  >
                    <option value="BRONZE">BRONZE</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                    <option value="PLATINUM">PLATINUM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat / Wilayah
                </label>
                <input
                  type="text"
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                  placeholder="Contoh: Jl. Kenanga No. 12, RT 01/02"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan Khusus
                </label>
                <textarea
                  rows={2}
                  value={customerFormData.notes}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                  placeholder="Catatan belanja partai, diskon khusus, atau preferensi antar barang"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST POINTS MANUAL */}
      {isAdjustModalOpen && adjustCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Penyesuaian Poin Manual</h3>
                  <p className="text-xs text-slate-500">{adjustCustomer.name} (Saldo: {adjustCustomer.pointsBalance} Poin)</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustPoints} className="p-5 space-y-4">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAdjustType('ADD')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    adjustType === 'ADD'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Poin (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('DEDUCT')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    adjustType === 'DEDUCT'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Kurangi Poin (-)</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jumlah Poin
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    required
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full text-base font-black px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-slate-900"
                  />
                  <span className="text-xs font-bold text-slate-500 shrink-0">Poin</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Saldo setelah disesuaikan:{' '}
                  <strong className="text-slate-900 font-bold">
                    {adjustType === 'ADD'
                      ? adjustCustomer.pointsBalance + adjustAmount
                      : Math.max(0, adjustCustomer.pointsBalance - adjustAmount)}{' '}
                    Poin
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan / Keterangan Penyesuaian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Contoh: Bonus Ulang Tahun Toko / Klaim Hadiah / Koreksi Kasir"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Konfirmasi Penyesuaian</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CUSTOMER STATEMENT & HISTORY DETAIL */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black flex items-center justify-center text-sm shadow-xs">
                  {selectedCustomerDetail.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{selectedCustomerDetail.name}</h3>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${getTierBadge(selectedCustomerDetail.tier)}`}>
                      {selectedCustomerDetail.tier}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedCustomerDetail.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile summary banner */}
            <div className="p-4 bg-slate-900 text-white grid grid-cols-3 gap-3 text-center shrink-0">
              <div className="p-2 border-r border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Saldo Poin</span>
                <span className="font-black text-amber-400 text-lg flex items-center justify-center gap-1 mt-0.5">
                  <Sparkles className="w-4 h-4 fill-amber-400" />
                  {selectedCustomerDetail.pointsBalance.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="p-2 border-r border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Total Belanja</span>
                <span className="font-bold text-emerald-400 text-base mt-0.5 block">
                  Rp {(selectedCustomerDetail.totalSpend || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="p-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Frekuensi Kunjungan</span>
                <span className="font-bold text-slate-200 text-base mt-0.5 block">
                  {selectedCustomerDetail.totalVisits || 0} Kali
                </span>
              </div>
            </div>

            {/* Statement of Loyalty Logs for this Customer */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Catatan Mutasi Poin & Transaksi
              </h4>

              {loyaltyLogs.filter((l) => l.customerId === selectedCustomerDetail.id).length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Belum ada catatan mutasi poin untuk member ini.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {loyaltyLogs
                    .filter((l) => l.customerId === selectedCustomerDetail.id)
                    .map((log) => {
                      const isPositive = log.points > 0;
                      return (
                        <div key={log.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  log.type === 'EARN'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : log.type === 'REDEEM'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {log.type}
                              </span>
                              <span className="text-slate-500 font-mono text-[11px]">
                                {new Date(log.timestamp).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}{' '}
                                {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-slate-700 mt-1 text-[11px] font-medium">{log.notes || 'Transaksi kasir'}</p>
                          </div>

                          <div className="text-right">
                            <span
                              className={`font-black text-sm block font-mono ${
                                isPositive ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {isPositive ? `+${log.points}` : log.points} Poin
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Saldo: {log.balanceAfter} Poin
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  handleOpenAdjustPoints(selectedCustomerDetail);
                  setSelectedCustomerDetail(null);
                }}
                className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-600" />
                <span>Sesuaikan Poin (+/-)</span>
              </button>

              <button
                onClick={() => setSelectedCustomerDetail(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CustomersView;

import React, { useEffect, useState, useRef } from 'react';
import { Customer } from '../../types';
import { db } from '../../db/indexedDB';
import { useApp } from '../../context/AppContext';
import {
  User,
  Search,
  Plus,
  X,
  Award,
  Sparkles,
  Check,
  ChevronDown,
  Gift,
  Phone,
} from 'lucide-react';

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  subtotal: number;
  pointsToRedeem: number;
  onChangePointsToRedeem: (points: number) => void;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  selectedCustomer,
  onSelectCustomer,
  subtotal,
  pointsToRedeem,
  onChangePointsToRedeem,
}) => {
  const { settings, showToast, activeUser } = useApp();
  const [query, setQuery] = useState('');
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isNewCustomerModalOpen, setNewCustomerModalOpen] = useState(false);

  // New customer form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Redeem points toggle
  const [isRedeeming, setIsRedeeming] = useState(pointsToRedeem > 0);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const pointsPerAmount = settings?.loyaltyPointsPerAmount || 10000;
  const redemptionValue = settings?.loyaltyPointRedemptionValue || 100; // 1 point = Rp 100
  const minRedeemPoints = settings?.loyaltyMinRedeemPoints || 10;

  // Calculate points that will be earned
  const potentialPointsEarned = Math.floor(Math.max(0, subtotal) / pointsPerAmount);

  // Max points that can be redeemed based on subtotal and customer balance
  const maxRedeemablePoints = selectedCustomer
    ? Math.min(
        selectedCustomer.pointsBalance,
        Math.floor(subtotal / (redemptionValue || 1))
      )
    : 0;

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const list = await db.customers.toArray();
      setCustomers(list);
    } catch (e) {
      console.error('Failed to load customers:', e);
    }
  };

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    setQuery('');
    setIsOpenDropdown(false);
    onChangePointsToRedeem(0);
    setIsRedeeming(false);
  };

  const handleClear = () => {
    onSelectCustomer(null);
    setQuery('');
    onChangePointsToRedeem(0);
    setIsRedeeming(false);
  };

  const handleToggleRedeem = (enable: boolean) => {
    setIsRedeeming(enable);
    if (!enable) {
      onChangePointsToRedeem(0);
    } else {
      // Default to minRedeemPoints or maxRedeemablePoints
      const initial = Math.min(maxRedeemablePoints, Math.max(minRedeemPoints, 10));
      onChangePointsToRedeem(initial);
    }
  };

  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      showToast('Nama dan nomor telepon wajib diisi', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const newCustomer: Customer = {
        id: `CUST-${Date.now()}`,
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        address: newAddress.trim() || undefined,
        notes: newNotes.trim() || undefined,
        tier: 'BRONZE',
        pointsBalance: 0,
        totalSpend: 0,
        totalVisits: 0,
        createdAt: new Date().toISOString(),
      };

      await db.customers.add(newCustomer);

      // Audit log
      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'CREATE_CUSTOMER',
        category: 'CUSTOMER',
        details: `Pelanggan baru ${newCustomer.name} (${newCustomer.phone}) ditambahkan dari kasir POS.`,
      });

      await loadCustomers();
      onSelectCustomer(newCustomer);
      showToast(`Pelanggan ${newCustomer.name} berhasil didaftarkan!`, 'success');

      // Reset modal
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewAddress('');
      setNewNotes('');
      setNewCustomerModalOpen(false);
    } catch (err: any) {
      console.error('Error adding customer:', err);
      showToast('Gagal menambahkan pelanggan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const getTierBadge = (tier: string) => {
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

  return (
    <div className="border-b border-slate-200 bg-slate-50/60 p-3 space-y-2">
      {/* Selected Customer View */}
      {selectedCustomer ? (
        <div className="bg-white rounded-xl p-2.5 border border-emerald-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                {selectedCustomer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-xs text-slate-900 truncate">
                    {selectedCustomer.name}
                  </span>
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${getTierBadge(
                      selectedCustomer.tier
                    )}`}
                  >
                    {selectedCustomer.tier}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                  <Phone className="w-2.5 h-2.5" />
                  <span>{selectedCustomer.phone}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="text-right">
                <div className="text-[10px] text-slate-500">Saldo Poin</div>
                <div className="font-extrabold text-xs text-amber-600 flex items-center gap-0.5 justify-end">
                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>{selectedCustomer.pointsBalance.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Ganti / Lepas Pelanggan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Points earned preview and redemption */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                Poin diperoleh belanja ini:
              </span>
              <span className="font-bold text-emerald-700">
                +{potentialPointsEarned.toLocaleString('id-ID')} Poin
              </span>
            </div>

            {/* Redeem Points Section */}
            {selectedCustomer.pointsBalance >= minRedeemPoints && maxRedeemablePoints > 0 && (
              <div className="bg-amber-50/80 rounded-lg p-2 border border-amber-200/80 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 font-medium text-amber-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isRedeeming}
                      onChange={(e) => handleToggleRedeem(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <Gift className="w-3 h-3 text-amber-700" />
                    <span>Tukar Poin Jadi Diskon</span>
                  </label>
                  {isRedeeming && (
                    <span className="font-bold text-rose-600">
                      -Rp {(pointsToRedeem * redemptionValue).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>

                {isRedeeming && (
                  <div className="pt-1 flex items-center gap-2">
                    <input
                      type="range"
                      min={minRedeemPoints}
                      max={maxRedeemablePoints}
                      step={5}
                      value={pointsToRedeem}
                      onChange={(e) => onChangePointsToRedeem(parseInt(e.target.value, 10))}
                      className="w-full accent-amber-600 h-1.5 cursor-pointer"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={minRedeemPoints}
                        max={maxRedeemablePoints}
                        value={pointsToRedeem}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          onChangePointsToRedeem(
                            Math.min(maxRedeemablePoints, Math.max(0, val))
                          );
                        }}
                        className="w-14 px-1 py-0.5 text-center text-xs font-bold border border-amber-300 rounded bg-white"
                      />
                      <span className="text-[10px] text-amber-800">Poin</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No Customer Selected - Search / Autocomplete Box */
        <div ref={dropdownRef} className="relative">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={query}
                onFocus={() => setIsOpenDropdown(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpenDropdown(true);
                }}
                placeholder="Pilih/Cari Member (Nama / No. HP)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 placeholder:text-slate-400"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpenDropdown(!isOpenDropdown)}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setNewCustomerModalOpen(true)}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              title="Daftarkan Member Baru"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Member Baru</span>
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {isOpenDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
              {filteredCustomers.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">
                  <p>Tidak ada pelanggan ditemukan.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewName(query);
                      setIsOpenDropdown(false);
                      setNewCustomerModalOpen(true);
                    }}
                    className="mt-1.5 text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah "{query}" sebagai member baru
                  </button>
                </div>
              ) : (
                filteredCustomers.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelect(cust)}
                    className="w-full p-2.5 text-left hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {cust.name}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getTierBadge(
                            cust.tier
                          )}`}
                        >
                          {cust.tier}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {cust.phone}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-xs text-amber-600 flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5 fill-amber-500" />
                        {cust.pointsBalance}
                      </span>
                      <span className="text-[10px] text-slate-400">Poin</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Add New Customer Modal */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Registrasi Member Baru</h3>
                  <p className="text-[11px] text-slate-500">Mulai kumpulkan poin belanja pelanggan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewCustomerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewCustomer} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Ibu Rina Wati"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. Telepon / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Contoh: 0812-3456-7890"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email (Opsional)
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat / Area
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Contoh: RT 03/05"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Preferensi belanja atau kontak keluarga"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewCustomerModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan & Pilih Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

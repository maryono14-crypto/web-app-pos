import React, { useState } from 'react';
import { db } from '../../db/indexedDB';
import { CashierShift } from '../../types';
import { useApp } from '../../context/AppContext';
import { Clock, DollarSign, Lock, AlertCircle, X, CheckCircle2 } from 'lucide-react';

export const ShiftModal: React.FC = () => {
  const {
    isShiftModalOpen,
    setShiftModalOpen,
    activeShift,
    refreshShift,
    activeUser,
    showToast,
  } = useApp();

  const [startingCashInput, setStartingCashInput] = useState('200000');
  const [actualCashInput, setActualCashInput] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isShiftModalOpen) return null;

  const handleOpenShift = async () => {
    const startingCash = parseInt(startingCashInput.replace(/\D/g, '') || '0', 10);
    if (startingCash < 0) {
      showToast('Modal awal tidak valid', 'error');
      return;
    }

    try {
      setLoading(true);
      const newShift: CashierShift = {
        id: `SHF-${Date.now()}`,
        cashierId: activeUser.id,
        cashierName: activeUser.name,
        openedAt: new Date().toISOString(),
        startingCash,
        expectedEndingCash: startingCash,
        totalSalesCash: 0,
        totalSalesNonCash: 0,
        totalTransactions: 0,
        cashInExpenses: 0,
        status: 'OPEN',
      };

      await db.shifts.add(newShift);
      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'OPEN_SHIFT',
        category: 'POS',
        details: `Shift dibuka oleh ${activeUser.name} dengan modal awal Rp ${startingCash.toLocaleString('id-ID')}`,
      });

      await refreshShift();
      showToast(`Shift kasir dibuka! Modal awal: Rp ${startingCash.toLocaleString('id-ID')}`, 'success');
      setShiftModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Gagal membuka shift', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;

    const actualCash = parseInt(actualCashInput.replace(/\D/g, '') || '0', 10);
    const expected = activeShift.expectedEndingCash;
    const diff = actualCash - expected;

    try {
      setLoading(true);
      const now = new Date().toISOString();
      await db.shifts.update(activeShift.id, {
        closedAt: now,
        actualEndingCash: actualCash,
        cashDifference: diff,
        notes,
        status: 'CLOSED',
      });

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'CLOSE_SHIFT',
        category: 'POS',
        details: `Shift ditutup. Diharapkan: Rp ${expected.toLocaleString('id-ID')}, Aktual: Rp ${actualCash.toLocaleString('id-ID')}, Selisih: Rp ${diff.toLocaleString('id-ID')}`,
      });

      await refreshShift();
      showToast(`Shift kasir berhasil ditutup! Selisih kas: Rp ${diff.toLocaleString('id-ID')}`, 'success');
      setShiftModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Gagal menutup shift', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-xl ${
                activeShift ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {activeShift ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900">
                {activeShift ? 'Manajemen Shift Kasir Aktif' : 'Buka Shift Kasir Baru'}
              </h3>
              <p className="text-xs text-slate-500">
                Kasir: <span className="font-semibold text-slate-700">{activeUser.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setShiftModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {!activeShift ? (
            /* Open Shift Form */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-xs text-blue-800">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Sebelum memulai transaksi penjualan, silakan hitung uang modal tunai di laci kasir
                  (uang pecahan/kembalian awal).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Modal Kas Awal (Rp):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm font-semibold text-slate-500">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={startingCashInput}
                    onChange={(e) => {
                      const num = e.target.value.replace(/\D/g, '');
                      setStartingCashInput(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                    }}
                    placeholder="0"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[100000, 150000, 200000, 300000, 500000].map((nominal) => (
                  <button
                    key={nominal}
                    type="button"
                    onClick={() => setStartingCashInput(nominal.toLocaleString('id-ID'))}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                  >
                    Rp {nominal.toLocaleString('id-ID')}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Close Shift / Live Shift Monitor */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500">Waktu Mulai Shift</span>
                  <p className="font-semibold text-sm text-slate-800 mt-0.5">
                    {new Date(activeShift.openedAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    WIB
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500">Modal Kas Awal</span>
                  <p className="font-bold text-sm text-slate-900 mt-0.5">
                    Rp {activeShift.startingCash.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[11px] font-medium text-emerald-700">Penjualan Tunai</span>
                  <p className="font-bold text-sm text-emerald-800 mt-0.5">
                    + Rp {activeShift.totalSalesCash.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-[11px] font-medium text-blue-700">Non-Tunai (QRIS/Card)</span>
                  <p className="font-bold text-sm text-blue-800 mt-0.5">
                    Rp {activeShift.totalSalesNonCash.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Total Kas Fisik Diharapkan di Laci:</span>
                  <p className="text-xl font-black text-emerald-400 mt-0.5">
                    Rp {activeShift.expectedEndingCash.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    (Modal Awal + Penjualan Tunai - Kasbon/Pengeluaran)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total Struk</span>
                  <p className="text-lg font-bold text-white">{activeShift.totalTransactions}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tutup Shift Kasir
                </h4>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hitungan Fisik Uang di Laci (Rp):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-sm font-semibold text-slate-500">
                      Rp
                    </span>
                    <input
                      type="text"
                      value={actualCashInput}
                      onChange={(e) => {
                        const num = e.target.value.replace(/\D/g, '');
                        setActualCashInput(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                      }}
                      placeholder="Masukkan total uang aktual"
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {actualCashInput && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                      parseInt(actualCashInput.replace(/\D/g, ''), 10) - activeShift.expectedEndingCash === 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : parseInt(actualCashInput.replace(/\D/g, ''), 10) - activeShift.expectedEndingCash > 0
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800 font-bold'
                    }`}
                  >
                    <span>Selisih Kas:</span>
                    <span className="font-bold text-sm">
                      {parseInt(actualCashInput.replace(/\D/g, ''), 10) - activeShift.expectedEndingCash === 0
                        ? 'Uang Pas (Cocok Rp 0)'
                        : (parseInt(actualCashInput.replace(/\D/g, ''), 10) - activeShift.expectedEndingCash > 0 ? '+ ' : '') +
                          'Rp ' +
                          (parseInt(actualCashInput.replace(/\D/g, ''), 10) - activeShift.expectedEndingCash).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Catatan Kasir (opsional):
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Selisih Rp 500 karena pembulatan pecahan kecil"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100">
          <button
            onClick={() => setShiftModalOpen(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200/60"
          >
            Tutup
          </button>
          {!activeShift ? (
            <button
              onClick={handleOpenShift}
              disabled={loading || !startingCashInput}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Membuka...' : 'Buka Shift Sekarang'}
            </button>
          ) : (
            <button
              onClick={handleCloseShift}
              disabled={loading || !actualCashInput}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
            >
              {loading ? 'Menutup...' : 'Tutup Shift & Rekonsiliasi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

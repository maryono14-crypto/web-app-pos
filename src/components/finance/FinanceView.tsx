import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../db/indexedDB';
import { CashierShift, Expense, ExpenseCategory } from '../../types';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { downloadCsv } from '../../utils/exportHelpers';
import {
  Wallet,
  Plus,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  X,
  FileSpreadsheet,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowDownRight,
  Lock,
  CheckCircle2,
  Calendar,
  Building2,
  Printer,
} from 'lucide-react';
import { MonthlyPdfReportModal } from '../analytics/MonthlyPdfReportModal';

export const FinanceView: React.FC = () => {
  const { activeUser, activeShift, refreshShift, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'EXPENSES' | 'SHIFTS'>('EXPENSES');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shifts, setShifts] = useState<CashierShift[]>([]);

  // Search & Filter state for Expenses
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | 'MONTH'>('ALL');

  // Expense modal (Add / Edit)
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState<{
    timestamp: string;
    category: ExpenseCategory;
    amount: string;
    description: string;
    recipient: string;
    deductFromShiftCash: boolean;
  }>({
    timestamp: new Date().toISOString().slice(0, 16),
    category: 'OPERASIONAL_KASIR',
    amount: '',
    description: '',
    recipient: '',
    deductFromShiftCash: true,
  });

  // Delete Expense Confirmation
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [isMonthlyPdfModalOpen, setIsMonthlyPdfModalOpen] = useState(false);

  // Shift Management State (Close / Edit / Delete Shift)
  const [shiftToClose, setShiftToClose] = useState<CashierShift | null>(null);
  const [closingActualCash, setClosingActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [shiftToDelete, setShiftToDelete] = useState<CashierShift | null>(null);
  const [shiftToEdit, setShiftToEdit] = useState<CashierShift | null>(null);
  const [editShiftNotes, setEditShiftNotes] = useState('');

  // RBAC Permission checks for Expenses
  const canEditExpense = (expense: Expense): boolean => {
    if (!activeUser) return false;
    if (activeUser.role === 'OWNER' || activeUser.role === 'ADMIN') return true;
    if (activeUser.role === 'MANAGER') return true;
    if (
      activeUser.role === 'CASHIER' &&
      expense.userId === activeUser.id &&
      activeShift &&
      expense.shiftId === activeShift.id
    ) {
      return true; // Cashier can only edit their own expense recorded in the current active shift
    }
    return false;
  };

  const canDeleteExpense = (expense: Expense): boolean => {
    if (!activeUser) return false;
    if (activeUser.role === 'OWNER' || activeUser.role === 'ADMIN') return true;
    if (
      activeUser.role === 'MANAGER' &&
      expense.category !== 'GAJI_KARYAWAN' &&
      expense.category !== 'SEWA_TEMPAT'
    ) {
      return true; // Manager cannot delete critical fixed expenses (salary & rent)
    }
    return false;
  };

  const canDeleteAllExpenses = (): boolean => {
    return activeUser?.role === 'OWNER';
  };

  // RBAC Permission checks for Shifts
  const canCloseShift = (shift: CashierShift): boolean => {
    if (!activeUser) return false;
    if (shift.status !== 'OPEN') return false;
    // OWNER, ADMIN, and MANAGER can force-close open shifts
    return activeUser.role === 'OWNER' || activeUser.role === 'ADMIN' || activeUser.role === 'MANAGER';
  };

  const canEditShift = (_shift: CashierShift): boolean => {
    if (!activeUser) return false;
    return activeUser.role === 'OWNER' || activeUser.role === 'ADMIN';
  };

  const canDeleteShift = (_shift: CashierShift): boolean => {
    if (!activeUser) return false;
    return activeUser.role === 'OWNER' || activeUser.role === 'ADMIN';
  };

  const loadData = async () => {
    const [eList, shList] = await Promise.all([
      db.expenses.reverse().sortBy('timestamp'),
      db.shifts.reverse().sortBy('openedAt'),
    ]);
    setExpenses(eList);
    setShifts(shList);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return expenses.filter((e) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        e.description.toLowerCase().includes(q) ||
        (e.recipient && e.recipient.toLowerCase().includes(q)) ||
        e.userName.toLowerCase().includes(q) ||
        e.categoryLabel.toLowerCase().includes(q);

      // Category
      const matchCat = selectedCategory === 'ALL' || e.category === selectedCategory;

      // Date
      const expTime = new Date(e.timestamp).getTime();
      let matchDate = true;
      if (dateFilter === 'TODAY') {
        matchDate = expTime >= startOfToday;
      } else if (dateFilter === '7DAYS') {
        matchDate = expTime >= sevenDaysAgo;
      } else if (dateFilter === 'MONTH') {
        matchDate = expTime >= startOfMonth;
      }

      return matchSearch && matchCat && matchDate;
    });
  }, [expenses, searchQuery, selectedCategory, dateFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalAll = expenses.reduce((s, e) => s + e.amount, 0);
    const totalFiltered = filteredExpenses.reduce((s, e) => s + e.amount, 0);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const todayAmount = expenses
      .filter((e) => new Date(e.timestamp).getTime() >= startOfToday)
      .reduce((s, e) => s + e.amount, 0);

    const monthAmount = expenses
      .filter((e) => new Date(e.timestamp).getTime() >= startOfMonth)
      .reduce((s, e) => s + e.amount, 0);

    const shiftTiedAmount = expenses
      .filter((e) => Boolean(e.shiftId))
      .reduce((s, e) => s + e.amount, 0);

    return { totalAll, totalFiltered, todayAmount, monthAmount, shiftTiedAmount };
  }, [expenses, filteredExpenses]);

  // Handle Add Modal
  const openAddExpenseModal = () => {
    setEditingExpense(null);
    setExpenseForm({
      timestamp: new Date().toISOString().slice(0, 16),
      category: 'OPERASIONAL_KASIR',
      amount: '',
      description: '',
      recipient: '',
      deductFromShiftCash: Boolean(activeShift),
    });
    setExpenseModalOpen(true);
  };

  // Handle Edit Modal
  const openEditExpenseModal = (e: Expense) => {
    if (!canEditExpense(e)) {
      showToast(
        `Akses ditolak: Role ${activeUser?.role} tidak memiliki izin mengubah catatan pengeluaran ini.`,
        'error'
      );
      return;
    }

    setEditingExpense(e);
    setExpenseForm({
      timestamp: new Date(e.timestamp).toISOString().slice(0, 16),
      category: e.category,
      amount: e.amount.toLocaleString('id-ID'),
      description: e.description,
      recipient: e.recipient || '',
      deductFromShiftCash: Boolean(e.shiftId),
    });
    setExpenseModalOpen(true);
  };

  // Handle Save Expense (Add or Edit)
  const handleSaveExpense = async () => {
    const nominal = parseInt(expenseForm.amount.replace(/\D/g, '') || '0', 10);
    if (nominal <= 0 || !expenseForm.description.trim()) {
      showToast('Nominal dan keterangan biaya wajib diisi', 'error');
      return;
    }

    const categoryLabels: Record<ExpenseCategory, string> = {
      LISTRIK_AIR: 'Listrik & Air',
      SEWA_TEMPAT: 'Sewa Tempat / Kios',
      GAJI_KARYAWAN: 'Gaji Karyawan',
      OPERASIONAL_KASIR: 'Operasional Kasir / Kas Kecil',
      KONSUMSI_KEBERSIHAN: 'Konsumsi & Kebersihan',
      MARKETING: 'Promosi / Marketing',
      LAINNYA: 'Lain-lain',
    };

    const finalTimestamp = expenseForm.timestamp
      ? new Date(expenseForm.timestamp).toISOString()
      : new Date().toISOString();

    if (editingExpense) {
      // Update existing expense
      const oldAmount = editingExpense.amount;
      const amountDiff = nominal - oldAmount;

      await db.expenses.update(editingExpense.id, {
        timestamp: finalTimestamp,
        category: expenseForm.category,
        categoryLabel: categoryLabels[expenseForm.category],
        amount: nominal,
        description: expenseForm.description.trim(),
        recipient: expenseForm.recipient.trim() || undefined,
      });

      // If tied to an active shift, adjust the difference in drawer cash
      if (
        editingExpense.shiftId &&
        activeShift &&
        editingExpense.shiftId === activeShift.id &&
        amountDiff !== 0
      ) {
        await db.shifts.update(activeShift.id, {
          cashInExpenses: activeShift.cashInExpenses + amountDiff,
          expectedEndingCash: activeShift.expectedEndingCash - amountDiff,
        });
        await refreshShift();
      }

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'UPDATE_EXPENSE',
        category: 'FINANCE',
        details: `Pengeluaran diubah: Rp ${oldAmount.toLocaleString('id-ID')} -> Rp ${nominal.toLocaleString('id-ID')} (${expenseForm.category}) - ${expenseForm.description}`,
      });

      showToast(`Pengeluaran Rp ${nominal.toLocaleString('id-ID')} berhasil diperbarui!`, 'success');
    } else {
      // Create new expense
      const newExpense: Expense = {
        id: `EXP-${Date.now()}`,
        timestamp: finalTimestamp,
        category: expenseForm.category,
        categoryLabel: categoryLabels[expenseForm.category],
        amount: nominal,
        description: expenseForm.description.trim(),
        recipient: expenseForm.recipient.trim() || undefined,
        userId: activeUser.id,
        userName: activeUser.name,
        shiftId: expenseForm.deductFromShiftCash && activeShift ? activeShift.id : undefined,
      };

      await db.expenses.add(newExpense);

      // If deducted from active shift drawer cash
      if (expenseForm.deductFromShiftCash && activeShift) {
        await db.shifts.update(activeShift.id, {
          cashInExpenses: activeShift.cashInExpenses + nominal,
          expectedEndingCash: activeShift.expectedEndingCash - nominal,
        });
        await refreshShift();
      }

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'ADD_EXPENSE',
        category: 'FINANCE',
        details: `Pengeluaran dicatat: Rp ${nominal.toLocaleString('id-ID')} (${expenseForm.category}) - ${expenseForm.description}`,
      });

      showToast(`Pengeluaran Rp ${nominal.toLocaleString('id-ID')} berhasil dicatat!`, 'success');
    }

    setExpenseModalOpen(false);
    setEditingExpense(null);
    setExpenseForm({
      timestamp: new Date().toISOString().slice(0, 16),
      category: 'OPERASIONAL_KASIR',
      amount: '',
      description: '',
      recipient: '',
      deductFromShiftCash: true,
    });
    loadData();
  };

  // Handle Delete Expense
  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;

    if (!canDeleteExpense(expenseToDelete)) {
      showToast(
        `Akses ditolak: Role ${activeUser?.role} tidak memiliki hak akses menghapus pengeluaran ini.`,
        'error'
      );
      setExpenseToDelete(null);
      return;
    }

    try {
      const e = expenseToDelete;
      const now = new Date().toISOString();

      await db.expenses.delete(e.id);

      // If it was deducted from active shift, restore the cash
      if (e.shiftId && activeShift && e.shiftId === activeShift.id) {
        await db.shifts.update(activeShift.id, {
          cashInExpenses: Math.max(0, activeShift.cashInExpenses - e.amount),
          expectedEndingCash: activeShift.expectedEndingCash + e.amount,
        });
        await refreshShift();
      }

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'DELETE_EXPENSE',
        category: 'FINANCE',
        details: `Pengeluaran dihapus: Rp ${e.amount.toLocaleString('id-ID')} (${e.category}) - ${e.description}`,
      });

      showToast(`Pengeluaran Rp ${e.amount.toLocaleString('id-ID')} berhasil dihapus`, 'success');
      setExpenseToDelete(null);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus pengeluaran: ' + err.message, 'error');
    }
  };

  // Handle Delete All Filtered Expenses (OWNER Only)
  const handleDeleteAllFiltered = async () => {
    if (!canDeleteAllExpenses()) {
      showToast('Akses ditolak: Hanya OWNER yang dapat menghapus seluruh data pengeluaran.', 'error');
      setDeleteAllModalOpen(false);
      return;
    }

    try {
      const idsToDelete = filteredExpenses.map((e) => e.id);
      if (idsToDelete.length === 0) return;

      await db.expenses.bulkDelete(idsToDelete);

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'BULK_DELETE_EXPENSES',
        category: 'FINANCE',
        details: `Menghapus massal ${idsToDelete.length} data pengeluaran`,
      });

      showToast(`${idsToDelete.length} data pengeluaran berhasil dibersihkan`, 'success');
      setDeleteAllModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus data pengeluaran: ' + err.message, 'error');
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredExpenses.length === 0) {
      showToast('Tidak ada data pengeluaran untuk diekspor', 'info');
      return;
    }

    const headers = [
      'ID Pengeluaran',
      'Tanggal & Waktu',
      'Kategori Biaya',
      'Keterangan / Keperluan',
      'Penerima / Vendor',
      'Nominal (Rp)',
      'Dicatat Oleh',
      'ID Shift Terkait',
    ];

    const rows = filteredExpenses.map((e) => [
      e.id,
      new Date(e.timestamp).toLocaleString('id-ID'),
      e.categoryLabel,
      e.description,
      e.recipient || '-',
      e.amount,
      e.userName,
      e.shiftId || 'Tidak Terikat Shift',
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`Laporan_Keuangan_Pengeluaran_${dateStr}.csv`, headers, rows);
    showToast('Data pengeluaran berhasil diunduh (CSV)', 'success');
  };

  // Shift Management Handlers
  const handleConfirmCloseShift = async () => {
    if (!shiftToClose) return;

    const actual = parseInt(closingActualCash.replace(/\D/g, '') || '0', 10);
    const diff = actual - shiftToClose.expectedEndingCash;
    const now = new Date().toISOString();

    try {
      await db.shifts.update(shiftToClose.id, {
        status: 'CLOSED',
        closedAt: now,
        actualEndingCash: actual,
        cashDifference: diff,
        notes: closingNotes.trim()
          ? `${shiftToClose.notes ? shiftToClose.notes + ' | ' : ''}Ditutup paksa oleh ${activeUser.name}: ${closingNotes.trim()}`
          : shiftToClose.notes,
      });

      if (activeShift?.id === shiftToClose.id) {
        await refreshShift();
      }

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'FORCE_CLOSE_SHIFT',
        category: 'FINANCE',
        details: `Shift kasir ${shiftToClose.cashierName} ditutup oleh ${activeUser.name}. Kas Aktual: Rp ${actual.toLocaleString('id-ID')}, Selisih: Rp ${diff.toLocaleString('id-ID')}`,
      });

      showToast(`Shift kasir ${shiftToClose.cashierName} berhasil ditutup`, 'success');
      setShiftToClose(null);
      setClosingActualCash('');
      setClosingNotes('');
      loadData();
    } catch (err: any) {
      showToast('Gagal menutup shift: ' + err.message, 'error');
    }
  };

  const handleSaveShiftEdit = async () => {
    if (!shiftToEdit) return;

    try {
      await db.shifts.update(shiftToEdit.id, {
        notes: editShiftNotes.trim(),
      });

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'UPDATE_SHIFT',
        category: 'FINANCE',
        details: `Catatan shift ${shiftToEdit.cashierName} diperbarui: ${editShiftNotes.trim()}`,
      });

      showToast('Catatan shift berhasil diperbarui', 'success');
      setShiftToEdit(null);
      loadData();
    } catch (err: any) {
      showToast('Gagal memperbarui shift: ' + err.message, 'error');
    }
  };

  const handleDeleteShift = async () => {
    if (!shiftToDelete) return;

    if (!canDeleteShift(shiftToDelete)) {
      showToast('Akses ditolak: Hanya OWNER dan ADMIN yang dapat menghapus data riwayat shift.', 'error');
      setShiftToDelete(null);
      return;
    }

    try {
      await db.shifts.delete(shiftToDelete.id);

      if (activeShift?.id === shiftToDelete.id) {
        await refreshShift();
      }

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'DELETE_SHIFT',
        category: 'FINANCE',
        details: `Riwayat shift ${shiftToDelete.cashierName} (${shiftToDelete.id}) dihapus oleh ${activeUser.name}`,
      });

      showToast(`Histori shift ${shiftToDelete.cashierName} berhasil dihapus`, 'success');
      setShiftToDelete(null);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus shift: ' + err.message, 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Keuangan & Biaya Operasional</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manajemen pencatatan pengeluaran, cash flow kasir, dan audit rekonsiliasi shift
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsMonthlyPdfModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs cursor-pointer transition-colors"
            title="Cetak & Ekspor Ringkasan Laporan Bulanan Penjualan & Keuangan ke PDF"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>Laporan PDF Bulanan</span>
          </button>
          <button
            onClick={openAddExpenseModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran Baru</span>
          </button>
        </div>
      </div>

      {/* RBAC Role Transparency Banner */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Hak Akses Keuangan:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                {activeUser?.role || 'GUEST'}
              </span>
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5">
              {activeUser?.role === 'OWNER' &&
                'Hak Penuh: Anda memiliki izin mutlak untuk mengedit, menghapus seluruh biaya, dan mengelola histori shift.'}
              {activeUser?.role === 'ADMIN' &&
                'Hak Administrator: Anda dapat mengedit dan menghapus semua catatan biaya serta mengelola shift kasir.'}
              {activeUser?.role === 'MANAGER' &&
                'Hak Manajer: Anda dapat mengedit biaya dan menghapus biaya operasional rutin (Gaji & Sewa dilindungi).' }
              {activeUser?.role === 'CASHIER' &&
                'Hak Kasir: Anda hanya dapat mencatat dan mengedit pengeluaran yang terikat pada shift aktif Anda sendiri.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {activeShift ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Shift Aktif: {activeShift.cashierName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
              Tidak Ada Shift Berjalan
            </span>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Beban Operasional</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-black text-slate-900 font-mono">
            Rp {stats.totalAll.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Akumulasi seluruh catatan</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Pengeluaran Hari Ini</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-black text-blue-700 font-mono">
            Rp {stats.todayAmount.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Biaya tanggal berjalan</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Bulan Ini ({new Date().toLocaleString('id-ID', { month: 'short' })})</span>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-black text-purple-700 font-mono">
            Rp {stats.monthAmount.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Pergerakan kas bulan ini</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Potong Uang Kasir</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-black text-rose-600 font-mono">
            Rp {stats.shiftTiedAmount.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Diambil dari laci kas kasir</p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'EXPENSES'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Daftar Pengeluaran & Biaya</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {expenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SHIFTS')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'SHIFTS'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Riwayat Shift & Kas Laci</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {shifts.length}
          </span>
        </button>
      </div>

      {/* TAB 1: EXPENSES MANAGEMENT */}
      {activeTab === 'EXPENSES' && (
        <div className="space-y-4">
          {/* Search, Filters, and Action Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-2xs">
            <div className="flex flex-1 flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari keterangan, penerima, dicatat oleh..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua Kategori Biaya</option>
                <option value="OPERASIONAL_KASIR">Operasional Kasir / Kas Kecil</option>
                <option value="LISTRIK_AIR">Listrik & Air</option>
                <option value="SEWA_TEMPAT">Sewa Tempat / Kios</option>
                <option value="GAJI_KARYAWAN">Gaji Karyawan</option>
                <option value="KONSUMSI_KEBERSIHAN">Konsumsi & Kebersihan</option>
                <option value="MARKETING">Promosi / Marketing</option>
                <option value="LAINNYA">Lain-lain</option>
              </select>

              {/* Date Filter */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua Periode</option>
                <option value="TODAY">Hari Ini Saja</option>
                <option value="7DAYS">7 Hari Terakhir</option>
                <option value="MONTH">Bulan Ini</option>
              </select>
            </div>

            {/* Quick action buttons: Export PDF, CSV & Delete All (Owner) */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={() => setIsMonthlyPdfModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                title="Cetak & Ekspor Laporan Bulanan Penjualan & Keuangan ke Dokumen PDF"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cetak PDF</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                title="Ekspor data pengeluaran terfilter ke CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unduh CSV</span>
              </button>

              {canDeleteAllExpenses() && filteredExpenses.length > 0 && (
                <button
                  onClick={() => setDeleteAllModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                  title="Hapus massal data pengeluaran yang sedang terfilter (Khusus OWNER)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Terfilter ({filteredExpenses.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Kategori Biaya</th>
                    <th className="py-3 px-4">Keterangan / Keperluan</th>
                    <th className="py-3 px-4">Penerima / Vendor</th>
                    <th className="py-3 px-4 text-right">Jumlah Biaya</th>
                    <th className="py-3 px-4">Dicatat Oleh</th>
                    <th className="py-3 px-4 text-center">Sumber Kas</th>
                    <th className="py-3 px-4 text-center min-w-[140px]">Menu Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Tidak ada data pengeluaran yang sesuai kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((e) => {
                      const editable = canEditExpense(e);
                      const deletable = canDeleteExpense(e);

                      return (
                        <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {new Date(e.timestamp).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200/80">
                              {e.categoryLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{e.description}</td>
                          <td className="py-3 px-4 text-slate-500">{e.recipient || '-'}</td>
                          <td className="py-3 px-4 text-right font-black text-rose-600 text-sm whitespace-nowrap font-mono">
                            -Rp {e.amount.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="font-medium text-slate-800">{e.userName}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {e.shiftId ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Laci Kasir
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                Kas Umum
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit Button */}
                              {editable ? (
                                <button
                                  onClick={() => openEditExpenseModal(e)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer text-[11px] font-medium"
                                  title="Ubah data pengeluaran ini"
                                >
                                  <Pencil className="w-3 h-3 text-emerald-600" />
                                  <span>Edit</span>
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed text-[11px]"
                                  title="Role Anda tidak memiliki izin mengedit catatan biaya ini"
                                >
                                  <Lock className="w-3 h-3 opacity-40" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {/* Delete Button */}
                              {deletable ? (
                                <button
                                  onClick={() => setExpenseToDelete(e)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 hover:border-rose-400 hover:bg-rose-50 text-slate-700 hover:text-rose-700 transition-colors cursor-pointer text-[11px] font-medium"
                                  title="Hapus data pengeluaran ini"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-600" />
                                  <span>Hapus</span>
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed text-[11px]"
                                  title={
                                    activeUser?.role === 'CASHIER'
                                      ? 'Kasir tidak memiliki izin menghapus pengeluaran'
                                      : 'Beban gaji & sewa dilindungi dari penghapusan Manajer'
                                  }
                                >
                                  <Lock className="w-3 h-3 opacity-40" />
                                  <span>Hapus</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
              <div>
                Menampilkan <span className="font-bold text-slate-700">{filteredExpenses.length}</span>{' '}
                dari <span className="font-bold text-slate-700">{expenses.length}</span> transaksi
              </div>
              <div className="font-semibold text-slate-800">
                Subtotal Terfilter:{' '}
                <span className="font-black text-rose-600 font-mono text-sm ml-1">
                  Rp {stats.totalFiltered.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SHIFT HISTORY & DRAWER RECONCILIATION */}
      {activeTab === 'SHIFTS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Kasir & Waktu Shift</th>
                    <th className="py-3 px-4 text-right">Modal Awal</th>
                    <th className="py-3 px-4 text-right">Penjualan Tunai</th>
                    <th className="py-3 px-4 text-right">Pengeluaran Laci</th>
                    <th className="py-3 px-4 text-right">Kas Diharapkan</th>
                    <th className="py-3 px-4 text-right">Kas Aktual</th>
                    <th className="py-3 px-4 text-right">Selisih Kas</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center min-w-[130px]">Aksi Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Belum ada riwayat shift kasir tercatat.
                      </td>
                    </tr>
                  ) : (
                    shifts.map((sh) => {
                      const diff = sh.cashDifference ?? 0;
                      const isOpen = sh.status === 'OPEN';
                      const allowClose = canCloseShift(sh);
                      const allowEdit = canEditShift(sh);
                      const allowDelete = canDeleteShift(sh);

                      return (
                        <tr key={sh.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900">{sh.cashierName}</span>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {new Date(sh.openedAt).toLocaleDateString('id-ID')} (
                              {new Date(sh.openedAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              -{' '}
                              {sh.closedAt
                                ? new Date(sh.closedAt).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Aktif Berjalan'}
                              )
                            </div>
                            {sh.notes && (
                              <div className="text-[10px] text-slate-400 italic mt-0.5 truncate max-w-xs">
                                Catatan: {sh.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-600 font-mono">
                            Rp {sh.startingCash.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700 font-mono">
                            +Rp {sh.totalSalesCash.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-rose-600 font-mono">
                            -Rp {sh.cashInExpenses.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                            Rp {sh.expectedEndingCash.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 font-mono">
                            {sh.actualEndingCash != null
                              ? `Rp ${sh.actualEndingCash.toLocaleString('id-ID')}`
                              : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold font-mono">
                            {sh.cashDifference != null ? (
                              <span
                                className={
                                  diff === 0
                                    ? 'text-emerald-700'
                                    : diff > 0
                                    ? 'text-blue-700'
                                    : 'text-rose-700'
                                }
                              >
                                {diff === 0
                                  ? 'Pas'
                                  : (diff > 0 ? '+' : '') + `Rp ${diff.toLocaleString('id-ID')}`}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isOpen
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isOpen ? 'Aktif' : 'Ditutup'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Close Shift (if still open) */}
                              {isOpen && allowClose && (
                                <button
                                  onClick={() => {
                                    setShiftToClose(sh);
                                    setClosingActualCash(
                                      sh.expectedEndingCash.toLocaleString('id-ID')
                                    );
                                  }}
                                  className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] cursor-pointer shadow-2xs"
                                  title="Tutup & rekonsiliasi kas shift ini"
                                >
                                  Tutup Shift
                                </button>
                              )}

                              {/* Edit Shift Notes */}
                              {allowEdit && (
                                <button
                                  onClick={() => {
                                    setShiftToEdit(sh);
                                    setEditShiftNotes(sh.notes || '');
                                  }}
                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                                  title="Ubah Catatan Shift"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete Shift */}
                              {allowDelete ? (
                                <button
                                  onClick={() => setShiftToDelete(sh)}
                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Hapus riwayat shift ini (Khusus OWNER/ADMIN)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                !isOpen && (
                                  <span
                                    title="Hanya OWNER & ADMIN yang dapat menghapus shift"
                                    className="p-1 text-slate-300 cursor-not-allowed"
                                  >
                                    <Lock className="w-3.5 h-3.5 opacity-40" />
                                  </span>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT EXPENSE */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  {editingExpense ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingExpense ? 'Ubah Catatan Biaya / Pengeluaran' : 'Catat Pengeluaran Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingExpense
                      ? `ID: ${editingExpense.id} • Dicatat: ${editingExpense.userName}`
                      : 'Isi detail beban operasional dan jumlah uang'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setExpenseModalOpen(false);
                  setEditingExpense(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              {/* Tanggal & Waktu */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tanggal & Waktu Biaya:</label>
                <input
                  type="datetime-local"
                  value={expenseForm.timestamp}
                  onChange={(e) => setExpenseForm({ ...expenseForm, timestamp: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Kategori Beban */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kategori Beban:</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="OPERASIONAL_KASIR">Operasional Kasir / Kas Kecil Toko</option>
                  <option value="LISTRIK_AIR">Listrik, Air & Internet</option>
                  <option value="SEWA_TEMPAT">Sewa Tempat / Kios / Kebersihan Pasar</option>
                  <option value="GAJI_KARYAWAN">Gaji / Uang Makan Karyawan</option>
                  <option value="KONSUMSI_KEBERSIHAN">Konsumsi, Plastik Kresek & Sabun</option>
                  <option value="MARKETING">Promosi / Spanduk</option>
                  <option value="LAINNYA">Lain-lain</option>
                </select>
              </div>

              {/* Jumlah Nominal */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Jumlah Pengeluaran (Rp):</label>
                <input
                  type="text"
                  value={expenseForm.amount}
                  onChange={(e) => {
                    const num = e.target.value.replace(/\D/g, '');
                    setExpenseForm({
                      ...expenseForm,
                      amount: num ? parseInt(num, 10).toLocaleString('id-ID') : '',
                    });
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-base text-rose-600 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Keterangan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan / Keperluan:</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Contoh: Beli kantong kresek 5 pak & sabun cuci"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Penerima / Vendor */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Penerima Uang / Vendor (opsional):</label>
                <input
                  type="text"
                  value={expenseForm.recipient}
                  onChange={(e) => setExpenseForm({ ...expenseForm, recipient: e.target.value })}
                  placeholder="Contoh: Toko Plastik Berkah / PLN"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Indikator Shift Kas Laci */}
              {editingExpense ? (
                editingExpense.shiftId ? (
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      Catatan ini terikat dengan shift kasir. Perubahan nominal akan otomatis disinkronkan ke laci kasir aktif jika shift masih dibuka.
                    </span>
                  </div>
                ) : null
              ) : (
                activeShift && (
                  <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        checked={expenseForm.deductFromShiftCash}
                        onChange={(e) =>
                          setExpenseForm({ ...expenseForm, deductFromShiftCash: e.target.checked })
                        }
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span className="font-semibold text-slate-800 text-[11px]">
                        Potong dari uang fisik laci kasir shift aktif saat ini ({activeShift.cashierName})
                      </span>
                    </label>
                  </div>
                )
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setExpenseModalOpen(false);
                  setEditingExpense(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveExpense}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs transition-colors"
              >
                {editingExpense ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FORCE CLOSE SHIFT */}
      {shiftToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <h3 className="font-bold text-amber-900 text-sm">
                Tutup Shift Kasir: {shiftToClose.cashierName}
              </h3>
              <button onClick={() => setShiftToClose(null)} className="text-amber-500 hover:text-amber-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Modal Awal:</span>
                  <span>Rp {shiftToClose.startingCash.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Penjualan Tunai:</span>
                  <span className="text-emerald-700 font-bold">+Rp {shiftToClose.totalSalesCash.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pengeluaran Laci:</span>
                  <span className="text-rose-600">-Rp {shiftToClose.cashInExpenses.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                  <span>Kas Diharapkan di Laci:</span>
                  <span>Rp {shiftToClose.expectedEndingCash.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kas Aktual Fisik Dihitung (Rp):</label>
                <input
                  type="text"
                  value={closingActualCash}
                  onChange={(e) => {
                    const num = e.target.value.replace(/\D/g, '');
                    setClosingActualCash(num ? parseInt(num, 10).toLocaleString('id-ID') : '');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-base text-slate-900 font-mono"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Penutupan / Alasan:</label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Contoh: Ditutup oleh Manajer pada akhir hari"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShiftToClose(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmCloseShift}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 cursor-pointer shadow-xs"
              >
                Konfirmasi Tutup Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT SHIFT NOTES */}
      {shiftToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Ubah Catatan Shift: {shiftToEdit.cashierName}
              </h3>
              <button onClick={() => setShiftToEdit(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Shift / Rekonsiliasi:</label>
                <textarea
                  rows={3}
                  value={editShiftNotes}
                  onChange={(e) => setEditShiftNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="Koreksi catatan atau keterangan selisih kas..."
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShiftToEdit(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleSaveShiftEdit}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: DELETE SINGLE EXPENSE */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        title="Hapus Biaya / Pengeluaran"
        message={`Apakah Anda yakin ingin menghapus catatan pengeluaran "${expenseToDelete?.description}" sebesar Rp ${(expenseToDelete?.amount || 0).toLocaleString('id-ID')}? Tindakan ini akan dicatat ke dalam audit log sistem.`}
        confirmText="Hapus Pengeluaran"
        isDestructive={true}
        onConfirm={handleDeleteExpense}
        onClose={() => setExpenseToDelete(null)}
      />

      {/* CONFIRM MODAL: DELETE ALL FILTERED EXPENSES (OWNER ONLY) */}
      <ConfirmModal
        isOpen={isDeleteAllModalOpen}
        title="Hapus Seluruh Data Pengeluaran Terfilter"
        message={`PERINGATAN: Anda akan menghapus secara permanen ${filteredExpenses.length} catatan pengeluaran yang sedang tampil pada filter saat ini. Total nilai: Rp ${stats.totalFiltered.toLocaleString('id-ID')}. Tindakan ini tidak dapat dibatalkan.`}
        confirmText={`Ya, Hapus ${filteredExpenses.length} Data`}
        isDestructive={true}
        onConfirm={handleDeleteAllFiltered}
        onClose={() => setDeleteAllModalOpen(false)}
      />

      {/* CONFIRM MODAL: DELETE SHIFT (OWNER & ADMIN ONLY) */}
      <ConfirmModal
        isOpen={!!shiftToDelete}
        title="Hapus Riwayat Shift Kasir"
        message={`Apakah Anda yakin ingin menghapus catatan riwayat shift kasir "${shiftToDelete?.cashierName}" (${shiftToDelete?.id})? Rekam jejak laci kasir terkait akan dihapus.`}
        confirmText="Hapus Shift"
        isDestructive={true}
        onConfirm={handleDeleteShift}
        onClose={() => setShiftToDelete(null)}
      />

      {/* Monthly PDF Report Modal */}
      <MonthlyPdfReportModal
        isOpen={isMonthlyPdfModalOpen}
        onClose={() => setIsMonthlyPdfModalOpen(false)}
        initialExpenses={expenses}
      />
    </div>
  );
};

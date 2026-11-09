import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../db/indexedDB';
import { Customer, Receivable, ReceivablePayment, ReceivableStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { downloadCsv } from '../../utils/exportHelpers';
import {
  FileText,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Plus,
  Calendar,
  User,
  Phone,
  ArrowRight,
  TrendingUp,
  Download,
  X,
  CreditCard,
  Banknote,
  Receipt,
  AlertTriangle,
  History,
  Pencil,
  Trash2,
  Lock,
  ShieldCheck,
} from 'lucide-react';

export const ReceivablesView: React.FC = () => {
  const { showToast, activeUser } = useApp();

  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BELUM_LUNAS' | 'SEBAGIAN' | 'LUNAS' | 'OVERDUE'>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Selected item states
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null);
  const [receivableToDelete, setReceivableToDelete] = useState<Receivable | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<{ receivable: Receivable; payment: ReceivablePayment } | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Add Manual Receivable Form
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    totalAmount: 0,
    downPayment: 0,
    dueDateDays: 30,
    notes: '',
  });

  // Edit Receivable Form
  const [editFormData, setEditFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    totalAmount: 0,
    transactionDate: '',
    dueDate: '',
    notes: '',
  });

  // Partial Payment Form
  const [payFormData, setPayFormData] = useState({
    amount: 0,
    paymentMethod: 'TUNAI' as 'TUNAI' | 'TRANSFER' | 'QRIS' | 'DEBIT',
    referenceNo: '',
    notes: '',
  });

  // RBAC Permission checks for Receivables
  const canCreateReceivable = (): boolean => {
    return Boolean(activeUser);
  };

  const canPayReceivable = (_rec: Receivable): boolean => {
    return Boolean(activeUser);
  };

  const canEditReceivable = (rec: Receivable): boolean => {
    if (!activeUser) return false;
    if (activeUser.role === 'OWNER' || activeUser.role === 'ADMIN') return true;
    if (activeUser.role === 'MANAGER') return true;
    if (activeUser.role === 'CASHIER') {
      // Cashier can only edit notes on unpaid records created today
      const isToday = new Date(rec.createdAt).toDateString() === new Date().toDateString();
      return isToday && rec.remainingBalance > 0;
    }
    return false;
  };

  const canDeleteReceivable = (rec: Receivable): boolean => {
    if (!activeUser) return false;
    if (activeUser.role === 'OWNER' || activeUser.role === 'ADMIN') return true;
    if (activeUser.role === 'MANAGER') {
      // Manager can delete if no payments have been collected yet
      return rec.paidAmount === 0;
    }
    return false; // Cashier cannot delete
  };

  const canDeletePayment = (): boolean => {
    if (!activeUser) return false;
    return activeUser.role === 'OWNER' || activeUser.role === 'ADMIN';
  };

  const canBulkDelete = (): boolean => {
    return activeUser?.role === 'OWNER';
  };

  const loadData = async () => {
    const [recList, custList] = await Promise.all([
      db.receivables.reverse().sortBy('transactionDate'),
      db.customers.toArray(),
    ]);
    setReceivables(recList);
    setCustomers(custList);
    if (custList.length > 0 && !formData.customerId) {
      setFormData((prev) => ({
        ...prev,
        customerId: custList[0].id,
        customerName: custList[0].name,
        customerPhone: custList[0].phone || '',
      }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary KPIs Calculation
  const stats = useMemo(() => {
    const now = new Date().toISOString();
    let totalOutstanding = 0;
    let totalCollected = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    receivables.forEach((r) => {
      totalOutstanding += r.remainingBalance;
      totalCollected += r.paidAmount;
      if (r.remainingBalance > 0 && r.dueDate < now) {
        overdueCount++;
        overdueAmount += r.remainingBalance;
      }
    });

    return {
      totalOutstanding,
      totalCollected,
      overdueCount,
      overdueAmount,
      totalCount: receivables.length,
      unpaidCount: receivables.filter((r) => r.remainingBalance > 0).length,
    };
  }, [receivables]);

  // Status Counts for Filter Tabs
  const statusCounts = useMemo(() => {
    const now = new Date().toISOString();
    let belumLunas = 0;
    let sebagian = 0;
    let lunas = 0;
    let overdue = 0;

    receivables.forEach((r) => {
      if (r.status === 'BELUM_LUNAS') belumLunas++;
      if (r.status === 'SEBAGIAN') sebagian++;
      if (r.status === 'LUNAS') lunas++;
      if (r.remainingBalance > 0 && r.dueDate < now) overdue++;
    });

    return {
      all: receivables.length,
      belumLunas,
      sebagian,
      lunas,
      overdue,
    };
  }, [receivables]);

  // Customer Balances Summary (Group by Customer)
  const customerBalances = useMemo(() => {
    const map = new Map<
      string,
      {
        customerId: string;
        name: string;
        phone?: string;
        totalDebt: number;
        remaining: number;
        invoiceCount: number;
        overdueCount: number;
      }
    >();
    const now = new Date().toISOString();

    receivables.forEach((r) => {
      const existing = map.get(r.customerId) || {
        customerId: r.customerId,
        name: r.customerName,
        phone: r.customerPhone,
        totalDebt: 0,
        remaining: 0,
        invoiceCount: 0,
        overdueCount: 0,
      };

      existing.totalDebt += r.totalAmount;
      existing.remaining += r.remainingBalance;
      existing.invoiceCount += 1;
      if (r.remainingBalance > 0 && r.dueDate < now) {
        existing.overdueCount += 1;
      }

      map.set(r.customerId, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.remaining - a.remaining);
  }, [receivables]);

  // Filtered Receivables
  const filteredReceivables = useMemo(() => {
    const now = new Date().toISOString();
    return receivables.filter((r) => {
      // Customer filter
      if (selectedCustomerId !== 'ALL' && r.customerId !== selectedCustomerId) {
        return false;
      }

      // Status filter
      if (statusFilter === 'OVERDUE') {
        if (!(r.remainingBalance > 0 && r.dueDate < now)) return false;
      } else if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }

      // Search filter
      const q = search.toLowerCase();
      return (
        r.receivableNo.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.customerPhone && r.customerPhone.includes(q)) ||
        (r.receiptNo && r.receiptNo.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    });
  }, [receivables, selectedCustomerId, statusFilter, search]);

  // Open Create Manual Receivable Modal
  const openAddModal = () => {
    const firstCust = customers[0];
    setFormData({
      customerId: firstCust?.id || '',
      customerName: firstCust?.name || '',
      customerPhone: firstCust?.phone || '',
      totalAmount: 0,
      downPayment: 0,
      dueDateDays: 30,
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Receivable Modal
  const openEditModal = (rec: Receivable) => {
    if (!canEditReceivable(rec)) {
      showToast(
        `Akses ditolak: Role ${activeUser?.role} tidak memiliki hak untuk mengubah data piutang ini.`,
        'error'
      );
      return;
    }
    setEditingReceivable(rec);
    setEditFormData({
      customerId: rec.customerId || '',
      customerName: rec.customerName,
      customerPhone: rec.customerPhone || '',
      totalAmount: rec.totalAmount,
      transactionDate: rec.transactionDate.slice(0, 10),
      dueDate: rec.dueDate.slice(0, 10),
      notes: rec.notes || '',
    });
    setIsEditModalOpen(true);
  };

  // Save New Manual Receivable
  const handleSaveReceivable = async () => {
    if (formData.totalAmount <= 0) {
      showToast('Nominal piutang harus lebih besar dari Rp 0', 'error');
      return;
    }

    if (!formData.customerName.trim()) {
      showToast('Nama pelanggan wajib diisi', 'error');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = (await db.receivables.count()) + 1;
    const recId = `REC-${dateStr}-${count.toString().padStart(4, '0')}`;
    const dueDate = new Date(Date.now() + formData.dueDateDays * 24 * 60 * 60 * 1000).toISOString();

    const downPayment = Math.min(formData.totalAmount, Math.max(0, formData.downPayment));
    const remaining = formData.totalAmount - downPayment;

    const initialPayments: ReceivablePayment[] = [];
    if (downPayment > 0) {
      initialPayments.push({
        id: `PAY-REC-${Date.now()}`,
        receivableId: recId,
        amount: downPayment,
        paymentMethod: 'TUNAI',
        paymentDate: now.toISOString(),
        referenceNo: 'DP Awal',
        receivedBy: activeUser?.name || 'Kasir',
        notes: 'Uang Muka (DP)',
      });
    }

    const newRec: Receivable = {
      id: recId,
      receivableNo: recId,
      customerId: formData.customerId || `CUST-NON-${Date.now()}`,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      transactionDate: now.toISOString(),
      dueDate,
      totalAmount: formData.totalAmount,
      paidAmount: downPayment,
      remainingBalance: remaining,
      status: remaining <= 0 ? 'LUNAS' : downPayment > 0 ? 'SEBAGIAN' : 'BELUM_LUNAS',
      notes: formData.notes || 'Pencatatan kasbon piutang manual',
      payments: initialPayments,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await db.receivables.add(newRec);

    // If customer didn't exist, create customer
    if (!formData.customerId && formData.customerName) {
      await db.customers.put({
        id: newRec.customerId,
        name: formData.customerName,
        phone: formData.customerPhone,
        tier: 'BRONZE',
        pointsBalance: 0,
        totalSpend: formData.totalAmount,
        totalVisits: 1,
        createdAt: now.toISOString(),
        notes: 'Dibuat otomatis dari pencatatan piutang manual',
      });
    }

    // Audit log
    await db.auditLogs.add({
      id: `AUD-${Date.now()}`,
      timestamp: now.toISOString(),
      userId: activeUser?.id || 'UNKNOWN',
      userName: activeUser?.name || 'Kasir',
      action: 'CREATE_RECEIVABLE',
      category: 'PIUTANG',
      details: `Catat Piutang ${recId} untuk ${formData.customerName}: Rp ${formData.totalAmount.toLocaleString('id-ID')} (DP: Rp ${downPayment.toLocaleString('id-ID')})`,
    });

    showToast(`Piutang ${recId} untuk ${formData.customerName} berhasil dicatat!`, 'success');
    setIsAddModalOpen(false);
    loadData();
  };

  // Save Edit Receivable
  const handleSaveEditReceivable = async () => {
    if (!editingReceivable) return;

    if (editFormData.totalAmount <= 0) {
      showToast('Nominal piutang harus lebih besar dari Rp 0', 'error');
      return;
    }

    if (editFormData.totalAmount < editingReceivable.paidAmount) {
      showToast(
        `Total piutang (Rp ${editFormData.totalAmount.toLocaleString('id-ID')}) tidak boleh lebih kecil dari jumlah yang sudah dibayar (Rp ${editingReceivable.paidAmount.toLocaleString('id-ID')})`,
        'error'
      );
      return;
    }

    if (!editFormData.customerName.trim()) {
      showToast('Nama pelanggan wajib diisi', 'error');
      return;
    }

    const now = new Date().toISOString();
    const newTotal = Number(editFormData.totalAmount);
    const newRemaining = Math.max(0, newTotal - editingReceivable.paidAmount);
    const newStatus: ReceivableStatus =
      newRemaining <= 0 ? 'LUNAS' : editingReceivable.paidAmount > 0 ? 'SEBAGIAN' : 'BELUM_LUNAS';

    const updatedTxDate = editFormData.transactionDate
      ? new Date(editFormData.transactionDate).toISOString()
      : editingReceivable.transactionDate;
    const updatedDueDate = editFormData.dueDate
      ? new Date(editFormData.dueDate).toISOString()
      : editingReceivable.dueDate;

    await db.receivables.update(editingReceivable.id, {
      customerId: editFormData.customerId || editingReceivable.customerId,
      customerName: editFormData.customerName.trim(),
      customerPhone: editFormData.customerPhone.trim() || undefined,
      totalAmount: newTotal,
      remainingBalance: newRemaining,
      status: newStatus,
      transactionDate: updatedTxDate,
      dueDate: updatedDueDate,
      notes: editFormData.notes.trim() || undefined,
      updatedAt: now,
    });

    await db.auditLogs.add({
      id: `AUD-${Date.now()}`,
      timestamp: now,
      userId: activeUser?.id || 'UNKNOWN',
      userName: activeUser?.name || 'Kasir',
      action: 'UPDATE_RECEIVABLE',
      category: 'PIUTANG',
      details: `Ubah data piutang ${editingReceivable.receivableNo} (${editFormData.customerName}): Total Rp ${editingReceivable.totalAmount.toLocaleString('id-ID')} -> Rp ${newTotal.toLocaleString('id-ID')}`,
    });

    showToast(`Data piutang ${editingReceivable.receivableNo} berhasil diperbarui!`, 'success');
    setIsEditModalOpen(false);
    setEditingReceivable(null);
    loadData();
  };

  // Delete Receivable
  const handleDeleteReceivable = async () => {
    if (!receivableToDelete) return;

    if (!canDeleteReceivable(receivableToDelete)) {
      showToast(
        `Akses ditolak: Role ${activeUser?.role} tidak memiliki hak akses menghapus piutang ini.`,
        'error'
      );
      setReceivableToDelete(null);
      return;
    }

    const rec = receivableToDelete;
    const now = new Date().toISOString();

    try {
      await db.receivables.delete(rec.id);

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser?.id || 'UNKNOWN',
        userName: activeUser?.name || 'Kasir',
        action: 'DELETE_RECEIVABLE',
        category: 'PIUTANG',
        details: `Hapus catatan piutang ${rec.receivableNo} (${rec.customerName}) sebesar Rp ${rec.totalAmount.toLocaleString('id-ID')} (Sisa: Rp ${rec.remainingBalance.toLocaleString('id-ID')})`,
      });

      showToast(`Data piutang ${rec.receivableNo} berhasil dihapus`, 'success');
      setReceivableToDelete(null);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus piutang: ' + err.message, 'error');
    }
  };

  // Delete Single Payment Log
  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;

    if (!canDeletePayment()) {
      showToast('Akses ditolak: Hanya OWNER & ADMIN yang dapat menghapus rincian angsuran.', 'error');
      setPaymentToDelete(null);
      return;
    }

    const { receivable: targetRec, payment: targetPayment } = paymentToDelete;
    const now = new Date().toISOString();

    try {
      const updatedPayments = targetRec.payments.filter((p) => p.id !== targetPayment.id);
      const newPaidAmount = Math.max(0, targetRec.paidAmount - targetPayment.amount);
      const newRemaining = Math.max(0, targetRec.totalAmount - newPaidAmount);
      const newStatus: ReceivableStatus =
        newRemaining <= 0 ? 'LUNAS' : newPaidAmount > 0 ? 'SEBAGIAN' : 'BELUM_LUNAS';

      await db.receivables.update(targetRec.id, {
        paidAmount: newPaidAmount,
        remainingBalance: newRemaining,
        status: newStatus,
        payments: updatedPayments,
        updatedAt: now,
      });

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser?.id || 'UNKNOWN',
        userName: activeUser?.name || 'Kasir',
        action: 'DELETE_RECEIVABLE_PAYMENT',
        category: 'PIUTANG',
        details: `Hapus angsuran Rp ${targetPayment.amount.toLocaleString('id-ID')} (${targetPayment.paymentMethod}) dari piutang ${targetRec.receivableNo}`,
      });

      showToast(`Angsuran Rp ${targetPayment.amount.toLocaleString('id-ID')} berhasil dihapus`, 'success');

      if (selectedReceivable && selectedReceivable.id === targetRec.id) {
        setSelectedReceivable({
          ...targetRec,
          paidAmount: newPaidAmount,
          remainingBalance: newRemaining,
          status: newStatus,
          payments: updatedPayments,
        });
      }

      setPaymentToDelete(null);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus angsuran: ' + err.message, 'error');
    }
  };

  // Bulk Delete Filtered Receivables (OWNER only)
  const handleBulkDeleteFiltered = async () => {
    if (!canBulkDelete()) {
      showToast('Akses ditolak: Hanya OWNER yang dapat menghapus massal data piutang.', 'error');
      setIsBulkDeleteModalOpen(false);
      return;
    }

    const ids = filteredReceivables.map((r) => r.id);
    if (ids.length === 0) return;

    try {
      await db.receivables.bulkDelete(ids);

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser?.id || 'UNKNOWN',
        userName: activeUser?.name || 'Kasir',
        action: 'BULK_DELETE_RECEIVABLES',
        category: 'PIUTANG',
        details: `Menghapus massal ${ids.length} data piutang terfilter`,
      });

      showToast(`${ids.length} data piutang berhasil dibersihkan`, 'success');
      setIsBulkDeleteModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus data piutang: ' + err.message, 'error');
    }
  };

  // Open Log Partial Payment Modal
  const openPayModal = (rec: Receivable) => {
    setSelectedReceivable(rec);
    setPayFormData({
      amount: rec.remainingBalance,
      paymentMethod: 'TUNAI',
      referenceNo: '',
      notes: '',
    });
    setIsPayModalOpen(true);
  };

  // Save Partial Payment
  const handleSavePayment = async () => {
    if (!selectedReceivable) return;

    const payAmount = Number(payFormData.amount);
    if (payAmount <= 0) {
      showToast('Nominal angsuran pembayaran harus lebih besar dari Rp 0', 'error');
      return;
    }

    if (payAmount > selectedReceivable.remainingBalance) {
      showToast(
        `Nominal pembayaran melebihi sisa piutang (Maksimal: Rp ${selectedReceivable.remainingBalance.toLocaleString('id-ID')})`,
        'error'
      );
      return;
    }

    const now = new Date().toISOString();
    const newPayment: ReceivablePayment = {
      id: `PAY-REC-${Date.now()}`,
      receivableId: selectedReceivable.id,
      amount: payAmount,
      paymentMethod: payFormData.paymentMethod,
      paymentDate: now,
      referenceNo: payFormData.referenceNo || undefined,
      receivedBy: activeUser?.name || 'Kasir',
      notes: payFormData.notes || undefined,
    };

    const updatedPayments = [...selectedReceivable.payments, newPayment];
    const newPaidAmount = selectedReceivable.paidAmount + payAmount;
    const newRemaining = Math.max(0, selectedReceivable.totalAmount - newPaidAmount);
    const newStatus: ReceivableStatus = newRemaining <= 0 ? 'LUNAS' : 'SEBAGIAN';

    // Update in IndexedDB
    await db.receivables.update(selectedReceivable.id, {
      paidAmount: newPaidAmount,
      remainingBalance: newRemaining,
      status: newStatus,
      payments: updatedPayments,
      updatedAt: now,
    });

    // Also update Shift cash if paid cash
    const activeShift = await db.shifts.where('status').equals('OPEN').first();
    if (activeShift && payFormData.paymentMethod === 'TUNAI') {
      await db.shifts.update(activeShift.id, {
        totalSalesCash: activeShift.totalSalesCash + payAmount,
        expectedEndingCash: activeShift.expectedEndingCash + payAmount,
      });
    }

    // Audit log
    await db.auditLogs.add({
      id: `AUD-${Date.now()}`,
      timestamp: now,
      userId: activeUser?.id || 'UNKNOWN',
      userName: activeUser?.name || 'Kasir',
      action: 'PAY_RECEIVABLE',
      category: 'PIUTANG',
      details: `Pelunasan piutang ${selectedReceivable.receivableNo} (${selectedReceivable.customerName}) sebesar Rp ${payAmount.toLocaleString('id-ID')} via ${payFormData.paymentMethod}. Sisa: Rp ${newRemaining.toLocaleString('id-ID')}`,
    });

    showToast(
      `Pembayaran Rp ${payAmount.toLocaleString('id-ID')} berhasil dicatat! Status: ${newStatus}`,
      'success'
    );

    setIsPayModalOpen(false);
    setSelectedReceivable(null);
    loadData();
  };

  // Export Receivables to CSV
  const handleExportCSV = () => {
    const headers = [
      'No. Piutang',
      'No. Struk POS',
      'Pelanggan',
      'No. Telepon',
      'Tanggal Transaksi',
      'Jatuh Tempo',
      'Total Piutang (Rp)',
      'Sudah Dibayar (Rp)',
      'Sisa Saldo (Rp)',
      'Status',
      'Jumlah Angsuran',
      'Catatan',
    ];

    const rows = filteredReceivables.map((r) => [
      r.receivableNo,
      r.receiptNo || '-',
      r.customerName,
      r.customerPhone || '-',
      new Date(r.transactionDate).toLocaleDateString('id-ID'),
      new Date(r.dueDate).toLocaleDateString('id-ID'),
      r.totalAmount,
      r.paidAmount,
      r.remainingBalance,
      r.status,
      r.payments.length,
      r.notes || '-',
    ]);

    downloadCsv(`Laporan_Piutang_Pelanggan_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showToast('Laporan piutang berhasil diekspor ke format CSV', 'success');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Manajemen Piutang & Kasbon Pelanggan</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              Accounts Receivable
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau tagihan kredit, catat angsuran pembayaran parsial, edit faktur, dan kontrol hak akses sesuai RBAC
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs cursor-pointer min-h-[38px] transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer min-h-[38px] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Piutang Manual</span>
          </button>
        </div>
      </div>

      {/* RBAC Role Transparency Banner */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Hak Akses Modul Piutang:</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                {activeUser?.role || 'GUEST'}
              </span>
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5">
              {activeUser?.role === 'OWNER' &&
                'Hak Akses Penuh: Berhak mencatat, mengedit nilai/jatuh tempo, menerima angsuran, menghapus piutang & riwayat angsuran.'}
              {activeUser?.role === 'ADMIN' &&
                'Hak Akses Administrator: Berhak mencatat, mengedit data, menerima pembayaran, dan menghapus catatan piutang.'}
              {activeUser?.role === 'MANAGER' &&
                'Hak Akses Manajer: Berhak mencatat, mengedit catatan & tanggal tempo, menerima angsuran, serta menghapus piutang yang belum pernah dicicil.'}
              {activeUser?.role === 'CASHIER' &&
                'Hak Akses Kasir: Berhak mencatat piutang baru & memproses angsuran kasir. Penghapusan dan perubahan data dibatasi.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {canBulkDelete() && filteredReceivables.length > 0 && (
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold shadow-2xs cursor-pointer transition-colors"
              title="Hapus massal piutang yang sedang tampil pada filter (Khusus OWNER)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Massal Terfilter ({filteredReceivables.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Outstanding */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Total Sisa Piutang
            </span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-900 font-mono mt-2 tabular-nums">
            Rp {stats.totalOutstanding.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Dari {stats.unpaidCount} tagihan aktif</p>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Total Telah Ditagih
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-2 tabular-nums">
            Rp {stats.totalCollected.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Terkumpul dari DP &amp; angsuran</p>
        </div>

        {/* Overdue Alert */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Jatuh Tempo (Kritis)
            </span>
            <div
              className={`p-2 rounded-xl ${
                stats.overdueCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-xl sm:text-2xl font-black font-mono mt-2 tabular-nums ${
              stats.overdueCount > 0 ? 'text-rose-700' : 'text-slate-800'
            }`}
          >
            Rp {stats.overdueAmount.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.overdueCount} faktur lewat jatuh tempo
          </p>
        </div>

        {/* Total Pelanggan Berpiutang */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Pelanggan Kasbon
            </span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-2 tabular-nums">
            {customerBalances.filter((c) => c.remaining > 0).length} Orang
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Dari total {customerBalances.length} debitur tercatat
          </p>
        </div>
      </div>

      {/* 3. Customer Outstanding Balances Widget */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Rekapitulasi Saldo Piutang Tiap Pelanggan
            </h3>
          </div>
          {selectedCustomerId !== 'ALL' && (
            <button
              onClick={() => setSelectedCustomerId('ALL')}
              className="text-xs text-emerald-700 hover:underline font-semibold cursor-pointer"
            >
              Tampilkan Semua Pelanggan
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {customerBalances.map((cust) => {
            const isSelected = selectedCustomerId === cust.customerId;
            const hasOverdue = cust.overdueCount > 0;

            return (
              <div
                key={cust.customerId}
                onClick={() => setSelectedCustomerId(isSelected ? 'ALL' : cust.customerId)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="font-bold text-xs text-slate-900 truncate">{cust.name}</div>
                  {hasOverdue && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 shrink-0">
                      Lewat Tempo
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 mt-0.5">
                  {cust.phone || 'Tanpa No. HP'} &bull; {cust.invoiceCount} Transaksi
                </div>

                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-baseline justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">
                    Sisa Saldo:
                  </span>
                  <span
                    className={`font-mono font-bold text-xs tabular-nums ${
                      cust.remaining > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    Rp {cust.remaining.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Filters & Search Bar with Dynamic Status Counter Badges */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-2xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari faktur piutang, nama pelanggan, struk..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Status Filter Buttons with Count Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'Semua Status', count: statusCounts.all, color: 'bg-slate-200 text-slate-700' },
            {
              id: 'BELUM_LUNAS',
              label: 'Belum Lunas',
              count: statusCounts.belumLunas,
              color: 'bg-amber-100 text-amber-800',
            },
            {
              id: 'SEBAGIAN',
              label: 'Dicicil',
              count: statusCounts.sebagian,
              color: 'bg-blue-100 text-blue-800',
            },
            {
              id: 'LUNAS',
              label: 'Lunas',
              count: statusCounts.lunas,
              color: 'bg-emerald-100 text-emerald-800',
            },
            {
              id: 'OVERDUE',
              label: 'Lewat Tempo',
              count: statusCounts.overdue,
              color: 'bg-rose-100 text-rose-800',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  statusFilter === tab.id ? 'bg-white/20 text-white' : tab.color
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Main Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">No. Piutang / Struk</th>
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4">Tanggal &amp; Jatuh Tempo</th>
                <th className="py-3 px-4 text-right">Total Piutang</th>
                <th className="py-3 px-4 text-right">Sudah Dibayar</th>
                <th className="py-3 px-4 text-right">Sisa Saldo</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center min-w-[200px]">Menu Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto opacity-40 mb-2" />
                    <p className="font-semibold text-slate-600">Tidak ada data piutang ditemukan</p>
                    <p className="text-[11px] mt-0.5">
                      Catat piutang baru atau ubah kriteria filter status Anda.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReceivables.map((rec) => {
                  const now = new Date().toISOString();
                  const isOverdue = rec.remainingBalance > 0 && rec.dueDate < now;
                  const editable = canEditReceivable(rec);
                  const deletable = canDeleteReceivable(rec);

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Invoice No */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{rec.receivableNo}</div>
                        {rec.receiptNo && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Struk: {rec.receiptNo}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{rec.customerName}</div>
                        {rec.customerPhone && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{rec.customerPhone}</span>
                          </div>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="py-3 px-4 text-slate-600">
                        <div>{new Date(rec.transactionDate).toLocaleDateString('id-ID')}</div>
                        <div
                          className={`text-[10px] font-semibold flex items-center gap-1 ${
                            isOverdue ? 'text-rose-600 font-bold' : 'text-slate-400'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>Tempo: {new Date(rec.dueDate).toLocaleDateString('id-ID')}</span>
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-medium text-slate-700 font-mono tabular-nums">
                        Rp {rec.totalAmount.toLocaleString('id-ID')}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700 font-mono tabular-nums">
                        Rp {rec.paidAmount.toLocaleString('id-ID')}
                      </td>

                      {/* Remaining Balance */}
                      <td className="py-3 px-4 text-right font-black font-mono tabular-nums text-slate-900">
                        <span className={rec.remainingBalance > 0 ? 'text-amber-800' : 'text-slate-400'}>
                          Rp {rec.remainingBalance.toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'LUNAS'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isOverdue
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : rec.status === 'SEBAGIAN'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {rec.status === 'LUNAS'
                            ? 'Lunas'
                            : isOverdue
                            ? 'Lewat Tempo'
                            : rec.status === 'SEBAGIAN'
                            ? 'Dicicil'
                            : 'Belum Lunas'}
                        </span>
                      </td>

                      {/* Actions Menu Column */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Pay Button (if unpaid) */}
                          {rec.remainingBalance > 0 && canPayReceivable(rec) && (
                            <button
                              onClick={() => openPayModal(rec)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                              title="Bayar Cicilan / Angsuran"
                            >
                              Bayar
                            </button>
                          )}

                          {/* Detail / Payment History Button */}
                          <button
                            onClick={() => {
                              setSelectedReceivable(rec);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Rincian Riwayat Pembayaran & Pembatalan Angsuran"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          {editable ? (
                            <button
                              onClick={() => openEditModal(rec)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
                              title="Ubah Data Piutang & Jatuh Tempo (Edit)"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span
                              title="Akses ditolak: Anda tidak memiliki hak mengedit piutang ini"
                              className="p-1.5 text-slate-300 cursor-not-allowed inline-block"
                            >
                              <Lock className="w-3.5 h-3.5 opacity-40" />
                            </span>
                          )}

                          {/* Delete Button */}
                          {deletable ? (
                            <button
                              onClick={() => setReceivableToDelete(rec)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-400 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Hapus Piutang (Delete)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span
                              title={
                                activeUser?.role === 'CASHIER'
                                  ? 'Role Kasir tidak memiliki akses menghapus piutang'
                                  : 'Piutang yang sudah ada pembayaran cicilan dilindungi dari penghapusan'
                              }
                              className="p-1.5 text-slate-300 cursor-not-allowed inline-block"
                            >
                              <Lock className="w-3.5 h-3.5 opacity-40" />
                            </span>
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
            Menampilkan <span className="font-bold text-slate-700">{filteredReceivables.length}</span>{' '}
            dari <span className="font-bold text-slate-700">{receivables.length}</span> faktur piutang
          </div>
          <div className="font-semibold text-slate-800">
            Total Sisa Tagihan Terfilter:{' '}
            <span className="font-black text-amber-800 font-mono text-sm ml-1">
              Rp{' '}
              {filteredReceivables
                .reduce((s, r) => s + r.remainingBalance, 0)
                .toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Modal: Catat Piutang Manual */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Catat Piutang / Kasbon Pelanggan</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 overflow-y-auto">
              {/* Customer Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Pelanggan / Member:</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => {
                    const cust = customers.find((c) => c.id === e.target.value);
                    if (cust) {
                      setFormData({
                        ...formData,
                        customerId: cust.id,
                        customerName: cust.name,
                        customerPhone: cust.phone || '',
                      });
                    } else {
                      setFormData({ ...formData, customerId: '', customerName: '', customerPhone: '' });
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pelanggan Bebas (Ketik Manual) --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'Tanpa HP'}) - Tier {c.tier}
                    </option>
                  ))}
                </select>
              </div>

              {!formData.customerId && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Pelanggan:</label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="Contoh: Bpk. Joko"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">No. WhatsApp / HP:</label>
                    <input
                      type="text"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      placeholder="0812-xxxx-xxxx"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {/* Total Piutang & DP */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Piutang (Rp):</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.totalAmount || ''}
                    onChange={(e) => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-amber-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Uang Muka / DP (Rp):</label>
                  <input
                    type="number"
                    min="0"
                    max={formData.totalAmount}
                    value={formData.downPayment || ''}
                    onChange={(e) => setFormData({ ...formData, downPayment: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
              </div>

              {/* Due Date & Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Jangka Waktu Jatuh Tempo:</label>
                <select
                  value={formData.dueDateDays}
                  onChange={(e) => setFormData({ ...formData, dueDateDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                >
                  <option value={7}>7 Hari (1 Minggu)</option>
                  <option value={14}>14 Hari (2 Minggu)</option>
                  <option value={30}>30 Hari (1 Bulan)</option>
                  <option value={45}>45 Hari</option>
                  <option value={60}>60 Hari (2 Bulan)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Catatan / Peruntukan Barang:</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Contoh: Belanja beras 2 karung untuk syukuran"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl resize-none"
                />
              </div>

              {/* Summary Balance */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center">
                <span className="font-semibold text-amber-900">Sisa Saldo Yang Ditagih:</span>
                <span className="font-black text-amber-900 font-mono text-sm tabular-nums">
                  Rp {Math.max(0, formData.totalAmount - formData.downPayment).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveReceivable}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                Simpan Catatan Piutang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Ubah / Edit Data Piutang */}
      {isEditModalOpen && editingReceivable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Ubah Data Piutang: {editingReceivable.receivableNo}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Koreksi nominal, tanggal jatuh tempo, atau nama pelanggan
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingReceivable(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 overflow-y-auto">
              {/* Customer Name & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Pelanggan:</label>
                  <input
                    type="text"
                    value={editFormData.customerName}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">No. WhatsApp / HP:</label>
                  <input
                    type="text"
                    value={editFormData.customerPhone}
                    onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Total Piutang */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Total Nilai Piutang (Rp):</label>
                <input
                  type="number"
                  min={editingReceivable.paidAmount}
                  value={editFormData.totalAmount || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, totalAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-amber-800 text-base"
                />
                {editingReceivable.paidAmount > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    * Minimal Rp {editingReceivable.paidAmount.toLocaleString('id-ID')} (sudah ada cicilan masuk)
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Transaksi:</label>
                  <input
                    type="date"
                    value={editFormData.transactionDate}
                    onChange={(e) => setEditFormData({ ...editFormData, transactionDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Jatuh Tempo:</label>
                  <input
                    type="date"
                    value={editFormData.dueDate}
                    onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Catatan / Keterangan Kasbon:</label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl resize-none"
                />
              </div>

              {/* Recalculated Balance Preview */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Sudah Dibayar Sebelumnya:</span>
                  <span className="font-semibold text-emerald-700">
                    Rp {editingReceivable.paidAmount.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
                  <span>Sisa Saldo Baru:</span>
                  <span className="font-mono font-black text-amber-800 text-sm">
                    Rp{' '}
                    {Math.max(
                      0,
                      editFormData.totalAmount - editingReceivable.paidAmount
                    ).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingReceivable(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditReceivable}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Bayar Cicilan / Angsuran Parsial */}
      {isPayModalOpen && selectedReceivable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Catat Pembayaran Angsuran</h3>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 overflow-y-auto">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pelanggan:</span>
                  <span className="font-bold text-slate-900">{selectedReceivable.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Piutang:</span>
                  <span className="font-mono text-slate-700">{selectedReceivable.receivableNo}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-700 font-bold">Sisa Saldo Saat Ini:</span>
                  <span className="font-mono font-black text-amber-800 text-sm">
                    Rp {selectedReceivable.remainingBalance.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nominal Pembayaran / Angsuran (Rp):
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedReceivable.remainingBalance}
                  value={payFormData.amount || ''}
                  onChange={(e) => setPayFormData({ ...payFormData, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-700 text-base"
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPayFormData({ ...payFormData, amount: selectedReceivable.remainingBalance })}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 text-[10px] font-semibold cursor-pointer"
                  >
                    Lunasi Penuh (Rp {selectedReceivable.remainingBalance.toLocaleString('id-ID')})
                  </button>
                  {selectedReceivable.remainingBalance > 100000 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPayFormData({
                          ...payFormData,
                          amount: Math.floor(selectedReceivable.remainingBalance / 2),
                        })
                      }
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold cursor-pointer"
                    >
                      50% (Rp {Math.floor(selectedReceivable.remainingBalance / 2).toLocaleString('id-ID')})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Metode Pembayaran:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['TUNAI', 'TRANSFER', 'QRIS', 'DEBIT'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayFormData({ ...payFormData, paymentMethod: m })}
                      className={`p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                        payFormData.paymentMethod === m
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nomor Referensi / No. Bukti Transfer (Opsional):
                </label>
                <input
                  type="text"
                  value={payFormData.referenceNo}
                  onChange={(e) => setPayFormData({ ...payFormData, referenceNo: e.target.value })}
                  placeholder="Contoh: TRF-BCA-12345"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Catatan Pembayaran:</label>
                <input
                  type="text"
                  value={payFormData.notes}
                  onChange={(e) => setPayFormData({ ...payFormData, notes: e.target.value })}
                  placeholder="Contoh: Angsuran minggu ke-2"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                <span className="font-semibold text-emerald-900">Sisa Saldo Setelah Bayar:</span>
                <span className="font-black text-emerald-900 font-mono text-sm tabular-nums">
                  Rp{' '}
                  {Math.max(
                    0,
                    selectedReceivable.remainingBalance - (payFormData.amount || 0)
                  ).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSavePayment}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                Konfirmasi Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: Rincian Riwayat Pembayaran Piutang & Pembatalan Angsuran */}
      {isDetailModalOpen && selectedReceivable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Riwayat Pembayaran {selectedReceivable.receivableNo}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pelanggan: {selectedReceivable.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs flex-1 overflow-y-auto">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold block">Total Piutang</span>
                  <span className="font-black text-slate-900 font-mono mt-0.5 block tabular-nums">
                    Rp {selectedReceivable.totalAmount.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 font-semibold block">Sudah Dibayar</span>
                  <span className="font-black text-emerald-800 font-mono mt-0.5 block tabular-nums">
                    Rp {selectedReceivable.paidAmount.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] text-amber-600 font-semibold block">Sisa Tagihan</span>
                  <span className="font-black text-amber-900 font-mono mt-0.5 block tabular-nums">
                    Rp {selectedReceivable.remainingBalance.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Payment Logs List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800">Daftar Transaksi Angsuran</h4>
                  <span className="text-[11px] text-slate-500">
                    {selectedReceivable.payments.length} Pembayaran
                  </span>
                </div>

                {selectedReceivable.payments.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    Belum ada pembayaran cicilan yang dicatat.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedReceivable.payments.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 font-mono text-sm">
                            Rp {p.amount.toLocaleString('id-ID')}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(p.paymentDate).toLocaleString('id-ID')} &bull; Met: {p.paymentMethod}{' '}
                            &bull; Kasir: {p.receivedBy}
                          </div>
                          {p.notes && <div className="text-[10px] text-slate-600 italic mt-0.5">{p.notes}</div>}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {p.referenceNo && (
                            <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                              {p.referenceNo}
                            </span>
                          )}

                          {canDeletePayment() && (
                            <button
                              onClick={() =>
                                setPaymentToDelete({
                                  receivable: selectedReceivable,
                                  payment: p,
                                })
                              }
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Batalkan / Hapus Transaksi Angsuran Ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: DELETE RECEIVABLE */}
      <ConfirmModal
        isOpen={!!receivableToDelete}
        title="Hapus Catatan Piutang"
        message={`Apakah Anda yakin ingin menghapus data piutang "${receivableToDelete?.receivableNo}" atas nama "${receivableToDelete?.customerName}" sebesar Rp ${(receivableToDelete?.totalAmount || 0).toLocaleString('id-ID')}? Tindakan ini akan dicatat ke dalam audit log.`}
        confirmText="Hapus Piutang"
        isDestructive={true}
        onConfirm={handleDeleteReceivable}
        onClose={() => setReceivableToDelete(null)}
      />

      {/* CONFIRM MODAL: DELETE PAYMENT ANGSURAN */}
      <ConfirmModal
        isOpen={!!paymentToDelete}
        title="Batalkan Angsuran Pembayaran"
        message={`Apakah Anda yakin ingin membatalkan dan menghapus angsuran sebesar Rp ${(paymentToDelete?.payment.amount || 0).toLocaleString('id-ID')} (${paymentToDelete?.payment.paymentMethod})? Sisa tagihan piutang akan bertambah kembali secara otomatis.`}
        confirmText="Hapus Angsuran"
        isDestructive={true}
        onConfirm={handleDeletePayment}
        onClose={() => setPaymentToDelete(null)}
      />

      {/* CONFIRM MODAL: BULK DELETE FILTERED (OWNER ONLY) */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        title="Hapus Massal Data Piutang Terfilter"
        message={`PERINGATAN KHUSUS OWNER: Anda akan menghapus permanen ${filteredReceivables.length} data piutang yang sedang tampil pada filter saat ini. Tindakan ini tidak dapat dikembalikan.`}
        confirmText={`Ya, Hapus ${filteredReceivables.length} Data`}
        isDestructive={true}
        onConfirm={handleBulkDeleteFiltered}
        onClose={() => setIsBulkDeleteModalOpen(false)}
      />
    </div>
  );
};

export default ReceivablesView;

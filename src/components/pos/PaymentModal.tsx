import React, { useState } from 'react';
import { CartItem, Customer, PaymentMethod, Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/indexedDB';
import { processSaleStockDeduction } from '../../services/inventoryEngine';
import { syncManager } from '../../services/syncManager';
import {
  Banknote,
  QrCode,
  CreditCard,
  Building,
  CheckCircle2,
  X,
  AlertCircle,
  Sparkles,
  Award,
  FileText,
  Calendar,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  subtotal: number;
  orderDiscount: number;
  taxAmount: number;
  taxRatePercent: number;
  grandTotal: number;
  selectedCustomer?: Customer | null;
  pointsToRedeem?: number;
  pointsDiscountAmount?: number;
  pointsToEarn?: number;
  customerName: string;
  orderNotes: string;
  onPaymentSuccess: (sale: Sale) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  subtotal,
  orderDiscount,
  taxAmount,
  taxRatePercent,
  grandTotal,
  selectedCustomer,
  pointsToRedeem = 0,
  pointsDiscountAmount = 0,
  pointsToEarn,
  customerName,
  orderNotes,
  onPaymentSuccess,
}) => {
  const { activeUser, activeShift, refreshShift, settings, showToast } = useApp();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('TUNAI');
  const [cashGivenInput, setCashGivenInput] = useState<string>(grandTotal.toString());
  const [downPaymentInput, setDownPaymentInput] = useState<string>('0'); // DP for Piutang
  const [dueDateDays, setDueDateDays] = useState<number>(30); // 30 days default
  const [referenceNo, setReferenceNo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');


  if (!isOpen) return null;

  const cashGiven =
    selectedMethod === 'TUNAI'
      ? parseInt(cashGivenInput.replace(/\D/g, '') || '0', 10)
      : grandTotal;

  const changeAmount = Math.max(0, cashGiven - grandTotal);
  const isInsufficient = selectedMethod === 'TUNAI' && cashGiven < grandTotal;

  const quickNominals = [
    { label: 'Uang Pas', value: grandTotal },
    { label: '10.000', value: 10000 },
    { label: '20.000', value: 20000 },
    { label: '50.000', value: 50000 },
    { label: '100.000', value: 10000 },
    { label: '100.000', value: 100000 },
    { label: '200.000', value: 200000 },
    { label: '500.000', value: 500000 },
  ].filter((n, idx, arr) => n.value >= grandTotal || n.label === 'Uang Pas');

  const handleCheckout = async () => {
    if (isInsufficient) {
      setErrorMsg('Nominal uang tunai kurang dari total belanja.');
      return;
    }

    if (selectedMethod === 'PIUTANG' && !selectedCustomer && !customerName.trim()) {
      setErrorMsg('Transaksi Piutang (Kredit) wajib memilih pelanggan member atau mengisi nama pelanggan.');
      return;
    }

    if (cartItems.length === 0) {
      setErrorMsg('Keranjang kosong.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg('');

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = (await db.sales.count()) + 1;
      const receiptNo = `POS-${dateStr}-${countToday.toString().padStart(4, '0')}`;
      const saleId = `SLS-${Date.now()}`;
      const idempotencyKey = `IDEMP-${saleId}`;

      // Deduct stock & compute HPP (FIFO or Average)
      const costingMethod = settings?.costingMethod || 'FIFO';
      const { saleDetails, totalHpp } = await processSaleStockDeduction(
        cartItems,
        saleId,
        activeUser.id,
        activeUser.name,
        costingMethod
      );

      // Customer Loyalty Points Calculation
      const pointsPerAmount = settings?.loyaltyPointsPerAmount || 10000;
      const pointsEarned = pointsToEarn ?? Math.floor(grandTotal / pointsPerAmount);
      let customerPointsBalanceAfter: number | undefined = undefined;

      if (selectedCustomer) {
        const currentBalance = selectedCustomer.pointsBalance || 0;
        const netChange = pointsEarned - (pointsToRedeem || 0);
        customerPointsBalanceAfter = Math.max(0, currentBalance + netChange);

        const updatedSpend = (selectedCustomer.totalSpend || 0) + grandTotal;
        const updatedVisits = (selectedCustomer.totalVisits || 0) + 1;

        // Auto tier progression based on lifetime spend
        let newTier = selectedCustomer.tier;
        if (updatedSpend >= 15000000) newTier = 'PLATINUM';
        else if (updatedSpend >= 5000000) newTier = 'GOLD';
        else if (updatedSpend >= 1000000) newTier = 'SILVER';

        // Update customer record
        await db.customers.update(selectedCustomer.id, {
          pointsBalance: customerPointsBalanceAfter,
          totalSpend: updatedSpend,
          totalVisits: updatedVisits,
          tier: newTier,
          updatedAt: now.toISOString(),
        });

        // Add Loyalty Log for REDEEM if points were used
        if (pointsToRedeem > 0) {
          await db.loyaltyLogs.add({
            id: `LOG-LOYAL-${Date.now()}-RED`,
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            saleId,
            type: 'REDEEM',
            points: -pointsToRedeem,
            amountSpent: grandTotal,
            balanceAfter: currentBalance - pointsToRedeem,
            timestamp: now.toISOString(),
            notes: `Tukar ${pointsToRedeem} poin (Diskon Rp ${pointsDiscountAmount.toLocaleString('id-ID')}) pada struk ${receiptNo}`,
            createdBy: activeUser.name,
          });
        }

        if (pointsEarned > 0) {
          await db.loyaltyLogs.add({
            id: `LOG-LOYAL-${Date.now()}-EARN`,
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            saleId,
            type: 'EARN',
            points: pointsEarned,
            amountSpent: grandTotal,
            balanceAfter: customerPointsBalanceAfter,
            timestamp: now.toISOString(),
            notes: `Poin dari transaksi ${receiptNo}`,
            createdBy: activeUser.name,
          });
        }
      }

      const parsedDownPayment = selectedMethod === 'PIUTANG'
        ? Math.min(grandTotal, parseInt(downPaymentInput.replace(/\D/g, '') || '0', 10))
        : grandTotal;

      const saleRecord: Sale = {
        id: saleId,
        receiptNo,
        timestamp: now.toISOString(),
        cashierId: activeUser.id,
        cashierName: activeUser.name,
        shiftId: activeShift?.id,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer ? selectedCustomer.name : (customerName || undefined),
        customerPhone: selectedCustomer?.phone,
        subtotal,
        orderDiscount,
        taxAmount,
        taxRatePercent,
        grandTotal,
        paidAmount: selectedMethod === 'TUNAI' ? cashGiven : parsedDownPayment,
        changeAmount: selectedMethod === 'TUNAI' ? changeAmount : 0,
        paymentMethod: selectedMethod,
        payments: [
          {
            id: `PAY-${Date.now()}`,
            method: selectedMethod,
            amount: selectedMethod === 'PIUTANG' ? parsedDownPayment : grandTotal,
            referenceNo: referenceNo || undefined,
            paidAt: now.toISOString(),
          },
        ],
        notes: orderNotes || undefined,
        status: 'POSTED',
        items: saleDetails,
        pointsEarned: selectedCustomer ? pointsEarned : undefined,
        pointsRedeemed: selectedCustomer && pointsToRedeem > 0 ? pointsToRedeem : undefined,
        pointsDiscountAmount: selectedCustomer && pointsDiscountAmount > 0 ? pointsDiscountAmount : undefined,
        customerPointsBalanceAfter: selectedCustomer ? customerPointsBalanceAfter : undefined,
        syncStatus: 'PENDING',
        idempotencyKey,
        createdAt: now.toISOString(),
      };

      // Save sale to IndexedDB
      await db.sales.add(saleRecord);

      // If method is PIUTANG, create a Receivable record
      if (selectedMethod === 'PIUTANG') {
        const custId = selectedCustomer?.id || `CUST-NON-${Date.now()}`;
        const custName = selectedCustomer ? selectedCustomer.name : customerName;
        const dueDateObj = new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000);
        const remaining = grandTotal - parsedDownPayment;

        const recId = `REC-${dateStr}-${countToday.toString().padStart(4, '0')}`;
        const recPayments = [];

        if (parsedDownPayment > 0) {
          recPayments.push({
            id: `PAY-REC-${Date.now()}`,
            receivableId: recId,
            amount: parsedDownPayment,
            paymentMethod: 'TUNAI' as const,
            paymentDate: now.toISOString(),
            referenceNo: `DP Struk ${receiptNo}`,
            receivedBy: activeUser.name,
            notes: 'Uang Muka (DP) saat transaksi POS',
          });
        }

        await db.receivables.add({
          id: recId,
          receivableNo: recId,
          saleId,
          receiptNo,
          customerId: custId,
          customerName: custName,
          customerPhone: selectedCustomer?.phone,
          transactionDate: now.toISOString(),
          dueDate: dueDateObj.toISOString(),
          totalAmount: grandTotal,
          paidAmount: parsedDownPayment,
          remainingBalance: remaining,
          status: remaining <= 0 ? 'LUNAS' : parsedDownPayment > 0 ? 'SEBAGIAN' : 'BELUM_LUNAS',
          notes: orderNotes || `Piutang transaksi kasir ${receiptNo} (Jatuh tempo ${dueDateDays} hari)`,
          payments: recPayments,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });

        // Also add customer to customers table if not existed
        if (!selectedCustomer && customerName.trim()) {
          const newCust = {
            id: custId,
            name: customerName.trim(),
            phone: '',
            tier: 'BRONZE' as const,
            pointsBalance: 0,
            totalSpend: grandTotal,
            totalVisits: 1,
            createdAt: now.toISOString(),
            notes: 'Pelanggan dibuat otomatis dari transaksi Piutang Kasir',
          };
          await db.customers.put(newCust);
        }
      }

      // Enqueue sync queue
      await syncManager.enqueue('SALE', saleId, 'INSERT', saleRecord, idempotencyKey);

      // Update Shift totals if shift is active
      if (activeShift) {
        const cashAdded = selectedMethod === 'TUNAI' ? grandTotal : selectedMethod === 'PIUTANG' ? parsedDownPayment : 0;
        const nonCashAdded = selectedMethod !== 'TUNAI' && selectedMethod !== 'PIUTANG' ? grandTotal : 0;

        const newSalesCash = activeShift.totalSalesCash + cashAdded;
        const newSalesNonCash = activeShift.totalSalesNonCash + nonCashAdded;
        const newExpectedCash = activeShift.expectedEndingCash + cashAdded;
        const newTotalTransactions = activeShift.totalTransactions + 1;

        await db.shifts.update(activeShift.id, {
          totalSalesCash: newSalesCash,
          totalSalesNonCash: newSalesNonCash,
          expectedEndingCash: newExpectedCash,
          totalTransactions: newTotalTransactions,
        });

        await refreshShift();
      }

      // Audit log
      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now.toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'POST_SALE',
        category: 'POS',
        details: `Penjualan ${receiptNo} selesai. Total Rp ${grandTotal.toLocaleString('id-ID')} (${selectedMethod})${
          selectedMethod === 'PIUTANG' ? ` Sisa Piutang: Rp ${(grandTotal - parsedDownPayment).toLocaleString('id-ID')}` : ''
        } ${selectedCustomer ? ` Member: ${selectedCustomer.name}` : ''}`,
      });

      showToast(`Transaksi ${receiptNo} berhasil disimpan!`, 'success');
      onPaymentSuccess(saleRecord);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMsg(err?.message || 'Terjadi kesalahan saat memproses pembayaran.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Pembayaran Kasir</h3>
            <p className="text-xs text-slate-500">
              Kasir: {activeUser.name} &bull; Metode HPP: {settings?.costingMethod || 'FIFO'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grand Total Highlight */}
        <div className="bg-slate-900 p-4 sm:p-6 text-white flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
              Total yang Harus Dibayar:
            </span>
            <div className="text-3xl font-black text-emerald-400 tracking-tight mt-1">
              Rp {grandTotal.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Subtotal: Rp {subtotal.toLocaleString('id-ID')}
              {orderDiscount > 0 && ` | Diskon: -Rp ${orderDiscount.toLocaleString('id-ID')}`}
              {pointsDiscountAmount > 0 && ` | Poin: -Rp ${pointsDiscountAmount.toLocaleString('id-ID')}`}
              {taxAmount > 0 && ` | PPN: +Rp ${taxAmount.toLocaleString('id-ID')}`}
            </p>
            {selectedCustomer && (
              <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-3 text-xs flex-wrap">
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 fill-amber-400" />
                  Member: {selectedCustomer.name} ({selectedCustomer.tier})
                </span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  +{pointsToEarn ?? Math.floor(grandTotal / (settings?.loyaltyPointsPerAmount || 10000))} Poin Baru
                </span>
                {pointsToRedeem > 0 && (
                  <span className="text-rose-400 font-medium">
                    ({pointsToRedeem} poin ditukarkan)
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="text-right text-xs text-slate-400 font-mono">
            {cartItems.length} item barang
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Payment Methods */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Pilih Metode Pembayaran
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { method: 'TUNAI' as PaymentMethod, label: 'Tunai', icon: Banknote },
                { method: 'QRIS' as PaymentMethod, label: 'QRIS', icon: QrCode },
                { method: 'TRANSFER' as PaymentMethod, label: 'Transfer', icon: Building },
                { method: 'DEBIT' as PaymentMethod, label: 'Debit', icon: CreditCard },
                { method: 'PIUTANG' as PaymentMethod, label: 'Piutang (Kredit)', icon: FileText },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = selectedMethod === m.method;
                return (
                  <button
                    key={m.method}
                    type="button"
                    onClick={() => {
                      setSelectedMethod(m.method);
                      if (m.method !== 'TUNAI' && m.method !== 'PIUTANG') {
                        setCashGivenInput(grandTotal.toString());
                      }
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-xs font-semibold cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Piutang (Credit) Input Section */}
          {selectedMethod === 'PIUTANG' ? (
            <div className="space-y-3.5 p-4 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <FileText className="w-4 h-4 text-amber-700" />
                <span>Pencatatan Penjualan Piutang / Kasbon Pelanggan</span>
              </div>

              {!selectedCustomer && !customerName && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  Peringatan: Transaksi piutang memerlukan nama pelanggan atau member untuk penagihan.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Uang Muka / DP Dibayar Sekarang (Rp):
                  </label>
                  <input
                    type="text"
                    value={
                      downPaymentInput
                        ? parseInt(downPaymentInput.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')
                        : '0'
                    }
                    onChange={(e) => {
                      const num = e.target.value.replace(/\D/g, '');
                      setDownPaymentInput(num);
                    }}
                    placeholder="0 jika tanpa DP"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Bisa Rp 0 (belum ada pembayaran) atau bayar sebagian.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jangka Waktu Jatuh Tempo:
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={dueDateDays}
                      onChange={(e) => setDueDateDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value={7}>7 Hari (1 Minggu)</option>
                      <option value={14}>14 Hari (2 Minggu)</option>
                      <option value={30}>30 Hari (1 Bulan)</option>
                      <option value={45}>45 Hari</option>
                      <option value={60}>60 Hari (2 Bulan)</option>
                    </select>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Jatuh tempo: {new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                  </span>
                </div>
              </div>

              {/* Outstanding Balance Summary */}
              <div className="p-3 bg-white rounded-xl border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                    Sisa Saldo Piutang Yang Harus Dilunasi
                  </span>
                  <div className="text-xl font-black text-amber-900 font-mono mt-0.5">
                    Rp {Math.max(0, grandTotal - parseInt(downPaymentInput.replace(/\D/g, '') || '0', 10)).toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className="text-slate-500 block">Peminjam:</span>
                  <span className="font-bold text-slate-900">
                    {selectedCustomer ? `${selectedCustomer.name} (Member)` : (customerName || 'Umum')}
                  </span>
                </div>
              </div>
            </div>
          ) : selectedMethod === 'TUNAI' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Uang Diterima dari Pelanggan:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-base font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      cashGivenInput
                        ? parseInt(cashGivenInput.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')
                        : ''
                    }
                    onChange={(e) => {
                      const num = e.target.value.replace(/\D/g, '');
                      setCashGivenInput(num);
                    }}
                    autoFocus
                    placeholder="0"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2">
                {quickNominals.map((nom, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCashGivenInput(nom.value.toString())}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-800 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                  >
                    {nom.label === 'Uang Pas'
                      ? 'Uang Pas'
                      : `Rp ${nom.value.toLocaleString('id-ID')}`}
                  </button>
                ))}
              </div>

              {/* Kembalian Box */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                  isInsufficient
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div>
                  <span className="text-xs font-semibold uppercase">
                    {isInsufficient ? 'Kurang Bayar' : 'Uang Kembalian'}
                  </span>
                  <div className="text-2xl font-black mt-0.5">
                    Rp{' '}
                    {(isInsufficient
                      ? grandTotal - cashGiven
                      : changeAmount
                    ).toLocaleString('id-ID')}
                  </div>
                </div>
                {isInsufficient ? (
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                )}
              </div>
            </div>
          ) : (
            /* Non-cash Details */
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                Pembayaran non-tunai sebesar{' '}
                <span className="font-bold">Rp {grandTotal.toLocaleString('id-ID')}</span> via{' '}
                <span className="font-bold">{selectedMethod}</span>. Masukkan nomor referensi atau
                kode approval struk EDC / ID Transaksi QRIS jika ada.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Referensi / Approval Code:
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="Contoh: REF-982347102"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200/60"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isInsufficient || isProcessing}
            onClick={handleCheckout}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <span>{isProcessing ? 'Memproses Transaksi...' : 'Konfirmasi & Selesai'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

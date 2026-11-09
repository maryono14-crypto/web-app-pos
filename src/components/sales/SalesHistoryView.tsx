import React, { useEffect, useState } from 'react';
import { db } from '../../db/indexedDB';
import { Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import { ReceiptModal } from '../pos/ReceiptModal';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Receipt,
  Search,
  Printer,
  Ban,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
} from 'lucide-react';

export const SalesHistoryView: React.FC = () => {
  const { activeUser, showToast } = useApp();
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [reprintSale, setReprintSale] = useState<Sale | null>(null);
  const [voidTargetSale, setVoidTargetSale] = useState<Sale | null>(null);

  const loadSales = async () => {
    const list = await db.sales.reverse().sortBy('timestamp');
    setSales(list);
  };

  useEffect(() => {
    loadSales();
  }, []);

  const handleConfirmVoid = async () => {
    if (!voidTargetSale) return;

    // RBAC: Check permission
    if (activeUser.role === 'CASHIER') {
      showToast('Hanya Owner, Admin, atau Manager yang diizinkan melakukan void transaksi.', 'error');
      setVoidTargetSale(null);
      return;
    }

    try {
      // 1. Mark sale as VOID
      await db.sales.update(voidTargetSale.id, {
        status: 'VOID',
      });

      // 2. Return items back to stock
      for (const item of voidTargetSale.items) {
        const product = await db.products.get(item.productId);
        if (product) {
          const restoredStock = product.currentStock + item.qty;
          await db.products.update(product.id, {
            currentStock: restoredStock,
            updatedAt: new Date().toISOString(),
          });

          // Log stock reversal
          await db.inventoryLogs.add({
            id: `LOG-VOID-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            timestamp: new Date().toISOString(),
            type: 'RETUR_PENJUALAN',
            qtyIn: item.qty,
            qtyOut: 0,
            balanceAfter: restoredStock,
            costValue: item.hppTotal,
            referenceId: voidTargetSale.receiptNo,
            userId: activeUser.id,
            userName: activeUser.name,
            note: `Pembatalan transaksi (VOID) ${voidTargetSale.receiptNo}`,
          });
        }
      }

      // 3. Record Audit Log
      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'VOID_SALE',
        category: 'POS',
        details: `Transaksi ${voidTargetSale.receiptNo} dibatalkan oleh ${activeUser.name}. Stok dikembalikan.`,
      });

      showToast(`Transaksi ${voidTargetSale.receiptNo} berhasil dibatalkan (VOID)`, 'info');
      setVoidTargetSale(null);
      await loadSales();
    } catch (err: any) {
      showToast(err?.message || 'Gagal membatalkan transaksi', 'error');
    }
  };

  const filteredSales = sales.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.receiptNo.toLowerCase().includes(q) ||
      s.cashierName.toLowerCase().includes(q) ||
      (s.customerName && s.customerName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Riwayat Transaksi Penjualan</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Histori nota kasir, cetak ulang struk, dan pembatalan transaksi (VOID)
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari no struk, kasir, pelanggan..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-xs"
          />
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">No. Struk</th>
                <th className="py-3 px-4">Waktu Transaksi</th>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4 text-right">Total Transaksi</th>
                <th className="py-3 px-4">Metode Bayar</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Belum ada riwayat transaksi penjualan.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const isVoid = sale.status === 'VOID';
                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isVoid ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 font-mono">{sale.receiptNo}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(sale.timestamp).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{sale.cashierName}</td>
                      <td className="py-3 px-4 text-slate-500">{sale.customerName || '-'}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {isVoid ? (
                          <span className="line-through text-slate-400">
                            Rp {sale.grandTotal.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          `Rp ${sale.grandTotal.toLocaleString('id-ID')}`
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isVoid
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isVoid ? 'Dibatalkan (VOID)' : 'Selesai'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedSale(sale)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Rincian Item"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                          <button
                            onClick={() => setReprintSale(sale)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Cetak Ulang Struk"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-700" />
                          </button>
                          {!isVoid && (
                            <button
                              onClick={() => setVoidTargetSale(sale)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Batalkan Transaksi (VOID)"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-600" />
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
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Detail Transaksi: {selectedSale.receiptNo}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {new Date(selectedSale.timestamp).toLocaleString('id-ID')} &bull; Kasir:{' '}
                  {selectedSale.cashierName}
                </p>
              </div>
              <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 text-xs">
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {selectedSale.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-800">{item.nameSnapshot}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.qty} {item.unitSnapshot} x Rp {item.sellingPrice.toLocaleString('id-ID')}
                        <span className="ml-2 font-mono text-[10px] text-purple-600">
                          (HPP: Rp {item.hppTotal.toLocaleString('id-ID')})
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-black text-slate-900">
                      Rp {item.subtotal.toLocaleString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rp {selectedSale.subtotal.toLocaleString('id-ID')}</span>
                </div>
                {selectedSale.orderDiscount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon:</span>
                    <span>-Rp {selectedSale.orderDiscount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {selectedSale.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>PPN ({selectedSale.taxRatePercent}%):</span>
                    <span>Rp {selectedSale.taxAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span>Rp {selectedSale.grandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Thermal Receipt Modal */}
      <ReceiptModal
        sale={reprintSale}
        isOpen={!!reprintSale}
        onClose={() => setReprintSale(null)}
        onNewTransaction={() => setReprintSale(null)}
      />

      {/* Void Confirmation Modal (Mandatory User Confirmation for Destructive Action) */}
      <ConfirmModal
        isOpen={!!voidTargetSale}
        title="Konfirmasi Pembatalan Transaksi (VOID)"
        message={`Apakah Anda yakin ingin membatalkan transaksi nomor "${voidTargetSale?.receiptNo}" sebesar Rp ${voidTargetSale?.grandTotal.toLocaleString(
          'id-ID'
        )}? Seluruh barang yang terjual akan dikembalikan ke saldo stok secara otomatis.`}
        confirmText="Ya, Batalkan Transaksi"
        cancelText="Jangan Batalkan"
        isDestructive={true}
        onConfirm={handleConfirmVoid}
        onClose={() => setVoidTargetSale(null)}
      />
    </div>
  );
};

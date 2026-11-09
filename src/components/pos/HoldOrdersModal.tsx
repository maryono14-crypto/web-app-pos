import React, { useEffect, useState } from 'react';
import { db } from '../../db/indexedDB';
import { CartItem, HoldOrder } from '../../types';
import { Clock, Play, Trash2, X, ShoppingBag } from 'lucide-react';

interface HoldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResumeOrder: (items: CartItem[], customerName?: string, notes?: string, customerId?: string) => void;
}

export const HoldOrdersModal: React.FC<HoldOrdersModalProps> = ({
  isOpen,
  onClose,
  onResumeOrder,
}) => {
  const [orders, setOrders] = useState<HoldOrder[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadHoldOrders();
    }
  }, [isOpen]);

  const loadHoldOrders = async () => {
    const list = await db.holdOrders.toArray();
    setOrders(list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));
  };

  const handleDelete = async (id: string) => {
    await db.holdOrders.delete(id);
    await loadHoldOrders();
  };

  const handleResume = (order: HoldOrder) => {
    onResumeOrder(order.items, order.customerName, order.notes, order.customerId);
    handleDelete(order.id);
    onClose();
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Pesanan Ditahan (Hold Orders)</h3>
              <p className="text-xs text-slate-500">Panggil kembali transaksi yang diparkir kasir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
          {orders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Tidak ada pesanan yang sedang ditahan.</p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70 transition-all flex items-center justify-between gap-4 shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{order.orderName}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(order.savedAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {order.items.length} jenis item ({order.items.reduce((s, i) => s + i.qty, 0)} pcs)
                  </p>
                  <p className="text-sm font-bold text-emerald-700 mt-1">
                    Rp {order.subtotal.toLocaleString('id-ID')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(order.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleResume(order)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Lanjutkan</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/60"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

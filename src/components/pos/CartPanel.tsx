import React, { useState } from 'react';
import { CartItem, Customer } from '../../types';
import { useApp } from '../../context/AppContext';
import { CustomerSelector } from './CustomerSelector';
import {
  Trash2,
  Plus,
  Minus,
  PauseCircle,
  FolderOpen,
  Tag,
  Receipt,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';

interface CartPanelProps {
  items: CartItem[];
  onUpdateQty: (productId: string, newQty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  orderDiscount: number;
  setOrderDiscount: (discount: number) => void;
  pointsToRedeem: number;
  onChangePointsToRedeem: (points: number) => void;
  onHoldOrder: () => void;
  onOpenHoldModal: () => void;
  holdCount: number;
  onOpenPayment: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  items,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  selectedCustomer,
  onSelectCustomer,
  customerName,
  setCustomerName,
  orderNotes,
  setOrderNotes,
  orderDiscount,
  setOrderDiscount,
  pointsToRedeem,
  onChangePointsToRedeem,
  onHoldOrder,
  onOpenHoldModal,
  holdCount,
  onOpenPayment,
}) => {
  const { settings } = useApp();
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountValue, setDiscountValue] = useState(orderDiscount.toString());

  // Calculations
  const subtotal = items.reduce(
    (sum, item) => sum + item.qty * item.sellingPrice - item.discountItem,
    0
  );

  const redemptionValue = settings?.loyaltyPointRedemptionValue || 100;
  const pointsDiscountAmount = pointsToRedeem * redemptionValue;

  const discountedSubtotal = Math.max(0, subtotal - orderDiscount - pointsDiscountAmount);

  const taxRate = settings?.taxEnabled ? settings.taxRatePercent : 0;
  const taxAmount = settings?.taxEnabled ? Math.round((discountedSubtotal * taxRate) / 100) : 0;

  const grandTotal = discountedSubtotal + taxAmount;
  const totalItemCount = items.reduce((sum, item) => sum + item.qty, 0);

  const applyDiscount = () => {
    const val = parseInt(discountValue.replace(/\D/g, '') || '0', 10);
    setOrderDiscount(Math.min(subtotal, val));
    setShowDiscountInput(false);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-600" />
          <h2 className="font-bold text-slate-800 text-sm">Keranjang Belanja</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {totalItemCount} pcs
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenHoldModal}
            className="relative px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Daftar Pesanan Ditahan"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>Tahan</span>
            {holdCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {holdCount}
              </span>
            )}
          </button>

          {items.length > 0 && (
            <button
              onClick={onClearCart}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Kosongkan Keranjang"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Customer Selector & Loyalty */}
      <CustomerSelector
        selectedCustomer={selectedCustomer}
        onSelectCustomer={(cust) => {
          onSelectCustomer(cust);
          setCustomerName(cust ? cust.name : '');
        }}
        subtotal={subtotal}
        pointsToRedeem={pointsToRedeem}
        onChangePointsToRedeem={onChangePointsToRedeem}
      />


      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Receipt className="w-12 h-12 stroke-[1.2] opacity-40 mb-2" />
            <p className="text-sm font-medium text-slate-600">Keranjang masih kosong</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
              Pilih produk di sebelah kiri atau ketik barcode/SKU untuk menambahkan.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const lineSubtotal = item.qty * item.sellingPrice - item.discountItem;
            return (
              <div
                key={item.productId}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white shadow-2xs transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 truncate leading-snug">
                      {item.product.name}
                    </h4>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Rp {item.sellingPrice.toLocaleString('id-ID')} / {item.product.unit}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.productId)}
                    className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  {/* Quantity modifier */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => onUpdateQty(item.productId, item.qty - 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-white hover:bg-slate-200 text-slate-700 shadow-2xs cursor-pointer transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={item.product.currentStock}
                      value={item.qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          onUpdateQty(item.productId, val);
                        }
                      }}
                      className="w-10 text-center font-bold text-xs bg-transparent focus:outline-none"
                    />
                    <button
                      onClick={() => onUpdateQty(item.productId, item.qty + 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-white hover:bg-slate-200 text-slate-700 shadow-2xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900">
                      Rp {lineSubtotal.toLocaleString('id-ID')}
                    </span>
                    {item.discountItem > 0 && (
                      <span className="block text-[10px] text-rose-600 font-medium">
                        -Rp {item.discountItem.toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Summary & Checkout */}
      {items.length > 0 && (
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/70 space-y-2.5">
          {/* Summary Breakdown */}
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal ({totalItemCount} barang):</span>
              <span className="font-semibold text-slate-800">
                Rp {subtotal.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Discount */}
            <div className="flex justify-between items-center text-rose-600">
              <button
                onClick={() => setShowDiscountInput(!showDiscountInput)}
                className="flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <Tag className="w-3 h-3" />
                <span>Diskon Transaksi:</span>
              </button>
              <span className="font-semibold">
                {orderDiscount > 0 ? `-Rp ${orderDiscount.toLocaleString('id-ID')}` : 'Rp 0'}
              </span>
            </div>

            {showDiscountInput && (
              <div className="p-2 bg-white rounded-lg border border-slate-200 flex gap-1.5">
                <input
                  type="text"
                  placeholder="Nominal diskon (Rp)"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                />
                <button
                  onClick={applyDiscount}
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-medium cursor-pointer"
                >
                  OK
                </button>
              </div>
            )}

            {/* Points Redemption Discount */}
            {pointsDiscountAmount > 0 && (
              <div className="flex justify-between items-center text-amber-700 bg-amber-50/80 px-2 py-1 rounded-md border border-amber-200/60 font-medium">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                  Tukar {pointsToRedeem} Poin:
                </span>
                <span className="font-bold">
                  -Rp {pointsDiscountAmount.toLocaleString('id-ID')}
                </span>
              </div>
            )}


            {/* Tax */}
            {settings?.taxEnabled && (
              <div className="flex justify-between">
                <span>PPN ({taxRate}%):</span>
                <span className="font-semibold text-slate-800">
                  Rp {taxAmount.toLocaleString('id-ID')}
                </span>
              </div>
            )}

            {/* Grand Total */}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-slate-900">
              <span className="font-bold text-sm">TOTAL BAYAR:</span>
              <span className="font-black text-lg text-emerald-700 tracking-tight">
                Rp {grandTotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <button
              type="button"
              onClick={onHoldOrder}
              className="col-span-1 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex flex-col items-center justify-center transition-colors cursor-pointer"
              title="Simpan pesanan sementara"
            >
              <PauseCircle className="w-4 h-4 text-amber-700" />
              <span className="text-[10px] mt-0.5">Tahan</span>
            </button>

            <button
              type="button"
              onClick={onOpenPayment}
              className="col-span-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Bayar / Checkout</span>
              <span className="text-xs bg-emerald-700/60 px-1.5 py-0.5 rounded font-mono">F4</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

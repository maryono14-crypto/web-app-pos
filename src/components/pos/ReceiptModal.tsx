import React, { useRef, useState } from 'react';
import { Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import { Printer, CheckCircle, Download, X, Share2, Settings } from 'lucide-react';
import { ReceiptSettingsModal } from '../settings/ReceiptSettingsModal';

interface ReceiptModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onNewTransaction: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  isOpen,
  onClose,
  onNewTransaction,
}) => {
  const { settings } = useApp();
  const [receiptWidth, setReceiptWidth] = useState<'58mm' | '80mm'>(
    settings?.defaultReceiptWidth || '58mm'
  );
  const [isReceiptSettingsOpen, setReceiptSettingsOpen] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
        {/* Header Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Transaksi Berhasil</h3>
              <p className="text-xs text-slate-500 font-mono">{sale.receiptNo}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Format Struk button */}
            <button
              onClick={() => setReceiptSettingsOpen(true)}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
              title="Kustomisasi Format Struk"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Format</span>
            </button>

            {/* Width selector */}
            <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setReceiptWidth('58mm')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  receiptWidth === '58mm' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                58mm
              </button>
              <button
                onClick={() => setReceiptWidth('80mm')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  receiptWidth === '80mm' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                80mm
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-3 sm:p-6 bg-slate-100 flex justify-center flex-1 overflow-y-auto">
          <div
            ref={printAreaRef}
            id="printable-receipt"
            style={{ width: receiptWidth === '58mm' ? '280px' : '360px' }}
            className="bg-white p-4 shadow-md font-mono text-[11px] leading-tight text-slate-900 rounded-sm border border-slate-200 transition-all select-text"
          >
            {/* Store Info */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              <h2 className="font-bold text-sm tracking-tight uppercase">
                {settings?.storeName || 'TOKO RITEL'}
              </h2>
              {settings?.storeTagline && (
                <p className="text-[10px] text-slate-600 mt-0.5">{settings.storeTagline}</p>
              )}
              {settings?.storeAddress && (
                <p className="text-[10px] text-slate-600 mt-0.5 whitespace-pre-line leading-tight">
                  {settings.storeAddress}
                </p>
              )}
              {settings?.storePhone && (
                <p className="text-[10px] text-slate-500 mt-0.5">Telp: {settings.storePhone}</p>
              )}
            </div>

            {/* Transaction Metadata */}
            <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>No. Struk:</span>
                <span className="font-bold">{sale.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>
                  {new Date(sale.timestamp).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  {new Date(sale.timestamp).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{sale.cashierName}</span>
              </div>
              {sale.customerName && (
                <div className="flex justify-between">
                  <span>Pelanggan/Member:</span>
                  <span className="font-semibold">
                    {sale.customerName} {sale.customerPhone ? `(${sale.customerPhone})` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-2">
              {sale.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-semibold text-slate-800 break-words">{item.nameSnapshot}</div>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      {item.qty} {item.unitSnapshot} x Rp {item.sellingPrice.toLocaleString('id-ID')}
                      {item.discountItem > 0 && (
                        <span className="text-rose-600 ml-1">
                          (-Rp {item.discountItem.toLocaleString('id-ID')})
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-slate-900">
                      Rp {item.subtotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-right">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>Rp {sale.subtotal.toLocaleString('id-ID')}</span>
              </div>
              {sale.orderDiscount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Diskon Pesanan:</span>
                  <span>-Rp {sale.orderDiscount.toLocaleString('id-ID')}</span>
                </div>
              )}
              {sale.pointsDiscountAmount !== undefined && sale.pointsDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Tukar Poin ({sale.pointsRedeemed} Poin):</span>
                  <span>-Rp {sale.pointsDiscountAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              {sale.taxAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>PPN ({sale.taxRatePercent}%):</span>
                  <span>Rp {sale.taxAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-slate-300 pt-1 text-slate-900">
                <span>TOTAL:</span>
                <span>Rp {sale.grandTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-0.5">
                <span>Bayar ({sale.paymentMethod}):</span>
                <span>Rp {sale.paidAmount.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800">
                <span>Kembalian:</span>
                <span>Rp {sale.changeAmount.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Loyalty Points Section */}
            {(sale.pointsEarned !== undefined || sale.customerPointsBalanceAfter !== undefined) && (
              <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
                <div className="text-center font-bold tracking-wider text-[11px] pb-1 text-slate-800">
                  *** POIN LOYALITAS MEMBER ***
                </div>
                {sale.pointsEarned !== undefined && (
                  <div className="flex justify-between">
                    <span>Poin Diperoleh:</span>
                    <span className="font-bold text-emerald-800">
                      +{sale.pointsEarned.toLocaleString('id-ID')} Poin
                    </span>
                  </div>
                )}
                {sale.pointsRedeemed !== undefined && sale.pointsRedeemed > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>Poin Ditukarkan:</span>
                    <span>-{sale.pointsRedeemed.toLocaleString('id-ID')} Poin</span>
                  </div>
                )}
                {sale.customerPointsBalanceAfter !== undefined && (
                  <div className="flex justify-between font-bold pt-1 border-t border-slate-200 text-slate-900">
                    <span>Sisa Saldo Poin:</span>
                    <span>{sale.customerPointsBalanceAfter.toLocaleString('id-ID')} Poin</span>
                  </div>
                )}
              </div>
            )}


            {/* Footer */}
            <div className="pt-3 text-center text-[10px] text-slate-500 space-y-1">
              {settings?.storeFooterNote && (
                <p className="font-semibold text-slate-800 whitespace-pre-line leading-relaxed">
                  {settings.storeFooterNote}
                </p>
              )}
              <p className="text-[9px] text-slate-400 pt-0.5">=== Sistem POS & Inventory Terintegrasi ===</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 no-print shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200/60 cursor-pointer min-h-[44px] flex items-center justify-center"
          >
            Tutup
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs cursor-pointer min-h-[44px]"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak Struk</span>
            </button>
            <button
              onClick={onNewTransaction}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer min-h-[44px]"
            >
              <span>Transaksi Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Receipt Settings Modal */}
      <ReceiptSettingsModal
        isOpen={isReceiptSettingsOpen}
        onClose={() => setReceiptSettingsOpen(false)}
      />
    </div>
  );
};

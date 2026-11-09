import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Barcode,
  Printer,
  X,
  Plus,
  Minus,
  Settings2,
  Copy,
  Tag,
  Check,
} from 'lucide-react';

export interface BarcodePrintItem {
  product: Product;
  quantity: number;
}

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BarcodePrintItem[];
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  items: initialItems,
}) => {
  const { settings } = useApp();

  const [printItems, setPrintItems] = useState<BarcodePrintItem[]>([]);
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13' | 'pharmacode'>('CODE128');
  const [labelSize, setLabelSize] = useState<'sticker' | 'a4' | 'compact'>('sticker');
  const [showPrice, setShowPrice] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [barcodeSource, setBarcodeSource] = useState<'SKU' | 'BARCODE'>('SKU');

  useEffect(() => {
    if (isOpen) {
      setPrintItems(initialItems.length > 0 ? initialItems : []);
    }
  }, [isOpen, initialItems]);

  if (!isOpen) return null;

  const handleUpdateQty = (productId: string, delta: number) => {
    setPrintItems((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handlePrint = () => {
    window.print();
  };

  // Flatten items according to quantity to generate individual stickers
  const flattenedLabels: { product: Product; code: string }[] = [];
  printItems.forEach((item) => {
    const code =
      barcodeSource === 'SKU'
        ? item.product.sku
        : item.product.barcode || item.product.sku;

    for (let i = 0; i < item.quantity; i++) {
      flattenedLabels.push({
        product: item.product,
        code,
      });
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] my-auto">
        {/* Header Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 no-print shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Cetak Label Barcode Produk
              </h3>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Barcode terstandarisasi CODE128 untuk pemindaian instan di kasir POS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all min-h-[38px]"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak ({flattenedLabels.length} Label)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Options Toolbar */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          {/* Format & Source Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="text-slate-500 font-semibold mr-1.5">Sumber Kode:</span>
              <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setBarcodeSource('SKU')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    barcodeSource === 'SKU'
                      ? 'bg-white text-emerald-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  SKU Produk
                </button>
                <button
                  onClick={() => setBarcodeSource('BARCODE')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    barcodeSource === 'BARCODE'
                      ? 'bg-white text-emerald-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Barcode Fisik
                </button>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-semibold mr-1.5">Ukuran Kertas:</span>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
              >
                <option value="sticker">Stiker Thermal (40x30 mm)</option>
                <option value="compact">Stiker Rak Mini (35x25 mm)</option>
                <option value="a4">Kertas Stiker A4 (Kisi Label)</option>
              </select>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-3 text-slate-700">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="w-3.5 h-3.5 text-emerald-600 rounded"
              />
              <span className="font-semibold">Tampilkan Harga</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showStoreName}
                onChange={(e) => setShowStoreName(e.target.checked)}
                className="w-3.5 h-3.5 text-emerald-600 rounded"
              />
              <span className="font-semibold">Nama Toko</span>
            </label>
          </div>
        </div>

        {/* Quantity Controls for selected items */}
        {printItems.length > 1 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-print text-xs">
            <span className="text-slate-500 font-bold shrink-0">Jumlah Cetak per Produk:</span>
            {printItems.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs shrink-0"
              >
                <span className="font-semibold text-slate-800 max-w-[120px] truncate">
                  {item.product.name}
                </span>
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => handleUpdateQty(item.product.id, -1)}
                    className="w-4 h-4 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-bold text-emerald-800 px-1">{item.quantity}</span>
                  <button
                    onClick={() => handleUpdateQty(item.product.id, 1)}
                    className="w-4 h-4 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Barcode Sticker Preview Grid (Target for Printing) */}
        <div className="p-6 bg-slate-100 flex-1 overflow-y-auto">
          {flattenedLabels.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Barcode className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-slate-600">Tidak ada produk yang dipilih untuk dicetak.</p>
            </div>
          ) : (
            <div
              id="printable-barcode-sheet"
              className={`grid gap-3 justify-center ${
                labelSize === 'a4'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-4xl mx-auto'
                  : labelSize === 'compact'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
              }`}
            >
              {flattenedLabels.map((lbl, idx) => (
                <BarcodeCard
                  key={`${lbl.product.id}-${idx}`}
                  product={lbl.product}
                  code={lbl.code}
                  storeName={settings?.storeName || 'TOKO RETAIL'}
                  showPrice={showPrice}
                  showStoreName={showStoreName}
                  labelSize={labelSize}
                  format={barcodeFormat}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print">
          <span className="text-xs text-slate-500 font-medium">
            Total {flattenedLabels.length} stiker siap cetak. Gunakan kertas label thermal atau kertas stiker HVS.
          </span>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              disabled={flattenedLabels.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual Barcode Card Sticker Component
interface BarcodeCardProps {
  product: Product;
  code: string;
  storeName: string;
  showPrice: boolean;
  showStoreName: boolean;
  labelSize: 'sticker' | 'a4' | 'compact';
  format: string;
}

const BarcodeCard: React.FC<BarcodeCardProps> = ({
  product,
  code,
  storeName,
  showPrice,
  showStoreName,
  labelSize,
  format,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (svgRef.current && code) {
      try {
        setRenderError(false);
        // Render barcode using JsBarcode
        JsBarcode(svgRef.current, code, {
          format: 'CODE128', // CODE128 supports both alphanumeric SKUs and pure digits!
          width: labelSize === 'compact' ? 1.2 : 1.4,
          height: labelSize === 'compact' ? 32 : 40,
          displayValue: true,
          font: 'monospace',
          fontSize: 10,
          textMargin: 2,
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        console.warn('Barcode render fallback error:', err);
        setRenderError(true);
      }
    }
  }, [code, labelSize, format]);

  return (
    <div
      className={`bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs flex flex-col items-center justify-between text-center select-text transition-all print:border print:border-black print:shadow-none print:break-inside-avoid ${
        labelSize === 'compact'
          ? 'w-[145px] min-h-[110px]'
          : 'w-[180px] min-h-[140px]'
      }`}
    >
      {/* Store Header */}
      {showStoreName && (
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate w-full border-b border-dashed border-slate-200 pb-0.5 mb-1">
          {storeName}
        </div>
      )}

      {/* Product Name */}
      <div className="text-[11px] font-bold text-slate-900 line-clamp-2 leading-tight w-full px-0.5">
        {product.name}
      </div>

      {/* Barcode SVG Container */}
      <div className="py-1 w-full flex items-center justify-center">
        {renderError ? (
          <div className="p-2 border border-rose-300 rounded bg-rose-50 text-[10px] text-rose-700 font-mono">
            Kode: {code}
          </div>
        ) : (
          <svg ref={svgRef} className="max-w-full h-auto" />
        )}
      </div>

      {/* Price Tag */}
      {showPrice && (
        <div className="w-full pt-1 border-t border-slate-100 flex items-center justify-between text-slate-900 px-1">
          <span className="text-[9px] text-slate-500 font-medium">{product.unit}</span>
          <span className="text-xs font-black text-emerald-800">
            Rp {product.sellingPrice.toLocaleString('id-ID')}
          </span>
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { db } from '../../db/indexedDB';
import { Category, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { Upload, X, FileText, CheckCircle2, AlertTriangle, Download, ArrowRight } from 'lucide-react';
import { downloadCsv } from '../../utils/exportHelpers';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onImportSuccess: () => void;
}

interface ParsedRow {
  sku: string;
  barcode: string;
  name: string;
  categoryName: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  initialStock: number;
  minStock: number;
  status: 'valid' | 'invalid';
  error?: string;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  categories,
  onImportSuccess,
}) => {
  const { showToast, activeUser } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('update');
  const [autoCreateCategories, setAutoCreateCategories] = useState(true);

  if (!isOpen) return null;

  // Template download helper
  const handleDownloadTemplate = () => {
    const headers = [
      'SKU',
      'Barcode',
      'Nama Produk',
      'Kategori',
      'Satuan',
      'Harga Beli',
      'Harga Jual',
      'Stok Awal',
      'Stok Minimal',
    ];

    const sampleRows = [
      ['PRD-00101', '8991234567890', 'Minyak Goreng Sania 2L', 'Sembako', 'Pouch', 34000, 38500, 24, 6],
      ['PRD-00102', '8992345678901', 'Gula Pasir Gulaku 1kg', 'Sembako', 'Kg', 16500, 18500, 50, 10],
      ['PRD-00103', '8993456789012', 'Kopi Kapal Api Spesial 165g', 'Minuman', 'Bungkus', 13000, 15500, 30, 5],
      ['PRD-00104', '8994567890123', 'Sabun Mandi Lifebuoy Total 10 85g', 'Perawatan Tubuh', 'Pcs', 3800, 4800, 40, 8],
    ];

    downloadCsv('Template_Import_Produk.csv', headers, sampleRows);
    showToast('Template CSV berhasil diunduh. Silakan isi dan unggah kembali.', 'info');
  };

  // Parse CSV text properly handling quotes and commas/semicolons
  const parseCSVText = (text: string): string[][] => {
    // Detect delimiter: comma or semicolon (frequently used in Indonesian Excel)
    const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
    const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

    const lines = text.split(/\r\n|\n|\r/);
    const result: string[][] = [];

    for (const rawLine of lines) {
      if (!rawLine.trim()) continue;

      const row: string[] = [];
      let inQuotes = false;
      let currentVal = '';

      for (let i = 0; i < rawLine.length; i++) {
        const char = rawLine[i];
        const nextChar = rawLine[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            currentVal += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          row.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      row.push(currentVal.trim());
      result.push(row);
    }

    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const rows = parseCSVText(text);
        if (rows.length < 2) {
          showToast('File CSV tidak memiliki baris data atau kosong.', 'error');
          return;
        }

        // Header detection
        const rawHeaders = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

        // Map column indices flexibly
        const getColIdx = (keywords: string[]) => {
          return rawHeaders.findIndex((h) => keywords.some((k) => h.includes(k)));
        };

        const skuIdx = getColIdx(['sku', 'kodeproduk', 'kodebarang', 'code']);
        const barcodeIdx = getColIdx(['barcode', 'upc', 'ean']);
        const nameIdx = getColIdx(['nama', 'namaproduk', 'namabarang', 'productname', 'title']);
        const catIdx = getColIdx(['kategori', 'category']);
        const unitIdx = getColIdx(['satuan', 'unit']);
        const costIdx = getColIdx(['hargabeli', 'beli', 'hpp', 'cost']);
        const sellIdx = getColIdx(['hargajual', 'jual', 'price', 'selling']);
        const stockIdx = getColIdx(['stok', 'stock', 'stokawal', 'qty', 'stokfisik']);
        const minStockIdx = getColIdx(['minstok', 'stokminimal', 'minstock', 'batasminimum']);

        if (nameIdx === -1 && skuIdx === -1) {
          showToast('Format CSV tidak dikenali. Pastikan ada kolom "Nama Produk" atau "SKU".', 'error');
          return;
        }

        const dataRows = rows.slice(1);
        const parsed: ParsedRow[] = [];

        dataRows.forEach((cols, idx) => {
          if (cols.length === 0 || cols.every((c) => !c.trim())) return;

          const rawName = nameIdx !== -1 ? cols[nameIdx] || '' : '';
          const rawSku = skuIdx !== -1 ? cols[skuIdx] || '' : '';
          const rawBarcode = barcodeIdx !== -1 ? cols[barcodeIdx] || '' : '';
          const rawCat = catIdx !== -1 ? cols[catIdx] || '' : 'Umum';
          const rawUnit = unitIdx !== -1 ? cols[unitIdx] || 'Pcs' : 'Pcs';

          const parseNum = (val: string | undefined, defaultVal = 0) => {
            if (!val) return defaultVal;
            // Clean Rp, dots as thousand separators or commas
            const cleaned = val.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(/,/g, '.');
            const n = parseFloat(cleaned);
            return isNaN(n) ? defaultVal : n;
          };

          const costPrice = costIdx !== -1 ? parseNum(cols[costIdx], 0) : 0;
          const sellingPrice = sellIdx !== -1 ? parseNum(cols[sellIdx], 0) : 0;
          const initialStock = stockIdx !== -1 ? parseNum(cols[stockIdx], 0) : 0;
          const minStock = minStockIdx !== -1 ? parseNum(cols[minStockIdx], 5) : 5;

          const finalSku = rawSku.trim() || `PRD-${Date.now().toString().slice(-4)}${idx}`;
          const finalName = rawName.trim();

          let errorMsg = '';
          if (!finalName) {
            errorMsg = 'Nama produk tidak boleh kosong';
          }

          parsed.push({
            sku: finalSku,
            barcode: rawBarcode.trim() || `899${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            name: finalName || `(Produk Baris ${idx + 2})`,
            categoryName: rawCat.trim() || 'Umum',
            unit: rawUnit.trim() || 'Pcs',
            costPrice: Math.max(0, costPrice),
            sellingPrice: Math.max(0, sellingPrice),
            initialStock: Math.max(0, initialStock),
            minStock: Math.max(1, minStock),
            status: errorMsg ? 'invalid' : 'valid',
            error: errorMsg,
          });
        });

        setParsedRows(parsed);
      } catch (err: any) {
        showToast('Gagal membaca file CSV: ' + err.message, 'error');
      }
    };

    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.status === 'valid');
    if (validRows.length === 0) {
      showToast('Tidak ada data produk valid untuk diimpor.', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      const now = new Date().toISOString();
      const existingProducts = await db.products.toArray();
      const existingCategories = await db.categories.toArray();

      // Create a category lookup map (lowercase name -> categoryId)
      const categoryMap = new Map<string, string>();
      existingCategories.forEach((c) => categoryMap.set(c.name.toLowerCase().trim(), c.id));

      const newCategoriesToAdd: Category[] = [];

      // Check categories needed
      for (const row of validRows) {
        const catKey = row.categoryName.toLowerCase().trim();
        if (!categoryMap.has(catKey) && autoCreateCategories) {
          const newCatId = `CAT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const newCat: Category = {
            id: newCatId,
            name: row.categoryName.trim(),
            icon: '📦',
          };
          newCategoriesToAdd.push(newCat);
          categoryMap.set(catKey, newCatId);
        }
      }

      if (newCategoriesToAdd.length > 0) {
        await db.categories.bulkAdd(newCategoriesToAdd);
      }

      // Existing SKU & barcode lookup map
      const existingBySku = new Map<string, Product>();
      existingProducts.forEach((p) => existingBySku.set(p.sku.toLowerCase().trim(), p));

      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      const productsToInsert: Product[] = [];
      const batchesToInsert: any[] = [];

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const existing = existingBySku.get(row.sku.toLowerCase().trim());
        const catId = categoryMap.get(row.categoryName.toLowerCase().trim()) || categories[0]?.id || 'CAT-001';

        if (existing) {
          if (duplicateStrategy === 'skip') {
            skippedCount++;
            continue;
          } else {
            // Update existing product
            await db.products.update(existing.id, {
              barcode: row.barcode || existing.barcode,
              name: row.name,
              categoryId: catId,
              unit: row.unit,
              costPrice: row.costPrice,
              sellingPrice: row.sellingPrice,
              minStock: row.minStock,
              currentStock: row.initialStock > 0 ? existing.currentStock + row.initialStock : existing.currentStock,
              updatedAt: now,
            });

            if (row.initialStock > 0) {
              batchesToInsert.push({
                id: `BATCH-IMP-${Date.now()}-${i}`,
                productId: existing.id,
                purchaseRefId: 'IMPORT_CSV_RESTOCK',
                dateReceived: now,
                initialQty: row.initialStock,
                remainingQty: row.initialStock,
                costPerUnit: row.costPrice,
                status: 'ACTIVE',
              });
            }
            updatedCount++;
          }
        } else {
          // Insert new product
          const newProdId = `PRD-IMP-${Date.now()}-${i}`;
          const newProd: Product = {
            id: newProdId,
            sku: row.sku,
            barcode: row.barcode,
            name: row.name,
            categoryId: catId,
            unit: row.unit,
            costPrice: row.costPrice,
            sellingPrice: row.sellingPrice,
            minStock: row.minStock,
            currentStock: row.initialStock,
            avgCostPrice: row.costPrice,
            active: true,
            createdAt: now,
            updatedAt: now,
          };

          productsToInsert.push(newProd);

          if (row.initialStock > 0) {
            batchesToInsert.push({
              id: `BATCH-IMP-${Date.now()}-${i}`,
              productId: newProdId,
              purchaseRefId: 'IMPORT_CSV_INITIAL',
              dateReceived: now,
              initialQty: row.initialStock,
              remainingQty: row.initialStock,
              costPerUnit: row.costPrice,
              status: 'ACTIVE',
            });
          }
          importedCount++;
        }
      }

      if (productsToInsert.length > 0) {
        await db.products.bulkAdd(productsToInsert);
      }

      if (batchesToInsert.length > 0) {
        await db.fifoBatches.bulkAdd(batchesToInsert);
      }

      // Audit Log
      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'IMPORT_PRODUCTS_CSV',
        category: 'PRODUCTS',
        details: `Import CSV: ${importedCount} produk baru ditambahkan, ${updatedCount} diperbarui, ${skippedCount} dilewati. File: ${fileName}`,
      });

      showToast(
        `Berhasil mengimpor: ${importedCount} produk baru, ${updatedCount} diperbarui, ${skippedCount} dilewati.`,
        'success'
      );

      onImportSuccess();
      onClose();
    } catch (err: any) {
      showToast('Gagal memproses impor CSV: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.status === 'valid').length;
  const invalidCount = parsedRows.filter((r) => r.status === 'invalid').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Impor Data Produk dari File CSV
              </h3>
              <p className="text-[11px] text-slate-500">
                Unggah katalog produk dalam jumlah banyak dengan format CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto text-xs">
          {/* Download Template & File Input Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <div className="font-bold text-slate-800 text-xs">Belum punya format CSV yang sesuai?</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Unduh template resmi dengan contoh kolom SKU, Barcode, Kategori, Harga &amp; Stok.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 rounded-xl shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Unduh Template CSV</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="p-3 bg-white group-hover:bg-emerald-100 text-slate-400 group-hover:text-emerald-700 rounded-full shadow-xs transition-colors">
              <FileText className="w-7 h-7" />
            </div>
            <div className="text-xs font-bold text-slate-700 group-hover:text-emerald-800">
              {fileName ? fileName : 'Klik untuk memilih file CSV atau seret file ke sini'}
            </div>
            <div className="text-[11px] text-slate-400">
              Mendukung delimiter koma (,) atau titik-koma (;) dari ekspor Excel Indonesia.
            </div>
          </div>

          {/* Configuration Options */}
          {parsedRows.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Jika SKU Sudah Ada (Duplikat):
                </label>
                <select
                  value={duplicateStrategy}
                  onChange={(e) => setDuplicateStrategy(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-xs focus:outline-none"
                >
                  <option value="update">Perbarui Data Produk yang Sudah Ada (Update)</option>
                  <option value="skip">Lewati Baris (Jangan Timpa / Skip)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 mt-auto pb-1">
                <input
                  type="checkbox"
                  id="autoCat"
                  checked={autoCreateCategories}
                  onChange={(e) => setAutoCreateCategories(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="autoCat" className="font-semibold text-slate-700 cursor-pointer">
                  Buat Kategori Baru Otomatis jika Belum Terdaftar
                </label>
              </div>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-xs">
                    Pratinjau Impor ({parsedRows.length} baris terdeteksi)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {validCount} Siap
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                      {invalidCount} Error
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3">Nama Produk</th>
                      <th className="py-2 px-3">Kategori</th>
                      <th className="py-2 px-3 text-right">Harga Jual</th>
                      <th className="py-2 px-3 text-right">Stok Awal</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 15).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-600">{row.sku}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{row.name}</td>
                        <td className="py-2 px-3 text-slate-600">{row.categoryName}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">
                          Rp {row.sellingPrice.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium">{row.initialStock} {row.unit}</td>
                        <td className="py-2 px-3 text-center">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full" title={row.error}>
                              <AlertTriangle className="w-3 h-3" /> Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 15 && (
                <div className="text-[11px] text-slate-400 text-center mt-1.5 italic">
                  Menampilkan 15 baris pertama dari total {parsedRows.length} baris...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleExecuteImport}
            disabled={validCount === 0 || isProcessing}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer ${
              validCount === 0 || isProcessing
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'
            }`}
          >
            <span>{isProcessing ? 'Memproses Impor...' : `Impor ${validCount} Produk`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

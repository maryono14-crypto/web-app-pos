import React, { useEffect, useState } from 'react';
import { db } from '../../db/indexedDB';
import { Category, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit,
  PowerOff,
  CheckCircle,
  X,
  Barcode,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { BarcodePrintModal, BarcodePrintItem } from './BarcodePrintModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { CSVImportModal } from './CSVImportModal';

export const ProductsView: React.FC = () => {
  const { showToast, activeUser } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('ALL');

  // Product modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    categoryId: '',
    unit: 'Pcs',
    costPrice: 0,
    sellingPrice: 0,
    minStock: 5,
    initialStock: 0,
  });

  // Barcode Printing Modal
  const [barcodeModalItems, setBarcodeModalItems] = useState<BarcodePrintItem[]>([]);
  const [isBarcodeModalOpen, setBarcodeModalOpen] = useState(false);

  // CSV Import Modal
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);

  // Delete Confirmations
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

  const loadData = async () => {
    const [pList, cList] = await Promise.all([
      db.products.toArray(),
      db.categories.toArray(),
    ]);
    setProducts(pList);
    setCategories(cList);
    if (cList.length > 0 && !formData.categoryId) {
      setFormData((prev) => ({ ...prev, categoryId: cList[0].id }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    const skuAuto = `PRD-${Date.now().toString().slice(-6)}`;
    const barcodeAuto = `899${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    setFormData({
      sku: skuAuto,
      barcode: barcodeAuto,
      name: '',
      categoryId: categories[0]?.id || '',
      unit: 'Pcs',
      costPrice: 0,
      sellingPrice: 0,
      minStock: 5,
      initialStock: 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      categoryId: p.categoryId,
      unit: p.unit,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      minStock: p.minStock,
      initialStock: p.currentStock,
    });
    setIsModalOpen(true);
  };

  const handlePrintSingleBarcode = (p: Product) => {
    setBarcodeModalItems([{ product: p, quantity: Math.max(1, Math.min(p.currentStock || 1, 5)) }]);
    setBarcodeModalOpen(true);
  };

  const handlePrintBulkBarcodes = () => {
    const activeProducts = products.filter((p) => p.active);
    if (activeProducts.length === 0) {
      showToast('Tidak ada produk aktif untuk dicetak barcode.', 'info');
      return;
    }
    const items: BarcodePrintItem[] = activeProducts.map((p) => ({
      product: p,
      quantity: p.currentStock > 0 ? Math.min(p.currentStock, 5) : 1,
    }));
    setBarcodeModalItems(items);
    setBarcodeModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!formData.name.trim() || !formData.sku.trim()) {
      showToast('Nama produk dan SKU wajib diisi', 'error');
      return;
    }

    // SKU uniqueness validation
    const existingSku = products.find(
      (p) => p.sku.toLowerCase() === formData.sku.toLowerCase() && p.id !== editingProduct?.id
    );
    if (existingSku) {
      showToast(`SKU "${formData.sku}" sudah digunakan oleh produk "${existingSku.name}"`, 'error');
      return;
    }

    const now = new Date().toISOString();

    if (editingProduct) {
      // Update
      await db.products.update(editingProduct.id, {
        sku: formData.sku,
        barcode: formData.barcode,
        name: formData.name,
        categoryId: formData.categoryId,
        unit: formData.unit,
        costPrice: Number(formData.costPrice),
        sellingPrice: Number(formData.sellingPrice),
        minStock: Number(formData.minStock),
        updatedAt: now,
      });

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'UPDATE_PRODUCT',
        category: 'PRODUCTS',
        details: `Produk diubah: ${formData.name} (${formData.sku})`,
      });

      showToast(`Produk ${formData.name} berhasil diperbarui!`, 'success');
    } else {
      // Create
      const newId = `PRD-${Date.now()}`;
      const newProduct: Product = {
        id: newId,
        sku: formData.sku,
        barcode: formData.barcode,
        name: formData.name,
        categoryId: formData.categoryId,
        unit: formData.unit,
        costPrice: Number(formData.costPrice),
        sellingPrice: Number(formData.sellingPrice),
        minStock: Number(formData.minStock),
        currentStock: Number(formData.initialStock),
        avgCostPrice: Number(formData.costPrice),
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      await db.products.add(newProduct);

      // Create initial batch if initial stock > 0
      if (formData.initialStock > 0) {
        await db.fifoBatches.add({
          id: `BATCH-INIT-${Date.now()}`,
          productId: newId,
          purchaseRefId: 'STOK_AWAL',
          dateReceived: now,
          initialQty: Number(formData.initialStock),
          remainingQty: Number(formData.initialStock),
          costPerUnit: Number(formData.costPrice),
          status: 'ACTIVE',
        });
      }

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'CREATE_PRODUCT',
        category: 'PRODUCTS',
        details: `Produk baru ditambahkan: ${formData.name} (${formData.sku})`,
      });

      showToast(`Produk baru ${formData.name} berhasil ditambahkan!`, 'success');
    }

    setIsModalOpen(false);
    loadData();
  };

  const handleToggleActive = async (p: Product) => {
    const newStatus = !p.active;
    await db.products.update(p.id, { active: newStatus, updatedAt: new Date().toISOString() });
    showToast(
      `Produk "${p.name}" ${newStatus ? 'diaktifkan kembali' : 'dinonaktifkan (arsip)'}`,
      'info'
    );
    loadData();
  };

  const handleDeleteSingleProduct = async () => {
    if (!productToDelete) return;

    try {
      const now = new Date().toISOString();
      const p = productToDelete;

      // Delete product and associated FIFO batches
      await db.products.delete(p.id);
      await db.fifoBatches.where('productId').equals(p.id).delete();

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'DELETE_PRODUCT',
        category: 'PRODUCTS',
        details: `Produk dihapus: ${p.name} (SKU: ${p.sku})`,
      });

      showToast(`Produk "${p.name}" berhasil dihapus dari sistem.`, 'success');
      setProductToDelete(null);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus produk: ' + err.message, 'error');
    }
  };

  const handleDeleteAllProducts = async () => {
    try {
      const totalCount = products.length;
      if (totalCount === 0) {
        showToast('Tidak ada data produk untuk dihapus.', 'info');
        return;
      }

      const now = new Date().toISOString();

      // Clear all products and FIFO batches in a transaction
      await db.transaction('rw', [db.products, db.fifoBatches, db.auditLogs], async () => {
        await db.products.clear();
        await db.fifoBatches.clear();

        await db.auditLogs.add({
          id: `AUD-${Date.now()}`,
          timestamp: now,
          userId: activeUser.id,
          userName: activeUser.name,
          action: 'DELETE_ALL_PRODUCTS',
          category: 'PRODUCTS',
          details: `Hapus semua produk: ${totalCount} produk dan batch inventaris dibersihkan dari database.`,
        });
      });

      showToast(`Semua data produk (${totalCount} item) berhasil dihapus bersih.`, 'success');
      setIsDeleteAllModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus seluruh data produk: ' + err.message, 'error');
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'SKU', 'Barcode', 'Nama Produk', 'Kategori', 'Satuan', 'Harga Beli', 'Harga Jual', 'Stok'];
    const rows = products.map((p) => {
      const cat = categories.find((c) => c.id === p.categoryId)?.name || '';
      return [
        p.id,
        `"${p.sku}"`,
        `"${p.barcode}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${cat}"`,
        p.unit,
        p.costPrice,
        p.sellingPrice,
        p.currentStock,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Master_Produk_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Katalog produk diekspor ke CSV', 'success');
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCat === 'ALL' || p.categoryId === selectedCat;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);
    return matchCat && matchSearch;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Master Data Produk</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola katalog barang, barcode scanner, harga beli, harga jual, dan status aktif
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {products.length > 0 && (
            <button
              onClick={() => setIsDeleteAllModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-semibold text-xs shadow-xs cursor-pointer min-h-[38px] transition-colors"
              title="Hapus Seluruh Master Data Produk"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Hapus Semua Data</span>
            </button>
          )}
          <button
            onClick={() => setIsCSVModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 font-semibold text-xs shadow-xs cursor-pointer min-h-[38px] transition-colors"
            title="Import File CSV Produk"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Impor CSV</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs cursor-pointer min-h-[38px]"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={handlePrintBulkBarcodes}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs cursor-pointer min-h-[38px]"
            title="Cetak Barcode Seluruh Produk Aktif"
          >
            <Barcode className="w-4 h-4 text-emerald-600" />
            <span>Cetak Barcode</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama barang, barcode, SKU..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs overflow-x-auto max-w-full">
          <span className="text-slate-500 font-medium shrink-0">Kategori:</span>
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Nama Produk</th>
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Satuan</th>
                <th className="py-3 px-4 text-right">Harga Beli</th>
                <th className="py-3 px-4 text-right">Harga Jual</th>
                <th className="py-3 px-4 text-right">Stok Fisik</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const catName = categories.find((c) => c.id === p.categoryId)?.name || '-';
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      <div>{p.sku}</div>
                      <div className="text-[10px] text-slate-400">{p.barcode}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{catName}</td>
                    <td className="py-3 px-4 text-slate-600">{p.unit}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-600">
                      Rp {p.costPrice.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700">
                      Rp {p.sellingPrice.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {p.currentStock}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {p.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handlePrintSingleBarcode(p)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 text-emerald-600 transition-colors cursor-pointer"
                          title="Cetak Barcode Label (SKU)"
                        >
                          <Barcode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="Ubah Produk (Edit)"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            p.active
                              ? 'border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                          title={p.active ? 'Nonaktifkan Produk' : 'Aktifkan Produk'}
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setProductToDelete(p)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Hapus Produk (Delete)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Form Tambah / Edit Produk */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingProduct ? 'Ubah Data Produk (Edit)' : 'Tambah Produk Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Produk:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Beras Rojo Lele 5kg"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SKU Unik:</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Barcode:</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kategori:</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Satuan Kemasan:</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="Pcs, Kg, Pouch, Botol..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Harga Beli Ref (Rp):</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Harga Jual Kasir (Rp):</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, sellingPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Batas Minimum Alert:</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                {!editingProduct && (
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Stok Fisik Awal:</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.initialStock}
                      onChange={(e) =>
                        setFormData({ ...formData, initialStock: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleSaveProduct}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                {editingProduct ? 'Simpan Perubahan' : 'Tambahkan Produk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Print Modal */}
      <BarcodePrintModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        items={barcodeModalItems}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        categories={categories}
        onImportSuccess={() => loadData()}
      />

      {/* Confirmation Modal: Single Product Delete */}
      <ConfirmModal
        isOpen={!!productToDelete}
        title="Hapus Produk"
        message={`Apakah Anda yakin ingin menghapus produk "${productToDelete?.name}" (${productToDelete?.sku})? Tindakan ini akan menghapus data produk dan batch stok inventaris terkait secara permanen.`}
        confirmText="Hapus Produk"
        cancelText="Batal"
        isDestructive={true}
        onConfirm={handleDeleteSingleProduct}
        onClose={() => setProductToDelete(null)}
      />

      {/* Confirmation Modal: Delete All Products */}
      <ConfirmModal
        isOpen={isDeleteAllModalOpen}
        title="Hapus Seluruh Data Produk"
        message={`PERINGATAN: Tindakan ini akan menghapus SELURUH ${products.length} master produk dan seluruh batch stok inventaris secara permanen dari database. Anda dapat mengimpor ulang data melalui file CSV setelahnya.`}
        confirmText={`Hapus Semua (${products.length} Produk)`}
        cancelText="Batal"
        isDestructive={true}
        onConfirm={handleDeleteAllProducts}
        onClose={() => setIsDeleteAllModalOpen(false)}
      />
    </div>
  );
};

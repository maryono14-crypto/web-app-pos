import React, { useEffect, useState } from 'react';
import { db } from '../../db/indexedDB';
import {
  Category,
  CostingMethod,
  FifoBatch,
  InventoryLog,
  Product,
  StockMovementType,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { adjustProductStock } from '../../services/inventoryEngine';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Package,
  Plus,
  AlertTriangle,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  X,
  History,
  Sliders,
  DollarSign,
  Edit,
  Trash2,
  PowerOff,
  Download,
  Info,
  Sparkles,
  Calculator,
  RefreshCw,
  Barcode,
} from 'lucide-react';
import { BarcodePrintModal, BarcodePrintItem } from '../products/BarcodePrintModal';

export const InventoryView: React.FC = () => {
  const { settings, refreshSettings, activeUser, showToast } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allBatches, setAllBatches] = useState<FifoBatch[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Modals
  // 1. Product Form (CRUD: Create & Update)
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
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

  // 2. Delete / Deactivate (CRUD: Delete)
  const [deleteTargetProduct, setDeleteTargetProduct] = useState<Product | null>(null);

  // 3. Stock Card Modal
  const [stockCardProduct, setStockCardProduct] = useState<Product | null>(null);
  const [productLogs, setProductLogs] = useState<InventoryLog[]>([]);

  // 4. FIFO Batches Modal
  const [fifoBatchProduct, setFifoBatchProduct] = useState<Product | null>(null);
  const [batchesForProduct, setBatchesForProduct] = useState<FifoBatch[]>([]);

  // 5. Stock Opname / Adjustment Modal
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null);
  const [adjustQtyInput, setAdjustQtyInput] = useState('');
  const [adjustReason, setAdjustReason] = useState<StockMovementType>('OPNAME');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // 6. Barcode Printing Modal
  const [barcodeModalItems, setBarcodeModalItems] = useState<BarcodePrintItem[]>([]);
  const [isBarcodeModalOpen, setBarcodeModalOpen] = useState(false);

  // Load all master data
  const loadData = async () => {
    const [pList, cList, bList] = await Promise.all([
      db.products.toArray(),
      db.categories.toArray(),
      db.fifoBatches.toArray(),
    ]);
    setProducts(pList);
    setCategories(cList);
    setAllBatches(bList);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Switch costing method via AppContext
  const handleCostingMethodChange = async (newMethod: CostingMethod) => {
    if (activeUser.role === 'CASHIER') {
      showToast('Hanya Owner atau Manager yang dapat mengubah metode HPP.', 'error');
      return;
    }

    try {
      const currentConfig = await db.settings.get('current_config');
      if (currentConfig) {
        await db.settings.put({
          ...currentConfig,
          costingMethod: newMethod,
        });

        await db.auditLogs.add({
          id: `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: activeUser.id,
          userName: activeUser.name,
          action: 'SWITCH_COSTING_METHOD',
          category: 'SETTINGS',
          details: `Metode HPP diubah menjadi: ${newMethod} oleh ${activeUser.name}`,
        });

        await refreshSettings();
        showToast(`Metode HPP berhasil diubah ke: ${newMethod}`, 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengubah metode HPP', 'error');
    }
  };

  // CRUD: Open Create Modal
  const openCreateProduct = () => {
    setEditingProduct(null);
    const skuAuto = `SKU-${Date.now().toString().slice(-6)}`;
    const barcodeAuto = `899${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    setProductForm({
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
    setProductModalOpen(true);
  };

  // CRUD: Open Edit Modal
  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
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
    setProductModalOpen(true);
  };

  // CRUD: Save Product (Create or Update)
  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.sku.trim()) {
      showToast('Nama produk dan SKU wajib diisi', 'error');
      return;
    }

    // SKU uniqueness validation
    const existingSku = products.find(
      (p) =>
        p.sku.toLowerCase() === productForm.sku.toLowerCase() &&
        p.id !== editingProduct?.id
    );
    if (existingSku) {
      showToast(`SKU "${productForm.sku}" sudah digunakan oleh produk lain.`, 'error');
      return;
    }

    const now = new Date().toISOString();

    if (editingProduct) {
      // Update existing
      await db.products.update(editingProduct.id, {
        sku: productForm.sku,
        barcode: productForm.barcode,
        name: productForm.name,
        categoryId: productForm.categoryId,
        unit: productForm.unit,
        costPrice: Number(productForm.costPrice),
        sellingPrice: Number(productForm.sellingPrice),
        minStock: Number(productForm.minStock),
        updatedAt: now,
      });

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'UPDATE_PRODUCT',
        category: 'INVENTORY',
        details: `Produk "${productForm.name}" diperbarui oleh ${activeUser.name}`,
      });

      showToast(`Produk "${productForm.name}" berhasil diperbarui!`, 'success');
    } else {
      // Create new product
      const newId = `PRD-${Date.now()}`;
      const initStock = Number(productForm.initialStock) || 0;
      const cost = Number(productForm.costPrice) || 0;

      const newProduct: Product = {
        id: newId,
        sku: productForm.sku,
        barcode: productForm.barcode,
        name: productForm.name,
        categoryId: productForm.categoryId || (categories[0]?.id ?? 'CAT-01'),
        unit: productForm.unit,
        costPrice: cost,
        sellingPrice: Number(productForm.sellingPrice),
        minStock: Number(productForm.minStock),
        currentStock: initStock,
        avgCostPrice: cost,
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      await db.products.add(newProduct);

      // Create initial FIFO batch if initialStock > 0
      if (initStock > 0) {
        await db.fifoBatches.add({
          id: `BATCH-${Date.now()}`,
          productId: newId,
          purchaseRefId: 'SALDO_AWAL',
          dateReceived: now,
          initialQty: initStock,
          remainingQty: initStock,
          costPerUnit: cost,
          status: 'ACTIVE',
        });

        // Add initial inventory log
        await db.inventoryLogs.add({
          id: `LOG-INIT-${Date.now()}`,
          productId: newId,
          productName: newProduct.name,
          sku: newProduct.sku,
          timestamp: now,
          type: 'PENYESUAIAN_MASUK',
          qtyIn: initStock,
          qtyOut: 0,
          balanceAfter: initStock,
          costValue: initStock * cost,
          referenceId: 'SALDO_AWAL',
          userId: activeUser.id,
          userName: activeUser.name,
          note: `Saldo awal stok produk baru (${initStock} ${newProduct.unit})`,
        });
      }

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'CREATE_PRODUCT',
        category: 'INVENTORY',
        details: `Produk baru dibuat: ${newProduct.name} (${newProduct.sku}) dengan stok awal ${initStock}`,
      });

      showToast(`Produk "${newProduct.name}" berhasil ditambahkan!`, 'success');
    }

    setProductModalOpen(false);
    await loadData();
  };

  // CRUD: Delete / Deactivate Product
  const handleConfirmDelete = async () => {
    if (!deleteTargetProduct) return;

    if (activeUser.role === 'CASHIER') {
      showToast('Kasir tidak diizinkan menghapus atau menonaktifkan produk.', 'error');
      setDeleteTargetProduct(null);
      return;
    }

    try {
      // Toggle active status as per PRD rule (preserve historical transaction integrity)
      const newStatus = !deleteTargetProduct.active;
      await db.products.update(deleteTargetProduct.id, {
        active: newStatus,
        updatedAt: new Date().toISOString(),
      });

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: newStatus ? 'RESTORE_PRODUCT' : 'DEACTIVATE_PRODUCT',
        category: 'INVENTORY',
        details: `Produk "${deleteTargetProduct.name}" ${
          newStatus ? 'diaktifkan kembali' : 'dinonaktifkan (arsip)'
        } oleh ${activeUser.name}`,
      });

      showToast(
        `Produk "${deleteTargetProduct.name}" ${
          newStatus ? 'berhasil diaktifkan kembali' : 'berhasil dinonaktifkan'
        }.`,
        'info'
      );
      setDeleteTargetProduct(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengubah status produk', 'error');
    }
  };

  // Open Stock Card (Log Mutasi)
  const openStockCard = async (p: Product) => {
    setStockCardProduct(p);
    const logs = await db.inventoryLogs
      .where('productId')
      .equals(p.id)
      .reverse()
      .sortBy('timestamp');
    setProductLogs(logs);
  };

  // Open FIFO Batches modal
  const openFifoBatches = async (p: Product) => {
    setFifoBatchProduct(p);
    const bList = await db.fifoBatches
      .where('productId')
      .equals(p.id)
      .sortBy('dateReceived');
    setBatchesForProduct(bList);
  };

  // Barcode Printing Handlers
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

  // Open Stock Opname Modal
  const openAdjustment = (p: Product) => {
    setAdjustmentProduct(p);
    setAdjustQtyInput(p.currentStock.toString());
    setAdjustReason('OPNAME');
    setAdjustNotes('');
  };

  // Save Stock Opname
  const handleSaveAdjustment = async () => {
    if (!adjustmentProduct) return;
    const actualQty = parseInt(adjustQtyInput, 10);
    if (isNaN(actualQty) || actualQty < 0) {
      showToast('Kuantitas fisik tidak valid', 'error');
      return;
    }

    try {
      setIsSubmittingAdjust(true);
      await adjustProductStock(
        adjustmentProduct.id,
        actualQty,
        adjustReason,
        adjustNotes,
        activeUser.id,
        activeUser.name
      );

      showToast(`Penyesuaian stok ${adjustmentProduct.name} berhasil disimpan!`, 'success');
      setAdjustmentProduct(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan penyesuaian stok', 'error');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Export CSV Helper
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'SKU',
      'Barcode',
      'Nama Produk',
      'Kategori',
      'Satuan',
      'Stok Fisik',
      'Min Stok',
      'HPP FIFO',
      'HPP Average',
      'Harga Jual',
      'Valuasi Stok',
      'Status',
    ];

    const rows = products.map((p) => {
      const cat = categories.find((c) => c.id === p.categoryId)?.name || '';
      const fifoCost = getProductFifoCost(p.id, p.costPrice);
      const avgCost = p.avgCostPrice || p.costPrice;
      const activeCost = settings?.costingMethod === 'FIFO' ? fifoCost : avgCost;
      const val = p.currentStock * activeCost;

      return [
        p.id,
        `"${p.sku}"`,
        `"${p.barcode}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${cat}"`,
        p.unit,
        p.currentStock,
        p.minStock,
        fifoCost,
        avgCost,
        p.sellingPrice,
        val,
        p.active ? 'AKTIF' : 'NONAKTIF',
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inventaris_HPP_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Data inventaris & HPP berhasil diekspor ke CSV', 'success');
  };

  // Helper: Get FIFO cost for a product (cost of oldest remaining active batch)
  const getProductFifoCost = (productId: string, fallbackCost: number): number => {
    const activeProductBatches = allBatches
      .filter((b) => b.productId === productId && b.status === 'ACTIVE' && b.remainingQty > 0)
      .sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime());

    return activeProductBatches.length > 0
      ? activeProductBatches[0].costPerUnit
      : fallbackCost;
  };

  // Calculations for KPI Summary
  const activeMethod = settings?.costingMethod || 'FIFO';

  const totalValuationFifo = products.reduce((sum, p) => {
    const fifoCost = getProductFifoCost(p.id, p.costPrice);
    return sum + p.currentStock * fifoCost;
  }, 0);

  const totalValuationAverage = products.reduce((sum, p) => {
    const avgCost = p.avgCostPrice || p.costPrice;
    return sum + p.currentStock * avgCost;
  }, 0);

  const activeTotalValuation =
    activeMethod === 'FIFO' ? totalValuationFifo : totalValuationAverage;

  const lowStockCount = products.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStock)
    .length;
  const outOfStockCount = products.filter((p) => p.currentStock <= 0).length;

  // Average potential margin across all products
  const avgMarginPotential =
    products.length > 0
      ? products.reduce((sum, p) => {
          const cost =
            activeMethod === 'FIFO'
              ? getProductFifoCost(p.id, p.costPrice)
              : p.avgCostPrice || p.costPrice;
          const margin = p.sellingPrice > 0 ? ((p.sellingPrice - cost) / p.sellingPrice) * 100 : 0;
          return sum + margin;
        }, 0) / products.length
      : 0;

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);

    const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;

    let matchesStatus = true;
    if (filterType === 'LOW') matchesStatus = p.currentStock > 0 && p.currentStock <= p.minStock;
    if (filterType === 'OUT') matchesStatus = p.currentStock <= 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header with Title & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">Manajemen Inventaris & Biaya HPP</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {products.length} SKU
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola katalog barang, mutasi stok, kartu stok, batch FIFO, moving average, dan opname
            fisik
          </p>
        </div>

        {/* Costing Method Switcher & CRUD Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Method Selector Pill */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-bold">
            <span className="text-[11px] text-slate-500 px-2 font-medium">Metode HPP:</span>
            <button
              onClick={() => handleCostingMethodChange('FIFO')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeMethod === 'FIFO'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="First In, First Out (Lot Batch Tertua)"
            >
              FIFO
            </button>
            <button
              onClick={() => handleCostingMethodChange('AVERAGE')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeMethod === 'AVERAGE'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Moving Weighted Average (Biaya Rata-rata Tertimbang)"
            >
              Moving Average
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs cursor-pointer"
            title="Ekspor CSV Inventaris"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>

          {/* Cetak Barcode Massal */}
          <button
            onClick={handlePrintBulkBarcodes}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs cursor-pointer"
            title="Cetak Label Barcode Massal Seluruh Produk Aktif"
          >
            <Barcode className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Cetak Barcode</span>
          </button>

          {/* Create Product Button */}
          <button
            onClick={openCreateProduct}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics & Costing Comparison Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Total Valuation */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Total Valuasi ({activeMethod})</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            Rp {activeTotalValuation.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500">
            Nilai aset dari {products.reduce((s, p) => s + p.currentStock, 0)} unit fisik
          </p>
        </div>

        {/* Costing Comparison */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Komparasi FIFO vs Average</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex justify-between items-baseline pt-0.5 text-xs">
            <span className="text-slate-600">FIFO:</span>
            <span className="font-bold text-slate-900">
              Rp {totalValuationFifo.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-slate-600">Average:</span>
            <span className="font-bold text-slate-900">
              Rp {totalValuationAverage.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Average Potential Margin */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Rata-rata Margin Produk</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">
            {avgMarginPotential.toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-500">(Harga Jual - HPP) / Harga Jual</p>
        </div>

        {/* Stock Status Alert Box */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-semibold">Kesehatan Stok</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-sm font-black text-amber-700">
              {lowStockCount} Menipis
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-sm font-black text-rose-600">
              {outOfStockCount} Habis
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold">
            {products.length - lowStockCount - outOfStockCount} SKU dalam status aman
          </p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between shadow-2xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama barang, barcode, SKU..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end text-xs">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['ALL', 'LOW', 'OUT'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  filterType === t
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'ALL' ? 'Semua' : t === 'LOW' ? 'Menipis' : 'Habis'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Main Inventory & Costing Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Produk & SKU</th>
                <th className="py-3 px-4">Satuan</th>
                <th className="py-3 px-4 text-right">Stok Fisik</th>
                <th className="py-3 px-4 text-right">Min. Stok</th>
                <th className="py-3 px-4 text-right">HPP Aktif ({activeMethod})</th>
                <th className="py-3 px-4 text-right">HPP FIFO / Avg</th>
                <th className="py-3 px-4 text-right">Harga Jual (Margin)</th>
                <th className="py-3 px-4 text-right">Valuasi Stok</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-slate-600">Tidak ada produk ditemukan.</p>
                    <p className="text-[11px] mt-0.5">
                      Gunakan tombol "Tambah Produk" untuk menambahkan barang baru.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.currentStock <= 0;
                  const isLow = p.currentStock > 0 && p.currentStock <= p.minStock;
                  const catName = categories.find((c) => c.id === p.categoryId)?.name || '';

                  // Costs
                  const fifoCost = getProductFifoCost(p.id, p.costPrice);
                  const avgCost = p.avgCostPrice || p.costPrice;
                  const activeCost = activeMethod === 'FIFO' ? fifoCost : avgCost;
                  const lineValuation = p.currentStock * activeCost;
                  const marginPct =
                    p.sellingPrice > 0
                      ? Math.round(((p.sellingPrice - activeCost) / p.sellingPrice) * 100)
                      : 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !p.active ? 'bg-slate-50 opacity-60' : ''
                      }`}
                    >
                      {/* Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {!p.active && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 text-slate-600 font-normal">
                              Nonaktif
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                          <span>{p.sku}</span>
                          {catName && (
                            <span className="text-[10px] text-slate-400 font-sans">
                              &bull; {catName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-4 text-slate-600 font-medium">{p.unit}</td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 text-right font-black text-sm text-slate-900">
                        {p.currentStock}
                      </td>

                      {/* Min Stock */}
                      <td className="py-3 px-4 text-right text-slate-500 font-medium">
                        {p.minStock}
                      </td>

                      {/* Active HPP */}
                      <td className="py-3 px-4 text-right font-bold text-purple-700">
                        Rp {activeCost.toLocaleString('id-ID')}
                      </td>

                      {/* FIFO vs Average Details */}
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                        <div>FIFO: Rp {fifoCost.toLocaleString('id-ID')}</div>
                        <div className="text-[10px] text-slate-400">
                          Avg: Rp {avgCost.toLocaleString('id-ID')}
                        </div>
                      </td>

                      {/* Selling Price & Margin */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-emerald-700">
                          Rp {p.sellingPrice.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Margin: {marginPct}%
                        </div>
                      </td>

                      {/* Stock Valuation */}
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        Rp {lineValuation.toLocaleString('id-ID')}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            Habis
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Menipis
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                            Aman
                          </span>
                        )}
                      </td>

                      {/* Actions: CRUD (Edit/Delete) + Stock Ops (Opname/Card/Batches) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {/* Edit Product (CRUD) */}
                          <button
                            onClick={() => openEditProduct(p)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Ubah Produk (Edit)"
                          >
                            <Edit className="w-3.5 h-3.5 text-slate-700" />
                          </button>

                          {/* Stock Opname Adjustment */}
                          <button
                            onClick={() => openAdjustment(p)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 text-emerald-600 transition-colors cursor-pointer"
                            title="Penyesuaian Stok / Opname"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Stock Card (History) */}
                          <button
                            onClick={() => openStockCard(p)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 text-blue-600 transition-colors cursor-pointer"
                            title="Kartu Stok (Riwayat Mutasi)"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {/* FIFO Batches */}
                          <button
                            onClick={() => openFifoBatches(p)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-purple-50 text-purple-600 transition-colors cursor-pointer"
                            title="Lihat Batch FIFO"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>

                          {/* Print Barcode */}
                          <button
                            onClick={() => handlePrintSingleBarcode(p)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 text-emerald-600 transition-colors cursor-pointer"
                            title="Cetak Barcode Label (SKU)"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete / Deactivate (CRUD) */}
                          <button
                            onClick={() => setDeleteTargetProduct(p)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              p.active
                                ? 'border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }`}
                            title={p.active ? 'Nonaktifkan Produk' : 'Aktifkan Kembali'}
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                          </button>
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

      {/* 5. CRUD Modal: Form Tambah / Edit Produk */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingProduct ? 'Ubah Data Produk' : 'Tambah Produk Baru'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingProduct
                    ? 'Perbarui informasi produk dan harga'
                    : 'Tambahkan produk beserta saldo stok awal dan HPP'}
                </p>
              </div>
              <button
                onClick={() => setProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Produk:</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Contoh: Kopi Bubuk Arabika 250g"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SKU Unik:</label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Barcode Scanner:</label>
                  <input
                    type="text"
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kategori:</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
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
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    placeholder="Pcs, Kg, Pouch, Botol..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Harga Beli / HPP Awal (Rp):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.costPrice}
                    onChange={(e) =>
                      setProductForm({ ...productForm, costPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-purple-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Harga Jual Kasir (Rp):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.sellingPrice}
                    onChange={(e) =>
                      setProductForm({ ...productForm, sellingPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Batas Minimum Alert:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={productForm.minStock}
                    onChange={(e) =>
                      setProductForm({ ...productForm, minStock: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                {!editingProduct && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Saldo Fisik Awal:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.initialStock}
                      onChange={(e) =>
                        setProductForm({ ...productForm, initialStock: Number(e.target.value) })
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setProductModalOpen(false)}
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

      {/* 6. Kartu Stok Modal */}
      {stockCardProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Kartu Stok: {stockCardProduct.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  SKU: {stockCardProduct.sku} &bull; Saldo Saat Ini: {stockCardProduct.currentStock}{' '}
                  {stockCardProduct.unit}
                </p>
              </div>
              <button
                onClick={() => setStockCardProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {productLogs.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">
                  Belum ada log pergerakan stok untuk produk ini.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {productLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              log.qtyIn > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.type}
                          </span>
                          <span className="font-mono text-slate-400 text-[11px]">
                            {new Date(log.timestamp).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-1">{log.note}</p>
                        <p className="text-[10px] text-slate-400">
                          Ref: {log.referenceId} &bull; Oleh: {log.userName}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-black text-sm ${
                            log.qtyIn > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {log.qtyIn > 0 ? `+${log.qtyIn}` : `-${log.qtyOut}`} {stockCardProduct.unit}
                        </span>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Saldo: {log.balanceAfter}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setStockCardProduct(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. FIFO Batches Modal */}
      {fifoBatchProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Batch FIFO: {fifoBatchProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Urutan pembebanan HPP tertua (First-In, First-Out)
                </p>
              </div>
              <button
                onClick={() => setFifoBatchProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {batchesForProduct.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">
                  Tidak ada data batch tersimpan.
                </p>
              ) : (
                <div className="space-y-2">
                  {batchesForProduct.map((b, idx) => (
                    <div
                      key={b.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        b.status === 'ACTIVE'
                          ? 'bg-purple-50/50 border-purple-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 font-mono">
                            Batch #{idx + 1} ({b.id})
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              b.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Masuk: {new Date(b.dateReceived).toLocaleDateString('id-ID')} &bull; Ref:{' '}
                          {b.purchaseRefId}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-slate-900">
                          Sisa: {b.remainingQty} / {b.initialQty} {fifoBatchProduct.unit}
                        </div>
                        <div className="text-[11px] font-semibold text-purple-700">
                          @ Rp {b.costPerUnit.toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setFifoBatchProduct(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Penyesuaian Stok / Opname Modal */}
      {adjustmentProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Penyesuaian Stok / Opname</h3>
                <p className="text-xs text-slate-500">{adjustmentProduct.name}</p>
              </div>
              <button
                onClick={() => setAdjustmentProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-600">Stok Sistem Saat Ini:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {adjustmentProduct.currentStock} {adjustmentProduct.unit}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hasil Hitungan Fisik Aktual:
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustQtyInput}
                  onChange={(e) => setAdjustQtyInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Penyesuaian:
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as StockMovementType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="OPNAME">Stok Opname Fisik Bulanan</option>
                  <option value="RUSAK_HILANG">Barang Rusak / Kadaluarsa / Hilang</option>
                  <option value="PENYESUAIAN_MASUK">Koreksi Masuk (Barang Ditemukan)</option>
                  <option value="PENYESUAIAN_KELUAR">Koreksi Keluar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan / Keterangan:
                </label>
                <textarea
                  rows={2}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Contoh: Ditemukan 1 botol pecah di rak pojok"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setAdjustmentProduct(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                disabled={isSubmittingAdjust}
                onClick={handleSaveAdjustment}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingAdjust ? 'Menyimpan...' : 'Posting Penyesuaian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Deactivate / Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTargetProduct}
        title={
          deleteTargetProduct?.active
            ? 'Nonaktifkan Produk?'
            : 'Aktifkan Kembali Produk?'
        }
        message={
          deleteTargetProduct?.active
            ? `Apakah Anda yakin ingin menonaktifkan produk "${deleteTargetProduct?.name}"? Produk tidak akan muncul di kasir POS namun riwayat transaksi tetap utuh.`
            : `Aktifkan kembali produk "${deleteTargetProduct?.name}" agar dapat dijual di kasir POS?`
        }
        confirmText={deleteTargetProduct?.active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
        cancelText="Batal"
        isDestructive={deleteTargetProduct?.active}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTargetProduct(null)}
      />

      {/* 10. Barcode Print Modal */}
      <BarcodePrintModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        items={barcodeModalItems}
      />
    </div>
  );
};

// Also export as InventoryManagement for named convenience
export const InventoryManagement = InventoryView;
export default InventoryView;

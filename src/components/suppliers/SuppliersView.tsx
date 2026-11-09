import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../db/indexedDB';
import { Product, Purchase, PurchaseItem, Supplier } from '../../types';
import { useApp } from '../../context/AppContext';
import { receivePurchaseGoods } from '../../services/inventoryEngine';
import { downloadCsv } from '../../utils/exportHelpers';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Building2,
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  User,
  Package,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  PackageCheck,
  Download,
  X,
  History,
  DollarSign,
  TrendingUp,
  FileText,
  ArrowRight,
  Eye,
} from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const { activeUser, settings, showToast } = useApp();

  // Data states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Navigation tab: 'ALL_SUPPLIERS' or selected supplier detail
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [poFilterStatus, setPoFilterStatus] = useState<'ALL' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'>('ALL');

  // Supplier Add / Edit Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
  });

  // Delete Confirmation Modal
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // New Incoming Supply Order (Purchase Order) Modal
  const [isNewPoOpen, setNewPoOpen] = useState(false);
  const [targetSupplierForPo, setTargetSupplierForPo] = useState<string>('');
  const [poItems, setPoItems] = useState<
    { productId: string; qtyOrdered: number; costPerUnit: number }[]
  >([]);
  const [poNotes, setPoNotes] = useState('');

  // Receive Incoming Goods Modal
  const [receivePurchase, setReceivePurchase] = useState<Purchase | null>(null);
  const [receiveInputs, setReceiveInputs] = useState<Record<string, { qty: number; cost: number }>>({});
  const [isReceiving, setIsReceiving] = useState(false);

  // Purchase Order Detail View Modal
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);

  const loadData = async () => {
    const [sList, pList, prList] = await Promise.all([
      db.suppliers.toArray(),
      db.purchases.reverse().sortBy('date'),
      db.products.filter((p) => p.active).toArray(),
    ]);
    setSuppliers(sList);
    setPurchases(pList);
    setProducts(prList);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Aggregated Supplier Statistics
  const supplierStats = useMemo(() => {
    const map = new Map<
      string,
      {
        totalPurchased: number;
        poCount: number;
        incomingCount: number;
        lastOrderDate?: string;
      }
    >();

    purchases.forEach((po) => {
      const existing = map.get(po.supplierId) || {
        totalPurchased: 0,
        poCount: 0,
        incomingCount: 0,
      };

      existing.totalPurchased += po.totalAmount;
      existing.poCount += 1;
      if (po.status === 'ORDERED') {
        existing.incomingCount += 1;
      }
      if (!existing.lastOrderDate || po.date > existing.lastOrderDate) {
        existing.lastOrderDate = po.date;
      }

      map.set(po.supplierId, existing);
    });

    return map;
  }, [purchases]);

  // Overall KPIs
  const overallKPIs = useMemo(() => {
    const totalSuppliers = suppliers.length;
    let totalSpend = 0;
    let totalIncomingOrders = 0;
    let totalReceivedOrders = 0;

    purchases.forEach((po) => {
      totalSpend += po.totalAmount;
      if (po.status === 'ORDERED') totalIncomingOrders++;
      if (po.status === 'RECEIVED') totalReceivedOrders++;
    });

    return {
      totalSuppliers,
      totalSpend,
      totalIncomingOrders,
      totalReceivedOrders,
    };
  }, [suppliers, purchases]);

  // Filtered Suppliers list
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return suppliers.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
      );
    });
  }, [suppliers, searchQuery]);

  // Selected Supplier Object
  const currentSelectedSupplier = useMemo(() => {
    if (selectedSupplierId === 'ALL') return null;
    return suppliers.find((s) => s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  // Purchase orders belonging to currently selected supplier or all
  const filteredPurchases = useMemo(() => {
    return purchases.filter((po) => {
      if (selectedSupplierId !== 'ALL' && po.supplierId !== selectedSupplierId) {
        return false;
      }
      if (poFilterStatus !== 'ALL' && po.status !== poFilterStatus) {
        return false;
      }
      return true;
    });
  }, [purchases, selectedSupplierId, poFilterStatus]);

  // Open Add Supplier Modal
  const openAddSupplierModal = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
    });
    setIsSupplierModalOpen(true);
  };

  // Open Edit Supplier Modal
  const openEditSupplierModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupplierForm({
      name: sup.name,
      contactPerson: sup.contactPerson,
      phone: sup.phone,
      email: sup.email,
      address: sup.address,
    });
    setIsSupplierModalOpen(true);
  };

  // Save / Update Supplier
  const handleSaveSupplier = async () => {
    if (!supplierForm.name?.trim() || !supplierForm.phone?.trim()) {
      showToast('Nama perusahaan supplier dan nomor telepon/WA wajib diisi', 'error');
      return;
    }

    const now = new Date().toISOString();

    if (editingSupplier) {
      await db.suppliers.update(editingSupplier.id, {
        name: supplierForm.name.trim(),
        contactPerson: supplierForm.contactPerson?.trim() || '-',
        phone: supplierForm.phone.trim(),
        email: supplierForm.email?.trim() || '-',
        address: supplierForm.address?.trim() || '-',
      });

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'UPDATE_SUPPLIER',
        category: 'SUPPLIER',
        details: `Supplier diubah: ${supplierForm.name}`,
      });

      showToast(`Data supplier "${supplierForm.name}" berhasil diperbarui`, 'success');
    } else {
      const newSup: Supplier = {
        id: `SUP-${Date.now().toString().slice(-4)}`,
        name: supplierForm.name.trim(),
        contactPerson: supplierForm.contactPerson?.trim() || '-',
        phone: supplierForm.phone.trim(),
        email: supplierForm.email?.trim() || '-',
        address: supplierForm.address?.trim() || '-',
      };

      await db.suppliers.add(newSup);

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'CREATE_SUPPLIER',
        category: 'SUPPLIER',
        details: `Supplier baru ditambahkan: ${newSup.name} (PIC: ${newSup.contactPerson})`,
      });

      showToast(`Supplier baru "${newSup.name}" berhasil didaftarkan`, 'success');
    }

    setIsSupplierModalOpen(false);
    loadData();
  };

  // Delete Supplier
  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;

    try {
      const sup = supplierToDelete;
      await db.suppliers.delete(sup.id);

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'DELETE_SUPPLIER',
        category: 'SUPPLIER',
        details: `Supplier dihapus: ${sup.name} (${sup.id})`,
      });

      showToast(`Supplier "${sup.name}" berhasil dihapus`, 'success');
      if (selectedSupplierId === sup.id) {
        setSelectedSupplierId('ALL');
      }
      setSupplierToDelete(null);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus supplier: ' + err.message, 'error');
    }
  };

  // Open New PO Modal for a specific or any supplier
  const openNewPoModal = (supplierId?: string) => {
    const defaultSup = supplierId || (selectedSupplierId !== 'ALL' ? selectedSupplierId : suppliers[0]?.id || '');
    setTargetSupplierForPo(defaultSup);
    setPoItems([]);
    setPoNotes('');
    setNewPoOpen(true);
  };

  // Add Item to New PO
  const handleAddPoItem = (productId: string) => {
    const p = products.find((prod) => prod.id === productId);
    if (!p) return;
    if (poItems.some((i) => i.productId === productId)) {
      showToast('Produk sudah ada dalam daftar pesanan', 'info');
      return;
    }

    setPoItems((prev) => [
      ...prev,
      {
        productId: p.id,
        qtyOrdered: 10,
        costPerUnit: p.costPrice,
      },
    ]);
  };

  // Save and Issue New PO
  const handleCreatePO = async () => {
    if (!targetSupplierForPo) {
      showToast('Pilih supplier terlebih dahulu', 'error');
      return;
    }
    if (poItems.length === 0) {
      showToast('Tambahkan minimal 1 item produk pesanan', 'error');
      return;
    }

    const supplier = suppliers.find((s) => s.id === targetSupplierForPo);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const poCount = (await db.purchases.count()) + 1;
    const poNumber = `PO-${dateStr}-${poCount.toString().padStart(4, '0')}`;

    const items: PurchaseItem[] = poItems.map((item) => {
      const prod = products.find((p) => p.id === item.productId)!;
      return {
        productId: item.productId,
        sku: prod.sku,
        name: prod.name,
        unit: prod.unit,
        qtyOrdered: item.qtyOrdered,
        qtyReceived: 0,
        costPerUnit: item.costPerUnit,
        subtotal: item.qtyOrdered * item.costPerUnit,
      };
    });

    const totalAmount = items.reduce((s, i) => s + i.subtotal, 0);

    const newPO: Purchase = {
      id: `PUR-${Date.now()}`,
      purchaseNo: poNumber,
      supplierId: supplier!.id,
      supplierName: supplier!.name,
      date: new Date().toISOString(),
      status: 'ORDERED',
      items,
      totalAmount,
      additionalCost: 0,
      notes: poNotes,
      createdBy: activeUser.name,
      createdAt: new Date().toISOString(),
    };

    await db.purchases.add(newPO);

    await db.auditLogs.add({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: activeUser.id,
      userName: activeUser.name,
      action: 'CREATE_PURCHASE_ORDER',
      category: 'PURCHASING',
      details: `PO ${poNumber} diterbitkan untuk ${supplier!.name}. Total Rp ${totalAmount.toLocaleString('id-ID')} (${items.length} item)`,
    });

    showToast(`Pesanan pasokan ${poNumber} untuk ${supplier!.name} berhasil dibuat!`, 'success');
    setNewPoOpen(false);
    setPoItems([]);
    setPoNotes('');
    loadData();
  };

  // Open Receive Incoming Goods Modal
  const openReceiveModal = (p: Purchase) => {
    setReceivePurchase(p);
    const initialMap: Record<string, { qty: number; cost: number }> = {};
    p.items.forEach((item) => {
      initialMap[item.productId] = {
        qty: item.qtyOrdered,
        cost: item.costPerUnit,
      };
    });
    setReceiveInputs(initialMap);
  };

  // Post Received Goods into Warehouse Inventory
  const handlePostReceive = async () => {
    if (!receivePurchase) return;

    try {
      setIsReceiving(true);
      const itemsToReceive = receivePurchase.items.map((item) => ({
        productId: item.productId,
        qtyReceived: receiveInputs[item.productId]?.qty ?? item.qtyOrdered,
        costPerUnit: receiveInputs[item.productId]?.cost ?? item.costPerUnit,
      }));

      await receivePurchaseGoods(
        receivePurchase.id,
        itemsToReceive,
        activeUser.id,
        activeUser.name,
        settings?.costingMethod || 'FIFO'
      );

      showToast(
        `Barang PO ${receivePurchase.purchaseNo} dari ${receivePurchase.supplierName} berhasil diterima dan dimasukkan ke stok gudang!`,
        'success'
      );
      setReceivePurchase(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal posting penerimaan pasokan barang', 'error');
    } finally {
      setIsReceiving(false);
    }
  };

  // Export Suppliers & PO History to CSV
  const handleExportSuppliersCSV = () => {
    const headers = [
      'ID Supplier',
      'Nama Supplier / Vendor',
      'Kontak Person (PIC)',
      'No. Telepon / WhatsApp',
      'Email',
      'Alamat',
      'Total Nilai Pasokan (Rp)',
      'Jumlah PO Terbit',
      'Pesanan Sedang Dikirim',
    ];

    const rows = suppliers.map((s) => {
      const stats = supplierStats.get(s.id) || { totalPurchased: 0, poCount: 0, incomingCount: 0 };
      return [
        s.id,
        s.name,
        s.contactPerson,
        s.phone,
        s.email,
        s.address,
        stats.totalPurchased,
        stats.poCount,
        stats.incomingCount,
      ];
    });

    downloadCsv(`Master_Supplier_Rekap_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showToast('Data master supplier dan histori pembelian berhasil diekspor', 'success');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Manajemen Supplier &amp; Pasokan</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
              Supplier Management
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola detail kontak vendor mitra, pantau histori belanja grosir, dan terima pengiriman pasokan barang (PO)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportSuppliersCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs cursor-pointer min-h-[38px]"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={() => openNewPoModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer min-h-[38px]"
          >
            <Truck className="w-4 h-4" />
            <span>Pesan Pasokan (PO)</span>
          </button>
          <button
            onClick={openAddSupplierModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Supplier</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Suppliers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Total Mitra Supplier
            </span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-2 tabular-nums">
            {overallKPIs.totalSuppliers} Vendor
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Distributor &amp; agen kulakan</p>
        </div>

        {/* Total Spend */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Akumulasi Pembelian
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-2 tabular-nums">
            Rp {overallKPIs.totalSpend.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Dari {purchases.length} faktur PO belanja</p>
        </div>

        {/* Incoming Orders in Transit */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Pasokan Dalam Kiriman
            </span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-800 font-mono mt-2 tabular-nums">
            {overallKPIs.totalIncomingOrders} Pesanan
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Menunggu barang datang di gudang</p>
        </div>

        {/* Completed Deliveries */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Pasokan Telah Diterima
            </span>
            <div className="p-2 rounded-xl bg-teal-100 text-teal-700">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-2 tabular-nums">
            {overallKPIs.totalReceivedOrders} Selesai
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Stok &amp; HPP berhasil diperbarui</p>
        </div>
      </div>

      {/* 3. Supplier Selector & Search Header */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama supplier, PIC, nomor telepon, alamat..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto text-xs overflow-x-auto max-w-full">
          <span className="text-slate-500 font-medium shrink-0">Pilih Supplier:</span>
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
          >
            <option value="ALL">Semua Supplier ({suppliers.length})</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.contactPerson})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Supplier Contact Cards Grid (Top Row) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredSuppliers.map((sup) => {
          const stats = supplierStats.get(sup.id) || { totalPurchased: 0, poCount: 0, incomingCount: 0 };
          const isSelected = selectedSupplierId === sup.id;

          return (
            <div
              key={sup.id}
              className={`p-4 bg-white rounded-2xl border transition-all flex flex-col justify-between shadow-2xs ${
                isSelected
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Header: Name and Action Buttons */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                      <span>{sup.name}</span>
                    </h3>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">PIC: {sup.contactPerson}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditSupplierModal(sup)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                      title="Ubah Detail Kontak Supplier"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSupplierToDelete(sup)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Hapus Supplier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contact Information Details */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs space-y-1.5 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-800">{sup.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-700">{sup.email || '-'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {sup.address || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Spend Summary & Quick PO Button */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                    Total Pasokan:
                  </span>
                  <span className="font-mono font-bold text-xs text-emerald-700 tabular-nums">
                    Rp {stats.totalPurchased.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {stats.poCount} PO ({stats.incomingCount} Dikirim)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedSupplierId(isSelected ? 'ALL' : sup.id);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isSelected ? 'Tampilkan Semua' : 'Histori PO'}
                  </button>
                  <button
                    onClick={() => openNewPoModal(sup.id)}
                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer"
                    title="Buat PO Pasokan Baru untuk Supplier Ini"
                  >
                    <Truck className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Purchase History & Incoming Supply Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>
                Histori Pembelian &amp; Penerimaan Pasokan
                {currentSelectedSupplier ? ` — ${currentSelectedSupplier.name}` : ' (Seluruh Supplier)'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Daftar Purchase Order yang telah diterbitkan beserta status penerimaan barang fisik ke stok gudang
            </p>
          </div>

          {/* Status Filter for POs */}
          <div className="flex items-center gap-1.5 text-xs">
            {(['ALL', 'ORDERED', 'RECEIVED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setPoFilterStatus(st)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  poFilterStatus === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'ALL' ? 'Semua Status' : st === 'ORDERED' ? 'Dalam Kiriman' : 'Telah Diterima'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">No. PO &amp; Tanggal</th>
                <th className="py-3 px-4">Nama Supplier</th>
                <th className="py-3 px-4">Rincian Barang</th>
                <th className="py-3 px-4 text-right">Total Tagihan</th>
                <th className="py-3 px-4 text-center">Status Pasokan</th>
                <th className="py-3 px-4 text-center">Aksi Penerimaan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Truck className="w-10 h-10 mx-auto opacity-40 mb-2" />
                    <p className="font-semibold text-slate-600">Belum ada Purchase Order (PO) tercatat</p>
                    <p className="text-[11px] mt-0.5">
                      Klik tombol "Pesan Pasokan (PO)" untuk menerbitkan pesanan pasokan baru ke supplier.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((po) => {
                  const isOrdered = po.status === 'ORDERED';
                  const totalUnits = po.items.reduce((sum, item) => sum + item.qtyOrdered, 0);

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* PO Number & Date */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 font-mono">{po.purchaseNo}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {new Date(po.date).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Supplier Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{po.supplierName}</div>
                        <div className="text-[10px] text-slate-400">Dibuat oleh: {po.createdBy}</div>
                      </td>

                      {/* Items Summary */}
                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-medium text-slate-900">
                          {po.items.length} Macam Produk ({totalUnits} pcs)
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {po.items.map((i) => `${i.name} (x${i.qtyOrdered})`).join(', ')}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-black text-slate-900 font-mono tabular-nums">
                        Rp {po.totalAmount.toLocaleString('id-ID')}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            po.status === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : isOrdered
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {po.status === 'RECEIVED'
                            ? 'Diterima di Gudang'
                            : isOrdered
                            ? 'Dalam Pengiriman'
                            : po.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isOrdered ? (
                            <button
                              onClick={() => openReceiveModal(po)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                              title="Terima Barang & Masukkan ke Stok Gudang"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Terima Barang</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{po.receivedDate ? new Date(po.receivedDate).toLocaleDateString('id-ID') : 'Selesai'}</span>
                            </span>
                          )}
                          <button
                            onClick={() => setDetailPurchase(po)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Lihat Detail Pesanan PO"
                          >
                            <Eye className="w-3.5 h-3.5" />
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

      {/* 6. Modal: Tambah / Edit Supplier */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingSupplier ? 'Ubah Data Supplier' : 'Tambah Supplier Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Perusahaan / Supplier / Distributor:
                </label>
                <input
                  type="text"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="Contoh: PT Pangan Sentosa Nusantara"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kontak Person / PIC:</label>
                  <input
                    type="text"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    placeholder="Contoh: Bpk. Irwan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. Telepon / WhatsApp:</label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Alamat Email:</label>
                <input
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  placeholder="sales@supplier.co.id"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Alamat Kantor / Gudang:</label>
                <textarea
                  rows={2}
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="Jl. Pergudangan Industri Blok B..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl resize-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleSaveSupplier}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                {editingSupplier ? 'Simpan Perubahan' : 'Daftarkan Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Buat Pesanan Pasokan (PO) Baru */}
      {isNewPoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Buat Pesanan Pasokan Baru (Purchase Order)</h3>
                <p className="text-xs text-slate-500">
                  Stok barang fisik akan bertambah ke gudang saat penerimaan barang diposting
                </p>
              </div>
              <button onClick={() => setNewPoOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs flex-1 overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Supplier:</label>
                <select
                  value={targetSupplierForPo}
                  onChange={(e) => setTargetSupplierForPo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson} - {s.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Product selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tambahkan Produk ke Pesanan PO:
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPoItem(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pilih Produk Katalog untuk Dipesan --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stok Saat Ini: {p.currentStock} {p.unit} &bull; Harga Beli Ref: Rp {p.costPrice.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List in PO */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Nama Produk</th>
                      <th className="p-2.5 text-center">Qty Pesan</th>
                      <th className="p-2.5 text-right">Harga Beli Satuan (Rp)</th>
                      <th className="p-2.5 text-right">Subtotal (Rp)</th>
                      <th className="p-2.5 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {poItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          Belum ada item produk ditambahkan ke PO ini.
                        </td>
                      </tr>
                    ) : (
                      poItems.map((item, idx) => {
                        const prod = products.find((p) => p.id === item.productId)!;
                        return (
                          <tr key={item.productId}>
                            <td className="p-2.5 font-semibold text-slate-800">
                              <div>{prod.name}</div>
                              <span className="text-[10px] text-slate-400 font-mono">{prod.sku}</span>
                            </td>
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.qtyOrdered}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 1;
                                  setPoItems((prev) =>
                                    prev.map((i, iIdx) =>
                                      iIdx === idx ? { ...i, qtyOrdered: val } : i
                                    )
                                  );
                                }}
                                className="w-16 px-2 py-1 text-center bg-slate-100 border border-slate-200 rounded font-bold"
                              />
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={1}
                                value={item.costPerUnit}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setPoItems((prev) =>
                                    prev.map((i, iIdx) =>
                                      iIdx === idx ? { ...i, costPerUnit: val } : i
                                    )
                                  );
                                }}
                                className="w-24 px-2 py-1 text-right bg-slate-100 border border-slate-200 rounded font-semibold font-mono"
                              />
                            </td>
                            <td className="p-2.5 text-right font-black text-slate-900 font-mono tabular-nums">
                              Rp {(item.qtyOrdered * item.costPerUnit).toLocaleString('id-ID')}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() =>
                                  setPoItems((prev) => prev.filter((_, iIdx) => iIdx !== idx))
                                }
                                className="text-rose-500 hover:text-rose-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              {poItems.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700">Total Nilai Tagihan PO:</span>
                  <span className="font-black text-base text-slate-900 font-mono tabular-nums">
                    Rp{' '}
                    {poItems
                      .reduce((s, i) => s + i.qtyOrdered * i.costPerUnit, 0)
                      .toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Tambahan untuk Supplier:
                </label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Contoh: Estimasi sampai tanggal 15, kirim lewat ekspedisi langganan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setNewPoOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                disabled={poItems.length === 0}
                onClick={handleCreatePO}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Terbitkan Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Penerimaan Barang Pasokan (Receive Goods) */}
      {receivePurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Penerimaan Barang Pasokan: {receivePurchase.purchaseNo}
                </h3>
                <p className="text-xs text-slate-500">
                  Supplier: {receivePurchase.supplierName} &bull; Metode HPP: {settings?.costingMethod || 'FIFO'}
                </p>
              </div>
              <button onClick={() => setReceivePurchase(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs flex-1 overflow-y-auto">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  Periksa kondisi fisik barang dari supplier. Masukkan kuantitas aktual yang diterima dan sesuaikan harga beli faktur per unit untuk memperbarui nilai persediaan secara akurat.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Produk</th>
                      <th className="p-2.5 text-center">Pesan</th>
                      <th className="p-2.5 text-center">Qty Diterima Aktual</th>
                      <th className="p-2.5 text-right">Harga Beli Faktur (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receivePurchase.items.map((item) => (
                      <tr key={item.productId}>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800">{item.name}</span>
                          <span className="text-slate-400 block text-[10px] font-mono">{item.sku}</span>
                        </td>
                        <td className="p-2.5 text-center text-slate-500 font-semibold">
                          {item.qtyOrdered} {item.unit}
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            value={receiveInputs[item.productId]?.qty ?? item.qtyOrdered}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setReceiveInputs((prev) => ({
                                ...prev,
                                [item.productId]: {
                                  ...prev[item.productId],
                                  qty: val,
                                },
                              }));
                            }}
                            className="w-20 px-2 py-1 text-center bg-emerald-50 border border-emerald-300 rounded font-black text-emerald-900"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min={1}
                            value={receiveInputs[item.productId]?.cost ?? item.costPerUnit}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setReceiveInputs((prev) => ({
                                ...prev,
                                [item.productId]: {
                                  ...prev[item.productId],
                                  cost: val,
                                },
                              }));
                            }}
                            className="w-28 px-2 py-1 text-right bg-slate-100 border border-slate-200 rounded font-semibold text-slate-900 font-mono"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setReceivePurchase(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                disabled={isReceiving}
                onClick={handlePostReceive}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isReceiving ? 'Memproses Masuk Stok...' : 'Posting Penerimaan Barang ke Stok'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: Detail Pesanan PO */}
      {detailPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Rincian Purchase Order {detailPurchase.purchaseNo}
                </h3>
              </div>
              <button onClick={() => setDetailPurchase(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 overflow-y-auto">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier:</span>
                  <span className="font-bold text-slate-900">{detailPurchase.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal PO:</span>
                  <span className="text-slate-800">{new Date(detailPurchase.date).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Pasokan:</span>
                  <span className="font-bold text-emerald-700">{detailPurchase.status}</span>
                </div>
                {detailPurchase.notes && (
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Catatan:</span>
                    <span className="text-slate-700 italic">{detailPurchase.notes}</span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">Item Barang Dipesan</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                      <tr>
                        <th className="p-2">Produk</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Harga Beli</th>
                        <th className="p-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailPurchase.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-medium text-slate-900">{item.name}</td>
                          <td className="p-2 text-center font-mono">{item.qtyOrdered} {item.unit}</td>
                          <td className="p-2 text-right font-mono">Rp {item.costPerUnit.toLocaleString('id-ID')}</td>
                          <td className="p-2 text-right font-bold text-slate-900 font-mono">
                            Rp {item.subtotal.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase">Total Nilai Tagihan:</span>
                <span className="text-lg font-black text-emerald-400 font-mono tabular-nums">
                  Rp {detailPurchase.totalAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setDetailPurchase(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Confirmation Modal: Delete Supplier */}
      <ConfirmModal
        isOpen={!!supplierToDelete}
        title="Hapus Supplier"
        message={`Apakah Anda yakin ingin menghapus data supplier "${supplierToDelete?.name}"? Histori pembelian masa lalu tetap akan tersimpan di sistem.`}
        confirmText="Hapus Supplier"
        cancelText="Batal"
        isDestructive={true}
        onConfirm={handleDeleteSupplier}
        onClose={() => setSupplierToDelete(null)}
      />
    </div>
  );
};

export default SuppliersView;

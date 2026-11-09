import React, { useEffect, useState } from 'react';
import { db } from '../../db/indexedDB';
import {
  Product,
  Purchase,
  PurchaseItem,
  PurchaseStatus,
  Supplier,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { receivePurchaseGoods } from '../../services/inventoryEngine';
import {
  Truck,
  Plus,
  PackageCheck,
  Building2,
  Calendar,
  AlertCircle,
  X,
  CheckCircle2,
  Clock,
  Trash2,
} from 'lucide-react';

export const PurchasesView: React.FC = () => {
  const { activeUser, settings, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'PURCHASES' | 'SUPPLIERS'>('PURCHASES');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Modals
  const [isNewPoOpen, setNewPoOpen] = useState(false);
  const [receivePurchase, setReceivePurchase] = useState<Purchase | null>(null);
  const [receiveInputs, setReceiveInputs] = useState<Record<string, { qty: number; cost: number }>>({});
  const [isReceiving, setIsReceiving] = useState(false);

  // Supplier modal
  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
  });

  // PO Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPoItems] = useState<
    { productId: string; qtyOrdered: number; costPerUnit: number }[]
  >([]);
  const [poNotes, setPoNotes] = useState('');

  const loadData = async () => {
    const [pList, sList, prList] = await Promise.all([
      db.purchases.reverse().sortBy('date'),
      db.suppliers.toArray(),
      db.products.filter((p) => p.active).toArray(),
    ]);
    setPurchases(pList);
    setSuppliers(sList);
    setProducts(prList);
    if (sList.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(sList[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddPoItem = (productId: string) => {
    const p = products.find((prod) => prod.id === productId);
    if (!p) return;
    if (poItems.some((i) => i.productId === productId)) {
      showToast('Produk sudah ada di daftar', 'info');
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

  const handleCreatePO = async () => {
    if (!selectedSupplierId) {
      showToast('Pilih supplier terlebih dahulu', 'error');
      return;
    }
    if (poItems.length === 0) {
      showToast('Tambahkan minimal 1 item produk', 'error');
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
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
    showToast(`Purchase Order ${poNumber} berhasil dibuat!`, 'success');
    setNewPoOpen(false);
    setPoItems([]);
    setPoNotes('');
    loadData();
  };

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

  const handlePostReceive = async () => {
    if (!receivePurchase) return;

    try {
      setIsReceiving(true);
      const itemsToReceive = receivePurchase.items.map((item) => ({
        productId: item.productId,
        qtyReceived: receiveInputs[item.productId]?.qty || 0,
        costPerUnit: receiveInputs[item.productId]?.cost || item.costPerUnit,
      }));

      await receivePurchaseGoods(
        receivePurchase.id,
        itemsToReceive,
        activeUser.id,
        activeUser.name,
        settings?.costingMethod || 'FIFO'
      );

      showToast(`Penerimaan barang PO ${receivePurchase.purchaseNo} berhasil diposting ke stok!`, 'success');
      setReceivePurchase(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal posting penerimaan barang', 'error');
    } finally {
      setIsReceiving(false);
    }
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name || !supplierForm.phone) {
      showToast('Nama dan nomor telepon supplier wajib diisi', 'error');
      return;
    }

    const newSup: Supplier = {
      id: `SUP-${Date.now().toString().slice(-4)}`,
      name: supplierForm.name,
      contactPerson: supplierForm.contactPerson || '-',
      phone: supplierForm.phone,
      email: supplierForm.email || '-',
      address: supplierForm.address || '-',
    };

    await db.suppliers.add(newSup);
    showToast('Supplier baru berhasil ditambahkan!', 'success');
    setSupplierModalOpen(false);
    setSupplierForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
    loadData();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pembelian & Supplier (Purchasing)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola Purchase Order (PO), penerimaan barang gudang, dan mitra supplier
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'PURCHASES' ? (
            <button
              onClick={() => setNewPoOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Pesanan Pembelian (PO)</span>
            </button>
          ) : (
            <button
              onClick={() => setSupplierModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Supplier Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('PURCHASES')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'PURCHASES'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Daftar Purchase Order ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'SUPPLIERS'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Master Supplier ({suppliers.length})
        </button>
      </div>

      {/* Tab 1: Purchases List */}
      {activeTab === 'PURCHASES' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">No. PO & Tanggal</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Total Item</th>
                  <th className="py-3 px-4 text-right">Total Nilai Pembelian</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Belum ada Purchase Order dibuat.
                    </td>
                  </tr>
                ) : (
                  purchases.map((po) => {
                    return (
                      <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900">{po.purchaseNo}</span>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {new Date(po.date).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{po.supplierName}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {po.items.length} item ({po.items.reduce((s, i) => s + i.qtyOrdered, 0)} unit)
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          Rp {po.totalAmount.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              po.status === 'RECEIVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : po.status === 'ORDERED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {po.status === 'RECEIVED'
                              ? 'Diterima (Stok Masuk)'
                              : po.status === 'ORDERED'
                              ? 'Dalam Pengiriman'
                              : po.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {po.status === 'ORDERED' ? (
                            <button
                              onClick={() => openReceiveModal(po)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Terima Barang</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">
                              Selesai pada{' '}
                              {po.receivedDate
                                ? new Date(po.receivedDate).toLocaleDateString('id-ID')
                                : '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Supplier List */}
      {activeTab === 'SUPPLIERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => (
            <div
              key={sup.id}
              className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{sup.name}</h3>
                  <p className="text-xs text-slate-500">Kontak: {sup.contactPerson}</p>
                </div>
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>

              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <p>
                  <span className="font-medium text-slate-500">Telp/WA:</span> {sup.phone}
                </p>
                <p>
                  <span className="font-medium text-slate-500">Email:</span> {sup.email}
                </p>
                <p className="text-slate-500 text-[11px] leading-relaxed">{sup.address}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New Purchase Order */}
      {isNewPoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Buat Purchase Order (PO) Baru</h3>
                <p className="text-xs text-slate-500">
                  Stok baru akan bertambah saat penerimaan barang diposting
                </p>
              </div>
              <button onClick={() => setNewPoOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Supplier:</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tambahkan Produk ke PO:
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPoItem(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pilih Produk untuk Ditambahkan --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Harga Beli Ref: Rp {p.costPrice.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List in PO */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Produk</th>
                      <th className="p-2.5 text-center">Qty Pesan</th>
                      <th className="p-2.5 text-right">Harga Beli Satuan (Rp)</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                      <th className="p-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {poItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          Belum ada item ditambahkan ke PO ini.
                        </td>
                      </tr>
                    ) : (
                      poItems.map((item, idx) => {
                        const prod = products.find((p) => p.id === item.productId)!;
                        return (
                          <tr key={item.productId}>
                            <td className="p-2.5 font-semibold text-slate-800">{prod.name}</td>
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
                                className="w-24 px-2 py-1 text-right bg-slate-100 border border-slate-200 rounded font-semibold"
                              />
                            </td>
                            <td className="p-2.5 text-right font-black text-slate-900">
                              Rp {(item.qtyOrdered * item.costPerUnit).toLocaleString('id-ID')}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() =>
                                  setPoItems((prev) => prev.filter((_, iIdx) => iIdx !== idx))
                                }
                                className="text-rose-500 hover:text-rose-700"
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
                  <span className="font-semibold text-slate-700">Total Nilai PO:</span>
                  <span className="font-black text-base text-slate-900">
                    Rp{' '}
                    {poItems
                      .reduce((s, i) => s + i.qtyOrdered * i.costPerUnit, 0)
                      .toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Pembelian:
                </label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Contoh: Estimasi kirim 2 hari kerja"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setNewPoOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                disabled={poItems.length === 0}
                onClick={handleCreatePO}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                Terbitkan Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Penerimaan Barang (Goods Receipt) */}
      {receivePurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Penerimaan Barang: {receivePurchase.purchaseNo}
                </h3>
                <p className="text-xs text-slate-500">
                  Supplier: {receivePurchase.supplierName} &bull; Posting akan menambah saldo stok
                  dan memperbarui HPP ({settings?.costingMethod || 'FIFO'})
                </p>
              </div>
              <button onClick={() => setReceivePurchase(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  Periksa barang fisik yang datang dari supplier. Masukkan kuantitas aktual yang
                  diterima dan harga beli faktur per unit.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Produk</th>
                      <th className="p-2.5 text-center">Pesan</th>
                      <th className="p-2.5 text-center">Qty Diterima</th>
                      <th className="p-2.5 text-right">Harga Beli Aktual (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receivePurchase.items.map((item) => (
                      <tr key={item.productId}>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800">{item.name}</span>
                          <span className="text-slate-400 block text-[10px]">{item.sku}</span>
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
                            className="w-28 px-2 py-1 text-right bg-slate-100 border border-slate-200 rounded font-semibold text-slate-900"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
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
                {isReceiving ? 'Memproses...' : 'Posting Penerimaan Barang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Supplier */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Tambah Supplier Baru</h3>
              <button onClick={() => setSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Perusahaan / Supplier:</label>
                <input
                  type="text"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="Contoh: PT Pangan Sentosa Abadi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Kontak Person / PIC:</label>
                <input
                  type="text"
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                  placeholder="Contoh: Bapak Irwan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">No. Telepon / WhatsApp:</label>
                <input
                  type="text"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder="Contoh: 0812-3456-7890"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email:</label>
                <input
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  placeholder="sales@supplier.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Alamat Gudang / Kantor:</label>
                <textarea
                  rows={2}
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="Jl. Industri No. ..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSupplierModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleSaveSupplier}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
              >
                Simpan Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

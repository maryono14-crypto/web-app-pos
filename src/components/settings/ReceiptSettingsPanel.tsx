import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/indexedDB';
import { BusinessSettings } from '../../types';
import {
  Store,
  MapPin,
  FileText,
  Phone,
  Printer,
  Save,
  RotateCcw,
  Sparkles,
  Check,
  Eye,
  Sliders,
  Tag,
  Receipt,
  CheckCircle2,
} from 'lucide-react';

interface ReceiptSettingsPanelProps {
  onSaved?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

export const ReceiptSettingsPanel: React.FC<ReceiptSettingsPanelProps> = ({
  onSaved,
  isModal = false,
  onClose,
}) => {
  const { settings, refreshSettings, activeUser, showToast } = useApp();

  const [formData, setFormData] = useState({
    storeName: '',
    storeTagline: '',
    storeAddress: '',
    storePhone: '',
    storeFooterNote: '',
    defaultReceiptWidth: '58mm' as '58mm' | '80mm',
    taxEnabled: true,
    taxRatePercent: 11,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'layout'>('content');

  useEffect(() => {
    if (settings) {
      setFormData({
        storeName: settings.storeName || '',
        storeTagline: settings.storeTagline || '',
        storeAddress: settings.storeAddress || '',
        storePhone: settings.storePhone || '',
        storeFooterNote: settings.storeFooterNote || '',
        defaultReceiptWidth: settings.defaultReceiptWidth || '58mm',
        taxEnabled: settings.taxEnabled ?? true,
        taxRatePercent: settings.taxRatePercent ?? 11,
      });
    }
  }, [settings]);

  // Quick preset chips for footer notes
  const footerPresets = [
    {
      label: 'Ucapan Terima Kasih',
      text: 'Terima kasih atas kunjungan Anda!\nSelamat berbelanja kembali.',
    },
    {
      label: 'Kebijakan Retur',
      text: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan kecuali ada perjanjian.',
    },
    {
      label: 'Bukti Pembayaran',
      text: 'Simpan struk ini sebagai bukti pembayaran dan garansi yang sah.',
    },
    {
      label: 'Kontak CS / WA',
      text: `Layanan Pelanggan & Pemesanan WA: ${formData.storePhone || '0812-3456-7890'}`,
    },
  ];

  const handleAppendPreset = (text: string) => {
    setFormData((prev) => {
      const existing = prev.storeFooterNote.trim();
      const newNote = existing ? `${existing}\n${text}` : text;
      return { ...prev, storeFooterNote: newNote };
    });
  };

  const handleSave = async () => {
    if (activeUser.role === 'CASHIER') {
      showToast('Hanya Owner, Admin, atau Manager yang dapat mengubah format struk.', 'error');
      return;
    }

    if (!formData.storeName.trim()) {
      showToast('Nama toko tidak boleh kosong.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const currentConfig = await db.settings.get('current_config');

      const updatedSettings: BusinessSettings & { id: string } = {
        storeName: formData.storeName,
        storeTagline: formData.storeTagline,
        storeAddress: formData.storeAddress,
        storePhone: formData.storePhone,
        storeFooterNote: formData.storeFooterNote,
        currency: currentConfig?.currency || settings?.currency || 'IDR',
        costingMethod: currentConfig?.costingMethod || settings?.costingMethod || 'FIFO',
        taxEnabled: formData.taxEnabled,
        taxRatePercent: formData.taxRatePercent,
        defaultReceiptWidth: formData.defaultReceiptWidth,
        spreadsheetId: currentConfig?.spreadsheetId || settings?.spreadsheetId,
        spreadsheetUrl: currentConfig?.spreadsheetUrl || settings?.spreadsheetUrl,
        lastSyncTime: currentConfig?.lastSyncTime || settings?.lastSyncTime,
        autoSyncIntervalMinutes: currentConfig?.autoSyncIntervalMinutes || settings?.autoSyncIntervalMinutes || 5,
        id: 'current_config',
      };

      await db.settings.put(updatedSettings);

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'UPDATE_RECEIPT_SETTINGS',
        category: 'SETTINGS',
        details: `Format struk kasir diperbarui: "${formData.storeName}", Alamat: "${formData.storeAddress}", Catatan: "${formData.storeFooterNote}" oleh ${activeUser.name}`,
      });

      await refreshSettings();
      showToast('Format struk dan identitas toko berhasil disimpan!', 'success');
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan format struk', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = () => {
    window.print();
  };

  const handleResetDefaults = () => {
    setFormData({
      storeName: 'Toko Berkah Sejahtera',
      storeTagline: 'Retail, Sembako & Minimarket Modern',
      storeAddress: 'Jl. Ahmad Yani No. 88, Margamulya',
      storePhone: '0812-3456-7890',
      storeFooterNote:
        'Terima kasih atas kunjungan Anda!\nBarang yang dibeli tidak dapat ditukar kecuali ada perjanjian.',
      defaultReceiptWidth: '58mm',
      taxEnabled: true,
      taxRatePercent: 11,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Format Struk Kasir & Identitas Toko
            </h2>
            <p className="text-xs text-slate-500">
              Atur nama toko, alamat, nomor kontak, dan catatan kaki yang tercetak pada kertas thermal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs"
            title="Muat Ulang Teks Standar"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Standar</span>
          </button>
          <button
            type="button"
            onClick={handleTestPrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer shadow-2xs"
            title="Uji coba cetak pada printer kasir thermal"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            <span>Uji Cetak Struk</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Format'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form Settings (Left) & Real-time Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: 7 cols on lg */}
        <div className="lg:col-span-7 space-y-5">
          {/* Form Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-bold gap-4">
            <button
              onClick={() => setActiveTab('content')}
              className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === 'content'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Teks & Konten Struk</span>
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === 'layout'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Ukuran Kertas & Format</span>
            </button>
          </div>

          {activeTab === 'content' ? (
            <div className="space-y-4">
              {/* 1. Store Name */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Nama Toko / Usaha</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formData.storeName.length}/40 karakter
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={40}
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  placeholder="Contoh: Toko Berkah Sejahtera"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  Dicetak sebagai judul paling atas dengan huruf kapital tebal (Header Struk).
                </p>
              </div>

              {/* 2. Slogan / Tagline */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    <span>Slogan / Tagline Toko (Opsional)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formData.storeTagline.length}/50 karakter
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={50}
                  value={formData.storeTagline}
                  onChange={(e) => setFormData({ ...formData, storeTagline: e.target.value })}
                  placeholder="Contoh: Retail, Sembako & Minimarket Modern"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  Tampil tepat di bawah nama toko untuk memperkuat identitas brand usaha Anda.
                </p>
              </div>

              {/* 3. Store Address */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>Alamat Lengkap Toko</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formData.storeAddress.length} karakter
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={formData.storeAddress}
                  onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
                  placeholder="Contoh: Jl. Ahmad Yani No. 88, RT 06 / RW 02, Margamulya"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-500">
                  Dapat memuat nama jalan, nomor toko, RT/RW, dan nama kelurahan/kota. Mendukung multi-baris.
                </p>
              </div>

              {/* 4. Phone Number */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Nomor Telepon / WhatsApp Kasir</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={formData.storePhone}
                  onChange={(e) => setFormData({ ...formData, storePhone: e.target.value })}
                  placeholder="Contoh: 0812-3456-7890 / (021) 555-1234"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  Dicetak di bagian kepala struk agar pelanggan dapat menghubungi toko untuk retur/pesanan.
                </p>
              </div>

              {/* 5. Footer Notes */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                    <span>Catatan Kaki Struk (Footer Notes)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formData.storeFooterNote.length} karakter
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={formData.storeFooterNote}
                  onChange={(e) => setFormData({ ...formData, storeFooterNote: e.target.value })}
                  placeholder="Tuliskan ucapan terima kasih, kebijakan penukaran barang, atau info garansi..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                />

                {/* Preset Chips */}
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                    Sisipkan Teks Cepat (Klik untuk menambahkan):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {footerPresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAppendPreset(preset.text)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] text-slate-700 font-medium cursor-pointer shadow-2xs transition-colors"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Layout & Options Tab */
            <div className="space-y-4">
              {/* Paper Width */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <span>Lebar Kertas Thermal Default</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, defaultReceiptWidth: '58mm' })}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.defaultReceiptWidth === '58mm'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs">58 mm (Standar)</span>
                      {formData.defaultReceiptWidth === '58mm' && (
                        <Check className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ukuran printer kasir thermal portabel / Bluetooth / mini POS (lebar ~48mm area cetak).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, defaultReceiptWidth: '80mm' })}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.defaultReceiptWidth === '80mm'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs">80 mm (Lebar)</span>
                      {formData.defaultReceiptWidth === '80mm' && (
                        <Check className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ukuran printer kasir desktop USB/LAN supermarket besar (teks lebih renggang & muat banyak).
                    </p>
                  </button>
                </div>
              </div>

              {/* Tax Toggle */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.taxEnabled}
                    onChange={(e) => setFormData({ ...formData, taxEnabled: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Cetak Rincian Pajak (PPN) pada Struk Kasir
                  </span>
                </label>
                {formData.taxEnabled && (
                  <div className="flex items-center gap-2 pl-6 pt-1">
                    <span className="text-xs text-slate-600">Tarif PPN:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formData.taxRatePercent}
                      onChange={(e) =>
                        setFormData({ ...formData, taxRatePercent: Number(e.target.value) })
                      }
                      className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center"
                    />
                    <span className="text-xs font-semibold text-slate-500">%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Preview: 5 cols on lg (Interactive Live Receipt Simulator) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-2 mb-2 text-xs font-bold text-slate-700 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>Simulasi Struk Cetak (Real-time)</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-mono text-[10px]">
              {formData.defaultReceiptWidth}
            </span>
          </div>

          {/* Printable Receipt Paper Container */}
          <div className="p-4 bg-slate-200 rounded-2xl border border-slate-300 shadow-inner w-full flex justify-center overflow-x-auto">
            <div
              id="printable-receipt"
              style={{
                width: formData.defaultReceiptWidth === '58mm' ? '280px' : '360px',
              }}
              className="bg-white p-4 font-mono text-[11px] leading-tight text-slate-900 rounded-sm shadow-md border border-slate-300 transition-all select-text"
            >
              {/* Paper Jagged Top Deco */}
              <div className="text-center pb-2 border-b border-dashed border-slate-400">
                <h3 className="font-bold text-sm tracking-tight uppercase">
                  {formData.storeName || 'NAMA TOKO BELUM DIISI'}
                </h3>
                {formData.storeTagline && (
                  <p className="text-[10px] text-slate-600 mt-0.5">{formData.storeTagline}</p>
                )}
                {formData.storeAddress ? (
                  <p className="text-[10px] text-slate-600 mt-0.5 whitespace-pre-line leading-tight">
                    {formData.storeAddress}
                  </p>
                ) : (
                  <p className="text-[10px] text-rose-500 italic mt-0.5">[Alamat Toko Kosong]</p>
                )}
                {formData.storePhone && (
                  <p className="text-[10px] text-slate-600 mt-0.5">Telp: {formData.storePhone}</p>
                )}
              </div>

              {/* Sample Transaction Info */}
              <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5 text-slate-600">
                <div className="flex justify-between">
                  <span>No. Struk:</span>
                  <span className="font-bold text-slate-900 font-mono">INV-20261023-001</span>
                </div>
                <div className="flex justify-between">
                  <span>Waktu:</span>
                  <span>
                    {new Date().toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    {new Date().toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir:</span>
                  <span>{activeUser?.name || 'Ahmad Fauzi'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span>Pelanggan Umum</span>
                </div>
              </div>

              {/* Sample Product Items */}
              <div className="py-2 border-b border-dashed border-slate-400 space-y-2 text-slate-800">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900">Beras Pandan Wangi Premium 5kg</div>
                  <div className="flex justify-between text-slate-600">
                    <span>1 Sak x Rp 68.000</span>
                    <span className="font-semibold text-slate-900">Rp 68.000</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900">Minyak Goreng SunCo 2L</div>
                  <div className="flex justify-between text-slate-600">
                    <span>2 Pouch x Rp 36.000</span>
                    <span className="font-semibold text-slate-900">Rp 72.000</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900">Gula Pasir Gulaku 1kg</div>
                  <div className="flex justify-between text-slate-600">
                    <span>1 Pack x Rp 17.500</span>
                    <span className="font-semibold text-slate-900">Rp 17.500</span>
                  </div>
                </div>
              </div>

              {/* Sample Calculation */}
              <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-right text-[10px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>Rp 157.500</span>
                </div>
                {formData.taxEnabled && (
                  <div className="flex justify-between text-slate-600">
                    <span>PPN ({formData.taxRatePercent}%):</span>
                    <span>Rp {Math.round(157500 * (formData.taxRatePercent / 100)).toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-slate-900 pt-1 border-t border-slate-300">
                  <span>TOTAL:</span>
                  <span>
                    Rp{' '}
                    {Math.round(
                      157500 + (formData.taxEnabled ? 157500 * (formData.taxRatePercent / 100) : 0)
                    ).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Bayar (TUNAI):</span>
                  <span>Rp 200.000</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Kembalian:</span>
                  <span>
                    Rp{' '}
                    {Math.max(
                      0,
                      200000 -
                        Math.round(
                          157500 + (formData.taxEnabled ? 157500 * (formData.taxRatePercent / 100) : 0)
                        )
                    ).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Footer Section (Live Tested) */}
              <div className="pt-3 text-center text-[10px] space-y-1 text-slate-600">
                {formData.storeFooterNote ? (
                  <p className="font-semibold whitespace-pre-line leading-relaxed text-slate-800">
                    {formData.storeFooterNote}
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-600 italic">
                    [Catatan Kaki Struk Kosong - tambahkan pesan di sebelah kiri]
                  </p>
                )}
                <p className="text-[9px] text-slate-400 pt-1">
                  === Terima Kasih &bull; Berkah POS ===
                </p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-2 text-center">
            Pratinjau di atas adalah representasi akurat dari format fisik yang akan dicetak oleh printer thermal kasir.
          </p>
        </div>
      </div>
    </div>
  );
};

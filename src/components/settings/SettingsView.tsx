import React, { useEffect, useState } from 'react';
import { db, resetDatabaseWithSeed } from '../../db/indexedDB';
import { BusinessSettings, CostingMethod } from '../../types';
import { useApp } from '../../context/AppContext';
import { GoogleSignInBtn } from '../common/GoogleSignInBtn';
import { ConfirmModal } from '../common/ConfirmModal';
import { googleSignIn, getAccessToken, logoutGoogle } from '../../services/auth';
import {
  createGoogleSpreadsheet,
  syncAllToGoogleSheets,
  linkExistingSpreadsheet,
  disconnectSpreadsheet,
} from '../../services/sheetsService';
import { ReceiptSettingsPanel } from './ReceiptSettingsPanel';
import {
  Settings,
  Store,
  Layers,
  Percent,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Database,
  Receipt,
  Cpu,
  Link,
  Unlink,
  Activity,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    refreshSettings,
    activeUser,
    showToast,
    isOnline,
    isSimulatedOffline,
    toggleSimulateOffline,
    setSyncModalOpen,
    googleConnectionStatus,
    googleUserEmail,
    reconnectGoogle,
    testSheetsConnection,
    syncNow,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'receipt' | 'accounting' | 'sheets' | 'system'>('receipt');

  const [formData, setFormData] = useState<BusinessSettings>({
    storeName: '',
    storeTagline: '',
    storeAddress: '',
    storePhone: '',
    storeFooterNote: '',
    currency: 'IDR',
    costingMethod: 'FIFO',
    taxEnabled: true,
    taxRatePercent: 11,
    defaultReceiptWidth: '58mm',
  });

  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; title?: string } | null>(null);

  // Manual Spreadsheet link state
  const [manualSheetInput, setManualSheetInput] = useState('');
  const [isLinkingManual, setIsLinkingManual] = useState(false);
  const [showManualLinkInput, setShowManualLinkInput] = useState(false);

  // Disconnect confirmation modal
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);

  // Reset confirmation
  const [isResetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSaveAccountingSettings = async () => {
    if (activeUser.role === 'CASHIER') {
      showToast('Kasir tidak diizinkan mengubah konfigurasi sistem.', 'error');
      return;
    }

    try {
      const currentConfig = (await db.settings.get('current_config')) || {};
      await db.settings.put({
        ...currentConfig,
        ...formData,
        id: 'current_config',
      });

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'UPDATE_SETTINGS',
        category: 'SETTINGS',
        details: `Kebijakan akuntansi diperbarui. Metode HPP: ${formData.costingMethod}, PPN: ${
          formData.taxEnabled ? `${formData.taxRatePercent}%` : 'Non-aktif'
        }`,
      });

      await refreshSettings();
      showToast('Pengaturan akuntansi & pajak berhasil disimpan!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan pengaturan', 'error');
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setTestResult(null);
    try {
      const ok = await reconnectGoogle();
      if (ok) {
        showToast('Koneksi Google Sheets berhasil dipulihkan!', 'success');
      }
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    try {
      const res = await testSheetsConnection();
      setTestResult(res);
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleLinkExistingSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSheetInput.trim()) {
      showToast('Masukkan URL atau ID Google Spreadsheet.', 'error');
      return;
    }

    setIsLinkingManual(true);
    try {
      const res = await linkExistingSpreadsheet(manualSheetInput.trim());
      showToast(`Berhasil tersambung ke Google Spreadsheet: "${res.title}"!`, 'success');
      setManualSheetInput('');
      setShowManualLinkInput(false);
      await refreshSettings();
      await syncNow();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menautkan spreadsheet.', 'error');
    } finally {
      setIsLinkingManual(false);
    }
  };

  const handleDisconnectSpreadsheet = async () => {
    try {
      await disconnectSpreadsheet();
      setIsDisconnectConfirmOpen(false);
      setTestResult(null);
      showToast('Spreadsheet Google Sheets telah diputuskan dari sistem.', 'info');
      await refreshSettings();
    } catch (err: any) {
      showToast(err?.message || 'Gagal memutuskan sambungan', 'error');
    }
  };

  const handleCreateOrLinkSheet = async () => {
    try {
      setIsCreatingSheet(true);
      const created = await createGoogleSpreadsheet(`${formData.storeName || 'Toko Berkah'} - POS Database`);
      showToast('Spreadsheet Google Sheets dengan 15 tab PRD berhasil dibuat!', 'success');
      await refreshSettings();
    } catch (err: any) {
      showToast(err?.message || 'Gagal membuat Google Spreadsheet', 'error');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleSyncToSheets = async () => {
    try {
      setIsSyncingSheets(true);
      const res = await syncAllToGoogleSheets();
      if (res.success) {
        showToast(
          `Sinkronisasi berhasil! ${res.syncedCounts.produk} produk, ${res.syncedCounts.penjualan} penjualan diperbarui di Google Sheets.`,
          'success'
        );
        await refreshSettings();
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal sinkronisasi data ke Google Sheets', 'error');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleResetData = async () => {
    try {
      await resetDatabaseWithSeed();
      await refreshSettings();
      showToast('Database berhasil di-reset ke data demo ritel Indonesia!', 'success');
    } catch (err: any) {
      showToast('Gagal mereset database', 'error');
    }
  };

  const isSheetsConnected = googleConnectionStatus === 'CONNECTED' && Boolean(settings?.spreadsheetId);
  const isSheetsDisconnectedOrExpired =
    Boolean(settings?.spreadsheetId) && (googleConnectionStatus === 'EXPIRED' || googleConnectionStatus === 'DISCONNECTED');

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-sm">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Pengaturan Sistem & Toko
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasi format struk belanja, kebijakan akuntansi HPP, dan sambungan Google Sheets
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher buttons */}
        <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('receipt')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'receipt'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Format Struk</span>
          </button>
          <button
            onClick={() => setActiveTab('accounting')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'accounting'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Akuntansi & Pajak</span>
          </button>
          <button
            onClick={() => setActiveTab('sheets')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sheets'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google Sheets</span>
            {isSheetsDisconnectedOrExpired && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'system'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Offline & Database</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Receipt Format Customization */}
      {activeTab === 'receipt' && <ReceiptSettingsPanel />}

      {/* Tab 2: Accounting (Costing Method) & Tax */}
      {activeTab === 'accounting' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Action button header */}
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Konfigurasi metode HPP FIFO / Average dan persentase tarif pajak PPN transaksi
            </p>
            <button
              onClick={handleSaveAccountingSettings}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan Akuntansi</span>
            </button>
          </div>

          {/* Metode HPP */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Layers className="w-5 h-5 text-purple-600" />
              <h2 className="font-bold text-slate-900 text-sm">
                Metode Biaya Persediaan & HPP (Costing Method)
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Pilih metode yang digunakan sistem untuk menghitung Harga Pokok Penjualan (HPP) dan laba
                kotor transaksi:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label
                  className={`p-4 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    formData.costingMethod === 'FIFO'
                      ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="costingMethod"
                    value="FIFO"
                    checked={formData.costingMethod === 'FIFO'}
                    onChange={() => setFormData({ ...formData, costingMethod: 'FIFO' })}
                    className="mt-0.5 text-purple-600"
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">
                      FIFO (First In, First Out)
                    </span>
                    <p className="text-slate-500 mt-1 leading-relaxed text-[11px]">
                      Barang yang pertama kali dibeli adalah yang pertama kali dibebankan sebagai HPP.
                      Sistem mengelola batch masuk dan mengambil biaya dari sisa batch tertua.
                    </p>
                  </div>
                </label>

                <label
                  className={`p-4 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    formData.costingMethod === 'AVERAGE'
                      ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="costingMethod"
                    value="AVERAGE"
                    checked={formData.costingMethod === 'AVERAGE'}
                    onChange={() => setFormData({ ...formData, costingMethod: 'AVERAGE' })}
                    className="mt-0.5 text-purple-600"
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">
                      Moving Weighted Average
                    </span>
                    <p className="text-slate-500 mt-1 leading-relaxed text-[11px]">
                      Setiap penerimaan barang baru memperbarui rata-rata tertimbang persediaan:
                      (Nilai Stok Lama + Nilai Stok Baru) / Total Stok Baru.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Pajak PPN */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Percent className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-sm">Konfigurasi Pajak (PPN)</h2>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.taxEnabled}
                  onChange={(e) => setFormData({ ...formData, taxEnabled: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-bold text-slate-800">
                  Aktifkan Perhitungan Pajak pada Transaksi Kasir
                </span>
              </label>

              {formData.taxEnabled && (
                <div className="pt-2 pl-6">
                  <label className="block font-medium text-slate-700 mb-1">Tarif Pajak (%):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.taxRatePercent}
                      onChange={(e) =>
                        setFormData({ ...formData, taxRatePercent: Number(e.target.value) })
                      }
                      className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                    />
                    <span className="text-slate-500 font-semibold">% (Standar Indonesia: 11%)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Database Google Sheets Integration */}
      {activeTab === 'sheets' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-150">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm">
                  Koneksi Database Google Sheets Cloud
                </h2>
                <p className="text-xs text-slate-500">
                  Sinkronisasi offline-first otomatis antara IndexedDB lokal dan Google Sheets
                </p>
              </div>
            </div>

            {/* Connection Status Pill */}
            {isSheetsConnected ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terhubung Aktif</span>
              </span>
            ) : isSheetsDisconnectedOrExpired ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Sambungan Terputus</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Belum Disambungkan
              </span>
            )}
          </div>

          {/* Alert: Sambungan Terputus / Reconnect Prompt */}
          {isSheetsDisconnectedOrExpired && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-200/60 text-amber-800 rounded-xl shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-950 text-xs">
                    Sambungan Google Sheets Terputus
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Sesi otentikasi Google OAuth Anda telah berakhir atau jaringan sempat terputus.
                    Seluruh transaksi kasir Anda tetap aman di IndexedDB offline lokal. Silakan klik tombol di bawah untuk menyambungkan kembali.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                <span>{isReconnecting ? 'Menyambungkan...' : 'Hubungkan Ulang Sekarang'}</span>
              </button>
            </div>
          )}

          {/* Test Connection Live Result Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="space-y-4 text-xs">
            {/* Authenticated Account Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 block text-xs">
                  Akun Google Terautentikasi:
                </span>
                <p className="text-slate-600 mt-0.5 font-mono text-xs">
                  {googleUserEmail || 'Belum ada akun Google terhubung'}
                </p>
                <span
                  className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    googleConnectionStatus === 'CONNECTED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : googleConnectionStatus === 'EXPIRED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  Status Token:{' '}
                  {googleConnectionStatus === 'CONNECTED'
                    ? 'Aktif (Siap Sinkron)'
                    : googleConnectionStatus === 'EXPIRED'
                    ? 'Kadaluarsa / Perlu Hubungkan Ulang'
                    : 'Tidak Aktif'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Masuk atau perbarui token akses Google"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isReconnecting ? 'animate-spin' : ''}`} />
                  <span>{isReconnecting ? 'Menghubungkan...' : 'Hubungkan Ulang Akun'}</span>
                </button>
              </div>
            </div>

            {/* Active Spreadsheet Details */}
            {settings?.spreadsheetId ? (
              <div className="p-5 bg-emerald-50/60 rounded-3xl border border-emerald-200 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 block">
                      Google Spreadsheet Aktif:
                    </span>
                    <span className="font-mono text-emerald-950 font-bold text-xs select-all block mt-0.5">
                      {settings.spreadsheetId}
                    </span>
                  </div>

                  <a
                    href={settings.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold shadow-2xs shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Spreadsheet</span>
                  </a>
                </div>

                {settings.lastSyncTime && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                    <span>Terakhir sinkronisasi sukses:</span>
                    <strong className="font-mono">
                      {new Date(settings.lastSyncTime).toLocaleString('id-ID')}
                    </strong>
                  </p>
                )}

                {/* Spreadsheet Control Actions */}
                <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-emerald-200/60">
                  <button
                    disabled={isSyncingSheets}
                    onClick={handleSyncToSheets}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSheets ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
                  </button>

                  <button
                    disabled={isTestingConn}
                    onClick={handleTestConnection}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-100/70 border border-emerald-300 text-emerald-800 font-semibold shadow-2xs cursor-pointer disabled:opacity-50"
                    title="Uji kelayakan sambungan ke Google Sheets API"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isTestingConn ? 'animate-pulse' : ''}`} />
                    <span>{isTestingConn ? 'Menguji...' : 'Uji Sambungan'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDisconnectConfirmOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-semibold shadow-2xs cursor-pointer ml-auto"
                    title="Putuskan spreadsheet ini dari sistem"
                  >
                    <Unlink className="w-3.5 h-3.5 text-rose-500" />
                    <span>Putuskan Sambungan</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200 space-y-3">
                <p className="font-semibold text-slate-800 text-xs">
                  Pilih metode penyambungan database Google Sheets:
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    disabled={isCreatingSheet}
                    onClick={handleCreateOrLinkSheet}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{isCreatingSheet ? 'Membuat Spreadsheet...' : 'Buat Database Google Sheets Baru'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManualLinkInput(!showManualLinkInput)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold cursor-pointer shadow-xs"
                  >
                    <Link className="w-4 h-4 text-slate-500" />
                    <span>Sambungkan Spreadsheet yang Sudah Ada</span>
                  </button>
                </div>
              </div>
            )}

            {/* Manual Link Input Form */}
            {(showManualLinkInput || (!settings?.spreadsheetId && showManualLinkInput)) && (
              <form
                onSubmit={handleLinkExistingSheet}
                className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in"
              >
                <div>
                  <h4 className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tautkan Google Spreadsheet yang Sudah Ada</span>
                  </h4>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Tempelkan link (URL) atau ID Google Spreadsheet Anda yang pernah dibuat sebelumnya untuk menyambungkan kembali.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={manualSheetInput}
                    onChange={(e) => setManualSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isLinkingManual}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isLinkingManual ? 'Memverifikasi...' : 'Verifikasi & Sambungkan'}
                  </button>
                </div>
              </form>
            )}

            {/* Change existing spreadsheet link option */}
            {settings?.spreadsheetId && !showManualLinkInput && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualLinkInput(true)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700 underline cursor-pointer"
                >
                  Ingin mengganti atau menautkan ke file spreadsheet lain? Klik di sini.
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Offline Storage & UAT Demo */}
      {activeTab === 'system' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-sm">
                  Offline Storage (IndexedDB) & Service Worker
                </h2>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isOnline ? 'Service Worker Aktif (Online)' : 'Offline Mode Aktif'}
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed">
                Aplikasi menggunakan Service Worker dan IndexedDB (Dexie) sebagai penyimpanan lokal.
                Saat offline, transaksi tetap dapat dicatat, inventaris dihitung, dan struk dicetak tanpa kendala.
              </p>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-800 block text-xs">Simulasi Pemutusan Jaringan:</span>
                  <span className="text-slate-500 text-[11px]">
                    Gunakan tombol ini untuk menguji bagaimana kasir bekerja saat koneksi internet toko mati total.
                  </span>
                </div>

                <button
                  onClick={toggleSimulateOffline}
                  className={`px-4 py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer shrink-0 ${
                    isSimulatedOffline
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {isSimulatedOffline ? 'Matikan Simulasi Offline' : 'Aktifkan Simulasi Offline'}
                </button>
              </div>
            </div>
          </div>

          {/* Reset Demo Data */}
          <div className="bg-white p-6 rounded-3xl border border-rose-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-100">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <h2 className="font-bold text-rose-900 text-sm">Reset Database Demo Ritel</h2>
            </div>
            <p className="text-xs text-slate-600">
              Kembalikan seluruh produk, kategori, pelanggan, dan batch persediaan ke data awal toko ritel Indonesia.
              Transaksi lokal yang belum disinkronkan akan dihapus.
            </p>
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Data Demo Toko</span>
            </button>
          </div>
        </div>
      )}

      {/* Disconnect Spreadsheet Confirmation Modal */}
      <ConfirmModal
        isOpen={isDisconnectConfirmOpen}
        onClose={() => setIsDisconnectConfirmOpen(false)}
        onConfirm={handleDisconnectSpreadsheet}
        title="Putuskan Sambungan Google Sheets?"
        message="Spreadsheet saat ini akan dilepas dari sistem POS. Seluruh data transaksi di IndexedDB lokal Anda tetap aman dan tidak akan dihapus. Anda dapat menyambungkannya kembali kapan saja."
        confirmText="Putuskan Sambungan"
        cancelText="Batal"
        isDestructive={false}
      />

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleResetData}
        title="Konfirmasi Reset Database"
        message="Tindakan ini akan mengembalikan seluruh produk, kategori, dan data awal ritel. Transaksi penjualan kasir saat ini akan dihapus. Apakah Anda yakin?"
        confirmText="Ya, Reset Database"
        cancelText="Batal"
        isDestructive={true}
      />
    </div>
  );
};

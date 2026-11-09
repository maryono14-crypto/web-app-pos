import React, { useEffect, useState } from 'react';
import { db, resetDatabaseWithSeed } from '../../db/indexedDB';
import { BusinessSettings } from '../../types';
import { useApp } from '../../context/AppContext';
import { GoogleSignInBtn } from '../common/GoogleSignInBtn';
import { ConfirmModal } from '../common/ConfirmModal';
import { signInWithEmail, signUpWithEmail } from '../../services/auth';
import { ReceiptSettingsPanel } from './ReceiptSettingsPanel';
import firebaseConfig from '../../../firebase-applet-config.json';
import {
  Settings,
  Layers,
  Percent,
  Printer,
  Cloud,
  RefreshCw,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Database,
  Activity,
  UserCheck,
  LogOut,
  Download,
  UploadCloud,
  Mail,
  Lock,
  Info,
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
    googleConnectionStatus,
    googleUserEmail,
    googleUserName,
    googleUserPhoto,
    loginGoogle,
    logoutGoogleUser,
    testFirestore,
    restoreFromCloud,
    syncNow,
    isSyncing,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'receipt' | 'accounting' | 'cloud' | 'system'>('receipt');

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
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [isRestoringData, setIsRestoringData] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    databaseId?: string;
  } | null>(null);

  // Email/Password login modal state
  const [showEmailAuthForm, setShowEmailAuthForm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Restore confirmation modal
  const [isRestoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

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

  const handleGoogleLogin = async () => {
    setIsSigningInGoogle(true);
    try {
      await loginGoogle();
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      showToast('Email dan kata sandi wajib diisi.', 'error');
      return;
    }
    setIsSubmittingAuth(true);
    try {
      if (authMode === 'signup') {
        await signUpWithEmail(emailInput, passwordInput);
        showToast('Pendaftaran akun berhasil!', 'success');
      } else {
        await signInWithEmail(emailInput, passwordInput);
        showToast('Berhasil masuk dengan email!', 'success');
      }
      setShowEmailAuthForm(false);
      setEmailInput('');
      setPasswordInput('');
    } catch (err: any) {
      showToast(err?.message || 'Gagal autentikasi email', 'error');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    try {
      const res = await testFirestore();
      setTestResult(res);
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleConfirmRestore = async () => {
    setIsRestoringData(true);
    setRestoreConfirmOpen(false);
    try {
      await restoreFromCloud();
      showToast('Data berhasil dipulihkan dari Cloud Firestore!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal memulihkan data dari Cloud', 'error');
    } finally {
      setIsRestoringData(false);
    }
  };

  const handleResetData = async () => {
    try {
      await resetDatabaseWithSeed();
      await refreshSettings();
      showToast('Database berhasil di-reset ke data demo ritel Indonesia!', 'success');
    } catch {
      showToast('Gagal mereset database', 'error');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Pengaturan Sistem & Toko
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasi format struk belanja, kebijakan akuntansi HPP, dan Cloud Database Firestore
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
            onClick={() => setActiveTab('cloud')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cloud'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600" />
            <span>Cloud & Akun Google</span>
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

          {/* Costing Method FIFO / Average */}
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

          {/* Tax Rate (PPN) */}
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

      {/* Tab 3: Cloud Database Firestore & Google Auth (Replaces Discontinued Google Sheets) */}
      {activeTab === 'cloud' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in duration-150">
          {/* Discontinue Google Sheets Notice Banner */}
          <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl flex items-start gap-3">
            <div className="p-2 bg-amber-200 text-amber-900 rounded-xl shrink-0 mt-0.5">
              <Info className="w-5 h-5 text-amber-800" />
            </div>
            <div className="text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span>Pemberitahuan: Database Google Sheets Telah Dihentikan (Discontinue)</span>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] font-black uppercase">
                  Pembaruan Sistem
                </span>
              </div>
              <p className="leading-relaxed text-[11px] text-amber-900">
                Koneksi database melalui Google Sheets resmi dihentikan karena keterbatasan kuota spreadsheet API,
                latensi jaringan, dan masa berlaku token otorisasi 1 jam. Sistem kini beralih sepenuhnya ke
                <strong> Firebase Cloud Firestore</strong>: database cloud real-time berkecepatan tinggi, tanpa token kadaluarsa,
                dengan pencadangan otomatis dan autentikasi akun Google terpusat.
              </p>
            </div>
          </div>

          {/* Section 1: Google Account Authentication */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">
                    Autentikasi Akun Google & Keamanan
                  </h2>
                  <p className="text-xs text-slate-500">
                    Masuk dengan Akun Google untuk mengamankan data dan mengaktifkan sinkronisasi cloud
                  </p>
                </div>
              </div>

              {googleConnectionStatus === 'CONNECTED' ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Akun Google Terhubung</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Belum Masuk
                </span>
              )}
            </div>

            {/* Authenticated Profile Card */}
            {googleConnectionStatus === 'CONNECTED' ? (
              <div className="p-5 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {googleUserPhoto ? (
                    <img
                      src={googleUserPhoto}
                      alt="Google Avatar"
                      className="w-12 h-12 rounded-full border-2 border-white shadow-xs object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center shadow-xs">
                      {(googleUserName || googleUserEmail || 'G').substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {googleUserName || 'Pengguna Google Terverifikasi'}
                    </h3>
                    <p className="font-mono text-xs text-slate-600 mt-0.5">
                      {googleUserEmail}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Sesi Permanen (Firebase Auth)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        Akses Penuh Cloud POS
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={logoutGoogleUser}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Keluar Akun Google</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
                <p className="text-xs text-slate-600 max-w-md">
                  Login dengan Akun Google menggunakan Firebase Authentication tanpa batasan token 1 jam.
                  Identitas Anda terverifikasi secara aman dan sinkronisasi cloud langsung aktif.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <GoogleSignInBtn
                    onClick={handleGoogleLogin}
                    loading={isSigningInGoogle}
                    text="Masuk dengan Akun Google"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailAuthForm(!showEmailAuthForm)}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span>Login Email & Sandi</span>
                  </button>
                </div>

                {/* Email / Password Form toggle */}
                {showEmailAuthForm && (
                  <form
                    onSubmit={handleEmailAuthSubmit}
                    className="w-full max-w-sm mt-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 text-left animate-in fade-in"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-slate-800 text-xs">
                        {authMode === 'signin' ? 'Masuk dengan Email' : 'Daftar Akun Baru'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                        className="text-[11px] text-blue-600 font-bold hover:underline"
                      >
                        {authMode === 'signin' ? 'Buat akun baru' : 'Sudah punya akun? Masuk'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="nama@toko.com"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Kata Sandi
                      </label>
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingAuth}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingAuth
                        ? 'Memproses...'
                        : authMode === 'signin'
                        ? 'Masuk ke POS'
                        : 'Daftarkan Akun'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Cloud Firestore Database Configuration & Actions */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Database className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">
                    Database Cloud Firestore (Pengganti Google Sheets)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Penyimpanan enterprise NoSQL untuk sinkronisasi data master produk, transaksi kasir, & piutang
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1.5 shadow-2xs">
                <Cloud className="w-3.5 h-3.5 text-blue-600" />
                <span>Cloud Firestore Siap</span>
              </span>
            </div>

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

            {/* Database Metadata Box */}
            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-white rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Firestore Database ID:
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900 block mt-1 break-all select-all">
                    {firebaseConfig.firestoreDatabaseId || '(default)'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Google Cloud Project:
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900 block mt-1">
                    {firebaseConfig.projectId}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {/* 1. Sync local data to Firestore */}
                <button
                  onClick={syncNow}
                  disabled={isSyncing || !isOnline}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  title="Upload semua produk, transaksi, dan data ke Cloud Firestore"
                >
                  <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data ke Cloud Firestore'}</span>
                </button>

                {/* 2. Test Connection */}
                <button
                  onClick={handleTestConnection}
                  disabled={isTestingConn || !isOnline}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Uji kelayakan sambungan ke Cloud Firestore"
                >
                  <Activity className={`w-4 h-4 text-emerald-600 ${isTestingConn ? 'animate-pulse' : ''}`} />
                  <span>{isTestingConn ? 'Menguji...' : 'Uji Sambungan Firestore'}</span>
                </button>

                {/* 3. Pull / Restore Data from Cloud */}
                <button
                  onClick={() => setRestoreConfirmOpen(true)}
                  disabled={isRestoringData || !isOnline}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer ml-auto disabled:opacity-50"
                  title="Tarik data produk dan transaksi dari Cloud ke IndexedDB perangkat ini"
                >
                  <Download className={`w-4 h-4 text-amber-700 ${isRestoringData ? 'animate-bounce' : ''}`} />
                  <span>{isRestoringData ? 'Memulihkan...' : 'Tarik Data dari Cloud'}</span>
                </button>
              </div>
            </div>
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

      {/* Restore Data Confirmation Modal */}
      <ConfirmModal
        isOpen={isRestoreConfirmOpen}
        onClose={() => setRestoreConfirmOpen(false)}
        onConfirm={handleConfirmRestore}
        title="Tarik & Pulihkan Data dari Cloud Firestore?"
        message="Data master produk, transaksi, pelanggan, dan piutang yang tersimpan di Cloud Firestore akan diunduh dan digabungkan ke penyimpanan IndexedDB lokal di perangkat ini."
        confirmText="Ya, Tarik Data"
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
